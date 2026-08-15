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
requireText(styles, 'user-select:none', 'non-selectable editor chrome');
requireText(styles, 'input,textarea,select,[contenteditable="true"] { user-select:text; }', 'selectable editable fields');
console.log('Editor interaction validation passed.');
