export type EditorTheme = {
  name: string;
  fonts: { primary: string; monospace: string; weights: { regular: number; strong: number }; baseSize: string };
  colours: { background: string; panel: string; panelAlt: string; text: string; muted: string; accent: string; accentAlt: string; selection: string; border: string; warning: string; error: string; success: string; grid: string };
  gradients: { primary: string; panel: string; home: string };
  surfaces: { button: string; buttonHover: string; toolbar: string; inspector: string; overlay: string };
  controls: { radius: string; borderWidth: string; selectionGlow: string };
  viewport: { background: string; gridOpacity: number; gizmoSize: number };
};
const tokens: Record<string, (t: EditorTheme) => string> = {
  '--editor-font-primary':t=>t.fonts.primary,'--editor-font-mono':t=>t.fonts.monospace,'--editor-font-weight':t=>String(t.fonts.weights.strong),'--editor-font-size':t=>t.fonts.baseSize,
  '--editor-bg':t=>t.colours.background,'--editor-panel':t=>t.colours.panel,'--editor-panel-alt':t=>t.colours.panelAlt,'--editor-text':t=>t.colours.text,'--editor-muted':t=>t.colours.muted,'--editor-accent':t=>t.colours.accent,'--editor-accent-alt':t=>t.colours.accentAlt,'--editor-selection':t=>t.colours.selection,'--editor-border':t=>t.colours.border,'--editor-warning':t=>t.colours.warning,'--editor-error':t=>t.colours.error,'--editor-success':t=>t.colours.success,'--editor-grid':t=>t.colours.grid,
  '--editor-gradient-primary':t=>t.gradients.primary,'--editor-gradient-panel':t=>t.gradients.panel,'--editor-gradient-home':t=>t.gradients.home,'--editor-button':t=>t.surfaces.button,'--editor-button-hover':t=>t.surfaces.buttonHover,'--editor-toolbar':t=>t.surfaces.toolbar,'--editor-inspector':t=>t.surfaces.inspector,'--editor-overlay':t=>t.surfaces.overlay,'--editor-radius':t=>t.controls.radius,'--editor-border-width':t=>t.controls.borderWidth,'--editor-selection-glow':t=>t.controls.selectionGlow,'--editor-viewport':t=>t.viewport.background,'--editor-grid-opacity':t=>String(t.viewport.gridOpacity),'--editor-gizmo-size':t=>String(t.viewport.gizmoSize),
};
export function applyEditorTheme(theme: EditorTheme, root: HTMLElement = document.documentElement) { root.dataset.editorTheme=theme.name; for(const [key,read] of Object.entries(tokens)) root.style.setProperty(key,read(theme)); }
