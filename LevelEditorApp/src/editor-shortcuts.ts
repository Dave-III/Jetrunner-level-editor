export type EditorShortcutId = 'move' | 'rotate' | 'scale' | 'lasso' | 'inspector' | 'cameraDown' | 'cameraUp';

export interface EditorShortcutDefinition {
  code: string;
  label: string;
}

/** Central shortcut defaults. The Options UI can persist overrides here later. */
export const defaultEditorShortcuts: Record<EditorShortcutId, EditorShortcutDefinition> = {
  move: { code: 'KeyG', label: 'G' },
  rotate: { code: 'KeyR', label: 'R' },
  scale: { code: 'KeyT', label: 'T' },
  lasso: { code: 'KeyL', label: 'L' },
  inspector: { code: 'KeyI', label: 'I' },
  cameraDown: { code: 'KeyQ', label: 'Q' },
  cameraUp: { code: 'KeyE', label: 'E' },
};
export const editorShortcuts: Record<EditorShortcutId, EditorShortcutDefinition> = structuredClone(defaultEditorShortcuts);

export function setEditorShortcut(id: EditorShortcutId, code: string) {
  editorShortcuts[id] = { code, label: code.replace(/^Key/, '').replace(/^Digit/, '') };
}

export function restoreDefaultEditorShortcuts() {
  (Object.keys(defaultEditorShortcuts) as EditorShortcutId[]).forEach((id) => {
    editorShortcuts[id] = { ...defaultEditorShortcuts[id] };
  });
}

export function shortcutMatches(id: EditorShortcutId, code: string) {
  return editorShortcuts[id].code === code;
}
