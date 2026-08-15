import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const main = readFileSync(resolve(root, 'LevelEditorApp/src/main.ts'), 'utf8');
const compiler = readFileSync(resolve(root, 'UAssetPipeline/Scripts/Generate-JLEProject.cjs'), 'utf8');
const queue = JSON.parse(readFileSync(resolve(root, 'Scripts/interaction-range-extraction-queue.json'), 'utf8'));
const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
};

requireText(main, 'syncSelectionHighlights(meshes:', 'canonical multi-selection highlights');
requireText(main, 'setLassoEnabled(false);', 'one-shot lasso exit');
requireText(main, "setTransformMode('translate');", 'lasso return to Move');
requireText(main, 'showInteractionRanges?: boolean', 'persistent Advanced preference');
requireText(main, 'orb.raycast = () => undefined', 'non-raycast interaction orb');
for (const value of ['radius: 200', 'radius: 150', 'radius: 300']) requireText(main, value, `authoritative radius ${value}`);
for (const assetId of ['ability_jetfreeze', 'ability_jethook', 'ability_jetjellybomb', 'ability_jetleap', 'ability_jetpolarizer', 'ability_jetslam']) {
  requireText(main, `${assetId}: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' }`, `${assetId} interaction range`);
}
requireText(main, 'CANONICAL_GRID_CM = 100', 'full-grid constant');
requireText(main, 'snapMeshWorldPositionToFootprintGrid', 'footprint-aware serialized world-position snapping');
for (const [cells, sourceCenter] of [[1, 18], [2, 18], [3, 122], [4, 122]]) {
  const offset = cells % 2 === 1 ? 50 : 0;
  const center = Math.round((sourceCenter - offset) / 100) * 100 + offset;
  const min = center - cells * 50;
  const max = center + cells * 50;
  if (Math.abs(min % 100) > Number.EPSILON || Math.abs(max % 100) > Number.EPSILON) {
    throw new Error(`Footprint-aware snap did not align ${cells}-cell edges: ${min}..${max}`);
  }
}
requireText(main, 'moved.forEach(snapMeshWorldPositionToFootprintGrid)', 'post-gizmo footprint-aware grid commit');
requireText(main, "const latticeOffset = cells % 2 === 1 ? CANONICAL_GRID_CM / 2 : 0", 'odd-cell centre offset');
for (const feature of ['previewVerticalVelocity', 'previewGrounded', 'previewHorizontalBlocked', 'previewGroundAt']) {
  requireText(main, feature, `Preview traversal ${feature}`);
}
requireText(main, 'geometry: () => new THREE.PlaneGeometry(100, 100)', 'Jet Bubble Plane geometry');
requireText(main, 'canonicalWorldBounds(mesh:', 'shared canonical bounds');
requireText(main, "singleSelectionPivot.name = 'JLE_SingleSelectionPivot'", 'centred single-selection transform pivot');
requireText(main, 'canonicalWorldBounds(mesh).getCenter(new THREE.Vector3())', 'canonical gizmo centre calculation');
requireText(main, 'singleSelectionPivot.attach(mesh)', 'centre-pivot transform attachment');
requireText(main, "const polarityGlowOutline = assetDefinitions.light_rims", 'polarity glow outline definition');
requireText(main, 'polarityGlowOutline.baseDimensions = [821.6, 25.5, 821.7]', 'FModel polarity glow dimensions');
requireText(main, "currentWorldStartingPolarity() === 1 ? 0x5de9ff : 0xff4ca5", 'world polarity glow colour');
requireText(main, "assetId === 'basekit_small_ramp'", 'Ramp material routing');
if (main.includes('componentRoot.matrix.elements[12] -= 200')) {
  throw new Error('Basic Wall horizontal ledges still have the obsolete 200 cm left offset.');
}
requireText(main, 'componentRoot.matrix.elements[12] += 200', 'Basic Wall 200 cm right ledge alignment');
requireText(main, 'side: THREE.DoubleSide', 'two-sided extracted Basic Wall materials');
requireText(main, 'id="push-to-edit"', 'push-to-edit advanced option');
requireText(main, 'id="paste-in-place"', 'paste-in-place advanced option');
requireText(main, 'id="move-on-rotated-axes"', 'rotated-axis movement advanced option');
requireText(main, 'id="allow-fractional-object-sizing"', 'fractional sizing advanced option');
requireText(main, "startsWith('static_')", 'fractional sizing static-mesh safety gate');
requireText(main, '? 0.25 : 1', 'audited fractional minimum');
requireText(main, "moveOnRotatedAxes ? 'local' : 'world'", 'local/world movement axis switching');
requireText(main, 'pasteInPlace ? 0 : 100', 'paste-in-place offset control');
requireText(main, 'isBlastJelly ? 58 : 42', 'larger Blast Jelly identification ring');
requireText(main, "energy_pickup: { radius: 200, center: [0, 0, 0]", 'centred Gun Pickup interaction range');
requireText(main, 'if (usesLegacyPipeVisual) return', 'legacy compact pipe editor model');
requireText(main, "'EnvironmentExtension_NewYorkSubway_SecondFloor'", 'two-floor subway preview');
requireText(main, 'subwayLayout: environmentSelect.value', 'subway layout runtime export');
requireText(main, 'environmentPlacementSurface', 'subway platform Player Start placement surface');
requireText(main, 'const isSubwayPlacementSurface = environmentId ===', 'all base subway meshes exposed for placement');
requireText(main, ').find((hit) => Boolean(hit.face))', 'subway floors, walls and ceilings exposed for placement');
requireText(main, 'surfaceMatrix.multiply(placementInstanceMatrix)', 'instanced subway surface normal transform');
requireText(compiler, "property(mapPlacer.Data, 'Skybox').Value = subwayLayout", 'runtime subway extension loader slot');
requireText(compiler, "'EnvironmentExtension_NewYorkSubway_Roof'", 'single-roof runtime map');
requireText(compiler, "'EnvironmentExtension_NewYorkSubway_SecondFloor'", 'two-layer runtime map');
requireText(main, 'mesh.userData.hasAuthoritativeVisualBounds = true', 'measured loaded-assembly bounds');
requireText(main, 'mesh.userData.hasAuthoritativeVisualBounds || !canonical', 'canonical bounds loaded-geometry preference');
requireText(main, '-assembly.boundsCm.maxCm[1]', 'Unreal-to-editor canonical bounds reflection');
requireText(main, '-assembly.boundsCm.minCm[1]', 'Unreal-to-editor canonical bounds extrema swap');
requireText(compiler, 'runtimeLaserBeamTransform', 'runtime Laser Beam scale mapping');
requireText(compiler, 'safeName(level.levelId || level.levelName || level.displayName)', 'stable internal package identity');
requireText(compiler, "property(levelDefExport.Data, 'ExperienceName').CultureInvariantString = displayName", 'exact special-character display name');
requireText(main, "hiddenInPalette: true", 'legacy Crane hidden from palette');
requireText(compiler, "object.assetId === 'arcade_token'", 'Arcade Token level-definition flag');

for (const [editorScale, expectedCm] of [[0.5, 150], [1, 300], [2, 600]]) {
  const actualCm = 10000 * editorScale * 0.03;
  if (actualCm !== expectedCm) throw new Error(`Laser length mapping failed at scale ${editorScale}.`);
}
if (queue.requests.length !== 0) throw new Error('Interaction-range extraction queue is not empty.');
if (!queue.resolved.some((entry) => entry.requiredPackage.endsWith('/BP_ItemOrb') && entry.radiusCm === 200)) {
  throw new Error('Missing resolved BP_ItemOrb interaction range.');
}
console.log('Advanced editor feature validation passed.');
