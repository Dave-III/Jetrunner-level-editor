import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../LevelEditorApp/node_modules/three/build/three.module.js';

const root = path.resolve(import.meta.dirname, '..');
const fmodel = path.join(root, 'UAssetPipeline', 'Tools', 'FModel', 'Output', 'Exports', 'JETRUNNER');
const output = path.join(root, 'Scripts', 'adjustable-asset-dimensions.json');

const sources = [
  {
    assetIds: ['basekit_small_basewall', 'basekit_small_basewall_alt'],
    kind: 'mesh',
    file: path.join(fmodel, 'Plugins', 'GameFeatures', 'Flashback', 'Content', 'Maps', 'LevelKits', 'BaseKit', 'SM_BaseKit_Wall_01.glb'),
  },
  {
    assetIds: ['sky_platform', 'sky_platform_blue', 'sky_platform_gold', 'sky_platform_yellow'],
    kind: 'blueprint',
    file: path.join(fmodel, 'Content', 'Maps', 'Skypiercer', 'Environment', 'Props', 'SkyPlatform', 'BP_SkyPlatform.json'),
  },
];

function glbJson(file) {
  const data = fs.readFileSync(file);
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB: ${file}`);
  let offset = 12;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) return JSON.parse(data.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    offset += 8 + length;
  }
  throw new Error(`GLB has no JSON chunk: ${file}`);
}

function nodeMatrix(node) {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale || [1, 1, 1]),
  );
}

function meshBounds(file) {
  const json = glbJson(file);
  const bounds = new THREE.Box3();
  const visit = (index, parent = new THREE.Matrix4()) => {
    const node = json.nodes[index];
    const world = parent.clone().multiply(nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives || []) {
        const accessor = json.accessors[primitive.attributes?.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        const local = new THREE.Box3(
          new THREE.Vector3().fromArray(accessor.min),
          new THREE.Vector3().fromArray(accessor.max),
        );
        for (const x of [local.min.x, local.max.x]) for (const y of [local.min.y, local.max.y]) for (const z of [local.min.z, local.max.z]) {
          bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(world));
        }
      }
    }
    for (const child of node.children || []) visit(child, world);
  };
  const scene = json.scenes?.[json.scene || 0];
  for (const node of scene?.nodes || []) visit(node);
  const size = bounds.getSize(new THREE.Vector3());
  return { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() };
}

function blueprintMetrics(file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cdo = entries.find((entry) => entry.Name?.startsWith('Default__'))?.Properties || {};
  const collision = entries.filter((entry) => entry.Type === 'BoxComponent' && entry.Properties?.BoxExtent).map((entry) => ({
    component: entry.Name,
    extentCm: Object.values(entry.Properties.BoxExtent),
    fullSizeCm: Object.values(entry.Properties.BoxExtent).map((value) => Number(value) * 2),
    relativeLocationCm: entry.Properties.RelativeLocation || { X: 0, Y: 0, Z: 0 },
  }));
  const visibleComponents = entries.filter((entry) => /StaticMeshComponent$/.test(entry.Type) && entry.Properties?.StaticMesh).map((entry) => ({
    component: entry.Name,
    unrealMesh: entry.Properties.StaticMesh.ObjectPath,
    relativeLocationCm: entry.Properties.RelativeLocation || { X: 0, Y: 0, Z: 0 },
    relativeRotation: entry.Properties.RelativeRotation || { Pitch: 0, Yaw: 0, Roll: 0 },
    relativeScale: entry.Properties.RelativeScale3D || { X: 1, Y: 1, Z: 1 },
  }));
  return {
    constructionDefaults: Object.fromEntries(Object.entries(cdo).filter(([key]) => ['AnchorScale', 'SegmentsX', 'SegmentsY', 'EdgeLength', 'GutterMain'].includes(key))),
    collision,
    visibleComponents,
  };
}

const records = sources.map((source) => ({
  assetIds: source.assetIds,
  source: path.relative(root, source.file),
  sourceKind: source.kind,
  exactExtractedData: source.kind === 'mesh' ? { meshBoundsGlbUnits: meshBounds(source.file) } : blueprintMetrics(source.file),
  note: source.kind === 'mesh'
    ? 'Exact bounds of the canonical extracted mesh. Blueprint assemblies may add components beyond this mesh.'
    : 'Exact Blueprint defaults/components. Construction-script output must be evaluated to derive the final adjustable actor bounds.',
}));

fs.writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, output)} with ${records.length} authoritative source records.`);
