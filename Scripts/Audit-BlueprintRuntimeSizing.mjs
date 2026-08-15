import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from '../LevelEditorApp/node_modules/three/build/three.module.js';

const root = path.resolve(import.meta.dirname, '..');
const freshExportRoot = path.join(root, 'Output', 'Exports', 'JETRUNNER');
const exportRoot = fs.existsSync(freshExportRoot)
  ? freshExportRoot
  : path.join(root, 'UAssetPipeline', 'Tools', 'FModel', 'Output', 'Exports', 'JETRUNNER');
const layoutPath = path.join(root, 'LevelEditorApp', 'src', 'catalog-layout.json');
const outputPath = path.join(root, 'Scripts', 'blueprint-runtime-sizing.json');
const exportListPath = path.join(root, 'Scripts', 'blueprint-export-required.txt');
const assemblyPath = path.join(root, 'LevelEditorApp', 'src', 'blueprint-visual-assemblies.json');
const assemblyAssetDirectory = path.join(root, 'LevelEditorApp', 'public', 'asset-visuals', 'blueprint-components');

const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const blueprintAssets = layout.filter(({ objectName }) => /^BP_/.test(objectName));

function filesBelow(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.name.toLowerCase().endsWith(extension)) result.push(file);
    }
  }
  return result;
}

function xyz(value, fallback = 0) {
  return ['X', 'Y', 'Z'].map((axis) => Number(value?.[axis] ?? fallback));
}

function glbJson(file) {
  const data = fs.readFileSync(file);
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2) return undefined;
  let offset = 12;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) return JSON.parse(data.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    offset += 8 + length;
  }
  return undefined;
}

function nodeMatrix(node) {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale || [1, 1, 1]),
  );
}

function glbBoundsCm(file) {
  const json = glbJson(file);
  if (!json) return undefined;
  const glbBounds = new THREE.Box3();
  const visit = (index, parent = new THREE.Matrix4()) => {
    const node = json.nodes[index];
    const world = parent.clone().multiply(nodeMatrix(node));
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives || []) {
      const accessor = json.accessors[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) continue;
      for (const x of [accessor.min[0], accessor.max[0]])
        for (const y of [accessor.min[1], accessor.max[1]])
          for (const z of [accessor.min[2], accessor.max[2]])
            glbBounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(world));
    }
    for (const child of node.children || []) visit(child, world);
  };
  for (const node of json.scenes?.[json.scene || 0]?.nodes || []) visit(node);
  if (glbBounds.isEmpty()) return undefined;
  // FModel GLBs are metres and Y-up. Convert to Unreal centimetres and Z-up.
  const unreal = new THREE.Box3();
  for (const x of [glbBounds.min.x, glbBounds.max.x])
    for (const y of [glbBounds.min.y, glbBounds.max.y])
      for (const z of [glbBounds.min.z, glbBounds.max.z])
        unreal.expandByPoint(new THREE.Vector3(x * 100, -z * 100, y * 100));
  return unreal;
}

const exportedGlbs = filesBelow(exportRoot, '.glb');
const glbsByObjectName = new Map();
for (const file of exportedGlbs) {
  const key = path.basename(file, path.extname(file)).toLowerCase();
  const candidates = glbsByObjectName.get(key) || [];
  candidates.push(file);
  glbsByObjectName.set(key, candidates);
}
const glbBoundsCache = new Map();

function resolveComponentMesh(objectPath, blueprintFile) {
  const packagePath = objectPath.replace(/\.\d+$/, '');
  const objectName = path.posix.basename(packagePath).toLowerCase();
  const candidates = glbsByObjectName.get(objectName) || [];
  if (!candidates.length) return undefined;
  const packageParts = packagePath.toLowerCase().split('/');
  const score = (file) => {
    const normalized = file.replaceAll('\\', '/').toLowerCase();
    return packageParts.reduce((total, part) => total + (normalized.includes(`/${part}/`) || normalized.endsWith(`/${part}.glb`) ? 1 : 0), 0)
      + (path.dirname(file) === path.dirname(blueprintFile) ? 100 : 0);
  };
  return candidates.toSorted((left, right) => score(right) - score(left))[0];
}

function componentAssemblyBounds(components) {
  const assembly = new THREE.Box3();
  for (const component of components) {
    if ((!component.resolvedGlb && !component.enginePrimitive) || component.relativeScale.some((value) => Math.abs(value) < 0.000001)) continue;
    let local = component.enginePrimitive
      ? new THREE.Box3(new THREE.Vector3(-50, -50, component.enginePrimitive === 'plane' ? -0.01 : -50), new THREE.Vector3(50, 50, component.enginePrimitive === 'plane' ? 0.01 : 50))
      : glbBoundsCache.get(component.resolvedGlb);
    if (!component.enginePrimitive && local === undefined) {
      local = glbBoundsCm(component.resolvedGlb) || null;
      glbBoundsCache.set(component.resolvedGlb, local);
    }
    if (!local) continue;
    const matrix = component.assemblyMatrix
      ? new THREE.Matrix4().fromArray(component.assemblyMatrix)
      : new THREE.Matrix4().compose(
        new THREE.Vector3(...component.relativeLocationCm),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...component.relativeRotationDegrees.map(THREE.MathUtils.degToRad), 'ZYX')),
        new THREE.Vector3(...component.relativeScale),
      );
    for (const x of [local.min.x, local.max.x])
      for (const y of [local.min.y, local.max.y])
        for (const z of [local.min.z, local.max.z])
          assembly.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
  }
  if (assembly.isEmpty()) return undefined;
  return {
    minCm: assembly.min.toArray(),
    maxCm: assembly.max.toArray(),
    sizeCm: assembly.getSize(new THREE.Vector3()).toArray(),
  };
}

function collisionBounds(entries) {
  const boxes = entries.filter((entry) => entry.Type === 'BoxComponent' && entry.Properties?.BoxExtent);
  if (!boxes.length) return undefined;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    const center = xyz(box.Properties.RelativeLocation);
    const extent = xyz(box.Properties.BoxExtent);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], center[axis] - extent[axis]);
      max[axis] = Math.max(max[axis], center[axis] + extent[axis]);
    }
  }
  return { minCm: min, maxCm: max, sizeCm: max.map((value, axis) => value - min[axis]) };
}

function inspectBlueprint(file, entries, generatedClass) {
  const cdo = entries.find((entry) => entry.Name?.startsWith('Default__'));
  const constructionFunction = entries.find((entry) => entry.Type === 'Function' && entry.Name === 'UserConstructionScript');
  const componentEntries = new Map(entries
    .filter((entry) => /(?:Scene|StaticMesh|InstancedStaticMesh)Component$/.test(entry.Type))
    .map((entry) => [entry.Name, entry]));
  const scsNodes = entries.filter((entry) => entry.Type === 'SCS_Node');
  const nodeByName = new Map(scsNodes.map((node) => [node.Name, node]));
  const templateNameByNode = new Map(scsNodes.map((node) => {
    const objectName = node.Properties?.ComponentTemplate?.ObjectName || '';
    return [node.Name, /:([^']+)'$/.exec(objectName)?.[1]];
  }));
  const nodeByTemplateName = new Map([...templateNameByNode.entries()].map(([nodeName, templateName]) => [templateName, nodeName]));
  const parentNode = new Map();
  for (const node of scsNodes) for (const child of node.Properties?.ChildNodes || []) {
    const childName = /(?:\.|:)(SCS_Node[^']*)'$/.exec(child.ObjectName || '')?.[1];
    if (childName) parentNode.set(childName, node.Name);
  }
  function localComponentMatrix(componentEntry) {
    const location = xyz(componentEntry?.Properties?.RelativeLocation);
    const rotation = [
      Number(componentEntry?.Properties?.RelativeRotation?.Roll ?? 0),
      Number(componentEntry?.Properties?.RelativeRotation?.Pitch ?? 0),
      Number(componentEntry?.Properties?.RelativeRotation?.Yaw ?? 0),
    ].map(THREE.MathUtils.degToRad);
    return new THREE.Matrix4().compose(
      new THREE.Vector3(...location),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'ZYX')),
      new THREE.Vector3(...xyz(componentEntry?.Properties?.RelativeScale3D, 1)),
    );
  }
  const nodeWorldMatrixCache = new Map();
  function nodeWorldMatrix(nodeName, visiting = new Set()) {
    if (nodeWorldMatrixCache.has(nodeName)) return nodeWorldMatrixCache.get(nodeName).clone();
    if (visiting.has(nodeName)) return new THREE.Matrix4();
    visiting.add(nodeName);
    const templateName = templateNameByNode.get(nodeName);
    const local = localComponentMatrix(componentEntries.get(templateName));
    const parentName = parentNode.get(nodeName);
    const world = parentName ? nodeWorldMatrix(parentName, visiting).multiply(local) : local;
    nodeWorldMatrixCache.set(nodeName, world.clone());
    visiting.delete(nodeName);
    return world;
  }
  const visibleComponents = entries
    .filter((entry) => /(?:StaticMesh|InstancedStaticMesh)Component$/.test(entry.Type) && entry.Properties?.StaticMesh)
    .map((entry) => {
      const resolvedGlb = resolveComponentMesh(entry.Properties.StaticMesh.ObjectPath, file);
      const enginePrimitiveMatch = /^Engine\/Content\/BasicShapes\/(Cube|Cylinder|Plane)\.\d+$/i.exec(entry.Properties.StaticMesh.ObjectPath);
      return ({
      component: entry.Name,
      type: entry.Type,
      meshObjectPath: entry.Properties.StaticMesh.ObjectPath,
      relativeLocationCm: xyz(entry.Properties.RelativeLocation),
      relativeRotationDegrees: [
        Number(entry.Properties.RelativeRotation?.Roll ?? 0),
        Number(entry.Properties.RelativeRotation?.Pitch ?? 0),
        Number(entry.Properties.RelativeRotation?.Yaw ?? 0),
      ],
      relativeScale: xyz(entry.Properties.RelativeScale3D, 1),
      resolvedGlb: resolvedGlb ? path.relative(root, resolvedGlb) : undefined,
      enginePrimitive: enginePrimitiveMatch?.[1].toLowerCase(),
      assemblyMatrix: nodeByTemplateName.has(entry.Name)
        ? nodeWorldMatrix(nodeByTemplateName.get(entry.Name)).toArray()
        : localComponentMatrix(entry).toArray(),
    }); });
  if (generatedClass.Name === 'BP_Basekit_Smol_Basewall_C' || generatedClass.Name === 'BP_Basekit_Smol_Basewall1_C') {
    for (const component of visibleComponents) {
      if (/Pillar/i.test(component.component)) {
        const [roll, pitch, yaw] = component.relativeRotationDegrees.map(THREE.MathUtils.degToRad);
        component.assemblyMatrix = new THREE.Matrix4().compose(
          new THREE.Vector3(component.relativeLocationCm[0], component.relativeLocationCm[1], component.relativeLocationCm[2] + 450),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, pitch, yaw, 'ZYX')),
          new THREE.Vector3(...component.relativeScale),
        ).toArray();
      } else if (/Ledge/i.test(component.component)) {
        component.assemblyMatrix = new THREE.Matrix4().makeTranslation(-200, 0, 0)
          .multiply(new THREE.Matrix4().fromArray(component.assemblyMatrix)).toArray();
      }
    }
  }
  const assembledBounds = componentAssemblyBounds(visibleComponents.map((component) => ({
    ...component,
    resolvedGlb: component.resolvedGlb ? path.join(root, component.resolvedGlb) : undefined,
  })));
  const resolvedMeshComponents = visibleComponents.filter((component) => component.resolvedGlb || component.enginePrimitive).length;
  return {
    source: path.relative(root, file),
    package: generatedClass.Package,
    generatedClass: generatedClass.Name,
    softClassPath: generatedClass.Package && generatedClass.Name
      ? `${generatedClass.Package}.${generatedClass.Name}`
      : undefined,
    parentClass: generatedClass.SuperStruct?.ObjectName,
    hasConstructionScript: Boolean(constructionFunction),
    constructionDefaults: cdo?.Properties ?? {},
    collisionBoundsCm: collisionBounds(entries),
    defaultComponentBoundsCm: assembledBounds,
    assembledStaticMeshBoundsCm: constructionFunction ? undefined : assembledBounds,
    visibleComponents,
    meshTrace: {
      referencedComponents: visibleComponents.length,
      resolvedComponents: resolvedMeshComponents,
      unresolvedComponents: visibleComponents.length - resolvedMeshComponents,
    },
    sizingConfidence: constructionFunction
      ? 'component-defaults-only-construction-script-requires-evaluation'
      : visibleComponents.length ? 'static-component-transforms-extracted' : 'class-defaults-only',
  };
}

const extractedBlueprints = new Map();
for (const file of filesBelow(exportRoot, '.json')) {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  if (!Array.isArray(entries)) continue;
  for (const entry of entries) {
    if (entry.Type !== 'BlueprintGeneratedClass' || !entry.Name?.endsWith('_C')) continue;
    extractedBlueprints.set(entry.Name.slice(0, -2), inspectBlueprint(file, entries, entry));
  }
}

function inheritedBlueprintName(parentClass) {
  const match = /BlueprintGeneratedClass'([^']+)_C'/.exec(parentClass || '');
  return match?.[1];
}
function applyInheritedRuntimeData(name, visiting = new Set()) {
  const loader = extractedBlueprints.get(name);
  if (!loader || visiting.has(name)) return loader;
  visiting.add(name);
  const parentName = inheritedBlueprintName(loader.parentClass);
  const parent = parentName ? applyInheritedRuntimeData(parentName, visiting) : undefined;
  if (parent) {
    loader.constructionDefaults = { ...parent.constructionDefaults, ...loader.constructionDefaults };
    if (!loader.visibleComponents.length && parent.visibleComponents.length) {
      loader.visibleComponents = parent.visibleComponents.map((component) => ({ ...component }));
      loader.defaultComponentBoundsCm = parent.defaultComponentBoundsCm;
      loader.assembledStaticMeshBoundsCm = parent.assembledStaticMeshBoundsCm;
      loader.meshTrace = { ...parent.meshTrace };
      loader.inheritedVisualsFrom = parentName;
    }
    if (parent.hasConstructionScript) {
      loader.hasConstructionScript = true;
      loader.sizingConfidence = 'component-defaults-only-construction-script-requires-evaluation';
      delete loader.assembledStaticMeshBoundsCm;
    }
  }
  if (loader.hasConstructionScript) delete loader.assembledStaticMeshBoundsCm;
  visiting.delete(name);
  return loader;
}
for (const name of extractedBlueprints.keys()) applyInheritedRuntimeData(name);

const records = blueprintAssets.map((asset) => {
  const loader = extractedBlueprints.get(asset.objectName);
  return {
    assetId: asset.assetId,
    label: asset.label,
    runtimeObjectName: asset.objectName,
    runtimeLoader: {
      generatedClassName: `${asset.objectName}_C`,
      status: loader ? 'extracted' : 'export-required',
      ...(loader ?? {}),
    },
  };
});
const missingRuntimeObjects = [...new Set(records
  .filter((record) => record.runtimeLoader.status === 'export-required')
  .map((record) => record.runtimeObjectName))].sort();
const report = {
  generatedAt: new Date().toISOString(),
  purpose: 'Authoritative Blueprint runtime-loader inventory and sizing evidence. Collision bounds are exact defaults; construction-script actors require evaluation before final visual bounds are authoritative.',
  summary: {
    blueprintCatalogueAssets: records.length,
    extractedRuntimeClasses: records.length - missingRuntimeObjects.length,
    exportRequiredRuntimeClasses: missingRuntimeObjects.length,
    exportedGlbs: exportedGlbs.length,
    referencedMeshComponents: records.reduce((sum, record) => sum + (record.runtimeLoader.meshTrace?.referencedComponents ?? 0), 0),
    resolvedMeshComponents: records.reduce((sum, record) => sum + (record.runtimeLoader.meshTrace?.resolvedComponents ?? 0), 0),
    actorsWithAuthoritativeStaticMeshBounds: records.filter((record) => !record.runtimeLoader.hasConstructionScript && record.runtimeLoader.assembledStaticMeshBoundsCm).length,
  },
  missingRuntimeObjects,
  records,
};

fs.mkdirSync(assemblyAssetDirectory, { recursive: true });
const copiedComponents = new Map();
function publicComponentFile(sourceRelative) {
  if (copiedComponents.has(sourceRelative)) return copiedComponents.get(sourceRelative);
  const source = path.join(root, sourceRelative);
  const hash = crypto.createHash('sha256').update(sourceRelative).digest('hex').slice(0, 10);
  const stem = path.basename(source, path.extname(source)).replace(/[^A-Za-z0-9_-]+/g, '_');
  const fileName = `${stem}_${hash}.glb`;
  fs.copyFileSync(source, path.join(assemblyAssetDirectory, fileName));
  const publicPath = `./asset-visuals/blueprint-components/${fileName}`;
  copiedComponents.set(sourceRelative, publicPath);
  return publicPath;
}
const assemblies = {};
const unrealToEditorBasis = new THREE.Matrix4().makeScale(1, -1, 1);
function editorComponentMatrix(unrealMatrix) {
  return unrealToEditorBasis.clone()
    .multiply(new THREE.Matrix4().fromArray(unrealMatrix))
    .multiply(unrealToEditorBasis)
    .toArray();
}
for (const record of records) {
  const loader = record.runtimeLoader;
  if (loader.status !== 'extracted' || loader.hasConstructionScript || !loader.assembledStaticMeshBoundsCm) continue;
  const components = loader.visibleComponents
    .filter((component) => (component.resolvedGlb || component.enginePrimitive) && component.relativeScale.every((value) => Math.abs(value) > 0.000001))
    .map((component) => ({
      ...(component.resolvedGlb ? { file: publicComponentFile(component.resolvedGlb) } : { primitive: component.enginePrimitive }),
      matrix: editorComponentMatrix(component.assemblyMatrix),
      positionCm: component.relativeLocationCm,
      rotationDegrees: component.relativeRotationDegrees,
      scale: component.relativeScale,
    }));
  if (!components.length) continue;
  assemblies[record.assetId] = {
    runtimeObjectName: record.runtimeObjectName,
    boundsCm: loader.assembledStaticMeshBoundsCm,
    components,
  };
}
const retainedComponentFiles = new Set([...copiedComponents.values()].map((file) => path.basename(file)));
for (const file of fs.readdirSync(assemblyAssetDirectory)) {
  if (file.toLowerCase().endsWith('.glb') && !retainedComponentFiles.has(file)) {
    fs.rmSync(path.join(assemblyAssetDirectory, file));
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(exportListPath, `${missingRuntimeObjects.join('\n')}\n`);
fs.writeFileSync(assemblyPath, `${JSON.stringify({ assemblies }, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Wrote ${path.relative(root, outputPath)}.`);
console.log(`Wrote ${path.relative(root, exportListPath)}.`);
console.log(`Wrote ${path.relative(root, assemblyPath)} with ${Object.keys(assemblies).length} static assemblies and ${copiedComponents.size} traced GLBs.`);
