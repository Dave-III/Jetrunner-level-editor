#!/usr/bin/env python3
"""Convert FModel map JSON exports into compact JLE environment manifests.

The converter intentionally retains only visual mesh placement data.  Unreal
asset paths remain authoritative; ``preview`` paths are merely hints for the
Electron renderer and may point at GLBs which have not been exported yet.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import re
import shutil
import sys
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Iterator

LOG = logging.getLogger("jle.environment-converter")

MESH_COMPONENT_TYPES = {
    "StaticMeshComponent",
    "SplineMeshComponent",
    "InstancedStaticMeshComponent",
    "HierarchicalInstancedStaticMeshComponent",
    "FoliageInstancedStaticMeshComponent",
}
INSTANCE_COMPONENT_TYPES = {
    "InstancedStaticMeshComponent",
    "HierarchicalInstancedStaticMeshComponent",
    "FoliageInstancedStaticMeshComponent",
}
KNOWN_IGNORED_PATTERNS = re.compile(
    r"(?:BodySetup|Collision|Navigation|NavMesh|Niagara|Audio|Sound|Material|"
    r"Texture|Light|Reflection|World|Level|Model|Brush|SceneComponent|"
    r"LandscapeHeightfield|LandscapeTexture|SplineComponent|SplineSegment|"
    r"SplineControlPoint|PCG|Camera|Timeline|DataLayer|Partition|Physics|Chaos|"
    r"Billboard|Arrow|DrawSphere|Volume|Settings|Subsystem|Component|"
    r"StaticMeshActor|StaticMesh)$",
    re.IGNORECASE,
)


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def vec3(value: Any, default: tuple[float, float, float]) -> list[float]:
    if not isinstance(value, dict):
        return list(default)
    return [number(value.get(axis), default[index]) for index, axis in enumerate(("X", "Y", "Z"))]


def quat(value: Any) -> list[float] | None:
    if not isinstance(value, dict) or not all(axis in value for axis in ("X", "Y", "Z", "W")):
        return None
    result = [number(value[axis]) for axis in ("X", "Y", "Z", "W")]
    length = math.sqrt(sum(component * component for component in result))
    return [component / length for component in result] if length > 1e-8 else [0.0, 0.0, 0.0, 1.0]


def rotation(value: Any) -> list[float]:
    if not isinstance(value, dict):
        return [0.0, 0.0, 0.0]
    # FModel Rotators normally use Pitch/Yaw/Roll. Preserve editor-facing XYZ
    # as Roll/Pitch/Yaw while retaining the raw values on spline records.
    return [number(value.get("Roll")), number(value.get("Pitch")), number(value.get("Yaw"))]


def object_path(reference: Any) -> str | None:
    if not isinstance(reference, dict):
        return None
    path = reference.get("ObjectPath")
    return path if isinstance(path, str) and path else None


def canonical_unreal_path(reference: Any) -> str | None:
    """Turn an FModel object reference into an Unreal package path."""
    path = object_path(reference)
    if not path:
        return None
    path = re.sub(r"\.\d+$", "", path).replace("\\", "/")
    prefixes = (
        ("JETRUNNER/Content/", "/Game/"),
        ("JETRUNNER/Plugins/GameFeatures/Flashback/Content/", "/Flashback/"),
        ("JETRUNNER/Plugins/", "/Plugins/"),
    )
    for source, destination in prefixes:
        if path.startswith(source):
            return destination + path[len(source) :]
    return "/" + path.lstrip("/")


def mesh_key(unreal_path: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", PurePosixPath(unreal_path).name).strip("_") or "mesh"
    digest = hashlib.sha1(unreal_path.encode("utf-8")).hexdigest()[:8]
    return f"{base}__{digest}"


def transform_from_properties(properties: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "position": vec3(properties.get("RelativeLocation"), (0.0, 0.0, 0.0)),
        "rotation": rotation(properties.get("RelativeRotation")),
        "scale": vec3(properties.get("RelativeScale3D"), (1.0, 1.0, 1.0)),
    }
    q = quat(properties.get("RelativeRotation"))
    if q:
        result["quaternion"] = q
    return result


def multiply_quaternions(a: list[float], b: list[float]) -> list[float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def euler_quaternion(degrees: list[float]) -> list[float]:
    # Unreal Rotator: roll X, pitch Y, yaw Z.
    x, y, z = (math.radians(component) * 0.5 for component in degrees)
    sx, cx, sy, cy, sz, cz = math.sin(x), math.cos(x), math.sin(y), math.cos(y), math.sin(z), math.cos(z)
    return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz]


def rotate_vector(vector: list[float], quaternion: list[float]) -> list[float]:
    qx, qy, qz, qw = quaternion
    vx, vy, vz = vector
    tx, ty, tz = 2 * (qy * vz - qz * vy), 2 * (qz * vx - qx * vz), 2 * (qx * vy - qy * vx)
    return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx]


def combine_transforms(parent: dict[str, Any], child: dict[str, Any]) -> dict[str, Any]:
    parent_q = parent.get("quaternion") or euler_quaternion(parent["rotation"])
    child_q = child.get("quaternion") or euler_quaternion(child["rotation"])
    scaled = [child["position"][i] * parent["scale"][i] for i in range(3)]
    rotated = rotate_vector(scaled, parent_q)
    result = {
        "position": [parent["position"][i] + rotated[i] for i in range(3)],
        "rotation": child["rotation"],
        "quaternion": multiply_quaternions(parent_q, child_q),
        "scale": [parent["scale"][i] * child["scale"][i] for i in range(3)],
    }
    return result


@dataclass
class EnvironmentResult:
    environment: str
    source: str
    raw_entries: int
    assets: dict[str, dict[str, Any]] = field(default_factory=dict)
    instances: dict[str, list[dict[str, Any]]] = field(default_factory=lambda: defaultdict(list))
    foliage: dict[str, list[dict[str, Any]]] = field(default_factory=lambda: defaultdict(list))
    splines: list[dict[str, Any]] = field(default_factory=list)
    landscapes: list[dict[str, Any]] = field(default_factory=list)
    ignored_entries: int = 0
    unresolved_visible_components: int = 0

    def register_mesh(self, unreal_path: str) -> str:
        key = mesh_key(unreal_path)
        self.assets.setdefault(key, {
            "unrealPath": unreal_path,
            "preview": f"./meshes/{key}.glb",
        })
        return key

    def serializable(self) -> dict[str, Any]:
        visible = sum(map(len, self.instances.values())) + sum(map(len, self.foliage.values())) + len(self.splines)
        return {
            "schemaVersion": 1,
            "environment": self.environment,
            "source": self.source,
            "coordinateSystem": "Unreal Z-up, left-handed",
            "units": "centimeters",
            "assets": dict(sorted(self.assets.items())),
            "instances": {key: value for key, value in sorted(self.instances.items())},
            "foliage": {key: value for key, value in sorted(self.foliage.items())},
            "splines": self.splines,
            "landscapes": self.landscapes,
            "stats": {
                "rawEntries": self.raw_entries,
                "visibleObjects": visible,
                "uniqueMeshes": len(self.assets),
                "splineObjects": len(self.splines),
                "foliageInstances": sum(map(len, self.foliage.values())),
                "ignoredEntries": self.ignored_entries,
                "unresolvedVisibleComponents": self.unresolved_visible_components,
            },
        }


class EnvironmentExtractor:
    def __init__(
        self,
        source_name: str,
        entries: list[dict[str, Any]],
        dependency_entries: dict[str, dict[str, Any]] | None = None,
    ):
        self.source_name = source_name
        self.entries = entries
        self.dependency_entries = dependency_entries or {}
        self.entry_paths: dict[int, str] = {}
        self.by_path = {object_path(entry): entry for entry in entries if object_path(entry)}
        # FModel map exports commonly omit ObjectPath on the export entry
        # itself. References elsewhere in the same file still use the package
        # path plus the numeric export index (for example ``...Map.161``).
        # Recover those aliases so AttachParent chains can be composed instead
        # of silently collapsing every Blueprint component onto the origin.
        def register_indexed_references(value: Any) -> None:
            if isinstance(value, dict):
                referenced_path = object_path(value)
                if referenced_path:
                    match = re.search(r"\.(\d+)$", referenced_path)
                    if match:
                        index = int(match.group(1))
                        if 0 <= index < len(entries):
                            self.by_path[referenced_path] = entries[index]
                            self.entry_paths.setdefault(id(entries[index]), referenced_path)
                for nested in value.values():
                    register_indexed_references(nested)
            elif isinstance(value, list):
                for nested in value:
                    register_indexed_references(nested)

        for entry in entries:
            register_indexed_references(entry)
        self.world_transform_cache: dict[str, dict[str, Any]] = {}
        self.unknown_types: Counter[str] = Counter()
        self.result = EnvironmentResult(Path(source_name).stem, source_name, len(entries))

    def effective_properties(self, entry: dict[str, Any]) -> dict[str, Any]:
        """Merge inherited Blueprint component defaults with map overrides.

        FModel map exports commonly omit ``StaticMesh`` and default relative
        transforms on Blueprint-owned components. Their exact ``Template``
        export retains those values in the Blueprint package JSON.
        """
        local = entry.get("Properties") if isinstance(entry.get("Properties"), dict) else {}
        template_path = object_path(entry.get("Template") or local.get("Template"))
        template = self.dependency_entries.get(template_path) if template_path else None
        inherited = template.get("Properties") if isinstance(template, dict) else None
        if not isinstance(inherited, dict):
            return local
        return {**inherited, **local}

    def world_transform(self, entry: dict[str, Any], seen: set[str] | None = None) -> dict[str, Any]:
        path = object_path(entry) or self.entry_paths.get(id(entry))
        if path and path in self.world_transform_cache:
            return self.world_transform_cache[path]
        properties = self.effective_properties(entry)
        local = transform_from_properties(properties)
        parent_path = object_path(
            properties.get("AttachParent")
            or properties.get("ParentComponent")
            or entry.get("ParentComponent")
        )
        seen = set() if seen is None else seen
        if parent_path and parent_path in self.by_path and parent_path not in seen:
            seen.add(parent_path)
            local = combine_transforms(self.world_transform(self.by_path[parent_path], seen), local)
        if path:
            self.world_transform_cache[path] = local
        return local

    def instance_transform(self, raw: dict[str, Any], component: dict[str, Any]) -> dict[str, Any] | None:
        data = raw.get("TransformData") if isinstance(raw, dict) else None
        if not isinstance(data, dict):
            return None
        local = {
            "position": vec3(data.get("Translation"), (0.0, 0.0, 0.0)),
            "rotation": [0.0, 0.0, 0.0],
            "scale": vec3(data.get("Scale3D"), (1.0, 1.0, 1.0)),
        }
        q = quat(data.get("Rotation"))
        if q:
            local["quaternion"] = q
        return combine_transforms(self.world_transform(component), local)

    def extract_mesh_component(self, entry: dict[str, Any]) -> bool:
        properties = self.effective_properties(entry)
        if properties.get("bVisible") is False or properties.get("bHiddenInGame") is True:
            return False
        unreal_path = canonical_unreal_path(properties.get("StaticMesh"))
        if not unreal_path:
            self.result.unresolved_visible_components += 1
            return False
        key = self.result.register_mesh(unreal_path)
        kind = str(entry.get("Type"))
        if kind == "SplineMeshComponent":
            params = properties.get("SplineParams") if isinstance(properties.get("SplineParams"), dict) else {}
            self.result.splines.append({
                "asset": key,
                "name": entry.get("Name"),
                "transform": self.world_transform(entry),
                "forwardAxis": properties.get("ForwardAxis"),
                "start": {
                    "position": vec3(params.get("StartPos"), (0.0, 0.0, 0.0)),
                    "tangent": vec3(params.get("StartTangent"), (0.0, 0.0, 0.0)),
                    "scale": [number((params.get("StartScale") or {}).get(axis), 1.0) for axis in ("X", "Y")],
                    "roll": number(params.get("StartRoll")),
                },
                "end": {
                    "position": vec3(params.get("EndPos"), (0.0, 0.0, 0.0)),
                    "tangent": vec3(params.get("EndTangent"), (0.0, 0.0, 0.0)),
                    "scale": [number((params.get("EndScale") or {}).get(axis), 1.0) for axis in ("X", "Y")],
                    "roll": number(params.get("EndRoll")),
                },
            })
            return True
        if kind in INSTANCE_COMPONENT_TYPES:
            destination = self.result.foliage if kind == "FoliageInstancedStaticMeshComponent" else self.result.instances
            for raw in entry.get("PerInstanceSMData") or []:
                transform = self.instance_transform(raw, entry)
                if transform:
                    destination[key].append(transform)
            return True
        self.result.instances[key].append(self.world_transform(entry))
        return True

    def extract_landscape(self, entry: dict[str, Any]) -> None:
        properties = entry.get("Properties") if isinstance(entry.get("Properties"), dict) else {}
        components = properties.get("LandscapeComponents") or []
        self.result.landscapes.append({
            "name": entry.get("Name"),
            "guid": properties.get("LandscapeGuid"),
            "material": canonical_unreal_path(properties.get("LandscapeMaterial")),
            "transform": self.world_transform(entry),
            "componentCount": len(components),
            "components": [object_path(component) for component in components if object_path(component)],
        })

    def run(self) -> EnvironmentResult:
        for entry in self.entries:
            if not isinstance(entry, dict):
                self.result.ignored_entries += 1
                continue
            kind = str(entry.get("Type") or "<unknown>")
            if kind in MESH_COMPONENT_TYPES:
                if not self.extract_mesh_component(entry):
                    self.result.ignored_entries += 1
            elif kind == "Landscape":
                self.extract_landscape(entry)
            else:
                self.result.ignored_entries += 1
                # Blueprint actors are handled through their exported component
                # objects. Warn only for unfamiliar component-like types.
                if ("Component" in kind or "Mesh" in kind) and not KNOWN_IGNORED_PATTERNS.search(kind):
                    self.unknown_types[kind] += 1
        for kind, count in self.unknown_types.items():
            LOG.warning("%s: unknown FModel object type %s (%d entries)", self.source_name, kind, count)
        return self.result


def iter_json_inputs(source: Path) -> Iterator[tuple[str, Any]]:
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            for name in sorted(item for item in archive.namelist() if item.lower().endswith(".json")):
                with archive.open(name) as stream:
                    yield name, json.load(stream)
        return
    if source.is_file():
        with source.open("r", encoding="utf-8-sig") as stream:
            yield source.name, json.load(stream)
        return
    for path in sorted(source.rglob("*.json")):
        with path.open("r", encoding="utf-8-sig") as stream:
            yield path.relative_to(source).as_posix(), json.load(stream)


def load_dependency_entries(source: Path | None) -> dict[str, dict[str, Any]]:
    """Index exact FModel package export indices for Blueprint inheritance."""
    if source is None:
        return {}
    indexed: dict[str, dict[str, Any]] = {}
    package_count = 0
    for source_name, raw in iter_json_inputs(source):
        try:
            entries = extract_entry_list(raw, source_name)
        except ValueError:
            continue
        package = next(
            (
                entry.get("Package")
                for entry in entries
                if isinstance(entry, dict) and isinstance(entry.get("Package"), str)
            ),
            None,
        )
        if not package:
            continue
        package_count += 1
        for index, entry in enumerate(entries):
            if isinstance(entry, dict):
                indexed[f"{package}.{index}"] = entry
    LOG.info("Indexed %d Blueprint dependency exports from %d packages", len(indexed), package_count)
    return indexed


def extract_entry_list(raw: Any, source_name: str) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("Exports", "exports", "Objects", "objects"):
            if isinstance(raw.get(key), list):
                return raw[key]
    raise ValueError(f"{source_name}: expected a top-level array or Exports/Objects array")


def write_json(path: Path, value: Any, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(
        value,
        indent=None if compact else 2,
        separators=(",", ":") if compact else None,
        ensure_ascii=False,
    )
    path.write_text(rendered + "\n", encoding="utf-8")


def fmodel_preview_path(mesh_library: Path, unreal_path: str) -> Path:
    mappings = (
        ("/Game/", Path("JETRUNNER/Content")),
        ("/Flashback/", Path("JETRUNNER/Plugins/GameFeatures/Flashback/Content")),
        ("/Engine/", Path("Engine")),
        ("/Plugins/", Path()),
    )
    for prefix, relative_root in mappings:
        if unreal_path.startswith(prefix):
            return (mesh_library / relative_root / unreal_path[len(prefix) :]).with_suffix(".glb")
    return (mesh_library / unreal_path.lstrip("/")).with_suffix(".glb")


def materialize_preview(source: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file():
        return "existing"
    try:
        os.link(source, destination)
        return "linked"
    except OSError:
        # Cross-volume exports cannot be hard-linked. Copy only in that case;
        # the common in-repository FModel layout consumes no duplicate blocks.
        shutil.copy2(source, destination)
        return "copied"


def convert(
    source: Path,
    output: Path,
    mesh_library: Path | None = None,
    dependency_library: Path | None = None,
) -> int:
    global_assets: dict[str, dict[str, Any]] = {}
    summaries: list[dict[str, Any]] = []
    preview_actions: Counter[str] = Counter()
    dependency_entries = load_dependency_entries(dependency_library)
    for source_name, raw in iter_json_inputs(source):
        try:
            entries = extract_entry_list(raw, source_name)
            LOG.info("Processing %s (%d raw entries)", source_name, len(entries))
            result = EnvironmentExtractor(source_name, entries, dependency_entries).run()
            for asset in result.assets.values():
                preview = str(asset["preview"]).removeprefix("./")
                preview_path = output / preview
                if mesh_library:
                    source_preview = fmodel_preview_path(mesh_library, str(asset["unrealPath"]))
                    if source_preview.is_file():
                        preview_actions[materialize_preview(source_preview, preview_path)] += 1
                    else:
                        preview_actions["missing"] += 1
                        LOG.warning("Missing preview GLB for %s (expected %s)", asset["unrealPath"], source_preview)
                asset["previewAvailable"] = preview_path.is_file()
            destination = output / f"{result.environment}.json"
            write_json(destination, result.serializable(), compact=True)
            for key, asset in result.assets.items():
                record = global_assets.setdefault(key, {**asset, "environments": []})
                if result.environment not in record["environments"]:
                    record["environments"].append(result.environment)
            stats = result.serializable()["stats"]
            summaries.append(stats)
            LOG.info(
                "Extracted %d visible objects, %d unique meshes, %d splines, %d foliage instances; ignored %d",
                stats["visibleObjects"], stats["uniqueMeshes"], stats["splineObjects"],
                stats["foliageInstances"], stats["ignoredEntries"],
            )
        except Exception as error:  # continue converting independent maps
            LOG.error("Failed to convert %s: %s", source_name, error)
    required = {
        "schemaVersion": 1,
        "meshCount": len(global_assets),
        "assets": dict(sorted(global_assets.items())),
    }
    write_json(output / "required_meshes.json", required)
    totals = {
        "environments": len(summaries),
        "rawEntries": sum(item["rawEntries"] for item in summaries),
        "visibleObjects": sum(item["visibleObjects"] for item in summaries),
        "uniqueMeshes": len(global_assets),
        "splineObjects": sum(item["splineObjects"] for item in summaries),
        "foliageInstances": sum(item["foliageInstances"] for item in summaries),
        "ignoredEntries": sum(item["ignoredEntries"] for item in summaries),
    }
    LOG.info("Summary: %s", ", ".join(f"{key}={value}" for key, value in totals.items()))
    if mesh_library:
        LOG.info("Preview library: %s", ", ".join(f"{key}={value}" for key, value in sorted(preview_actions.items())))
    return 0 if summaries else 1


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="FModel JSON file/directory or a zip containing JSON exports")
    parser.add_argument("--output", "-o", type=Path, default=Path("ConvertedEnvironments"))
    parser.add_argument(
        "--mesh-library",
        type=Path,
        help="FModel Exports root; matching GLBs are hard-linked into output/meshes when possible",
    )
    parser.add_argument(
        "--dependency-library",
        type=Path,
        help="FModel JSON export root used to resolve Blueprint component templates",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")
    if not args.source.exists():
        parser.error(f"source does not exist: {args.source}")
    if args.mesh_library and not args.mesh_library.is_dir():
        parser.error(f"mesh library does not exist: {args.mesh_library}")
    if args.dependency_library and not args.dependency_library.is_dir():
        parser.error(f"dependency library does not exist: {args.dependency_library}")
    return convert(args.source, args.output, args.mesh_library, args.dependency_library)


if __name__ == "__main__":
    sys.exit(main())
