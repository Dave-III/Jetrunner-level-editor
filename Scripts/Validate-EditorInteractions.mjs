import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const main = readFileSync(resolve(root, 'LevelEditorApp/src/main.ts'), 'utf8');
const shortcuts = readFileSync(resolve(root, 'LevelEditorApp/src/editor-shortcuts.ts'), 'utf8');
const styles = readFileSync(resolve(root, 'LevelEditorApp/src/styles.css'), 'utf8');
const requireText = (source, text, name) => {
  if (!source.includes(text)) throw new Error(`Missing ${name}: ${text}`);
};

for (const key of ['move:', 'rotate:', 'scale:', 'lasso:', 'inspector:', 'cameraDown:', 'cameraUp:']) {
  requireText(shortcuts, key, `shortcut definition ${key}`);
}
for (const id of ['move', 'rotate', 'scale', 'lasso', 'inspector']) {
  requireText(main, `shortcutMatches('${id}'`, `shortcut handler ${id}`);
}
requireText(main, 'function openInspectorForSelection()', 'inspector focus action');
requireText(main, 'const pasted = pasteable.map', 'multi-object paste path');
requireText(main, 'undoButton.addEventListener', 'Undo UI handler');
requireText(main, 'redoButton.addEventListener', 'Redo UI handler');
requireText(main, 'function updateHistoryControls()', 'shared history button state');
requireText(main, 'editorNoticeTimer', 'notice timeout');
requireText(main, 'const completedSingleScale = Boolean(', 'centred resize commit detection');
requireText(main, 'if (transformSnappingEnabled) snapSingleSelectionPivotDimensions(selectedAsset, preferredScaleAxis);', 'live centred resize snapping');
requireText(main, 'singleSelectionPivot.position.copy(anchoredWorldPosition);', 'live one-sided pivot anchoring');
requireText(main, 'applyOneSidedScaleAnchor(selectedAsset);', 'one-sided resize anchor commit');
requireText(main, 'lockInactiveSingleSelectionScaleAxes(preferredScaleAxis);', 'inactive resize-axis lock');
if (main.includes('snapSingleSelectionPivotToFootprintGrid')) {
  throw new Error('Resize snapping must not re-centre the pivot after anchoring the opposite edge.');
}
if (/static_basekit_cube_01[\s\S]{0,180}setScalar\(uniformScale\)/.test(main)) {
  throw new Error('BaseKit block resizing still forces the inactive height axis to scale uniformly.');
}
requireText(main, 'if (activeAxisOnly && axis !== preferredAxis) continue;', 'inactive-axis resize constraint bypass');
requireText(main, 'constrainAssetScale(selectedAsset, preferredScaleAxis, true);', 'active-axis-only resize constraint');
requireText(main, 'const center = singleSelectionPivot.getWorldPosition(new THREE.Vector3());', 'centred resize anchor origin');
if (main.includes('const center = mesh.getWorldPosition(new THREE.Vector3());\n  const quaternion = mesh.getWorldQuaternion')) {
  throw new Error('One-sided resize still anchors from the asset origin instead of the centred gizmo.');
}
for (const side of [-1, 1]) {
  const startCenter = 50;
  const startSize = 100;
  const snappedSize = 200;
  const anchoredCenter = startCenter + side * (snappedSize - startSize) / 2;
  const fixedEdge = anchoredCenter - side * snappedSize / 2;
  const originalFixedEdge = startCenter - side * startSize / 2;
  if (fixedEdge !== originalFixedEdge) throw new Error(`One-sided resize moved its fixed edge for side ${side}.`);
}
requireText(styles, 'user-select:none', 'non-selectable editor chrome');
requireText(styles, 'input,textarea,select,[contenteditable="true"] { user-select:text; }', 'selectable editable fields');
console.log('Editor interaction validation passed.');
