import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../LevelEditorApp/node_modules/three/build/three.module.js';

const root = path.resolve(import.meta.dirname, '..');
const main = fs.readFileSync(path.join(root, 'LevelEditorApp', 'src', 'main.ts'), 'utf8');
const electron = fs.readFileSync(path.join(root, 'LevelEditorApp', 'electron', 'main.cjs'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, 'LevelEditorApp', 'src', 'visual-manifest.json'),
  'utf8',
));

for (const required of [
  'friendlyPipelineText',
  "'Problem'",
  "'Check'",
  'The console explains what happened',
  'gamePaksDirectory: gamePaks',
  'const gamePaks = result.gamePaksDirectory || null',
  'findRunningJETRUNNERProcesses(gamePaks, { requireInstallPath: false })',
  "' (path unavailable)'",
  'A JLE build-workspace file is locked',
  "const isLegacyJle = parsed?.format === 'jle-level' && parsed?.formatVersion === 1;",
  '&& !isCurrentJle && !isLegacyJle',
]) {
  if (!electron.includes(required)) throw new Error(`Missing friendly pipeline output contract: ${required}`);
}
const pipeline = fs.readFileSync(path.join(root, 'UAssetPipeline', 'Build-JLELevel.ps1'), 'utf8');
for (const required of [
  'function Initialize-WorkspaceDirectory',
  'for ($attempt = 1; $attempt -le 8; $attempt++)',
  'Start-Sleep -Milliseconds 500',
  "Initialize-WorkspaceDirectory $target 'JLE build workspace'",
]) {
  if (!pipeline.includes(required)) throw new Error(`Missing resilient build-workspace contract: ${required}`);
}
if (electron.includes("path.resolve(path.dirname(result.installedPak), '..')")) {
  throw new Error('Verification must not derive Content/Paks from the nested installed verification pak.');
}

const testPaks = path.win32.join('D:\\Steam', 'steamapps', 'common', 'JETRUNNER', 'JETRUNNER', 'Content', 'Paks');
const expectedRoot = path.win32.join('D:\\Steam', 'steamapps', 'common', 'JETRUNNER');
const actualRoot = path.win32.resolve(testPaks, '..', '..', '..');
if (actualRoot.toLowerCase() !== expectedRoot.toLowerCase()) {
  throw new Error(`Cross-drive JETRUNNER root resolution failed: ${actualRoot}`);
}
for (const required of [
  'normalizeRotationDegrees',
  'pitch: normalizeRotationDegrees',
  'yaw: normalizeRotationDegrees',
  'roll: normalizeRotationDegrees',
]) {
  if (!main.includes(required)) throw new Error(`Missing normalized rotation contract: ${required}`);
}

const invalidVisualRotations = [];
for (const [assetId, visual] of Object.entries(manifest.assetVisuals || {})) {
  if (visual.rotationDegrees === undefined) continue;
  if (!Array.isArray(visual.rotationDegrees)
    || visual.rotationDegrees.length !== 3
    || visual.rotationDegrees.some((value) => !Number.isFinite(value))) {
    invalidVisualRotations.push(assetId);
  }
}
if (invalidVisualRotations.length > 0) {
  throw new Error(`Invalid editor visual rotations: ${invalidVisualRotations.join(', ')}`);
}

// Runtime rotations remain authored in Unreal pitch/yaw/roll. Editor-only GLB
// rotations must stay in the visual manifest and must never be added to the
// serialized actor transform implicitly.
if (!main.includes('Editor-only visual treatment') || !main.includes('Default Unreal-style placement rotation')) {
  throw new Error('Editor visual and runtime rotation metadata are no longer clearly separated.');
}

// Verify the exact handedness conversion numerically. Yaw-only rotations can
// hide inverted pitch/roll, so deliberately exercise all three axes.
function unrealQuaternion({ pitch, yaw, roll }) {
  const p = pitch * Math.PI / 360;
  const y = yaw * Math.PI / 360;
  const r = roll * Math.PI / 360;
  const sp = Math.sin(p), cp = Math.cos(p);
  const sy = Math.sin(y), cy = Math.cos(y);
  const sr = Math.sin(r), cr = Math.cos(r);
  return new THREE.Quaternion(
    cr * sp * sy - sr * cp * cy,
    -cr * sp * cy - sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  );
}

const editorQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
  THREE.MathUtils.degToRad(31),
  THREE.MathUtils.degToRad(-22),
  THREE.MathUtils.degToRad(67),
  'ZYX',
));
const editorEuler = new THREE.Euler().setFromQuaternion(editorQuaternion, 'ZYX');
const actualUnrealQuaternion = unrealQuaternion({
  pitch: -THREE.MathUtils.radToDeg(editorEuler.y),
  yaw: -THREE.MathUtils.radToDeg(editorEuler.z),
  roll: THREE.MathUtils.radToDeg(editorEuler.x),
});
const reflectedEditorQuaternion = new THREE.Quaternion(
  -editorQuaternion.x,
  editorQuaternion.y,
  -editorQuaternion.z,
  editorQuaternion.w,
);
if (Math.abs(actualUnrealQuaternion.dot(reflectedEditorQuaternion)) < 0.999999) {
  throw new Error('Three.js to Unreal rotation handedness conversion is incorrect.');
}

console.log(JSON.stringify({
  result: 'Pipeline messages and rotation contracts valid',
  visualAssetsChecked: Object.keys(manifest.assetVisuals || {}).length,
  explicitVisualRotationsChecked: Object.values(manifest.assetVisuals || {})
    .filter((visual) => visual.rotationDegrees !== undefined).length,
}, null, 2));
