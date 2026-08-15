import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const main = readFileSync(resolve(root, 'LevelEditorApp/src/main.ts'), 'utf8');
const preload = readFileSync(resolve(root, 'LevelEditorApp/electron/preload.cjs'), 'utf8');
const electron = readFileSync(resolve(root, 'LevelEditorApp/electron/main.cjs'), 'utf8');
const shortcuts = readFileSync(resolve(root, 'LevelEditorApp/src/editor-shortcuts.ts'), 'utf8');
for (const [source, required] of [[main, 'id="home-screen"'], [main, 'id="home-quit"'], [main, 'id="new-level-dialog"'], [main, 'id="new-level-error"'], [main, 'createNewLevel'], [main, 'await saveEditorProject(true)'], [main, 'New level failed:'], [main, 'rememberRecent'], [main, 'recent.slice(0, 3)'], [main, 'closeKeybindOptions'], [main, 'focusCameraOnPlayerStart'], [main, 'renderOptions'], [main, 'loadRecentProject'], [main, 'id="editor-options"'], [main, 'id="editor-option-save"'], [main, 'id="editor-option-home"'], [main, 'beginNewProject'], [preload, 'project:load-recent'], [preload, 'project:new'], [preload, 'app:quit'], [electron, "ipcMain.handle('project:load-recent'"], [electron, "ipcMain.handle('project:new'"], [electron, "ipcMain.handle('app:quit'"], [electron, 'renamedProjectPath'], [electron, 'currentProjectDisplayName'], [shortcuts, 'restoreDefaultEditorShortcuts']]) {
  if (!source.includes(required)) throw new Error(`Missing ${required}`);
}
const displayName = 'Please!!! lets do this!';
const safeFilename = displayName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Unnamed_Level';
if (safeFilename !== 'Please_lets_do_this') throw new Error('The project filename sanitizer changed unexpectedly.');
console.log('Project management validation passed.');
