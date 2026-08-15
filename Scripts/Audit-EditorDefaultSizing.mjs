import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../LevelEditorApp/node_modules/three/build/three.module.js';

const root = path.resolve(import.meta.dirname, '..');
const exportRoot = path.join(root, 'Output', 'Exports', 'JETRUNNER');
const layout = JSON.parse(fs.readFileSync(path.join(root, 'LevelEditorApp/src/catalog-layout.json'), 'utf8'));
const visuals = JSON.parse(fs.readFileSync(path.join(root, 'LevelEditorApp/src/visual-manifest.json'), 'utf8')).assetVisuals || {};
const blueprint = JSON.parse(fs.readFileSync(path.join(root, 'Scripts/blueprint-runtime-sizing.json'), 'utf8'));
const mainSource = fs.readFileSync(path.join(root, 'LevelEditorApp/src/main.ts'), 'utf8');

function filesBelow(directory, extension) {
  const found = [];
  const pending = fs.existsSync(directory) ? [directory] : [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.name.toLowerCase().endsWith(extension)) found.push(file);
    }
  }
  return found;
}

function glbChunks(file) {
  const data = fs.readFileSync(file);
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2) return undefined;
  let json;
  let binary;
  for (let offset = 12; offset < data.length;) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(data.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    if (type === 0x004e4942) binary = data.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
  }
  return json ? { json, binary } : undefined;
}
function accessorBounds(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) return undefined;
  if (accessor.min && accessor.max) return { min: accessor.min, max: accessor.max };
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view || !binary || accessor.type !== 'VEC3') return undefined;
  const readers = {
    5120: { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset) },
    5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
    5122: { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset) },
    5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
    5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
    5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
  };
  const component = readers[accessor.componentType];
  if (!component) return undefined;
  const stride = view.byteStride || component.bytes * 3;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < accessor.count; vertex++) {
    const offset = start + vertex * stride;
    for (let axis = 0; axis < 3; axis++) {
      const value = component.read(binary, offset + axis * component.bytes);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return Number.isFinite(min[0]) ? { min, max } : undefined;
}
function nodeMatrix(node) {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale || [1, 1, 1]),
  );
}
function rawGlbBounds(file) {
  const chunks = glbChunks(file);
  const bounds = new THREE.Box3();
  if (!chunks) return undefined;
  const { json, binary } = chunks;
  const visit = (index, parent = new THREE.Matrix4()) => {
    const node = json.nodes[index];
    const world = parent.clone().multiply(nodeMatrix(node));
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives || []) {
      const accessor = accessorBounds(json, binary, primitive.attributes?.POSITION);
      if (!accessor) continue;
      for (const x of [accessor.min[0], accessor.max[0]]) for (const y of [accessor.min[1], accessor.max[1]])
        for (const z of [accessor.min[2], accessor.max[2]]) bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(world));
    }
    for (const child of node.children || []) visit(child, world);
  };
  for (const node of json.scenes?.[json.scene || 0]?.nodes || []) visit(node);
  return bounds.isEmpty() ? undefined : bounds;
}
function runtimeSize(file) {
  const bounds = rawGlbBounds(file);
  if (!bounds) return undefined;
  const size = bounds.getSize(new THREE.Vector3());
  return [size.x * 100, size.z * 100, size.y * 100];
}
function editorVisualSize(entry) {
  const sources = entry?.files || (entry?.file ? [entry.file] : []);
  const combined = new THREE.Box3();
  for (const source of sources) {
    const file = path.resolve(root, 'LevelEditorApp/public', source.replace(/^\.\//, ''));
    if (!fs.existsSync(file)) continue;
    const raw = rawGlbBounds(file);
    if (!raw) continue;
    const scale = entry.scale ?? 100;
    const scaleVector = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...(entry.position || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(entry.rotationDegrees || [0, 0, 0]).map(THREE.MathUtils.degToRad), 'ZYX')),
      scaleVector,
    ).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    for (const x of [raw.min.x, raw.max.x]) for (const y of [raw.min.y, raw.max.y])
      for (const z of [raw.min.z, raw.max.z]) combined.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
  }
  return combined.isEmpty() ? undefined : combined.getSize(new THREE.Vector3()).toArray();
}
function difference(runtime, editor) {
  if (!runtime || !editor) return undefined;
  return runtime.map((value, axis) => Math.abs(editor[axis] - value));
}
function matches(runtime, editor) {
  const delta = difference(runtime, editor);
  return delta?.every((value, axis) => value <= Math.max(1, runtime[axis] * 0.005));
}

const glbs = filesBelow(exportRoot, '.glb');
const byName = new Map();
for (const file of glbs) {
  const key = path.basename(file, '.glb').toLowerCase();
  for (const alias of new Set([key, key.replace(/^sm_/, '')])) {
    if (!byName.has(alias)) byName.set(alias, []);
    byName.get(alias).push(file);
  }
}
const blueprints = new Map(blueprint.records.map((record) => [record.assetId, record]));
// Several Peony packages reuse identical Unreal object names. The catalogue
// entries are the compact Sets/NewTemples variants; choosing only by basename
// silently selects the older, much larger legacy meshes.
const runtimePathHints = {
  static_temple_bottom_4x4_01: '/peony/sets/newtemples/',
  static_temple_3x6_bottom_01: '/peony/sets/newtemples/',
  static_temple_bottom_4x5: '/peony/sets/newtemples/',
};
const records = layout.map((asset) => {
  if (/^BP_/.test(asset.objectName)) {
    const evidence = blueprints.get(asset.assetId)?.runtimeLoader;
    const bounds = evidence?.assembledStaticMeshBoundsCm || evidence?.collisionBoundsCm;
    return {
      ...asset,
      kind: 'blueprint',
      runtimeSizeCm: bounds?.sizeCm,
      defaultComponentSizeCm: evidence?.defaultComponentBoundsCm?.sizeCm,
      editorCanonicalSource: evidence?.assembledStaticMeshBoundsCm ? 'extracted Blueprint component assembly' : undefined,
      status: evidence?.assembledStaticMeshBoundsCm ? 'authoritative-runtime-bounds-applied'
        : evidence?.hasConstructionScript ? 'manual-runtime-evaluation-required'
          : 'no-authoritative-visual-bounds',
    };
  }
  const objectKey = asset.objectName.trim().toLowerCase();
  const candidates = glbs.filter((file) => {
    const fileKey = path.basename(file, path.extname(file)).toLowerCase().replace(/^sm_/, '');
    return fileKey === objectKey
      || file.replaceAll('\\', '/').toLowerCase().endsWith(`/sm_${objectKey}.glb`);
  });
  const pathHint = runtimePathHints[asset.assetId];
  const runtimeFile = (pathHint
    ? candidates.find((file) => file.replaceAll('\\', '/').toLowerCase().includes(pathHint))
    : undefined) || candidates[0];
  const runtime = runtimeFile ? runtimeSize(runtimeFile) : undefined;
  const editor = editorVisualSize(visuals[asset.assetId]);
  const procedural = mainSource.includes(`const ${asset.assetId}`) || mainSource.includes(`assetDefinitions.${asset.assetId}`);
  return {
    ...asset,
    kind: 'static-mesh',
    runtimeGlb: runtimeFile ? path.relative(root, runtimeFile) : undefined,
    runtimeSizeCm: runtime,
    editorVisualSizeCm: editor,
    differenceCm: difference(runtime, editor),
    status: matches(runtime, editor) ? 'exact-exported-size'
      : runtimeFile && !runtime ? 'runtime-bounds-unavailable'
        : !runtime ? 'runtime-mesh-export-missing'
        : !editor && procedural ? 'procedural-override-manual-review'
          : !editor ? 'editor-visual-missing'
            : 'size-mismatch',
  };
});
const count = (status) => records.filter((record) => record.status === status).length;
const report = {
  generatedAt: new Date().toISOString(),
  exportRoot: path.relative(root, exportRoot),
  tolerance: 'max(1 cm, 0.5% per axis)',
  summary: {
    catalogueObjects: records.length,
    exactExportedStaticMeshes: count('exact-exported-size'),
    authoritativeBlueprintBoundsApplied: count('authoritative-runtime-bounds-applied'),
    sizeMismatches: count('size-mismatch'),
    manualRuntimeEvaluationRequired: count('manual-runtime-evaluation-required'),
    missingRuntimeMeshExports: count('runtime-mesh-export-missing'),
    exportedMeshesWithoutAccessorBounds: count('runtime-bounds-unavailable'),
    missingEditorVisuals: count('editor-visual-missing'),
    proceduralOverridesForReview: count('procedural-override-manual-review'),
  },
  records,
};
fs.writeFileSync(path.join(root, 'Scripts/editor-default-sizing-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
