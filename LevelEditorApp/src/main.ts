import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls, type TransformControlsMode } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import '@fontsource/barlow-condensed/900-italic.css';
import logoUrl from './assets/jetrunner-logo.png';
import skyboxUrl from './assets/central-park-skybox.png';
import { assetVisuals, environmentScenes, skyboxVisuals, type AssetVisualEntry } from './visual-manifest';
import {
  defaultGameplayProperties,
  gameplayPropertiesForAsset,
  medalPropertyDefinitions,
  validateGameplayProperty,
  worldPropertyDefinitions,
  type GameplayPropertyDefinition,
  type GameplayPropertyValue,
} from './gameplay-properties';
import { editorShortcuts, restoreDefaultEditorShortcuts, setEditorShortcut, shortcutMatches, type EditorShortcutId } from './editor-shortcuts';
import newObjectCatalog from './new-object-catalog.json';
import catalogLayout from './catalog-layout.json';
import blueprintAssemblyManifest from './blueprint-visual-assemblies.json';
import './styles.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="editor-shell">
    <header class="topbar">
      <div class="brand"><img src="${logoUrl}" alt="JETRUNNER" /><small>LEVEL EDITOR</small></div>
      <input id="level-name" class="scene-title" type="text" value="Unnamed Level" maxlength="48" aria-label="Level name" spellcheck="false" />
      <div class="topbar-actions">
        <button id="undo-editor" class="toolbar-button history-button" type="button" disabled aria-label="Undo" title="Undo">↶</button>
        <button id="redo-editor" class="toolbar-button history-button" type="button" disabled aria-label="Redo" title="Redo">↷</button>
        <button id="verify-level" class="toolbar-button verify-button" type="button">Verify</button>
        <button id="preview-level" class="toolbar-button" type="button">Preview</button>
        <button id="export-level" class="toolbar-button export-button" type="button" hidden>Export + install</button>
      </div>
    </header>
    <section class="workspace">
      <aside class="panel left-panel">
        <h2>Assets</h2>
        <nav class="catalog-tabs" aria-label="Asset catalogues">
          <button class="catalog-tab selected" type="button" data-catalog="surface">Surface</button>
          <button class="catalog-tab" type="button" data-catalog="gameplay">Gameplay</button>
          <button class="catalog-tab" type="button" data-catalog="props">Props</button>
        </nav>
        <nav id="surface-groups" class="gameplay-groups" aria-label="Surface types">
          <button class="surface-group gameplay-group selected" type="button" data-surface-group="platforms">Platforms</button>
          <button class="surface-group gameplay-group" type="button" data-surface-group="pillars">Pillars</button>
          <button class="surface-group gameplay-group" type="button" data-surface-group="walls">Walls</button>
          <button class="surface-group gameplay-group" type="button" data-surface-group="extras">Extras</button>
        </nav>
        <nav id="gameplay-groups" class="gameplay-groups" aria-label="Gameplay asset types" hidden>
          <button class="gameplay-group selected" type="button" data-gameplay-group="game">Game</button>
          <button class="gameplay-group" type="button" data-gameplay-group="pickups">Pickups</button>
          <button class="gameplay-group" type="button" data-gameplay-group="traversal">Traversal</button>
          <button class="gameplay-group" type="button" data-gameplay-group="interactable">Interactable</button>
          <button class="gameplay-group" type="button" data-gameplay-group="hazards">Hazards</button>
          <button class="gameplay-group" type="button" data-gameplay-group="misc">Misc</button>
        </nav>
        <nav id="prop-groups" class="gameplay-groups" aria-label="Prop types" hidden>
          <button class="prop-group gameplay-group selected" type="button" data-prop-group="props">Props</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="large">Large Props</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="lights">Lights</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="audience">Audience</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="foliage">Foliage</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="terrain">Terrain</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="architecture">Architecture</button>
          <button class="prop-group gameplay-group" type="button" data-prop-group="misc">Misc</button>
        </nav>
        <div class="asset-palette" role="list" aria-label="Placeable assets">
          <button class="asset-button" type="button" data-catalog="surface" data-surface-group="ice" data-asset-id="ice_platform_4x4">
            <span class="asset-swatch ice-swatch"></span><span>Ice platform</span>
          </button>
          <button class="asset-button" type="button" data-catalog="gameplay" data-gameplay-group="traversal" data-asset-id="launch_pad">
            <span class="asset-swatch pad-swatch"></span><span>Bounce pad</span>
          </button>
          <button class="asset-button" type="button" data-catalog="gameplay" data-gameplay-group="level" data-asset-id="time_trial_goal">
            <span class="asset-swatch goal-swatch"></span><span>Finish goal</span>
          </button>
          <button class="asset-button" type="button" data-catalog="gameplay" data-gameplay-group="level" data-asset-id="player_start">
            <span class="asset-swatch player-swatch"></span><span>Player start</span>
          </button>
        </div>
        <div class="transform-tools" aria-label="Transform tools">
          <button class="transform-button selected" type="button" data-transform-mode="translate" data-shortcut="move">Move</button>
          <button class="transform-button" type="button" data-transform-mode="rotate" data-shortcut="rotate">Rotate</button>
          <button class="transform-button" type="button" data-transform-mode="scale" data-shortcut="scale">Resize</button>
          <button id="lasso-tool" class="transform-button" type="button" data-shortcut="lasso">Lasso</button>
          <button id="deselect-asset" class="transform-button deselect-button" type="button">Deselect</button>
        </div>
      </aside>
      <div id="viewport" class="viewport">
        <div id="preview-indicator" class="preview-indicator" hidden>PREVIEW MODE — ESC to return</div>
        <div id="lasso-rectangle" class="lasso-rectangle"></div>
        <section id="entity-inspector" class="entity-inspector" aria-hidden="true">
          <header><strong id="entity-title">Entity data</strong><button id="entity-close" type="button">×</button></header>
          <p>Click any value to customise it.</p>
          <div id="entity-fields" class="entity-fields"></div>
          <div><button id="entity-save" type="button">Apply</button><button id="entity-cancel" type="button">Cancel</button></div>
        </section>
        <div id="camera-readout" class="camera-readout"></div>
        <div id="editor-notice" class="editor-notice" role="status" aria-live="polite"></div>
        <section id="pipeline-console" class="pipeline-console" aria-label="Pipeline console">
          <header>
            <strong>Pipeline console</strong>
            <div>
              <button id="clear-console" type="button">Clear</button>
              <button id="close-console" type="button">×</button>
            </div>
          </header>
          <pre id="pipeline-console-output">Ready. Pipeline output will appear here.</pre>
        </section>
      </div>
      <aside class="panel right-panel">
        <section class="world-settings-card" aria-labelledby="world-settings-title">
          <strong id="world-settings-title">Environment</strong>
          <label for="environment-select">Surroundings</label>
          <select id="environment-select">
            <option value="">None</option>
            <option value="Environment_CentralPark">Central Park</option>
            <option value="Environment_NewYorkSubway">New York Subway</option>
            <option value="Env_Rio_FreeOfCorruption">Rio</option>
            <option value="Environment_Skypiercer">Skypiercer</option>
            <option value="Environment_Skypiercer_CityCapture_Mumbai_Bitmap">Mumbai City</option>
            <option value="Environment_Geiranger">Geiranger</option>
            <option value="Environment_Seoul">Seoul</option>
            <option value="Backdrop_Peony_Mountainrange_ProcPlusLandscape">Peony Mountains</option>
            <option value="Scenario_RainbowDimension">Dream Dimension</option>
          </select>
          <div id="subway-layout-field" hidden>
            <label for="subway-layout-select">Subway roof</label>
            <select id="subway-layout-select">
              <option value="roof">Single-floor roof</option>
              <option value="two-layer">Two-floor roof</option>
            </select>
          </div>
          <label for="world-starting-polarity">Starting Polarity <input id="world-starting-polarity" type="checkbox" checked /></label>
          <label for="time-of-day-select">Time of day</label>
          <select id="time-of-day-select">
            <option value="">None</option>
            <optgroup label="New York">
              <option value="Scenario_YankeyDoodleMorning">Morning</option>
              <option value="Scenario_YankeyDoodleDay">Day</option>
              <option value="Scenario_TheNightThatNeverSleeps">Night</option>
              <option value="Scenario_CityStorm">Storm</option>
              <option value="Scenario_GoldenFall">Golden fall</option>
              <option value="Scenario_YankeyWinter">Winter day</option>
              <option value="Scenario_WinterNight">Winter night</option>
              <option value="Scenario_Subway">Subway</option>
              <option value="Scenario_EtheralSubway">Ethereal subway</option>
              <option value="Scenario_SubwayRave">Subway rave</option>
            </optgroup>
            <optgroup label="Rio">
              <option value="Scenario_Rio_Dawn">Dawn</option>
              <option value="Scenario_TropicDay">Tropical day</option>
              <option value="Scenario_TropicEvening">Tropical evening</option>
              <option value="Scenario_Rio_Night">Night</option>
              <option value="Scenario_CarnivalDay">Carnival day</option>
            </optgroup>
            <optgroup label="Skypiercer">
              <option value="Scenario_MumbaiMorning">Morning</option>
              <option value="Scenario_MumbaiDay">Day</option>
              <option value="Scenario_MumbaiEvening">Evening</option>
              <option value="Scenario_DayAboveTheClouds">Above the clouds</option>
              <option value="Scenario_NightAboveTheClouds">Night above the clouds</option>
            </optgroup>
            <optgroup label="Geiranger">
              <option value="Scenario_IdylicSpringMorning">Spring morning</option>
              <option value="Scenario_IdylicSpringDay">Spring day</option>
              <option value="Scenario_IdylicDay">Idyllic day</option>
              <option value="Scenario_IdylicEvening">Idyllic evening</option>
              <option value="Scenario_IdylicNight">Idyllic night</option>
              <option value="Scenario_IdylicMorning">Unused morning</option>
            </optgroup>
            <optgroup label="Seoul">
              <option value="Scenario_FortMorning">Fort morning</option>
              <option value="Scenario_VibrantDay">Vibrant day</option>
              <option value="Scenario_DauntingEvening">Daunting evening</option>
              <option value="Scenario_PurpleDay">Purple day</option>
              <option value="Scenario_PurpleNight">Purple night</option>
            </optgroup>
            <optgroup label="Peony Mountains">
              <option value="Scenario_MistyMorning">Misty morning</option>
              <option value="Scenario_MistyMountainDay">Misty day</option>
              <option value="Scenario_MistyEvening">Misty evening</option>
              <option value="Scenario_MistyNight">Misty night</option>
              <option value="Scenario_MistyDay">Clear misty day</option>
              <option value="Scenario_MistyHalloween">Halloween</option>
            </optgroup>
            <optgroup label="Virtual dimensions">
              <option value="Scenario_Virtual_WhiteCity">White City</option>
              <option value="Scenario_Virtual_MoonRiver">Moon River</option>
              <option value="Scenario_Virtual_SynthCity">Synth City</option>
              <option value="Scenario_Virtual_Aurora">Aurora</option>
              <option value="Scenario_Virtual_CyberStadium">Cyber Stadium</option>
              <option value="Scenario_Virtual_Mountains">Virtual Mountains</option>
            </optgroup>
          </select>
        </section>
        <section class="world-settings-card verification-card" aria-labelledby="verification-title">
          <strong id="verification-title">Verification</strong>
          <p id="verification-status">Unverified — beat this version before sharing.</p>
          <div id="verification-medals" hidden></div>
          <div id="medal-targets" class="entity-fields" hidden></div>
          <button id="check-verification" class="transform-button" type="button" disabled>Finish verification</button>
        </section>
      </aside>
    </section>
    <div class="designer-credit" aria-label="Designed by Dave">Designed by Dave</div>
    <section id="home-screen" class="home-screen">
      <button id="home-update" class="home-update" type="button" hidden>New Version Available</button>
      <div class="home-card">
        <img src="${logoUrl}" alt="JETRUNNER" />
        <h1>Level Editor</h1>
        <button id="home-new" type="button">Start New Level</button>
        <button id="home-load" type="button">Open Existing Level</button>
        <button id="home-options" type="button">Options</button>
        <button id="home-quit" type="button">Quit</button>
        <h2>Recent Levels</h2><div id="recent-levels" class="recent-levels"></div><p class="home-credit">Designed by Dave</p>
      </div>
    </section>
    <section id="options-screen" class="home-screen" hidden>
      <div class="home-card options-card"><h1>Keybinds</h1><div id="shortcut-options"></div><button id="reset-shortcuts" type="button">Restore Default Shortcuts</button><button id="options-back" type="button">Back to Options</button></div>
    </section>
    <section id="advanced-options-screen" class="home-screen" hidden>
      <div class="home-card options-card advanced-options-card"><h1>Advanced</h1><div class="advanced-options-list"><label><span>Show Interaction Ranges</span><input id="show-interaction-ranges" type="checkbox" /></label><label><span>Push-to-edit</span><input id="push-to-edit" type="checkbox" /></label><label><span>Paste in place</span><input id="paste-in-place" type="checkbox" /></label><label><span>Move on rotated axes</span><input id="move-on-rotated-axes" type="checkbox" /></label><label title="Applies only to audited static-mesh props; Blueprint and gameplay objects remain at normal minimum size."><span>Allow Fractional Object Sizing</span><input id="allow-fractional-object-sizing" type="checkbox" /></label></div><button id="advanced-options-back" type="button">Back to Options</button></div>
    </section>
    <section id="editor-options" class="editor-options" hidden aria-modal="true" role="dialog"><div><h2>Options</h2><button id="editor-option-save" type="button">Save</button><button id="editor-option-load" type="button">Load</button><button id="editor-option-keybinds" type="button">Keybinds</button><button id="editor-option-advanced" type="button">Advanced</button><button id="editor-option-home" type="button">Home</button></div></section>
    <section id="new-level-dialog" class="editor-options" hidden aria-modal="true" role="dialog" aria-labelledby="new-level-title"><div><h2 id="new-level-title">New Level</h2><label class="new-level-label" for="new-level-name">Level name</label><input id="new-level-name" type="text" maxlength="48" value="Unnamed Level" spellcheck="false" /><p id="new-level-error" class="new-level-error" hidden></p><button id="new-level-confirm" type="button">Create Level</button><button id="new-level-cancel" type="button">Cancel</button></div></section>
  </main>
`;

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const readout = document.querySelector<HTMLDivElement>('#camera-readout')!;
const editorNotice = document.querySelector<HTMLDivElement>('#editor-notice')!;
const pipelineConsole = document.querySelector<HTMLElement>('#pipeline-console')!;
const pipelineConsoleOutput = document.querySelector<HTMLPreElement>('#pipeline-console-output')!;
const levelNameInput = document.querySelector<HTMLInputElement>('#level-name')!;
const lassoRectangle = document.querySelector<HTMLDivElement>('#lasso-rectangle')!;
const entityInspector = document.querySelector<HTMLElement>('#entity-inspector')!;
const entityTitle = document.querySelector<HTMLElement>('#entity-title')!;
const entityFields = document.querySelector<HTMLDivElement>('#entity-fields')!;
const environmentSelect = document.querySelector<HTMLSelectElement>('#environment-select')!;
const subwayLayoutField = document.querySelector<HTMLDivElement>('#subway-layout-field')!;
const subwayLayoutSelect = document.querySelector<HTMLSelectElement>('#subway-layout-select')!;
const timeOfDaySelect = document.querySelector<HTMLSelectElement>('#time-of-day-select')!;
const worldStartingPolarityCheckbox = document.querySelector<HTMLInputElement>('#world-starting-polarity')!;
const verificationStatus = document.querySelector<HTMLParagraphElement>('#verification-status')!;
const verificationMedals = document.querySelector<HTMLDivElement>('#verification-medals')!;
const medalTargets = document.querySelector<HTMLDivElement>('#medal-targets')!;
const verifyButton = document.querySelector<HTMLButtonElement>('#verify-level')!;
const checkVerificationButton = document.querySelector<HTMLButtonElement>('#check-verification')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export-level')!;
const previewButton = document.querySelector<HTMLButtonElement>('#preview-level')!;
const previewIndicator = document.querySelector<HTMLDivElement>('#preview-indicator')!;
const undoButton = document.querySelector<HTMLButtonElement>('#undo-editor')!;
const redoButton = document.querySelector<HTMLButtonElement>('#redo-editor')!;
const homeScreen = document.querySelector<HTMLElement>('#home-screen')!;
const homeUpdateButton = document.querySelector<HTMLButtonElement>('#home-update')!;
const optionsScreen = document.querySelector<HTMLElement>('#options-screen')!;
const advancedOptionsScreen = document.querySelector<HTMLElement>('#advanced-options-screen')!;
const newLevelDialog = document.querySelector<HTMLElement>('#new-level-dialog')!;
const newLevelNameInput = document.querySelector<HTMLInputElement>('#new-level-name')!;
const newLevelError = document.querySelector<HTMLParagraphElement>('#new-level-error')!;
const recentLevels = document.querySelector<HTMLDivElement>('#recent-levels')!;
const shortcutOptions = document.querySelector<HTMLDivElement>('#shortcut-options')!;

type RecentLevel = { displayName: string; filePath: string; openedAt: string };
const SETTINGS_KEY = 'jle-project-management-settings-v1';
function readProjectSettings(): { shortcuts?: Partial<Record<EditorShortcutId, string>>; recent?: RecentLevel[]; showInteractionRanges?: boolean; pushToEdit?: boolean; pasteInPlace?: boolean; moveOnRotatedAxes?: boolean; allowFractionalObjectSizing?: boolean } {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function writeProjectSettings(next: ReturnType<typeof readProjectSettings>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
function applySavedShortcuts() {
  const saved = readProjectSettings().shortcuts || {};
  (Object.entries(saved) as [EditorShortcutId, string][]).forEach(([id, code]) => setEditorShortcut(id, code));
}
function updateShortcutLabels() {
  document.querySelectorAll<HTMLElement>('[data-shortcut-key]').forEach((element) => {
    const shortcut = editorShortcuts[element.dataset.shortcutKey as EditorShortcutId];
    if (shortcut) element.textContent = shortcut.label;
  });
  document.querySelectorAll<HTMLElement>('[data-shortcut]').forEach((element) => {
    const shortcut = editorShortcuts[element.dataset.shortcut as EditorShortcutId];
    if (shortcut) element.title = `${element.textContent?.trim() || 'Tool'} (${shortcut.label})`;
  });
}
function rememberRecent(displayName: string, filePath: string) {
  const settings = readProjectSettings();
  const recent = (settings.recent || []).filter((entry) => entry.filePath !== filePath);
  recent.unshift({ displayName, filePath, openedAt: new Date().toISOString() });
  writeProjectSettings({ ...settings, recent: recent.slice(0, 3) });
  renderRecentLevels();
}
function renderRecentLevels() {
  recentLevels.replaceChildren();
  const settings = readProjectSettings();
  const storedRecent = settings.recent || [];
  const recent = storedRecent.slice(0, 3);
  if (storedRecent.length !== recent.length) writeProjectSettings({ ...settings, recent });
  if (!recent.length) { recentLevels.textContent = 'No saved levels yet.'; return; }
  recent.forEach((entry) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.displayName;
    button.title = entry.filePath;
    button.addEventListener('click', async () => {
      if (!window.jetrunnerEditor) return;
      const result = await window.jetrunnerEditor.loadRecentProject(entry.filePath);
      if (result.missing) { const settings = readProjectSettings(); writeProjectSettings({ ...settings, recent: (settings.recent || []).filter((item) => item.filePath !== entry.filePath) }); renderRecentLevels(); showEditorNotice('That recent save no longer exists.', 'error'); return; }
      if (await loadEditorProject(result)) hideHome();
    });
    recentLevels.append(button);
  });
}
function renderOptions() {
  shortcutOptions.replaceChildren();
  (Object.keys(editorShortcuts) as EditorShortcutId[]).forEach((id) => {
    const row = document.createElement('label'); row.textContent = id.replace(/([A-Z])/g, ' $1');
    const input = document.createElement('input'); input.value = editorShortcuts[id].label; input.readOnly = true;
    input.addEventListener('keydown', (event) => { event.preventDefault(); if (event.code === 'Escape') { input.blur(); closeKeybindOptions(); return; } setEditorShortcut(id, event.code); const settings = readProjectSettings(); writeProjectSettings({ ...settings, shortcuts: Object.fromEntries((Object.keys(editorShortcuts) as EditorShortcutId[]).map((key) => [key, editorShortcuts[key].code])) }); updateShortcutLabels(); renderOptions(); });
    row.append(input); shortcutOptions.append(row);
  });
}
let optionsReturnHome = true;
function showHome() { optionsReturnHome = true; homeScreen.hidden = false; optionsScreen.hidden = true; advancedOptionsScreen.hidden = true; renderRecentLevels(); }
function hideHome() { homeScreen.hidden = true; }
applySavedShortcuts(); updateShortcutLabels(); renderRecentLevels();
function showOptions(fromHome: boolean) { optionsReturnHome = fromHome; closeEditorOptions(); homeScreen.hidden = true; optionsScreen.hidden = false; renderOptions(); }
function closeKeybindOptions() { optionsScreen.hidden = true; if (optionsReturnHome) showHome(); else openEditorOptions(); }
function showAdvancedOptions() { optionsReturnHome = false; closeEditorOptions(); homeScreen.hidden = true; advancedOptionsScreen.hidden = false; }
function closeAdvancedOptions() { advancedOptionsScreen.hidden = true; openEditorOptions(); }
document.querySelector<HTMLButtonElement>('#home-options')!.addEventListener('click', () => showOptions(true));
document.querySelector<HTMLButtonElement>('#options-back')!.addEventListener('click', closeKeybindOptions);
document.querySelector<HTMLButtonElement>('#advanced-options-back')!.addEventListener('click', closeAdvancedOptions);
document.querySelector<HTMLButtonElement>('#home-quit')!.addEventListener('click', () => { window.jetrunnerEditor?.quitApp(); });
homeUpdateButton.addEventListener('click', async () => {
  if (!window.jetrunnerEditor || homeUpdateButton.disabled) return;
  homeUpdateButton.disabled = true;
  homeUpdateButton.textContent = 'Starting Download...';
  const result = await window.jetrunnerEditor.downloadEditorUpdate();
  if (!result.started) {
    homeUpdateButton.disabled = false;
    homeUpdateButton.hidden = true;
  }
});
window.jetrunnerEditor?.onEditorUpdateState((state) => {
  if (state.status === 'current' || state.status === 'error') {
    homeUpdateButton.hidden = true;
    homeUpdateButton.disabled = false;
    return;
  }
  homeUpdateButton.hidden = false;
  if (state.status === 'available') {
    homeUpdateButton.disabled = false;
    homeUpdateButton.textContent = state.version ? `New Version ${state.version} Available` : 'New Version Available';
  } else if (state.status === 'downloading') {
    homeUpdateButton.disabled = true;
    homeUpdateButton.textContent = `Downloading Update ${Math.round(state.percent || 0)}%`;
  } else {
    homeUpdateButton.disabled = true;
    homeUpdateButton.textContent = 'Update Ready';
  }
});
document.querySelector<HTMLButtonElement>('#reset-shortcuts')!.addEventListener('click', () => { restoreDefaultEditorShortcuts(); const settings = readProjectSettings(); writeProjectSettings({ ...settings, shortcuts: {} }); updateShortcutLabels(); renderOptions(); });
document.querySelector<HTMLButtonElement>('#home-load')!.addEventListener('click', async () => { if (await loadEditorProject()) hideHome(); });
async function createNewLevel() {
  const name = newLevelNameInput.value.trim();
  if (!name) {
    newLevelError.textContent = 'Enter a level name to continue.';
    newLevelError.hidden = false;
    newLevelNameInput.focus();
    return;
  }
  try {
    newLevelError.hidden = true;
    if (!window.jetrunnerEditor) throw new Error('The desktop project service is unavailable. Restart the Level Editor from its launcher.');
    window.jetrunnerEditor.logEditor('project', `Creating new level: ${name}`);
    const ready = await window.jetrunnerEditor.beginNewProject();
    if (!ready.ready) throw new Error(ready.error || 'The project service did not prepare a new level.');
    currentLevelId = `jle_${crypto.randomUUID()}`;
    sessionStorage.setItem('jle-current-level-id', currentLevelId);
    levelNameInput.value = name;
    localStorage.setItem('jle-level-name', name);
    verification = undefined;
    restoreEditorState([]);
    resetCamera();
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryControls();
    newLevelDialog.hidden = true;
    hideHome();
    await saveEditorProject(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.jetrunnerEditor?.logEditor('project', `New level failed: ${message}`);
    newLevelError.textContent = `Could not create level: ${message}`;
    newLevelError.hidden = false;
    showEditorNotice(`Could not create level: ${message}`, 'error');
  }
}
document.querySelector<HTMLButtonElement>('#home-new')!.addEventListener('click', () => {
  newLevelNameInput.value = 'Unnamed Level';
  newLevelError.hidden = true;
  newLevelDialog.hidden = false;
  window.setTimeout(() => newLevelNameInput.select(), 0);
});
document.querySelector<HTMLButtonElement>('#new-level-confirm')!.addEventListener('click', () => { void createNewLevel(); });
document.querySelector<HTMLButtonElement>('#new-level-cancel')!.addEventListener('click', () => { newLevelDialog.hidden = true; });
newLevelNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); void createNewLevel(); }
  if (event.key === 'Escape') { event.preventDefault(); newLevelDialog.hidden = true; }
});

document.querySelectorAll<HTMLElement>('[data-shortcut]').forEach((element) => {
  const shortcut = editorShortcuts[element.dataset.shortcut as keyof typeof editorShortcuts];
  if (shortcut) element.title = `${element.textContent?.trim() || 'Tool'} (${shortcut.label})`;
});
document.querySelectorAll<HTMLElement>('[data-shortcut-key]').forEach((element) => {
  const shortcut = editorShortcuts[element.dataset.shortcutKey as keyof typeof editorShortcuts];
  if (shortcut) element.textContent = shortcut.label;
});
const savedLevelName = localStorage.getItem('jle-level-name');
if (savedLevelName && savedLevelName !== 'Untitled Level') levelNameInput.value = savedLevelName;
environmentSelect.value =
  localStorage.getItem('jle-environment') || 'Environment_CentralPark';
timeOfDaySelect.value =
  localStorage.getItem('jle-time-of-day') || 'Scenario_TheNightThatNeverSleeps';
worldStartingPolarityCheckbox.checked = (localStorage.getItem('jle-world-starting-polarity') || '1') === '1';
environmentSelect.addEventListener('change', () => {
  localStorage.setItem('jle-environment', environmentSelect.value);
  // Environment manifests can span hundreds of metres. Do not retain a
  // camera framed around the previous environment, otherwise the editable
  // origin and the newly selected surroundings can appear completely absent.
  resetCamera();
  applyEditorEnvironmentPreview();
  scheduleAutosave();
  environmentSelect.blur();
});
subwayLayoutSelect.value = localStorage.getItem('jle-subway-layout') || 'roof';
subwayLayoutSelect.addEventListener('change', () => {
  localStorage.setItem('jle-subway-layout', subwayLayoutSelect.value);
  applyEditorEnvironmentPreview();
  scheduleAutosave();
  subwayLayoutSelect.blur();
});
timeOfDaySelect.addEventListener('change', () => {
  localStorage.setItem('jle-time-of-day', timeOfDaySelect.value);
  applyEditorEnvironmentPreview();
  scheduleAutosave();
  timeOfDaySelect.blur();
});
worldStartingPolarityCheckbox.addEventListener('change', () => {
  localStorage.setItem('jle-world-starting-polarity', String(currentWorldStartingPolarity()));
  placedAssets.filter((mesh) => mesh.userData.assetId === 'light_rims').forEach(refreshAssetPresentation);
  scheduleAutosave();
});
// Identity belongs to this editor document, not its display name. sessionStorage
// preserves it across reloads/repeated exports, while a newly launched editor
// receives a fresh UUID even when the user reuses an earlier custom name.
let currentLevelId = sessionStorage.getItem('jle-current-level-id') || `jle_${crypto.randomUUID()}`;
sessionStorage.setItem('jle-current-level-id', currentLevelId);
levelNameInput.addEventListener('input', () => {
  localStorage.setItem('jle-level-name', levelNameInput.value || 'Unnamed Level');
  scheduleAutosave();
});
let isEditingLevelName = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080716);
// Distance fog made large scenes turn into an opaque smoky wall when zoomed
// out. Keep the authoring viewport clear at every camera distance.
scene.fog = null;

const camera = new THREE.PerspectiveCamera(55, 1, 10, 100000);
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.screenSpacePanning = true;
controls.minDistance = 100;
controls.maxDistance = 30000;
controls.zoomSpeed = 1.15;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.55;
// Editor-style navigation: drag the middle mouse button to pan the camera.
// The scroll wheel continues to control dolly/zoom.
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;

readout.textContent = 'X —  Y —  Z —';

// Panoramic reference reconstructed from four fixed-position, 90-degree game
// captures. It follows the editor camera so it behaves as an infinitely distant
// environment and remains a scale reference rather than level geometry.
const textureLoader = new THREE.TextureLoader();
let skyTexture = textureLoader.load(skyboxUrl);
configureSkyTexture(skyTexture);

const skyMaterial = new THREE.MeshBasicMaterial({
  map: skyTexture,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(50000, 64, 40), skyMaterial);
skyDome.rotation.x = Math.PI / 2;
skyDome.renderOrder = -100;
scene.add(skyDome);

function configureSkyTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
}

let requestedSkybox = '';
function setEditorSkybox(environmentId: string, scenarioId: string, morningGrade = false) {
  // The captured panorama is specifically Central Park. Never show that map
  // behind Rio, Seoul, Peony, etc.; those environments use their harvested
  // surroundings plus a generated sky gradient below.
  const requestedUrl = environmentId === 'Environment_CentralPark'
    ? (skyboxVisuals[scenarioId] || skyboxUrl)
    : '';
  if (!requestedUrl) return;
  const requestKey = `${requestedUrl}|${morningGrade ? 'morning' : 'standard'}`;
  if (requestKey === requestedSkybox) return;
  requestedSkybox = requestKey;
  textureLoader.load(
    requestedUrl,
    (sourceTexture) => {
      if (requestKey !== requestedSkybox) {
        sourceTexture.dispose();
        return;
      }
      let texture: THREE.Texture = sourceTexture;
      if (morningGrade) {
        const canvas = document.createElement('canvas');
        canvas.width = sourceTexture.image.width;
        canvas.height = sourceTexture.image.height;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(sourceTexture.image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let offset = 0; offset < pixels.data.length; offset += 4) {
            // Lift the deep-blue night reference into Central Park's warm,
            // hazy morning palette while retaining its skyline geometry.
            pixels.data[offset] = Math.min(255, pixels.data[offset] * 1.02 + 52);
            pixels.data[offset + 1] = Math.min(255, pixels.data[offset + 1] * 1.02 + 40);
            pixels.data[offset + 2] = Math.min(255, pixels.data[offset + 2] * 0.82 + 24);
          }
          context.putImageData(pixels, 0, 0);
          texture = new THREE.CanvasTexture(canvas);
          sourceTexture.dispose();
        }
      }
      configureSkyTexture(texture);
      const previous = skyMaterial.map;
      skyMaterial.map = texture;
      skyMaterial.needsUpdate = true;
      skyTexture = texture;
      if (previous && previous !== texture) previous.dispose();
    },
    undefined,
    () => {
      if (requestedUrl !== skyboxUrl) {
        requestedSkybox = '';
        setEditorSkybox('Environment_CentralPark', '', morningGrade);
      }
    },
  );
}

function setGeneratedEnvironmentSky(environmentId: string, scenarioId: string, top: THREE.Color, horizon: THREE.Color) {
  if (environmentId === 'Environment_CentralPark') return;
  const requestKey = `generated:${environmentId}:${scenarioId}:${top.getHexString()}:${horizon.getHexString()}`;
  if (requestKey === requestedSkybox) return;
  requestedSkybox = requestKey;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${top.getHexString()}`);
  gradient.addColorStop(0.58, `#${horizon.getHexString()}`);
  gradient.addColorStop(1, `#${horizon.clone().multiplyScalar(0.62).getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  configureSkyTexture(texture);
  const previous = skyMaterial.map;
  skyMaterial.map = texture;
  skyMaterial.needsUpdate = true;
  skyTexture = texture;
  if (previous && previous !== texture) previous.dispose();
}

const grid = new THREE.GridHelper(20000, 200, 0x26d9ff, 0x252047);
grid.rotation.x = Math.PI / 2;
grid.position.z = 1;
grid.material.transparent = true;
grid.material.opacity = 0.9;
scene.add(grid);

const majorGrid = new THREE.GridHelper(20000, 20, 0xff3df2, 0x6335ad);
majorGrid.rotation.x = Math.PI / 2;
majorGrid.position.z = 1.1;
majorGrid.material.transparent = true;
majorGrid.material.opacity = 0.76;
scene.add(majorGrid);

const axes = new THREE.AxesHelper(500);
axes.position.z = 3;
scene.add(axes);

const origin = new THREE.Mesh(
  new THREE.SphereGeometry(22, 20, 12),
  new THREE.MeshBasicMaterial({ color: 0xd8ff3e }),
);
origin.position.z = 22;
scene.add(origin);

const hemisphereLight = new THREE.HemisphereLight(0xbdefff, 0x120625, 1.8);
scene.add(hemisphereLight);
const assetLight = new THREE.DirectionalLight(0xffffff, 2.2);
assetLight.position.set(-1200, -1600, 2600);
assetLight.castShadow = true;
assetLight.shadow.mapSize.set(2048, 2048);
assetLight.shadow.camera.near = 10;
assetLight.shadow.camera.far = 12000;
assetLight.shadow.camera.left = -5000;
assetLight.shadow.camera.right = 5000;
assetLight.shadow.camera.top = 5000;
assetLight.shadow.camera.bottom = -5000;
scene.add(assetLight);
const environmentPreviewGroup = new THREE.Group();
environmentPreviewGroup.name = 'JLE_EnvironmentPreview';
scene.add(environmentPreviewGroup);

const environmentPreviewAssets: Record<string, AssetId[]> = {
  Environment_CentralPark: ['static_tree_02', 'static_tree_large_02', 'static_rocksround_one', 'static_reservoirbuildings_building1', 'static_tree_fallen_01'],
  Environment_NewYorkSubway: ['static_metalbeam', 'static_stage_acousticpanel_01', 'static_constructionpathblocker', 'static_stage_speaker', 'static_stage_spotlight'],
  Env_Rio_FreeOfCorruption: ['static_palm_00', 'static_rio_rock_01', 'static_2x2_rio_house_01', 'static_2x3_rio_house_01', 'static_rio_rock_02'],
  Environment_Skypiercer: ['static_building5', 'static_building6', 'static_buildingfill1', 'static_cloudbody', 'static_building5_v2'],
  Environment_Skypiercer_CityCapture_Mumbai_Bitmap: ['static_building63', 'static_shippingcontainer', 'static_tarp_meshes_sm_tarp_03', 'static_tarp_meshes_sm_tarp_05', 'static_building8'],
  Environment_Geiranger: ['static_cliff_07', 'static_cliff_10', 'static_farmountains_mt1', 'static_willowtree_00', 'static_fjord_cruiseship_radiant_vista'],
  Environment_Seoul: ['static_building8', 'static_ledarrowstraight', 'static_artinstallation01', 'static_artinstallation03', 'static_building6_v2'],
  Backdrop_Peony_Mountainrange_ProcPlusLandscape: ['static_torigate01', 'static_sacredgroundstemple', 'static_tree_large_01', 'static_peony_temple_4x5', 'static_temple_tower_5x5_01'],
  Scenario_RainbowDimension: ['static_cloudbody', 'static_heart', 'static_starparticle'],
};

const environmentPalette: Record<string, { background: number; sky: number; ground: number; sun: number }> = {
  Environment_CentralPark: { background: 0x8ac9e4, sky: 0xccefff, ground: 0x315f56, sun: 0xffd2a0 },
  Environment_NewYorkSubway: { background: 0x10131f, sky: 0x8aa0b8, ground: 0x16151a, sun: 0xffd08b },
  Env_Rio_FreeOfCorruption: { background: 0x4fbbe8, sky: 0xc4f7ff, ground: 0x237c66, sun: 0xffe0a3 },
  Environment_Skypiercer: { background: 0x191047, sky: 0xa889ff, ground: 0x241236, sun: 0xff8bd8 },
  Environment_Skypiercer_CityCapture_Mumbai_Bitmap: { background: 0xe08c62, sky: 0xffd1a9, ground: 0x59382d, sun: 0xffb46b },
  Environment_Geiranger: { background: 0x8db7c4, sky: 0xd9f1f4, ground: 0x35565a, sun: 0xe8f7ff },
  Environment_Seoul: { background: 0x182b58, sky: 0x80bfff, ground: 0x17233c, sun: 0xa6d8ff },
  Backdrop_Peony_Mountainrange_ProcPlusLandscape: { background: 0xd7a4bc, sky: 0xffd6dc, ground: 0x593d58, sun: 0xffc09f },
  Scenario_RainbowDimension: { background: 0x5b278d, sky: 0xf2b8ff, ground: 0x28104c, sun: 0xffa9ed },
};

function updateEnvironmentGridBounds(environmentId: string) {
  const subway = environmentId === 'Environment_NewYorkSubway';
  subwayLayoutField.hidden = !subway;
  if (subway) {
    // Crop the authoring grid to the interior footprint extracted from the
    // subway manifests, with a small inset so it does not bleed through the
    // exterior walls.
    const width = 16100;
    const depth = 8640;
    const centerX = 4400;
    const centerY = -5210;
    for (const helper of [grid, majorGrid]) {
      helper.position.x = centerX;
      helper.position.y = centerY;
      helper.scale.set(width / 20000, 1, depth / 20000);
    }
  } else {
    for (const helper of [grid, majorGrid]) {
      helper.position.x = 0;
      helper.position.y = 0;
      helper.scale.set(1, 1, 1);
    }
  }
}

function applyEditorEnvironmentPreview() {
  if (!environmentSelect.value) {
    updateEnvironmentGridBounds('');
    requestedSkybox = '';
    const previous = skyMaterial.map;
    skyMaterial.map = null;
    skyMaterial.needsUpdate = true;
    if (previous) previous.dispose();
    scene.background = new THREE.Color(0x080716);
    scene.fog = null;
    while (environmentPreviewGroup.children.length) environmentPreviewGroup.remove(environmentPreviewGroup.children[0]);
    return;
  }
  const centralParkMorning = environmentSelect.value === 'Environment_CentralPark'
    && timeOfDaySelect.value === 'Scenario_YankeyDoodleMorning';
  const palette = environmentPalette[environmentSelect.value] ?? environmentPalette.Environment_CentralPark;
  updateEnvironmentGridBounds(environmentSelect.value);
  const scenario = timeOfDaySelect.value;
  const isNight = /Night|Rave|Moon|Synth|Cyber|Aurora|Rainbow/i.test(scenario);
  const isStorm = /Storm|Daunting/i.test(scenario);
  const isMorning = /Morning|Dawn/i.test(scenario);
  const isEvening = /Evening|Golden|Halloween/i.test(scenario);
  const isWinter = /Winter/i.test(scenario);
  const isSubway = /Subway/i.test(scenario);
  const sky = new THREE.Color(palette.sky);
  const horizon = new THREE.Color(palette.background);
  if (isNight) {
    sky.multiplyScalar(0.23).lerp(new THREE.Color(0x17285f), 0.58);
    horizon.multiplyScalar(0.3).lerp(new THREE.Color(0x44256f), 0.32);
  } else if (isStorm) {
    sky.lerp(new THREE.Color(0x657582), 0.72);
    horizon.lerp(new THREE.Color(0x45505b), 0.58);
  } else if (isMorning) {
    sky.lerp(new THREE.Color(0xffd9bd), 0.32);
    horizon.lerp(new THREE.Color(0xffae86), 0.38);
  } else if (isEvening) {
    sky.lerp(new THREE.Color(0xb96da8), 0.38);
    horizon.lerp(new THREE.Color(0xff875e), 0.5);
  } else if (isWinter) {
    sky.lerp(new THREE.Color(0xdff6ff), 0.55);
    horizon.lerp(new THREE.Color(0xc8e9f4), 0.45);
  }
  if (isSubway) {
    sky.setHex(0x191b28);
    horizon.setHex(0x332b31);
  }
  setEditorSkybox(environmentSelect.value, scenario, centralParkMorning);
  setGeneratedEnvironmentSky(environmentSelect.value, scenario, sky, horizon);
  scene.background = horizon;
  scene.fog = null;
  hemisphereLight.color.copy(sky);
  hemisphereLight.groundColor.setHex(palette.ground);
  hemisphereLight.intensity = isNight ? 1.15 : isStorm ? 1.45 : isSubway ? 1.05 : 2.15;
  assetLight.color.setHex(isNight ? 0x9cb8ff : isEvening ? 0xffa06e : palette.sun);
  assetLight.intensity = isNight ? 1.45 : isStorm ? 1.72 : isSubway ? 1.55 : 2.8;
  assetLight.position.set(
    isMorning ? -2600 : isEvening ? 2600 : -1200,
    isMorning ? -700 : isEvening ? 800 : -1600,
    isNight ? 1300 : isEvening ? 1500 : 2800,
  );
  skyMaterial.color.setHex(environmentSelect.value === 'Environment_CentralPark'
    ? (isNight ? 0x91a8df : isStorm ? 0x9ba8ad : isEvening ? 0xffc1a1 : 0xffffff)
    : 0xffffff);
  renderer.toneMappingExposure = isNight ? 0.9 : isStorm ? 0.98 : isSubway ? 0.86 : isEvening ? 1.08 : 1.18;
  void rebuildEditorSurroundings(environmentSelect.value);
}

queueMicrotask(applyEditorEnvironmentPreview);

type LegacyAssetId = 'ice_platform_4x4' | 'digital_platform' | 'digital_platform_red'
  | 'capped_platform_tower' | 'ice_platform_2x2' | 'ice_platform_2x3'
  | 'ice_platform_2x4' | 'ice_platform_3x5' | 'frozen_waterfall'
  | 'wooden_platform_2x2' | 'rio_platform_2x2' | 'rio_platform_2x3'
  | 'rio_platform_2x4' | 'rio_platform_2x5' | 'rio_platform_3x3'
  | 'rio_platform_3x5' | 'rio_platform_3x9' | 'rio_platform_4x5'
  | 'skypiercer_tower_2x2' | 'skypiercer_tower_2x3' | 'skypiercer_tower_2x4'
  | 'skypiercer_tower_3x3' | 'skypiercer_tower_3x4' | 'skypiercer_tower_4x4'
  | 'skypiercer_edge_detail' | 'skypiercer_midwall_detail'
  | 'skypiercer_special_1x1' | 'skypiercer_special_2x2'
  | 'skypiercer_special_2x3' | 'tower_wall'
  | 'virtual_platform_dark' | 'virtual_platform_orange' | 'virtual_platform_purple'
  | 'virtual_platform_purple_orange' | 'virtual_platform_white'
  | 'virtual_platform_white_blue' | 'virtual_platform_white_gold'
  | 'virtual_platform_white_orange' | 'virtual_platform_white_red'
  | 'launch_pad' | 'ability_jetfreeze' | 'ability_jethook' | 'ability_jetjellybomb'
  | 'ability_jetleap' | 'ability_jetpolarizer' | 'ability_jetslam'
  | 'energy_pickup' | 'enemy_plain' | 'enemy_gun' | 'enemy_gatling'
  | 'enemy_cannon' | 'enemy_laser' | 'enemy_wall'
  | 'blast_jelly_container' | 'blast_jelly_container_evil'
  | 'blast_jelly_container_grounded' | 'block_tree' | 'calculator'
  | 'damage_box' | 'destructible_hard_real_virtual'
  | 'destructible_hard_virtual' | 'destructible_hard_virtual_fragile'
  | 'hardlight_box' | 'health_pickup' | 'jet_bubble' | 'jetmill'
  | 'jetmill_supercharged' | 'jet_water_surface' | 'juan'
  | 'laser_beam' | 'laser_wall' | 'launch_ring' | 'polarity_flipper'
  | 'statue_the_man' | 'swing_bar' | 'water_body_big'
  | 'ancient_pillar' | 'arcade_token' | 'arcade_token_rainbow'
  | 'artic_spotlight' | 'artic_spotlight_child' | 'basekit_house'
  | 'basekit_small_basewall' | 'basekit_small_basewall_alt' | 'basekit_small_cube_tower'
  | 'basekit_tower' | 'basekit_trip_trap' | 'basekit_trip_trap_no_slope'
  | 'basekit_small_house' | 'basekit_small_house_alt'
  | 'basekit_small_platform' | 'basekit_small_platform_alt_1'
  | 'basekit_small_platform_alt_2' | 'basekit_small_platform_alt_3'
  | 'basekit_small_hollow_cylinder' | 'basekit_small_ramp'
  | 'bg_flood_light' | 'chinese_lantern' | 'concrete_pillar' | 'crane'
  | 'digital_audience_gallery' | 'digital_audience_gallery_synth'
  | 'digital_audience_gallery_white' | 'drone' | 'elevator'
  | 'installation_pillar' | 'kill_cloud' | 'ladder' | 'lars' | 'lcd_screen'
  | 'destructible_leaf_pile' | 'light_pole' | 'light_rims'
  | 'light_rims_arrow_straight' | 'monorail' | 'peony_spectating_box'
  | 'rio_gallery_shard' | 'setback_bounds_waterfall' | 'skypiercer_gallery_shard'
  | 'sky_pillar' | 'sky_platform' | 'sky_platform_blue' | 'sky_platform_gold'
  | 'sky_platform_yellow' | 'spectator_drone' | 'spotlight' | 'swanboat'
  | 'torch_floor' | 'torch_wall' | 'tower_waterfall' | 'wall_monitor'
  | 'wall_monitor_blimp' | 'wall_monitor_blimp_peony' | 'water_pipe'
  | 'water_pipe_etheral' | 'water_pipe_rave' | 'window_cleaner' | 'wooden_platform'
  | 'time_trial_goal' | 'player_start';

// Static-mesh catalogue IDs are data-driven from Dweeb's approved CSV. Keep
// legacy IDs typed above for documentation/backwards compatibility while
// allowing new approved entries without regenerating a giant union type.
type AssetId = LegacyAssetId | string;

type SurfaceGroup = 'platforms' | 'pillars' | 'walls' | 'extras' | 'architecture';
type GameplayGroup = 'game' | 'pickups' | 'traversal' | 'interactable' | 'hazards' | 'misc' | 'level' | 'enemies' | 'props';
type PropGroup = 'props' | 'large' | 'lights' | 'audience' | 'foliage' | 'terrain' | 'architecture' | 'misc';

type EditorVisualProfile = 'basic' | 'orb' | 'target' | 'laserBeam' | 'laserWall' | 'jetmill' | 'polarity' | 'light';

interface AssetDefinitionBase {
  label: string;
  color: number;
  emissive: number;
  baseHeight: number;
  geometry: () => THREE.BufferGeometry;
  description?: string;
  hiddenInPalette?: boolean;
  /** Editor dummy bounds in Unreal centimetres. */
  baseDimensions?: [number, number, number];
  /** Opt-in bounds for extracted GLB previews; omitted means preserve stock mesh size. */
  previewDimensions?: [number, number, number];
  /** Local axes the genuine runtime asset supports scaling along. */
  resizeAxes?: Array<'x' | 'y' | 'z'>;
  /** Default Unreal-style placement rotation in degrees. */
  defaultRotation?: { pitch: number; yaw: number; roll: number };
  /** Stable editor-only opacity used when the runtime material is unavailable. */
  opacity?: number;
  /** Editor-only visual treatment for Blueprint objects without an extracted mesh. */
  visualProfile?: EditorVisualProfile;
  /** Canonical identifier consumed by JLE_ObjectPlacer at runtime. */
  runtimeObjectName?: string;
  /** Runtime support is independent of preview meshes and materials. */
  runtimeMappingStatus?: 'resolved' | 'unresolved';
  /** Whether the actual verification dummy can spawn this asset ID. */
  verificationMappingStatus?: 'supported' | 'unsupported';
  /** Authoritative editor-only gameplay reach visualization, in centimetres. */
  interactionRange?: { radius: number; center: [number, number, number]; source: string };
  /** Runtime-audited local bounds shared by snapping and Preview collision. */
  canonicalBoundsCm?: { min: [number, number, number]; max: [number, number, number] };
}
type AssetDefinition = AssetDefinitionBase & {
  catalog: 'surface' | 'gameplay' | 'props';
  surfaceGroup?: SurfaceGroup;
  gameplayGroup?: GameplayGroup;
  propGroup?: PropGroup;
};

// Blueprint classes are not exportable as individual FModel meshes. Keep
// their editor representation in one metadata table rather than scattering
// visual-only conditions through placement, saving, and export code.
const editorVisualProfiles: Partial<Record<AssetId, EditorVisualProfile>> = {
  player_start: 'orb', time_trial_goal: 'orb', energy_pickup: 'orb', health_pickup: 'orb',
  ability_jetleap: 'orb', ability_jetslam: 'orb', ability_jetjellybomb: 'orb',
  ability_jethook: 'orb', ability_jetfreeze: 'orb', ability_jetpolarizer: 'orb',
  blast_jelly_container: 'polarity', blast_jelly_container_evil: 'polarity',
  blast_jelly_container_grounded: 'polarity',
  // Launch Ring and Swing Bar already communicate their direction through
  // their genuine silhouettes.  Do not add the generic polarity halo to
  // either preview; it obscures those shapes and is not present in-game.
  hardlight_box: 'polarity', jet_bubble: 'polarity',
  // Plain and Cannon are Blueprint-composite targets and therefore have no
  // single exported GLB. Reconstruct their genuine floating target silhouette
  // from editor primitives instead of displaying the old cube/sphere dummy.
  enemy_plain: 'target', enemy_gun: 'target', enemy_gatling: 'target',
  enemy_cannon: 'target', enemy_laser: 'target', enemy_wall: 'target',
  laser_beam: 'laserBeam', laser_wall: 'laserWall', jetmill: 'jetmill', jetmill_supercharged: 'jetmill',
  light_pole: 'light', artic_spotlight: 'light', artic_spotlight_child: 'light', spotlight: 'light',
  bg_flood_light: 'light', chinese_lantern: 'light', torch_floor: 'light', torch_wall: 'light',
};

// Every ordinary gameplay item uses the same neutral authoring placeholder.
// assetId remains the runtime mapping key for the genuine JETRUNNER class.
const dummyPlaceholderGeometry = () => new THREE.BoxGeometry(100, 100, 100);
const surfacePlaceholderGeometry = () => {
  const geometry = new THREE.BoxGeometry(100, 100, 100);
  // JETRUNNER platforms use their top face as the transform origin. Keeping
  // the editor geometry below Z=0 makes vertical resizing extend downward.
  geometry.translate(0, 0, -50);
  return geometry;
};
const topOriginBoxGeometry = (x: number, y: number, z: number) => {
  const geometry = new THREE.BoxGeometry(x, y, z);
  geometry.translate(0, 0, -z / 2);
  return geometry;
};
const skyPlatformGeometry = () => {
  // Canonical 3 x 3 x 1 m Sky Platform in Unreal centimetres.
  return topOriginBoxGeometry(300, 300, 100);
};
const craneGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  const addBox = (x: number, y: number, z: number, px: number, py: number, pz: number) => {
    const part = new THREE.BoxGeometry(x, y, z);
    part.translate(px, py, pz);
    parts.push(part);
  };
  const addBeam = (from: THREE.Vector3, to: THREE.Vector3, thickness = 16) => {
    const direction = to.clone().sub(from);
    const part = new THREE.BoxGeometry(direction.length(), thickness, thickness);
    part.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0), direction.clone().normalize(),
    ));
    part.translate(...from.clone().add(to).multiplyScalar(0.5).toArray());
    parts.push(part);
  };

  // BP_Crane's actor origin is at the slewing platform. In the reference
  // level that origin is 48.06 m above the platform, so the tower extends
  // 48 m downward from here and the mast rises another 10 m above it.
  for (const x of [-55, 55]) for (const y of [-55, 55]) addBox(18, 18, 5800, x, y, -1900);
  for (let z = -4700; z < 900; z += 400) {
    for (const y of [-55, 55]) {
      addBeam(new THREE.Vector3(-55, y, z), new THREE.Vector3(55, y, z + 400), 13);
      addBeam(new THREE.Vector3(55, y, z), new THREE.Vector3(-55, y, z + 400), 13);
    }
  }

  // Main jib, shorter counter-jib, operator cabin and counterweights.
  for (const y of [-65, 65]) addBox(5300, 18, 18, -850, y, 40);
  addBox(3450, 16, 16, -1725, 0, 310);
  for (let x = -3400; x < 1700; x += 350) {
    addBeam(new THREE.Vector3(x, -65, 40), new THREE.Vector3(x + 350, -65, x < 0 ? 310 : 40), 12);
    addBeam(new THREE.Vector3(x, 65, 40), new THREE.Vector3(x + 350, 65, x < 0 ? 310 : 40), 12);
  }
  addBox(520, 360, 420, 150, 0, -120);
  addBox(430, 410, 280, 1670, 0, 10);
  addBox(300, 380, 300, 1670, 0, -280);

  const merged = mergeGeometries(parts, false);
  // Editor-only facing correction. The genuine BP_Crane keeps the authored
  // actor rotation; only this visual dummy is turned around.
  merged.rotateZ(Math.PI);
  parts.forEach((part) => part.dispose());
  return merged;
};
const waterPipeGeometry = () => {
  const body = new THREE.CylinderGeometry(58, 58, 180, 24);
  body.rotateZ(Math.PI / 2);
  body.translate(-20, 0, 0);
  const collar = new THREE.CylinderGeometry(70, 70, 32, 24);
  collar.rotateZ(Math.PI / 2);
  collar.translate(65, 0, 0);
  const merged = mergeGeometries([body, collar], false);
  // Keep this editor-only orientation aligned with the genuine pipe's visible
  // outlet while leaving the exported actor rotation untouched.
  // Editor-only correction: face the outlet the same way as the in-game pipe.
  // The previous 4PI rotation was a no-op and allowed the extracted slab-like
  // Blueprint preview to disguise this purpose-built pipe.
  merged.rotateZ(Math.PI);
  body.dispose();
  collar.dispose();
  return merged;
};
const wallTorchGeometry = () => {
  // Build in the actor's native horizontal frame. Its 90-degree default pitch
  // below turns the long +X handle upright, matching the in-game wall torch.
  const handle = new THREE.CylinderGeometry(18, 28, 190, 12);
  handle.rotateZ(Math.PI / 2);
  handle.translate(115, 0, 0);
  const guard = new THREE.CylinderGeometry(40, 40, 14, 16);
  guard.rotateZ(Math.PI / 2);
  guard.translate(20, 0, 0);
  const head = new THREE.BoxGeometry(72, 54, 70);
  head.translate(-24, 0, 0);
  // A small rear peg makes the wall-facing side unambiguous in the editor.
  const wallPeg = new THREE.CylinderGeometry(9, 9, 58, 10);
  wallPeg.rotateX(Math.PI / 2);
  wallPeg.translate(-22, 42, 0);
  const merged = mergeGeometries([handle, guard, head, wallPeg], false);
  // Bake the upright preview into the dummy. The genuine actor must remain at
  // its native zero rotation or it lies horizontally in-game.
  merged.rotateY(Math.PI / 2);
  // Turn the wall-facing mounting peg 90 degrees left in the editor without
  // changing the rotation exported to the genuine actor.
  merged.rotateZ(Math.PI / 2);
  merged.rotateZ(Math.PI);
  // Keep the compact prop size used by the genuine wall fixture rather than
  // the oversized authoring helper bounds present in its Blueprint export.
  merged.scale(0.5, 0.5, 0.5);
  merged.rotateZ(Math.PI);
  handle.dispose();
  guard.dispose();
  head.dispose();
  wallPeg.dispose();
  return merged;
};
const floorTorchGeometry = () => {
  const legs: THREE.BufferGeometry[] = [];
  for (const [x, y, tiltX, tiltY] of [
    [-34, -16, -0.14, -0.2],
    [34, -16, -0.14, 0.2],
    [0, 34, 0.24, 0],
  ] as const) {
    const leg = new THREE.CylinderGeometry(8, 10, 190, 10);
    leg.rotateX(Math.PI / 2 + tiltX);
    leg.rotateY(tiltY);
    leg.translate(x, y, -12);
    legs.push(leg);
  }
  const brazier = new THREE.CylinderGeometry(38, 28, 34, 16);
  brazier.rotateX(Math.PI / 2);
  brazier.translate(0, 0, 90);
  const rim = new THREE.TorusGeometry(38, 6, 8, 18);
  rim.translate(0, 0, 106);
  const merged = mergeGeometries([...legs, brazier, rim], false);
  // The genuine floor torch is visually much smaller than its original
  // authoring dummy. Scale the editor geometry around its lowest point so it
  // remains planted on the same surface. This does not affect exported scale.
  merged.computeBoundingBox();
  const floorZ = merged.boundingBox?.min.z ?? 0;
  merged.scale(0.5, 0.5, 0.5);
  merged.translate(0, 0, floorZ * 0.5);
  legs.forEach((geometry) => geometry.dispose());
  brazier.dispose();
  rim.dispose();
  return merged;
};
const chineseLanternGeometry = () => {
  const body = new THREE.SphereGeometry(38, 18, 12);
  body.scale(1, 1, 1.18);
  const top = new THREE.CylinderGeometry(19, 24, 12, 14);
  top.rotateX(Math.PI / 2);
  top.translate(0, 0, 48);
  const bottom = new THREE.CylinderGeometry(24, 18, 12, 14);
  bottom.rotateX(Math.PI / 2);
  bottom.translate(0, 0, -48);
  const hanger = new THREE.TorusGeometry(25, 3, 6, 16, Math.PI);
  hanger.rotateX(Math.PI / 2);
  hanger.translate(0, 0, 57);
  const merged = mergeGeometries([body, top, bottom, hanger], false);
  body.dispose();
  top.dispose();
  bottom.dispose();
  hanger.dispose();
  return merged;
};
const ladderGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-38, 38]) {
    const rail = new THREE.CylinderGeometry(7, 7, 240, 10);
    rail.rotateX(Math.PI / 2);
    rail.translate(x, 0, 0);
    parts.push(rail);
  }
  for (let z = -100; z <= 100; z += 40) {
    const rung = new THREE.CylinderGeometry(5, 5, 76, 10);
    rung.rotateZ(Math.PI / 2);
    rung.translate(0, 0, z);
    parts.push(rung);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
};
const basicWallLegsGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  const addBox = (x: number, y: number, z: number, px: number, py: number, pz: number) => {
    const part = new THREE.BoxGeometry(x, y, z);
    part.translate(px, py, pz);
    parts.push(part);
  };
  // The pale inset is deliberately smaller and shallower than the separately
  // rendered structural frame. Keeping the volumes disjoint prevents the
  // coplanar z-fighting that made this wall flash while moving the camera.
  for (const x of [-129, -43, 43, 129]) addBox(82, 12, 202, x, 0, 30);
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
};
const basicWallNoLegsGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-150, -50, 50, 150]) {
    const panel = new THREE.BoxGeometry(94, 12, 232);
    panel.translate(x, 0, 0);
    parts.push(panel);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
};
const basicCubePillarGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  // Five subtly separated one-metre courses match the tall white in-game
  // pillar while retaining one selectable authoring object.
  for (let index = 0; index < 5; index += 1) {
    const course = new THREE.BoxGeometry(198, 198, 96);
    course.translate(0, 0, -48 - index * 100);
    parts.push(course);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
};
const lippedPillarGeometry = () => {
  const body = new THREE.BoxGeometry(92, 92, 92);
  body.translate(0, 0, -50);
  const top = new THREE.BoxGeometry(104, 104, 8);
  top.translate(0, 0, -4);
  const bottom = new THREE.BoxGeometry(104, 104, 8);
  bottom.translate(0, 0, -96);
  const merged = mergeGeometries([body, top, bottom], false);
  body.dispose(); top.dispose(); bottom.dispose();
  return merged;
};
const concretePillarGeometry = () => {
  const body = new THREE.BoxGeometry(96, 96, 100);
  body.translate(0, 0, -50);
  return body;
};
const hollowWhiteCylinderGeometry = () => {
  const shell = new THREE.CylinderGeometry(200, 200, 400, 32, 1, true);
  shell.rotateX(Math.PI / 2);
  const topRim = new THREE.TorusGeometry(200, 9, 10, 32);
  topRim.translate(0, 0, 200);
  const bottomRim = new THREE.TorusGeometry(200, 9, 10, 32);
  bottomRim.translate(0, 0, -200);
  const merged = mergeGeometries([shell, topRim, bottomRim], false);
  shell.dispose();
  topRim.dispose();
  bottomRim.dispose();
  return merged;
};
const woodenPlatformGeometry = () => {
  const deck = new THREE.BoxGeometry(100, 100, 100);
  deck.translate(0, 0, -50);
  return deck;
};
const DUMMY_PLACEHOLDER_ID = 'jle_dummy';
const gltfLoader = new GLTFLoader();
const editorTextureLoader = new THREE.TextureLoader();
const visualModelCache = new Map<string, Promise<THREE.Group>>();

interface EnvironmentManifestTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  quaternion?: [number, number, number, number];
  scale: [number, number, number];
  matrix?: number[];
}

interface EnvironmentManifest {
  schemaVersion: number;
  environment: string;
  assets: Record<string, { unrealPath: string; preview: string; previewAvailable?: boolean }>;
  instances: Record<string, EnvironmentManifestTransform[]>;
  foliage: Record<string, EnvironmentManifestTransform[]>;
}

const environmentManifestCache = new Map<string, Promise<EnvironmentManifest | undefined>>();

function loadEnvironmentManifest(environmentId: string) {
  let pending = environmentManifestCache.get(environmentId);
  if (!pending) {
    const url = `./environments/converted/${encodeURIComponent(environmentId)}.json`;
    editorLog('environment-diagnostic', {
      event: 'manifest-request',
      environmentId,
      url,
      documentUrl: window.location.href,
    });
    pending = fetch(url).then(async (response) => {
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const manifest = await response.json() as EnvironmentManifest;
      if (manifest.schemaVersion !== 1 || !manifest.assets || !manifest.instances) {
        throw new Error(`Unsupported environment manifest schema for ${environmentId}.`);
      }
      editorLog('environment-diagnostic', {
        event: 'manifest-loaded',
        environmentId,
        assets: Object.keys(manifest.assets).length,
        availablePreviews: Object.values(manifest.assets).filter((asset) => asset.previewAvailable === true).length,
        staticInstances: Object.values(manifest.instances).reduce((sum, instances) => sum + instances.length, 0),
        foliageInstances: Object.values(manifest.foliage ?? {}).reduce((sum, instances) => sum + instances.length, 0),
      });
      return manifest;
    }).catch((error) => {
      editorLog('environment-manifest-error', {
        environmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });
    environmentManifestCache.set(environmentId, pending);
  }
  return pending;
}

function editorLog(source: string, message: unknown) {
  const rendered = typeof message === 'string' ? message : JSON.stringify(message);
  console.log(`[${source}] ${rendered}`);
  window.jetrunnerEditor?.logEditor(source, rendered);
}

window.addEventListener('error', (event) => {
  editorLog('renderer-error', `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
});
window.addEventListener('unhandledrejection', (event) => {
  editorLog('renderer-rejection', event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason));
});

function makeFallbackVisualMaterial(assetId: AssetId, materialName: string) {
  const name = materialName.toLowerCase();

  if (name === 'm_invisible') {
    return new THREE.MeshBasicMaterial({ name: materialName, transparent: true, opacity: 0, depthWrite: false });
  }
  if (/bgwindow|windowpanel/.test(name)) {
    return new THREE.MeshStandardMaterial({
      name: materialName, color: 0x203a5b, emissive: 0x4d8dcc,
      emissiveIntensity: 0.42, metalness: 0.48, roughness: 0.2, side: THREE.DoubleSide,
    });
  }
  if (/cinemat_rig|ventilation|seating|stadiumstairs/.test(name)) {
    return new THREE.MeshStandardMaterial({
      name: materialName, color: 0x596873, metalness: 0.36, roughness: 0.52, side: THREE.DoubleSide,
    });
  }
  if (/doorshadow/.test(name)) {
    return new THREE.MeshStandardMaterial({ name: materialName, color: 0x29323a, roughness: 0.78, side: THREE.DoubleSide });
  }
  if (/rainbowcloud/.test(name)) {
    return new THREE.MeshStandardMaterial({
      name: materialName, color: 0xd4d8ff, emissive: 0x7559c7, emissiveIntensity: 0.34,
      transparent: true, opacity: 0.72, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide,
    });
  }
  if (/starmeshparticle/.test(name)) {
    return new THREE.MeshBasicMaterial({ name: materialName, color: assetId.includes('heart') ? 0xff4e9c : 0xffdc4d, toneMapped: false });
  }
  if (/halloween_bone/.test(name)) {
    return new THREE.MeshStandardMaterial({ name: materialName, color: 0xd8cfaf, roughness: 0.76, side: THREE.DoubleSide });
  }

  if (name.includes('mi_atlas_temple02')) {
    const texturePath = './asset-visuals/materials/T_Atlas_01_C.png';
    editorLog('material', `Reconstructing ${materialName} for ${assetId} with ${texturePath}`);
    const colorMap = editorTextureLoader.load(
      texturePath,
      (texture) => editorLog('texture', {
        event: 'loaded', path: texturePath,
        width: texture.image?.width, height: texture.image?.height,
      }),
      undefined,
      (error) => editorLog('texture-error', `${texturePath}: ${String(error)}`),
    );
    colorMap.colorSpace = THREE.SRGBColorSpace;
    // glTF UVs use the opposite vertical texture convention from textures
    // loaded directly by Three.js. Match GLTFLoader's texture setup so the
    // Unreal atlas lands on the intended wooden faces.
    colorMap.flipY = false;
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.magFilter = THREE.NearestFilter;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;
    const material = new THREE.MeshBasicMaterial({
      name: materialName,
      map: colorMap,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      // Editor skins are authoring references. Draw them above the grid and
      // helper geometry so a correctly loaded mesh cannot disappear behind
      // the editor plane because of an imported pivot/depth mismatch.
      depthTest: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    material.needsUpdate = true;
    return material;
  }

  // FModel preserves these Unreal material-slot names, but glTF cannot
  // translate the game's material graphs. Rebuild the important launch-pad
  // materials from the colour parameters exported beside SM_LaunchPad.
  if (name.includes('basicprecioussilver')) {
    return new THREE.MeshStandardMaterial({
      name: materialName,
      color: 0xf4fcff,
      emissive: 0x17232a,
      emissiveIntensity: 0.35,
      metalness: 0.38,
      roughness: 0.26,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
  }
  if (name.includes('launchpademissive')) {
    return new THREE.MeshBasicMaterial({
      name: materialName,
      color: 0xffb12e,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }
  if (name.includes('jellypad')) {
    return new THREE.MeshStandardMaterial({
      name: materialName,
      color: 0xff5100,
      emissive: 0xff2700,
      emissiveIntensity: 1.35,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }
  if (name.includes('launchpadglow')) {
    return new THREE.MeshBasicMaterial({
      name: materialName,
      color: 0xff8a24,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }

  if (name.includes('surface_icewsnow')) {
    return new THREE.MeshStandardMaterial({
      name: materialName,
      color: 0xeafcff,
      emissive: 0x153f55,
      emissiveIntensity: 0.18,
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }
  if (name.includes('surface_ice')) {
    return new THREE.MeshPhysicalMaterial({
      name: materialName,
      color: 0x42dff5,
      emissive: 0x063c68,
      emissiveIntensity: 0.34,
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.08,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
  }

  // Never leave an unsupported Unreal material as the glTF default metallic
  // black. The catalogue colour keeps unknown extracted assets recognisable
  // until a bespoke editor material is added.
  const definition = assetDefinitions[assetId];
  const fallbackSource = `${assetId} ${materialName}`.toLowerCase();
  let fallbackColor = definition?.color ?? 0xd9e7ff;
  // Explicit editor swatches are authoritative for both placed fallbacks and
  // catalogue cards. Only infer a semantic colour for assets that have not
  // been deliberately assigned one (for example, the pink rock family).
  if (!editorAssetColourOverrideIds.has(assetId)) {
    if (/ice|snow|icicle|frozen/.test(fallbackSource)) fallbackColor = 0x7de9f7;
    else if (/tree|bush|flower|foliage|grass|fern|palm|willow/.test(fallbackSource)) fallbackColor = 0x35b878;
    else if (/bone|skull/.test(fallbackSource)) fallbackColor = 0xd8cfaf;
    else if (/rock|cliff|mountain|stone/.test(fallbackSource)) fallbackColor = 0x71838d;
    else if (/window|building|tower|ventilation/.test(fallbackSource)) fallbackColor = 0x354c68;
    else if (/cloud/.test(fallbackSource)) fallbackColor = 0xd8e8ff;
    else if (/heart/.test(fallbackSource)) fallbackColor = 0xff4e9c;
    else if (/star/.test(fallbackSource)) fallbackColor = 0xffdc4d;
    else if (/sign|led|emissive/.test(fallbackSource)) fallbackColor = 0x39dfff;
  }
  // Near-black catalogue swatches are useful UI accents but make an
  // unresolved 3D material indistinguishable from a failed shader.
  if (new THREE.Color(fallbackColor).getHSL({ h: 0, s: 0, l: 0 }).l < 0.055) fallbackColor = 0x65758c;
  return new THREE.MeshStandardMaterial({
    name: materialName || 'JLE_FallbackMaterial',
    color: fallbackColor,
    emissive: definition?.emissive ?? 0x101828,
    emissiveIntensity: 0.28,
    metalness: 0.08,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
}

function repairExtractedMaterials(visual: THREE.Object3D, assetId: AssetId) {
  let renderableMeshCount = 0;
  visual.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    renderableMeshCount += 1;
    child.visible = true;
    child.frustumCulled = false;
    child.renderOrder = 100;
    let loggedFirstDraw = false;
    child.onBeforeRender = () => {
      if (loggedFirstDraw) return;
      loggedFirstDraw = true;
      const geometry = child.geometry;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      editorLog('mesh-draw', {
        assetId,
        mesh: child.name,
        triangles: geometry.index ? geometry.index.count / 3 : geometry.attributes.position?.count / 3,
        materials: materials.map((material) => ({
          name: material.name,
          type: material.type,
          visible: material.visible,
          opacity: material.opacity,
          transparent: material.transparent,
          depthTest: material.depthTest,
          depthWrite: material.depthWrite,
          map: Boolean((material as THREE.MeshBasicMaterial).map),
        })),
      });
    };
    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    child.material = sourceMaterials.map((material) => {
      editorLog('mesh-material', {
        assetId,
        mesh: child.name,
        material: material.name,
        type: material.type,
        visible: child.visible,
      });
      // FModel can emit a placeholder/empty texture for Unreal material
      // instances.  That still makes `map` truthy, so the generic texture
      // test below incorrectly kept a material that renders no pixels.
      // Materials for which JLE has an explicit reconstruction must always
      // win over the material embedded in the extracted glTF.
      const normalizedMaterialName = material.name.toLowerCase();
      if (forcedFlatColourAssetIds.has(assetId)) {
        return makeFallbackVisualMaterial(assetId, material.name);
      }
      // Material graphs are not carried through an FModel GLB export. Some
      // exports nevertheless expose a truthy one-pixel/empty map, which used
      // to pass the generic texture check below and render as a black
      // silhouette. Treat Unreal material-instance slots as unreliable unless
      // they have an explicit reconstruction above; the centralized fallback
      // colour is a more truthful preview than an invalid black texture.
      const requiresEditorReconstruction = /^(?:mi_|m_)/.test(normalizedMaterialName)
        || /(?:mi_atlas_temple02|cinemat_rig|ventilation|bgwindow|windowpanel|doorshadow|seating|stadiumstairs|rainbowcloud|starmeshparticle|halloween_bone|foliage_05_inst|m_invisible)/
          .test(normalizedMaterialName);
      if (requiresEditorReconstruction) {
        editorLog('mesh-material-repaired', {
          assetId,
          mesh: child.name,
          material: material.name,
          reason: 'unreal-only-or-empty-material',
        });
        return makeFallbackVisualMaterial(assetId, material.name);
      }
      const standard = material instanceof THREE.MeshStandardMaterial
        ? material
        : undefined;
      const hasUsableTexture = Boolean(
        standard?.map
        || standard?.emissiveMap
        || standard?.normalMap
        || standard?.metalnessMap
        || standard?.roughnessMap,
      );
      const hasRecoveredColor = Boolean(material.userData?.jleResolvedColor);
      return hasUsableTexture || hasRecoveredColor
        ? material
        : makeFallbackVisualMaterial(assetId, material.name);
    });
  });
  return renderableMeshCount;
}

function loadVisualModel(entry: AssetVisualEntry) {
  const files = entry.files ?? (entry.file ? [entry.file] : []);
  if (files.length === 0) return Promise.reject(new Error('Visual entry has no model files.'));
  const cacheKey = files.join('|');
  let cached = visualModelCache.get(cacheKey);
  if (!cached) {
    editorLog('gltf', { event: 'request', files });
    cached = Promise.all(files.map(async (file) => {
      try {
        const model = await gltfLoader.loadAsync(file);
        editorLog('gltf', { event: 'loaded', file, children: model.scene.children.length });
        return model;
      } catch (error) {
        editorLog('gltf-error', { file, error: error instanceof Error ? error.stack || error.message : String(error) });
        throw error;
      }
    })).then((models) => {
      const group = new THREE.Group();
      models.forEach((model) => group.add(model.scene));
      return group;
    });
    visualModelCache.set(cacheKey, cached);
  }
  return cached;
}

function applyVisualTransform(visual: THREE.Object3D, entry: AssetVisualEntry, assetId?: AssetId) {
  const scale = entry.scale ?? 100;
  if (Array.isArray(scale)) visual.scale.set(...scale);
  else visual.scale.setScalar(scale);
  if (entry.position) visual.position.set(...entry.position);
  if (entry.rotationDegrees) {
    visual.rotation.set(
      THREE.MathUtils.degToRad(entry.rotationDegrees[0]),
      THREE.MathUtils.degToRad(entry.rotationDegrees[1]),
      THREE.MathUtils.degToRad(entry.rotationDegrees[2]),
      'ZYX',
    );
  }
  // FModel exports every glTF preview in the standard Y-up frame, while JLE
  // and Unreal author levels Z-up. This conversion belongs to the preview
  // pipeline, not to a particular asset-name prefix: Blueprint-backed props,
  // gameplay objects, and static meshes all require the same basis change.
  // Environment scene manifests have already had their map transforms
  // converted separately, so only placeable asset previews pass assetId.
  if (assetId !== undefined) visual.rotateX(Math.PI / 2);
}

/** Fit only assets explicitly configured with preview dimensions. */
function fitSurfaceVisualToConfiguredBounds(visual: THREE.Object3D, assetId: AssetId) {
  const definition = assetDefinitions[assetId];
  const target = definition?.previewDimensions;
  if (!definition || !target) return;
  visual.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(visual);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  if (sourceSize.x <= 0.001 || sourceSize.y <= 0.001 || sourceSize.z <= 0.001) return;

  visual.scale.multiply(new THREE.Vector3(
    target[0] / sourceSize.x,
    target[1] / sourceSize.y,
    target[2] / sourceSize.z,
  ));
  visual.updateMatrixWorld(true);
  const fittedBounds = new THREE.Box3().setFromObject(visual);
  const center = fittedBounds.getCenter(new THREE.Vector3());
  // Surface roots use the walkable top face as their placement origin.
  visual.position.x -= center.x;
  visual.position.y -= center.y;
  visual.position.z -= fittedBounds.max.z;
}

function sliceNonIndexedGeometry(
  geometry: THREE.BufferGeometry,
  start: number,
  count: number,
) {
  const sliced = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) continue;
    const itemStart = start * attribute.itemSize;
    const itemEnd = (start + count) * attribute.itemSize;
    const array = attribute.array.slice(itemStart, itemEnd);
    sliced.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
  }
  sliced.computeBoundingBox();
  sliced.computeBoundingSphere();
  return sliced;
}

function flattenVisualMeshes(source: THREE.Object3D) {
  // Some FModel glTF scene hierarchies validate and produce correct bounds,
  // but Chromium never submits their nested primitives. Bake every mesh's
  // hierarchy transform into a fresh geometry and attach plain Mesh objects.
  source.updateMatrixWorld(true);
  const flattened = new THREE.Group();
  source.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const transformed = child.geometry.clone();
    transformed.applyMatrix4(child.matrixWorld);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const groups = transformed.groups;
    if (materials.length > 1 && groups.length > 0) {
      const nonIndexed = transformed.index ? transformed.toNonIndexed() : transformed;
      groups.forEach((group: { start: number; count: number; materialIndex?: number }, groupIndex: number) => {
        const geometry = sliceNonIndexedGeometry(nonIndexed, group.start, group.count);
        const material = materials[group.materialIndex ?? 0] ?? materials[0];
        const bakedMesh = new THREE.Mesh(geometry, material.clone());
        bakedMesh.name = `${child.name}_Material${groupIndex}`;
        flattened.add(bakedMesh);
      });
      if (nonIndexed !== transformed) nonIndexed.dispose();
      transformed.dispose();
    } else {
      transformed.computeBoundingBox();
      transformed.computeBoundingSphere();
      const bakedMesh = new THREE.Mesh(transformed, materials[0].clone());
      bakedMesh.name = child.name;
      flattened.add(bakedMesh);
    }
  });
  return flattened;
}

type BlueprintAssemblyComponent = {
  file?: string;
  primitive?: 'cube' | 'cylinder' | 'plane';
  positionCm: [number, number, number];
  rotationDegrees: [number, number, number];
  scale: [number, number, number];
  matrix?: number[];
};
type BlueprintAssemblyEntry = {
  runtimeObjectName: string;
  boundsCm: { minCm: [number, number, number]; maxCm: [number, number, number]; sizeCm: [number, number, number] };
  components: BlueprintAssemblyComponent[];
};
const blueprintVisualAssemblies = (blueprintAssemblyManifest as unknown as {
  assemblies: Partial<Record<AssetId, BlueprintAssemblyEntry>>;
}).assemblies;

async function loadBlueprintVisualAssembly(entry: BlueprintAssemblyEntry, assetId: AssetId) {
  const assembly = new THREE.Group();
  const uniqueComponents = entry.components.filter((component, index, components) => {
    const key = JSON.stringify([component.file, component.primitive, component.matrix,
      component.positionCm, component.rotationDegrees, component.scale]);
    return components.findIndex((candidate) => JSON.stringify([
      candidate.file, candidate.primitive, candidate.matrix, candidate.positionCm,
      candidate.rotationDegrees, candidate.scale,
    ]) === key) === index;
  });
  await Promise.all(uniqueComponents.map(async (component) => {
    let part: THREE.Object3D;
    if (component.file) {
      const source = await loadVisualModel({ file: component.file });
      part = flattenVisualMeshes(source);
      // Convert FModel metres/Y-up into Unreal centimetres/Z-up before applying
      // the Blueprint component's native relative transform.
      part.scale.setScalar(100);
      part.rotateX(Math.PI / 2);
      if (assetId === 'basekit_small_basewall' || assetId === 'basekit_small_basewall_alt') {
        const trim = /(?:ledge|pillar)/i.test(component.file);
        part.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
          oldMaterials.forEach((material) => material.dispose());
          const material = new THREE.MeshStandardMaterial({
            color: trim ? 0xff7259 : 0xe9f3f7,
            roughness: 0.66,
            metalness: 0.04,
            // Some extracted wall sections retain Unreal's opposite winding
            // after basis conversion. Render both faces without changing the
            // mesh topology used by the assembly baker.
            side: THREE.DoubleSide,
          });
          material.userData.jleResolvedColor = true;
          child.material = material;
        });
      } else if (assetId === 'basekit_small_ramp') {
        const accent = /ledge|wallshort|wallslanted/i.test(component.file);
        part.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
          oldMaterials.forEach((material) => material.dispose());
          const material = new THREE.MeshStandardMaterial({
            color: accent ? 0xff7259 : 0xf3f6fa,
            roughness: 0.68,
            metalness: 0.03,
          });
          material.userData.jleResolvedColor = true;
          child.material = material;
        });
      }
    } else {
      const material = new THREE.MeshStandardMaterial({ color: 0xd9e3ec, roughness: 0.7 });
      const geometry = component.primitive === 'cylinder'
        ? new THREE.CylinderGeometry(50, 50, 100, 24)
        : component.primitive === 'plane'
          ? new THREE.BoxGeometry(100, 100, 0.02)
          : new THREE.BoxGeometry(100, 100, 100);
      if (component.primitive === 'cylinder') geometry.rotateX(Math.PI / 2);
      part = new THREE.Mesh(geometry, material);
    }
    const componentRoot = new THREE.Group();
    if (component.matrix) {
      componentRoot.matrix.fromArray(component.matrix);
      if ((assetId === 'basekit_small_basewall' || assetId === 'basekit_small_basewall_alt')
        && /ledgefloor/i.test(component.file ?? '')) {
        // Align the extracted horizontal ledges with the four wall panels and
        // vertical frame. The raw SCS transforms sit one 2 m module left.
        componentRoot.matrix.elements[12] += 200;
      }
      componentRoot.matrixAutoUpdate = false;
    } else {
      componentRoot.position.set(...component.positionCm);
      componentRoot.rotation.set(
        THREE.MathUtils.degToRad(component.rotationDegrees[0]),
        THREE.MathUtils.degToRad(component.rotationDegrees[1]),
        THREE.MathUtils.degToRad(component.rotationDegrees[2]),
        'ZYX',
      );
      componentRoot.scale.set(...component.scale);
    }
    componentRoot.add(part);
    assembly.add(componentRoot);
  }));
  return assembly;
}

const skyPlatformAssetIds = new Set<AssetId>([
  'sky_platform', 'sky_platform_blue', 'sky_platform_gold', 'sky_platform_yellow',
]);

function centerVisualOnTopOrigin(visual: THREE.Object3D) {
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const center = bounds.getCenter(new THREE.Vector3());
  visual.position.set(-center.x, -center.y, -bounds.max.z);
  visual.updateMatrixWorld(true);
  return bounds.getSize(new THREE.Vector3());
}

/** Rebuild BP_SkyPlatform's default construction-script assembly. */
function buildSkyPlatformVisual(source: THREE.Object3D, assetId: AssetId) {
  const sourceScenes = source.children;
  if (sourceScenes.length < 2) throw new Error('Sky Platform requires its side and corner component meshes.');

  const side = flattenVisualMeshes(sourceScenes[0]);
  const corner = flattenVisualMeshes(sourceScenes[1]);
  // The two GLBs are FModel Y-up exports. Convert and scale the components
  // before arranging the four Blueprint sides and corners in JLE's Z-up frame.
  applyVisualTransform(side, { scale: 100 }, assetId);
  applyVisualTransform(corner, { scale: 100 }, assetId);
  const sideSize = centerVisualOnTopOrigin(side);
  centerVisualOnTopOrigin(corner);

  const assembly = new THREE.Group();
  const longAxis = Math.max(sideSize.x, sideSize.y);
  const edgeCenter = longAxis / 2;
  const addPart = (template: THREE.Object3D, x: number, y: number, rotationZ: number) => {
    const part = template.clone(true);
    part.position.set(x, y, 0);
    part.rotation.z = rotationZ;
    assembly.add(part);
  };

  // Platform_PlatformSide is long on local Y after basis conversion.
  addPart(side, edgeCenter, 0, 0);
  addPart(side, -edgeCenter, 0, Math.PI);
  addPart(side, 0, edgeCenter, -Math.PI / 2);
  addPart(side, 0, -edgeCenter, Math.PI / 2);
  addPart(corner, edgeCenter, edgeCenter, 0);
  addPart(corner, -edgeCenter, edgeCenter, Math.PI / 2);
  addPart(corner, -edgeCenter, -edgeCenter, Math.PI);
  addPart(corner, edgeCenter, -edgeCenter, -Math.PI / 2);

  // BP_SkyPlatform uses Engine Plane components for its top and underside;
  // recreate those construction components while retaining the genuine frame.
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9eaf3,
    roughness: 0.48,
    metalness: 0.28,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(longAxis, longAxis, 8), deckMaterial);
  top.position.z = -5;
  top.name = 'SkyPlatform_TopPlane';
  assembly.add(top);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(longAxis, longAxis, 6), deckMaterial.clone());
  bottom.position.z = -155;
  bottom.name = 'SkyPlatform_BottomPlane';
  assembly.add(bottom);
  return assembly;
}

function usesProceduralEditorVisual(assetId: AssetId) {
  return assetId === 'crane'
    || assetId === 'light_rims'
    || assetId === 'wooden_platform'
    || assetId === 'wooden_platform_2x2'
    // These Blueprint exports contain helper/light/collision components or
    // multiple component meshes. Their centralized editor representations
    // are intentionally authoritative and must not be replaced by a GLB.
    || assetId === 'chinese_lantern'
    || assetId === 'torch_floor'
    || assetId === 'torch_wall'
    || assetId === 'ladder'
    || assetId === 'water_pipe'
    || assetId === 'water_pipe_etheral'
    || assetId === 'water_pipe_rave'
    || assetId === 'blast_jelly_container'
    || assetId === 'blast_jelly_container_evil'
    || assetId === 'blast_jelly_container_grounded'
    || assetId === 'jet_bubble'
    || assetId === 'jet_water_surface'
    || assetId === 'laser_beam'
    || assetId === 'laser_wall'
    || assetId === 'ancient_pillar'
    || assetId === 'basekit_small_hollow_cylinder'
    || assetId === 'static_basekit_floor_01'
    || assetId === 'static_basekit_floorcylinder_01'
    || assetId === 'static_basekit_floorquartercylinder_01';
}

async function attachAssetVisual(mesh: THREE.Mesh, assetId: AssetId, preview: boolean) {
  // The crane uses a purpose-built complete preview. Its extracted files are
  // separate Blueprint components with large local offsets; merging them as
  // one ordinary GLB stretches the assembly across the viewport. Resizable
  // authoring surfaces likewise retain their exact procedural geometry.
  // The compact legacy pipe preview communicates placement much more clearly
  // than the tall runtime assembly and its stretched tube. Keep the genuine
  // runtime Blueprint mapping for export, but do not replace the editor model.
  const usesLegacyPipeVisual = assetId === 'water_pipe'
    || assetId === 'water_pipe_etheral'
    || assetId === 'water_pipe_rave';
  if (usesLegacyPipeVisual) return;
  const assemblyEntry = blueprintVisualAssemblies[assetId];
  if (usesProceduralEditorVisual(assetId) && !assemblyEntry) return;
  const entry = assetVisuals[assetId];
  if (!entry && !assemblyEntry) return;
  try {
    editorLog('visual', { event: 'attach-start', assetId, preview, entry });
    const source = assemblyEntry
      ? await loadBlueprintVisualAssembly(assemblyEntry, assetId)
      : await loadVisualModel(entry!);
    if (!mesh.parent) return;
    // A successfully resolved runtime visual is authoritative. Procedural
    // details attached while the async model loaded must not remain behind it.
    for (const child of [...mesh.children]) {
      if (!child.userData.editorVisual) continue;
      mesh.remove(child);
      disposeObjectResources(child);
    }
    // FModel scenes can contain nested transforms which Chromium occasionally
    // fails to submit. More importantly, retaining those scenes as children of
    // the authoring dummy leaves a translucent cube visible through the real
    // prop. Flatten every successfully imported catalogue visual and bake it
    // into the selectable root. Collision and entity data still belong to the
    // root, but its rendered geometry is now exclusively the genuine prop.
    const isSkyPlatform = skyPlatformAssetIds.has(assetId);
    const isBlueprintAssembly = Boolean(assemblyEntry);
    const visual = isSkyPlatform
      ? buildSkyPlatformVisual(source, assetId)
      : isBlueprintAssembly ? source : flattenVisualMeshes(source);
    visual.name = 'JLE_VisualOverlay';
    visual.userData.editorVisual = true;
    const renderableMeshCount = repairExtractedMaterials(visual, assetId);
    if (renderableMeshCount === 0) {
      throw new Error('The extracted GLB does not contain a renderable mesh.');
    }
    visual.traverse((child) => {
      child.userData.editorVisual = true;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.raycast = () => undefined;
        if (preview) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          child.material = materials.map((sourceMaterial) => {
            const material = sourceMaterial.clone();
            material.transparent = true;
            material.opacity *= 0.58;
            material.depthWrite = false;
            material.depthTest = false;
            return material;
          });
          child.renderOrder = 250;
        }
      }
    });
    if (!isSkyPlatform && !isBlueprintAssembly) applyVisualTransform(visual, entry!, assetId);
    if (!isBlueprintAssembly) fitSurfaceVisualToConfiguredBounds(visual, assetId);
    {
      // Render the extracted geometry through the selectable root Mesh. The
      // same geometry was not submitted by Chromium while nested beneath the
      // authoring mesh, whereas the root render path is known to work.
      visual.updateMatrixWorld(true);
      const bakedGeometries: THREE.BufferGeometry[] = [];
      const bakedMaterials: THREE.Material[] = [];
      visual.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const geometry = child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
        bakedGeometries.push(geometry);
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        bakedMaterials.push(childMaterials[0].clone());
      });
      const mergedGeometry = mergeGeometries(bakedGeometries, true);
      if (!mergedGeometry) throw new Error(`Could not merge the extracted mesh parts for ${assetId}.`);
      mesh.geometry.dispose();
      mesh.geometry = mergedGeometry;
      mesh.geometry.computeBoundingBox();
      // The genuine assembly is now baked into this root. From this point on,
      // use its measured local bounds for selection, snapping, and Preview
      // collision instead of separately converted manifest extents.
      mesh.userData.hasAuthoritativeVisualBounds = true;
      if (preview) {
        bakedMaterials.forEach((material) => {
          material.transparent = true;
          material.opacity *= 0.58;
          material.depthWrite = false;
          material.depthTest = false;
        });
      }
      mesh.material = bakedMaterials;
      mesh.frustumCulled = false;
      mesh.renderOrder = 100;
      bakedGeometries.forEach((geometry) => geometry.dispose());
      editorLog('visual', {
        event: 'baked-into-root', assetId,
        vertices: mergedGeometry.attributes.position?.count,
        triangles: mergedGeometry.index ? mergedGeometry.index.count / 3 : mergedGeometry.attributes.position?.count / 3,
        hasUv: Boolean(mergedGeometry.attributes.uv),
      });
      refreshAssetPresentation(mesh);
      return;
    }
  } catch (error) {
    console.warn(`Could not load visual overlay for ${assetId}`, error);
    editorLog('visual-error', { assetId, error: error instanceof Error ? error.stack || error.message : String(error) });
  }
}

let environmentPreviewRequest = 0;

function vectorLogValue(value: THREE.Vector3) {
  return value.toArray().map((component) => Number(component.toFixed(2)));
}

function transformPositionBounds(transforms: EnvironmentManifestTransform[]) {
  const bounds = new THREE.Box3();
  transforms.forEach((transform) => {
    bounds.expandByPoint(new THREE.Vector3(
      transform.position[0],
      -transform.position[1],
      transform.position[2],
    ));
  });
  return bounds.isEmpty()
    ? undefined
    : { min: vectorLogValue(bounds.min), max: vectorLogValue(bounds.max) };
}

function logEnvironmentSceneState(environmentId: string, event: string) {
  environmentPreviewGroup.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(environmentPreviewGroup);
  editorLog('environment-diagnostic', {
    event,
    environmentId,
    groupVisible: environmentPreviewGroup.visible,
    groupChildren: environmentPreviewGroup.children.length,
    worldBounds: bounds.isEmpty()
      ? undefined
      : {
        min: vectorLogValue(bounds.min),
        max: vectorLogValue(bounds.max),
        size: vectorLogValue(bounds.getSize(new THREE.Vector3())),
        center: vectorLogValue(bounds.getCenter(new THREE.Vector3())),
      },
    camera: {
      position: vectorLogValue(camera.position),
      target: vectorLogValue(controls.target),
      near: camera.near,
      far: camera.far,
    },
    renderer: {
      width: renderer.domElement.width,
      height: renderer.domElement.height,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    },
  });
}

function manifestTransformMatrix(transform: EnvironmentManifestTransform) {
  const position = new THREE.Vector3(
    transform.position[0],
    -transform.position[1],
    transform.position[2],
  );
  const quaternion = transform.quaternion
    ? new THREE.Quaternion(
      -transform.quaternion[0],
      transform.quaternion[1],
      -transform.quaternion[2],
      transform.quaternion[3],
    )
    : new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(-transform.rotation[0]),
      THREE.MathUtils.degToRad(transform.rotation[1]),
      THREE.MathUtils.degToRad(-transform.rotation[2]),
      'ZYX',
    ));
  return new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(...transform.scale));
}

function configureEnvironmentPreviewMaterial(sourceMaterial: THREE.Material, unrealPath = '') {
  const sourceStandard = sourceMaterial instanceof THREE.MeshStandardMaterial
    ? sourceMaterial
    : undefined;
  const materialName = sourceMaterial.name.toLowerCase();
  const visualHint = `${materialName} ${unrealPath.toLowerCase()}`;
  const isTransparentShell = /holoskydome|glass|window/.test(visualHint);
  let material: THREE.Material;

  if (sourceStandard && !sourceStandard.map) {
    let color = 0x68748b;
    if (/gold|yellow|warning/.test(visualHint)) color = 0xd79a37;
    else if (/foliage|leaf|tree|grass|bush|plant/.test(visualHint)) color = 0x47785c;
    else if (/wood|timber|trunk/.test(visualHint)) color = 0x76513b;
    else if (/snow|ice|arctic/.test(visualHint)) color = 0xb7dbe4;
    else if (/rock|stone|cliff|mountain/.test(visualHint)) color = 0x687078;
    else if (/concrete|cement|brick|wall/.test(visualHint)) color = 0x747d8d;
    else if (/seating/.test(visualHint)) color = 0x3f2a68;
    else if (/metal|plate|trim|beam|support|rail/.test(visualHint)) color = 0x536078;
    else if (/plastic/.test(visualHint)) color = 0x27304d;
    else if (/holo/.test(visualHint)) color = 0x8068d9;
    else if (/glass|window/.test(visualHint)) color = 0x79b7d8;
    // Missing Unreal material graphs use a stable semantic colour, but remain
    // light-reactive so their shape and depth are readable in the viewport.
    material = new THREE.MeshStandardMaterial({
      name: sourceMaterial.name,
      color,
      emissive: new THREE.Color(color).multiplyScalar(0.04),
      emissiveIntensity: 0.35,
      roughness: 0.72,
      metalness: /metal|plate|trim|beam|support|rail/.test(visualHint) ? 0.28 : 0.03,
      side: THREE.DoubleSide,
      transparent: isTransparentShell,
      opacity: isTransparentShell ? (/holoskydome/.test(visualHint) ? 0.035 : 0.14) : 1,
      depthWrite: !isTransparentShell,
    });
  } else {
    material = sourceMaterial.clone();
    material.side = THREE.DoubleSide;
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    // FModel GLBs preserve Unreal material names, but complex UE material
    // graphs are commonly exported without their texture graph or blend mode.
    // In particular, an opaque HoloSkyDome encloses the camera and hides every
    // other Skypiercer mesh. Restore preview-safe shell transparency here.
    if (isTransparentShell) {
      material.transparent = true;
      material.opacity = /holoskydome/.test(materialName) ? 0.08 : 0.2;
      material.depthWrite = false;
    }

    // Use deterministic, semantic flat colours when no texture was exported.
    // This is preferable to a featureless white/black object and does not
    // affect the canonical Unreal asset mapping used by the runtime compiler.
  }

  material.needsUpdate = true;
  return material;
}

async function buildInstancedEnvironment(environmentId: string, request: number) {
  const manifest = await loadEnvironmentManifest(environmentId);
  if (!manifest || request !== environmentPreviewRequest) {
    editorLog('environment-diagnostic', {
      event: 'manifest-aborted', environmentId, request,
      currentRequest: environmentPreviewRequest,
      manifestFound: Boolean(manifest),
    });
    return false;
  }
  const availableAssets = Object.entries(manifest.assets)
    .filter(([, asset]) => asset.previewAvailable === true);
  if (availableAssets.length === 0) {
    editorLog('environment-manifest', {
      environmentId,
      mode: 'metadata-only',
      uniqueMeshes: Object.keys(manifest.assets).length,
      message: 'No exported preview GLBs are present; using the existing surroundings fallback.',
    });
    return false;
  }

  let instanceCount = 0;
  let primitiveCount = 0;
  for (const [assetKey, asset] of availableAssets) {
    if (
      environmentId === 'Backdrop_Peony_Mountainrange_ProcPlusLandscape'
      && /\/engine\/content\/basicshapes\/plane$/i.test(asset.unrealPath)
    ) {
      editorLog('environment-diagnostic', {
        event: 'preview-only-asset-hidden',
        environmentId,
        assetKey,
        unrealPath: asset.unrealPath,
        reason: 'Peony death-barrier plane',
      });
      continue;
    }
    const transforms = [
      ...(manifest.instances[assetKey] ?? []),
      ...(manifest.foliage?.[assetKey] ?? []),
    ];
    if (transforms.length === 0) continue;
    const preview = asset.preview.replace(/^\.\//, '');
    const file = `./environments/converted/${preview}`;
    try {
      const source = await loadVisualModel({ file });
      if (request !== environmentPreviewRequest) return false;
      const flattened = flattenVisualMeshes(source);
      const sourceBounds = new THREE.Box3().setFromObject(flattened);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      // FModel's glTF export is metre-scaled while Unreal/JLE transforms are
      // expressed in centimetres. Apply this once to the shared source mesh;
      // instance positions and authored scale remain untouched.
      const conversion = new THREE.Matrix4()
        .makeRotationX(Math.PI / 2)
        .scale(new THREE.Vector3(100, 100, 100));
      flattened.updateMatrixWorld(true);
      flattened.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // Environment shells (notably Skypiercer stadium) are authored with
        // outward-facing normals. The editor camera sits inside that shell,
        // so FrontSide culling makes a successfully loaded environment appear
        // completely absent. Use local material clones so catalogue previews
        // remain unchanged while both sides of environment geometry render.
        const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
        const materials = sourceMaterials.map((material) => (
          configureEnvironmentPreviewMaterial(material, asset.unrealPath)
        ));
        const geometry = child.geometry;
        // A one-element material array makes Three.js draw only explicit
        // geometry groups. Flattened FModel primitives have no groups, which
        // left them present in scene bounds while producing no visible draw.
        const instancedMaterial = materials.length === 1 ? materials[0] : materials;
        const instanced = new THREE.InstancedMesh(geometry, instancedMaterial, transforms.length);
        transforms.forEach((transform, index) => {
          // The placement is Unreal Z-up. FModel GLBs are glTF Y-up, so only
          // the shared source mesh receives the axis conversion.
          const matrix = manifestTransformMatrix(transform).multiply(conversion);
          // Peony's far mountain kit is authored substantially higher than
          // the playable area. The game presents it as a low horizon, so keep
          // only those background/cliff assets below the editor work plane.
          if (
            environmentId === 'Backdrop_Peony_Mountainrange_ProcPlusLandscape'
            && /farplateau|\/cliffs?\//i.test(asset.unrealPath)
          ) {
            // Keep the raw background clear of Player Start while retaining
            // enough mountain height to read as a nearby horizon.
            matrix.elements[14] -= 40000;
          }
          instanced.setMatrixAt(index, matrix);
        });
        instanced.instanceMatrix.needsUpdate = true;
        instanced.name = `EnvironmentInstances_${assetKey}_${primitiveCount}`;
        instanced.userData.environmentPreview = true;
        instanced.userData.unrealPath = asset.unrealPath;
        // Every upward-facing part of the base subway can be authored on.
        // Filtering by a short mesh-name allowlist left stairs and modular
        // platform pieces visible but impossible to build on.
        const isSubwayPlacementSurface = environmentId === 'Environment_NewYorkSubway';
        instanced.userData.environmentPlacementSurface = isSubwayPlacementSurface;
        // Environment scenery is normally non-interactive. Retain the native
        // InstancedMesh raycast only for the subway base. Placement retains
        // each face's world-space normal so floors, walls and ceilings all
        // support flush object placement.
        if (!isSubwayPlacementSurface) instanced.raycast = () => undefined;
        instanced.castShadow = true;
        instanced.receiveShadow = true;
        instanced.frustumCulled = false;
        environmentPreviewGroup.add(instanced);
        primitiveCount += 1;
      });
      instanceCount += transforms.length;
      editorLog('environment-diagnostic', {
        event: 'asset-instanced',
        environmentId,
        assetKey,
        unrealPath: asset.unrealPath,
        file,
        instances: transforms.length,
        sourceSizeMetres: vectorLogValue(sourceSize),
        placementBoundsCentimetres: transformPositionBounds(transforms),
      });
    } catch (error) {
      editorLog('environment-mesh-error', {
        environmentId,
        assetKey,
        unrealPath: asset.unrealPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (primitiveCount === 0) return false;
  editorLog('environment', {
    environmentId,
    mode: 'instanced-manifest',
    uniqueMeshes: availableAssets.length,
    primitives: primitiveCount,
    instances: instanceCount,
  });
  logEnvironmentSceneState(environmentId, 'manifest-build-complete');
  requestAnimationFrame(() => logEnvironmentSceneState(environmentId, 'first-render-frame'));
  window.setTimeout(() => {
    if (request === environmentPreviewRequest) logEnvironmentSceneState(environmentId, 'settled-render-frame');
  }, 250);
  return true;
}

async function rebuildEditorSurroundings(environmentId: string) {
  const request = ++environmentPreviewRequest;
  editorLog('environment-diagnostic', {
    event: 'rebuild-start',
    environmentId,
    request,
    previousChildren: environmentPreviewGroup.children.length,
    cameraPosition: vectorLogValue(camera.position),
    cameraTarget: vectorLogValue(controls.target),
  });
  while (environmentPreviewGroup.children.length) {
    environmentPreviewGroup.remove(environmentPreviewGroup.children[0]);
  }
  if (environmentId === 'Environment_NewYorkSubway') {
    const baseBuilt = await buildInstancedEnvironment(environmentId, request);
    const extensionId = subwayLayoutSelect.value === 'two-layer'
      ? 'EnvironmentExtension_NewYorkSubway_SecondFloor'
      : 'EnvironmentExtension_NewYorkSubway_Roof';
    const extensionBuilt = await buildInstancedEnvironment(extensionId, request);
    if (baseBuilt || extensionBuilt) {
      editorLog('environment', {
        environmentId,
        mode: 'subway-composite',
        layout: subwayLayoutSelect.value,
        extensionId,
      });
      return;
    }
  } else if (await buildInstancedEnvironment(environmentId, request)) return;
  const combinedEntry = environmentScenes[environmentId];
  if (combinedEntry) {
    try {
      const source = await loadVisualModel(combinedEntry);
      if (request !== environmentPreviewRequest) return;
      const visual = cloneScene(source);
      applyVisualTransform(visual, combinedEntry);
      visual.name = `EnvironmentScene_${environmentId}`;
      visual.traverse((child) => {
        child.userData.environmentPreview = true;
        if (!(child instanceof THREE.Mesh)) return;
        child.raycast = () => undefined;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      });
      environmentPreviewGroup.add(visual);
      editorLog('environment', { environmentId, mode: 'combined-scene', objects: 1 });
      return;
    } catch (error) {
      editorLog('environment-error', {
        environmentId,
        mode: 'combined-scene',
        error: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  }
  const assetIds = environmentPreviewAssets[environmentId] ?? environmentPreviewAssets.Environment_CentralPark;
  const placements = [
    [0, 1500, 0], [-1700, 1850, 0], [1700, 1850, 0], [-2900, 2200, 0], [2900, 2200, 0],
    [3500, 300, 0], [-3500, 300, 0],
    [-4100, -1100, 0], [-1900, -4100, 0], [1900, -4100, 0], [4100, -1100, 0],
    [3900, 2400, 0], [0, 4100, 0], [-3900, 2400, 0],
  ] as const;
  await Promise.all(placements.map(async (placement, index) => {
    const assetId = assetIds[index % assetIds.length];
    const entry = assetVisuals[assetId];
    if (!entry) return;
    try {
      const source = await loadVisualModel(entry);
      if (request !== environmentPreviewRequest) return;
      const visual = flattenVisualMeshes(source);
      repairExtractedMaterials(visual, assetId);
      applyVisualTransform(visual, entry, assetId);
      visual.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(visual);
      const size = bounds.getSize(new THREE.Vector3());
      const desiredHeight = /building|temple|cliff|mountain/.test(assetId) ? 3400
        : /tree|palm|willow/.test(assetId) ? 1900
          : 1250;
      // These are backdrop pieces, so normalize against their upright Z
      // extent. Using the largest horizontal dimension made cliffs, towers,
      // trees and long buildings almost flat at the horizon.
      const scale = desiredHeight / Math.max(size.z, 1);
      visual.scale.multiplyScalar(scale);
      visual.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(visual);
      visual.position.set(placement[0], placement[1], placement[2] - scaledBounds.min.z - 120);
      visual.rotation.z += Math.atan2(-placement[1], -placement[0]);
      editorLog('environment-object', {
        environmentId, assetId, sourceSize: size.toArray(), desiredHeight,
        appliedScale: scale, position: visual.position.toArray(),
      });
      visual.name = `Environment_${assetId}_${index}`;
      visual.traverse((child) => {
        child.userData.environmentPreview = true;
        if (child instanceof THREE.Mesh) {
          child.raycast = () => undefined;
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
          child.renderOrder = -50;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            material.depthTest = false;
            material.depthWrite = false;
            material.needsUpdate = true;
          });
        }
      });
      if (request === environmentPreviewRequest) environmentPreviewGroup.add(visual);
    } catch (error) {
      editorLog('environment-error', {
        environmentId, assetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }));
  editorLog('environment', { environmentId, objects: environmentPreviewGroup.children.length });
}

/**
 * Central default dimensions for the legacy, named surface Blueprints.  The
 * scale saved to a level remains 1/1/1; only the authored preview footprint
 * changes.  This deliberately preserves explicit 2x2/2x3/etc. variants
 * without turning unrelated asset categories into one-metre cubes.
 */
function namedSurfaceDefaultDimensions(label: string): [number, number, number] {
  const explicitFootprint = label.match(/\b(\d+)\s*[x×]\s*(\d+)\b/i);
  if (!explicitFootprint) return [100, 100, 100];
  return [Number(explicitFootprint[1]) * 100, Number(explicitFootprint[2]) * 100, 100];
}

function surfaceDefinition(
  label: string,
  color: number,
  surfaceGroup: SurfaceGroup,
): AssetDefinition {
  const baseDimensions = namedSurfaceDefaultDimensions(label);
  return {
    label,
    color,
    emissive: 0x07152c,
    baseHeight: 0,
    geometry: () => topOriginBoxGeometry(...baseDimensions),
    baseDimensions,
    catalog: 'surface',
    surfaceGroup,
  };
}

const assetDefinitions: Record<AssetId, AssetDefinition> = {
  capped_platform_tower: surfaceDefinition('Capped Platform Tower', 0x6e91b8, 'pillars'),
  ice_platform_2x2: surfaceDefinition('Ice Platform 2x2', 0x57e7ff, 'platforms'),
  ice_platform_2x3: surfaceDefinition('Ice Platform 2x3', 0x50e2ff, 'platforms'),
  ice_platform_2x4: surfaceDefinition('Ice Platform 2x4', 0x49dcff, 'platforms'),
  ice_platform_3x5: surfaceDefinition('Ice Platform 3x5', 0x40d5ff, 'platforms'),
  frozen_waterfall: surfaceDefinition('Frozen Waterfall', 0x82f3ff, 'extras'),
  wooden_platform_2x2: {
    ...surfaceDefinition('Wooden Platform 2x2', 0xa86d3c, 'platforms'),
    geometry: () => topOriginBoxGeometry(200, 200, 100),
    baseDimensions: [200, 200, 100],
    resizeAxes: ['x', 'y'],
  },
  rio_platform_2x2: surfaceDefinition('Rio Platform 2x2', 0x38d9cc, 'platforms'),
  rio_platform_2x3: surfaceDefinition('Rio Platform 2x3', 0x34d2c5, 'platforms'),
  rio_platform_2x4: surfaceDefinition('Rio Platform 2x4', 0x31cabd, 'platforms'),
  rio_platform_2x5: surfaceDefinition('Rio Platform 2x5', 0x2dc3b5, 'platforms'),
  rio_platform_3x3: surfaceDefinition('Rio Platform 3x3', 0x2abaae, 'platforms'),
  rio_platform_3x5: surfaceDefinition('Rio Platform 3x5', 0x27b2a7, 'platforms'),
  rio_platform_3x9: surfaceDefinition('Rio Platform 3x9', 0x23aa9f, 'platforms'),
  rio_platform_4x5: surfaceDefinition('Rio Platform 4x5', 0x20a297, 'platforms'),
  skypiercer_tower_2x2: surfaceDefinition('Skypiercer Tower 2x2', 0x9ec9ff, 'pillars'),
  skypiercer_tower_2x3: surfaceDefinition('Skypiercer Tower 2x3', 0x95c3ff, 'pillars'),
  skypiercer_tower_2x4: surfaceDefinition('Skypiercer Tower 2x4', 0x8cbdff, 'pillars'),
  skypiercer_tower_3x3: surfaceDefinition('Skypiercer Tower 3x3', 0x83b7ff, 'pillars'),
  skypiercer_tower_3x4: surfaceDefinition('Skypiercer Tower 3x4', 0x7ab1ff, 'pillars'),
  skypiercer_tower_4x4: surfaceDefinition('Skypiercer Tower 4x4', 0x71abff, 'pillars'),
  skypiercer_edge_detail: surfaceDefinition('Skypiercer Edge Detail', 0xb5d8ff, 'walls'),
  skypiercer_midwall_detail: surfaceDefinition('Skypiercer Mid-Wall Detail', 0xa9d1ff, 'walls'),
  skypiercer_special_1x1: surfaceDefinition('Skypiercer Special 1x1', 0xc1deff, 'extras'),
  skypiercer_special_2x2: surfaceDefinition('Skypiercer Special 2x2', 0xb8d8ff, 'extras'),
  skypiercer_special_2x3: surfaceDefinition('Skypiercer Special 2x3', 0xafd2ff, 'extras'),
  tower_wall: surfaceDefinition('Tower Wall', 0x7895ba, 'walls'),
  ice_platform_4x4: {
    label: 'Ice platform',
    color: 0x35dfff,
    emissive: 0x073a55,
    baseHeight: 0,
    geometry: surfacePlaceholderGeometry,
    baseDimensions: [100, 100, 100],
    catalog: 'surface',
    surfaceGroup: 'platforms',
  },
  digital_platform: surfaceDefinition('Virtual Platform (Pink)', 0xff4ca5, 'platforms'),
  digital_platform_red: surfaceDefinition('Digital Platform Red', 0xff365f, 'platforms'),
  virtual_platform_dark: surfaceDefinition('Virtual Platform (Gray)', 0x303650, 'platforms'),
  virtual_platform_orange: surfaceDefinition('Virtual Platform (Orange)', 0xff8b2d, 'platforms'),
  virtual_platform_purple: surfaceDefinition('Virtual Platform (Purple)', 0x9d52ff, 'platforms'),
  virtual_platform_purple_orange: surfaceDefinition('Virtual Platform (Purple + Orange)', 0xd361f4, 'platforms'),
  virtual_platform_white: surfaceDefinition('Virtual Platform (White)', 0xf2f6ff, 'platforms'),
  virtual_platform_white_blue: surfaceDefinition('Virtual Platform (White + Blue)', 0x78cfff, 'platforms'),
  virtual_platform_white_gold: surfaceDefinition('Virtual Platform (White + Gold)', 0xffd95b, 'platforms'),
  virtual_platform_white_orange: surfaceDefinition('Virtual Platform (White + Orange)', 0xffb066, 'platforms'),
  virtual_platform_white_red: surfaceDefinition('Virtual Platform (White + Red)', 0xff6c79, 'platforms'),
  destructible_hard_real_virtual: surfaceDefinition('Destructible Box (All)', 0xff354f, 'extras'),
  destructible_hard_virtual: surfaceDefinition('Destructible Box (No Jelly)', 0xa56cff, 'extras'),
  destructible_hard_virtual_fragile: { ...surfaceDefinition('Breakable Glass', 0xffffff, 'extras'), opacity: 0.7 },
  hardlight_box: surfaceDefinition('Polarity Cube', 0x72f7ff, 'extras'),
  jet_water_surface: {
    ...surfaceDefinition('Jet Bubble Plane', 0x0a55bc, 'extras'),
    // This is a thin editor marker for the gameplay volume, not a block.
    // Keep it visibly small and flat while preserving X/Y authoring scale.
    geometry: () => new THREE.PlaneGeometry(100, 100),
    baseDimensions: [100, 100, 1],
    resizeAxes: ['x', 'y'],
    opacity: 0.7,
  },
  water_body_big: surfaceDefinition('Water', 0x1764d8, 'extras'),
  launch_pad: {
    label: 'Bounce pad',
    color: 0xffa51f,
    emissive: 0x7a2f00,
    baseHeight: 0,
    geometry: dummyPlaceholderGeometry,
    catalog: 'gameplay',
    gameplayGroup: 'traversal',
  },
  ability_jetfreeze: { label: 'Freeze Pickup', color: 0xc9fbff, emissive: 0x248ca3, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  ability_jethook: { label: 'Hook Pickup', color: 0x45ff58, emissive: 0x087a22, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  ability_jetjellybomb: { label: 'Jelly Pickup', color: 0xff872f, emissive: 0x8a3100, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  ability_jetleap: { label: 'Leap Pickup', color: 0xffe54d, emissive: 0x8a6500, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  ability_jetpolarizer: { label: 'Polarizer Pickup', color: 0xff43bd, emissive: 0x86105e, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  ability_jetslam: { label: 'Slam Pickup', color: 0xff5b91, emissive: 0x8b1747, baseHeight: 45, geometry: () => new THREE.SphereGeometry(45, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  energy_pickup: { label: 'Gun Pickup', color: 0xffe83d, emissive: 0x745500, baseHeight: 42, geometry: () => new THREE.SphereGeometry(42, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups' },
  enemy_plain: { label: 'Plain target', color: 0x55eaff, emissive: 0x08718a, baseHeight: 65, geometry: () => { const geometry = new THREE.CylinderGeometry(43, 43, 28, 16); geometry.rotateZ(Math.PI / 2); return geometry; }, catalog: 'gameplay', gameplayGroup: 'enemies' },
  enemy_gun: { label: 'Gun target', color: 0xff4d7d, emissive: 0x891331, baseHeight: 65, geometry: () => new THREE.SphereGeometry(65, 20, 14), catalog: 'gameplay', gameplayGroup: 'enemies' },
  enemy_gatling: { label: 'Gatling target', color: 0xffd64d, emissive: 0x896400, baseHeight: 65, geometry: () => new THREE.SphereGeometry(65, 20, 14), catalog: 'gameplay', gameplayGroup: 'enemies' },
  enemy_cannon: { label: 'Cannon target', color: 0xe34fff, emissive: 0x72138a, baseHeight: 65, geometry: () => { const geometry = new THREE.CylinderGeometry(43, 43, 28, 16); geometry.rotateZ(Math.PI / 2); return geometry; }, catalog: 'gameplay', gameplayGroup: 'enemies' },
  enemy_laser: { label: 'Laser target', color: 0x42ff59, emissive: 0x087b20, baseHeight: 65, geometry: () => new THREE.SphereGeometry(65, 20, 14), catalog: 'gameplay', gameplayGroup: 'enemies' },
  enemy_wall: { label: 'Wall target', color: 0x238dff, emissive: 0x0b376f, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'enemies' },
  blast_jelly_container: { label: 'Blast Jelly', color: 0xff9d35, emissive: 0x6b2f00, baseHeight: 50, geometry: () => new THREE.SphereGeometry(50, 24, 16), baseDimensions: [100, 100, 100], catalog: 'gameplay', gameplayGroup: 'traversal' },
  blast_jelly_container_evil: { label: 'Evil Blast Jelly', color: 0xff365f, emissive: 0x6d061c, baseHeight: 50, geometry: () => new THREE.SphereGeometry(50, 24, 16), baseDimensions: [100, 100, 100], catalog: 'gameplay', gameplayGroup: 'traversal' },
  blast_jelly_container_grounded: { label: 'Grounded Blast Jelly', color: 0xffc24b, emissive: 0x714500, baseHeight: 50, geometry: () => new THREE.SphereGeometry(50, 24, 16), baseDimensions: [100, 100, 100], catalog: 'gameplay', gameplayGroup: 'traversal' },
  damage_box: { label: 'Damage Box', color: 0xff274f, emissive: 0x710018, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'hazards' },
  jet_bubble: { label: 'Jet Bubble', color: 0x0750a4, emissive: 0x062b6f, baseHeight: 60, geometry: () => new THREE.SphereGeometry(60, 20, 14), opacity: 0.7, catalog: 'gameplay', gameplayGroup: 'traversal' },
  jetmill: { label: 'Jetmill', color: 0x11151c, emissive: 0x000000, baseHeight: 20, geometry: () => new THREE.BoxGeometry(100, 100, 20), baseDimensions: [100, 100, 20], catalog: 'gameplay', gameplayGroup: 'traversal' },
  jetmill_supercharged: { label: 'Supercharged jetmill', color: 0xff4fda, emissive: 0x76105f, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'traversal', hiddenInPalette: true },
  laser_beam: { label: 'Laser Beam', color: 0xa95cff, emissive: 0x38126c, baseHeight: 12.5, geometry: () => new THREE.BoxGeometry(300, 25, 25), baseDimensions: [300, 25, 25], resizeAxes: ['x'], catalog: 'gameplay', gameplayGroup: 'hazards', description: 'A 3 m default beam. Resize X to change its runtime trace length predictably.' },
  laser_wall: { label: 'Laser Wall', color: 0x8f2cff, emissive: 0x49107d, baseHeight: 5, geometry: () => new THREE.BoxGeometry(300, 200, 10), baseDimensions: [300, 200, 10], catalog: 'gameplay', gameplayGroup: 'hazards', description: 'A horizontal 3 m × 2 m laser field. Scale X and Y change its floor coverage.' },
  polarity_flipper: { label: 'Polarity Flipper', color: 0x52dfff, emissive: 0x0a6075, baseHeight: 12, baseDimensions: [90, 90, 24], geometry: () => { const geometry = new THREE.CylinderGeometry(45, 45, 24, 24); geometry.rotateX(Math.PI / 2); return geometry; }, catalog: 'gameplay', gameplayGroup: 'hazards' },
  launch_ring: { label: 'Launch Ring', color: 0xd2a72d, emissive: 0x513900, baseHeight: 75, geometry: () => new THREE.TorusGeometry(75, 12, 12, 28), catalog: 'gameplay', gameplayGroup: 'traversal' },
  swing_bar: { label: 'Swing Bar', color: 0xffd458, emissive: 0x755100, baseHeight: 20, geometry: () => new THREE.CylinderGeometry(18, 18, 220, 16), catalog: 'gameplay', gameplayGroup: 'traversal' },
  health_pickup: { label: 'Health Pickup', color: 0x70ff86, emissive: 0x176628, baseHeight: 42, geometry: () => new THREE.SphereGeometry(42, 20, 14), catalog: 'gameplay', gameplayGroup: 'pickups', description: 'Players have 100 maximum health; standard damage sources deal 35.' },
  // Normal placeable tree: no editor-specific break/punch metadata is authored.
  block_tree: { label: 'Block Tree', color: 0x49d879, emissive: 0x13582c, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  calculator: { label: 'Calculator', color: 0xaeb9d5, emissive: 0x26314b, baseHeight: 22, geometry: () => new THREE.BoxGeometry(100, 68, 22), baseDimensions: [100, 68, 22], catalog: 'gameplay', gameplayGroup: 'props' },
  juan: { label: 'Juan', color: 0x39b866, emissive: 0x0f5126, baseHeight: 70, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  statue_the_man: { label: 'Statue: The Man', color: 0xd7deeb, emissive: 0x3f4758, baseHeight: 75, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  ancient_pillar: surfaceDefinition('Ancient pillar', 0xb99b78, 'architecture'),
  basekit_house: surfaceDefinition('Basekit house', 0x82a8cf, 'architecture'),
  basekit_small_basewall: surfaceDefinition('Basekit small wall', 0x779cc5, 'architecture'),
  basekit_small_basewall_alt: surfaceDefinition('Basekit small wall 2', 0x668db8, 'architecture'),
  basekit_small_cube_tower: surfaceDefinition('Basekit cube tower', 0x7398c0, 'architecture'),
  basekit_tower: surfaceDefinition('Basekit tower', 0x6f94bd, 'architecture'),
  basekit_trip_trap: surfaceDefinition('Basekit trip trap', 0xe35a74, 'architecture'),
  basekit_trip_trap_no_slope: surfaceDefinition('Basekit trip trap (flat)', 0xdc4967, 'architecture'),
  basekit_small_house: surfaceDefinition('Basekit small house', 0x8aafd1, 'architecture'),
  basekit_small_house_alt: surfaceDefinition('Basekit small house 2', 0x789fc7, 'architecture'),
  basekit_small_platform: { ...surfaceDefinition('Basekit small platform', 0x58c9e8, 'architecture'), geometry: () => topOriginBoxGeometry(400, 400, 50), baseDimensions: [400, 400, 50] },
  basekit_small_platform_alt_1: { ...surfaceDefinition('Basekit small platform 2', 0x4bbddd, 'architecture'), geometry: () => topOriginBoxGeometry(400, 400, 50), baseDimensions: [400, 400, 50] },
  basekit_small_platform_alt_2: { ...surfaceDefinition('Basekit small platform 3', 0x3fb0d2, 'architecture'), geometry: () => topOriginBoxGeometry(400, 400, 50), baseDimensions: [400, 400, 50] },
  basekit_small_platform_alt_3: { ...surfaceDefinition('Basekit small platform 4', 0x35a4c8, 'architecture'), geometry: () => topOriginBoxGeometry(400, 400, 50), baseDimensions: [400, 400, 50] },
  basekit_small_hollow_cylinder: surfaceDefinition('Basekit hollow cylinder', 0x8d79c9, 'architecture'),
  basekit_small_ramp: surfaceDefinition('Basekit small ramp', 0x61b8d1, 'architecture'),
  concrete_pillar: surfaceDefinition('Concrete pillar', 0xaab2bd, 'architecture'),
  installation_pillar: surfaceDefinition('Installation pillar', 0x7a8ea8, 'architecture'),
  sky_pillar: surfaceDefinition('Sky pillar', 0x9bd8f1, 'architecture'),
  sky_platform: {
    ...surfaceDefinition('Sky platform', 0xe7f5ff, 'architecture'),
    geometry: skyPlatformGeometry,
    baseDimensions: [400, 400, 200],
    resizeAxes: ['x', 'y'],
    description: 'A 4 m × 4 m Sky Platform with a 2 m frame. Resize along its local X and Y axes.',
  },
  sky_platform_blue: {
    ...surfaceDefinition('Sky platform blue', 0x4a9cff, 'architecture'),
    geometry: skyPlatformGeometry,
    baseDimensions: [400, 400, 200],
    resizeAxes: ['x', 'y'],
    description: 'A 4 m × 4 m Sky Platform with a 2 m frame. Resize along its local X and Y axes.',
  },
  sky_platform_gold: {
    ...surfaceDefinition('Sky platform gold', 0xffc94a, 'architecture'),
    geometry: skyPlatformGeometry,
    baseDimensions: [400, 400, 200],
    resizeAxes: ['x', 'y'],
    description: 'A 4 m × 4 m Sky Platform with a 2 m frame. Resize along its local X and Y axes.',
  },
  sky_platform_yellow: {
    ...surfaceDefinition('Sky platform yellow', 0xffeb4f, 'architecture'),
    geometry: skyPlatformGeometry,
    baseDimensions: [400, 400, 200],
    resizeAxes: [],
    description: 'A fixed-size 4 m × 4 m Yellow Sky Platform. Its runtime class ignores actor resizing.',
  },
  wooden_platform: {
    ...surfaceDefinition('Wooden platform', 0xa86d3c, 'architecture'),
    geometry: woodenPlatformGeometry,
    baseDimensions: [100, 100, 100],
    resizeAxes: ['x', 'y'],
  },
  arcade_token: { label: 'Arcade token', color: 0xffd94f, emissive: 0x765400, baseHeight: 6, baseDimensions: [80, 80, 12], geometry: () => { const geometry = new THREE.CylinderGeometry(40, 40, 12, 32); geometry.rotateX(Math.PI / 2); return geometry; }, catalog: 'gameplay', gameplayGroup: 'pickups' },
  arcade_token_rainbow: { label: 'Rainbow arcade token', color: 0xff54de, emissive: 0x6d175f, baseHeight: 6, baseDimensions: [80, 80, 12], geometry: () => { const geometry = new THREE.CylinderGeometry(40, 40, 12, 32); geometry.rotateX(Math.PI / 2); return geometry; }, catalog: 'gameplay', gameplayGroup: 'pickups' },
  artic_spotlight: { label: 'Arctic spotlight', color: 0xc9f5ff, emissive: 0x326d7a, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  artic_spotlight_child: { label: 'Arctic spotlight child', color: 0xaeefff, emissive: 0x286b7a, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  bg_flood_light: { label: 'Background floodlight', color: 0xfff5c2, emissive: 0x796f30, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  chinese_lantern: { label: 'Chinese lantern', color: 0xff5e48, emissive: 0x7b160b, baseHeight: 50, geometry: chineseLanternGeometry, baseDimensions: [76, 76, 114], catalog: 'gameplay', gameplayGroup: 'props' },
  crane: {
    label: 'Crane', color: 0xff7b28, emissive: 0x6d2300, baseHeight: 50,
    geometry: craneGeometry, baseDimensions: [5300, 410, 5800],
    description: 'Full-size tower crane. Its origin is at the central slewing platform, matching BP_Crane.',
    catalog: 'gameplay', gameplayGroup: 'props', hiddenInPalette: true,
  },
  digital_audience_gallery: { label: 'Digital audience gallery', color: 0x4be1ff, emissive: 0x0b6375, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  digital_audience_gallery_synth: { label: 'Digital gallery synth', color: 0xd45bff, emissive: 0x5f1876, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  digital_audience_gallery_white: { label: 'Digital gallery white', color: 0xf2f7ff, emissive: 0x525c69, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  drone: { label: 'Drone', color: 0x69e9ff, emissive: 0x176779, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  elevator: { label: 'Elevator', color: 0xa779ff, emissive: 0x3b2471, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'traversal' },
  kill_cloud: { label: 'Kill cloud', color: 0xef365d, emissive: 0x790c24, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'hazards' },
  ladder: { label: 'Ladder', color: 0xffb85b, emissive: 0x664000, baseHeight: 120, geometry: ladderGeometry, baseDimensions: [90, 18, 240], catalog: 'gameplay', gameplayGroup: 'traversal' },
  lars: { label: 'Lars', color: 0x58e0c2, emissive: 0x126650, baseHeight: 70, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  lcd_screen: { label: 'LCD screen', color: 0x48cfff, emissive: 0x0c586f, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  destructible_leaf_pile: { label: 'Destructible leaf pile', color: 0x58d567, emissive: 0x185b22, baseHeight: 30, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  light_pole: { label: 'Light pole', color: 0xe8f4ff, emissive: 0x59636b, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  light_rims: { label: 'Light rims', color: 0x60eaff, emissive: 0x13697a, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  light_rims_arrow_straight: { label: 'Light rims arrow', color: 0x63ffda, emissive: 0x146b58, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  monorail: { label: 'Monorail', color: 0xd8e9f4, emissive: 0x485761, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  peony_spectating_box: { label: 'Peony spectating box', color: 0xff75bd, emissive: 0x70204a, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  rio_gallery_shard: { label: 'Rio gallery shard', color: 0x55dbff, emissive: 0x125c70, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  setback_bounds_waterfall: { label: 'Setback bounds waterfall', color: 0x3496ff, emissive: 0x0a4175, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'hazards' },
  skypiercer_gallery_shard: { label: 'Skypiercer gallery shard', color: 0x9ec9ff, emissive: 0x304e70, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  spectator_drone: { label: 'Spectator drone', color: 0x76e8ff, emissive: 0x176779, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  spotlight: { label: 'Spotlight', color: 0xfff4bc, emissive: 0x776b2e, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  swanboat: { label: 'Swan boat', color: 0xffffff, emissive: 0x50545c, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  torch_floor: { label: 'Floor torch', color: 0x3b241d, emissive: 0x160805, baseHeight: 55, geometry: floorTorchGeometry, baseDimensions: [48, 48, 113], catalog: 'gameplay', gameplayGroup: 'props' },
  torch_wall: {
    label: 'Wall torch', color: 0x8b4a25, emissive: 0x2f1006, baseHeight: 15,
    geometry: wallTorchGeometry, baseDimensions: [117, 55, 70],
    description: 'Upright wall torch. The small side peg marks the wall-facing handle side.',
    catalog: 'gameplay', gameplayGroup: 'props',
  },
  tower_waterfall: { label: 'Tower waterfall', color: 0x3da8ff, emissive: 0x0b4976, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  wall_monitor: { label: 'Wall monitor', color: 0x5be1ff, emissive: 0x126174, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  wall_monitor_blimp: { label: 'Wall monitor: Blimp', color: 0x54d6ff, emissive: 0x105e76, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  wall_monitor_blimp_peony: { label: 'Wall monitor: Blimp Peony', color: 0xff62b9, emissive: 0x711d49, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  water_pipe: { label: 'Water pipe', color: 0x3e4933, emissive: 0x10170c, baseHeight: 70, geometry: waterPipeGeometry, baseDimensions: [212, 140, 140], catalog: 'gameplay', gameplayGroup: 'props' },
  water_pipe_etheral: { label: 'Ethereal water pipe', color: 0x5b382b, emissive: 0x201009, baseHeight: 70, geometry: waterPipeGeometry, baseDimensions: [212, 140, 140], catalog: 'gameplay', gameplayGroup: 'props' },
  water_pipe_rave: { label: 'Rave water pipe', color: 0x263d67, emissive: 0x0c1d42, baseHeight: 70, geometry: waterPipeGeometry, baseDimensions: [212, 140, 140], catalog: 'gameplay', gameplayGroup: 'props' },
  window_cleaner: { label: 'Window cleaner', color: 0xb8c9d6, emissive: 0x35434d, baseHeight: 50, geometry: dummyPlaceholderGeometry, catalog: 'gameplay', gameplayGroup: 'props' },
  time_trial_goal: {
    label: 'Finish goal',
    color: 0xd8ff3e,
    emissive: 0x395500,
    baseHeight: 90,
    geometry: () => new THREE.SphereGeometry(90, 28, 18),
    catalog: 'gameplay',
    gameplayGroup: 'level',
  },
  player_start: {
    label: 'Player start',
    color: 0xffa12e,
    emissive: 0x592000,
    baseHeight: 0,
    geometry: () => {
      const geometry = new THREE.CapsuleGeometry(55, 110, 8, 16);
      geometry.rotateX(Math.PI / 2);
      return geometry;
    },
    catalog: 'gameplay',
    gameplayGroup: 'level',
  },
};

type NewObjectCatalogueEntry = {
  assetId: string;
  objectName: string;
  label: string;
  note?: string;
};

type CatalogueLayoutEntry = {
  assetId: string;
  objectName: string;
  label: string;
  catalog: 'surface' | 'gameplay' | 'props';
  group: SurfaceGroup | GameplayGroup | PropGroup;
  order: number;
};

function catalogueColour(name: string) {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hue = Math.abs(hash) % 360;
  return new THREE.Color().setHSL(hue / 360, 0.55, 0.55).getHex();
}

// AllAssetsNew is an example map: its entries are raw StaticMesh object names.
// Only rows approved by JLE - NewObjects.csv are present in this generated
// manifest. X-marked and unlisted objects are deliberately not registered.
(newObjectCatalog as NewObjectCatalogueEntry[]).forEach((entry) => {
  assetDefinitions[entry.assetId] = {
    label: entry.label,
    color: catalogueColour(entry.objectName),
    emissive: 0x07152c,
    baseHeight: 50,
    geometry: dummyPlaceholderGeometry,
    baseDimensions: [100, 100, 100],
    catalog: 'props',
    propGroup: 'props',
    description: entry.note || `Place ${entry.label}.`,
  };
});

Object.entries(editorVisualProfiles).forEach(([assetId, visualProfile]) => {
  const definition = assetDefinitions[assetId];
  if (definition) definition.visualProfile = visualProfile;
});

// A missing Blueprint mesh must not degrade to an unlabelled colour cube.
// Retain its authored geometry and give it a clear editor marker until the
// source class receives a genuine FModel export. GLB-backed assets are never
// put through this fallback.
Object.entries(assetDefinitions).forEach(([assetId, definition]) => {
  if (!assetVisuals[assetId] && !definition.visualProfile) definition.visualProfile = 'basic';
});
// Coins have an intentional procedural silhouette; the generic missing-mesh
// fallback would otherwise replace the rainbow coin with a cube.
delete assetDefinitions.arcade_token.visualProfile;
delete assetDefinitions.arcade_token_rainbow.visualProfile;

// Every catalogue entry has an explicit dummy size, even when the genuine
// mesh has not yet been extracted. Known assets can override this with their
// measured Unreal bounds (Sky Platform does so above).
(Object.values(assetDefinitions) as AssetDefinition[]).forEach((definition) => {
  if (definition.baseDimensions) return;
  const geometry = definition.geometry();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(100, 100, 100);
  definition.baseDimensions = [size.x, size.y, size.z];
  geometry.dispose();
});

const experimentalSurfaceAssets: AssetId[] = [
  'capped_platform_tower', 'ice_platform_2x2', 'ice_platform_2x3',
  'ice_platform_2x4', 'ice_platform_3x5', 'frozen_waterfall',
  'wooden_platform_2x2', 'rio_platform_2x2', 'rio_platform_2x3',
  'rio_platform_2x4', 'rio_platform_2x5', 'rio_platform_3x3',
  'rio_platform_3x5', 'rio_platform_3x9', 'rio_platform_4x5',
  'skypiercer_tower_2x2', 'skypiercer_tower_2x3', 'skypiercer_tower_2x4',
  'skypiercer_tower_3x3', 'skypiercer_tower_3x4', 'skypiercer_tower_4x4',
  'skypiercer_edge_detail', 'skypiercer_midwall_detail',
  'skypiercer_special_1x1', 'skypiercer_special_2x2',
  'skypiercer_special_2x3', 'tower_wall',
];
experimentalSurfaceAssets.forEach((assetId) => {
  // Do not offer experimental runtime classes to new level authors. Retain
  // their definitions so existing project files can still be opened, edited,
  // and migrated without reporting an unsupported asset.
  assetDefinitions[assetId].hiddenInPalette = true;
  assetDefinitions[assetId].description =
    `Experimental: ${assetDefinitions[assetId].label}. This class is listed in the shared asset plan, but currently requires matching runtime dummy support to spawn in-game.`;
});

// Only expose one resizable representative for each modular surface family.
// Keep the remaining IDs registered so older saved levels continue to load.
const hiddenSizedSurfaceVariants: AssetId[] = [
  'ice_platform_2x2', 'ice_platform_2x3', 'ice_platform_2x4', 'ice_platform_3x5',
  'rio_platform_2x3', 'rio_platform_2x4', 'rio_platform_2x5',
  'rio_platform_3x3', 'rio_platform_3x5', 'rio_platform_3x9', 'rio_platform_4x5',
  'skypiercer_tower_2x3', 'skypiercer_tower_2x4',
  'skypiercer_tower_3x3', 'skypiercer_tower_3x4', 'skypiercer_tower_4x4',
  'skypiercer_special_2x2', 'skypiercer_special_2x3',
];
hiddenSizedSurfaceVariants.forEach((assetId) => {
  assetDefinitions[assetId].hiddenInPalette = true;
});
assetDefinitions.ice_platform_4x4.label = 'Ice Platform';
assetDefinitions.wooden_platform_2x2.label = 'Wooden Platform (Experimental)';
assetDefinitions.rio_platform_2x2.label = 'Rio Platform';
assetDefinitions.skypiercer_tower_2x2.label = 'Skypiercer Tower';
assetDefinitions.skypiercer_special_1x1.label = 'Skypiercer Special';

function assignCatalogue(ids: AssetId[], catalog: AssetDefinition['catalog'], group: string) {
  ids.forEach((id) => {
    const definition = assetDefinitions[id];
    definition.catalog = catalog;
    delete definition.surfaceGroup;
    delete definition.gameplayGroup;
    delete definition.propGroup;
    if (catalog === 'surface') definition.surfaceGroup = group as SurfaceGroup;
    if (catalog === 'gameplay') definition.gameplayGroup = group as GameplayGroup;
    if (catalog === 'props') definition.propGroup = group as PropGroup;
  });
}

assignCatalogue([
  'wooden_platform', 'sky_platform', 'sky_platform_blue', 'sky_platform_gold',
  'sky_platform_yellow', 'basekit_small_platform', 'basekit_small_platform_alt_1',
  'basekit_small_platform_alt_2', 'basekit_small_platform_alt_3', 'digital_platform',
  'digital_platform_red', 'virtual_platform_dark', 'virtual_platform_orange',
  'virtual_platform_purple', 'virtual_platform_purple_orange', 'virtual_platform_white',
  'virtual_platform_white_blue', 'virtual_platform_white_gold',
  'virtual_platform_white_orange', 'virtual_platform_white_red', 'ice_platform_4x4',
], 'surface', 'platforms');
assignCatalogue(['concrete_pillar', 'ancient_pillar', 'sky_pillar', 'basekit_small_cube_tower'], 'surface', 'pillars');
assignCatalogue(['basekit_small_basewall', 'basekit_small_basewall_alt', 'lcd_screen'], 'surface', 'walls');
assignCatalogue(['basekit_small_hollow_cylinder', 'basekit_small_ramp'], 'surface', 'extras');

assignCatalogue(['player_start', 'time_trial_goal', 'enemy_plain', 'enemy_gun', 'enemy_gatling', 'enemy_laser', 'enemy_cannon', 'enemy_wall'], 'gameplay', 'game');
assignCatalogue(['energy_pickup', 'ability_jetleap', 'ability_jetslam', 'ability_jetjellybomb', 'ability_jethook', 'ability_jetfreeze', 'ability_jetpolarizer', 'health_pickup'], 'gameplay', 'pickups');
assignCatalogue(['blast_jelly_container', 'blast_jelly_container_evil', 'blast_jelly_container_grounded', 'launch_pad', 'launch_ring', 'jetmill', 'jetmill_supercharged', 'swing_bar', 'jet_bubble', 'jet_water_surface'], 'gameplay', 'traversal');
assignCatalogue(['polarity_flipper', 'hardlight_box', 'destructible_hard_virtual', 'destructible_hard_real_virtual', 'destructible_hard_virtual_fragile', 'calculator', 'block_tree'], 'gameplay', 'interactable');
assignCatalogue(['damage_box', 'laser_beam', 'laser_wall', 'water_body_big', 'kill_cloud', 'statue_the_man', 'lars', 'setback_bounds_waterfall'], 'gameplay', 'hazards');

const authoritativeInteractionRanges: Partial<Record<AssetId, AssetDefinitionBase['interactionRange']>> = {
  ability_jetfreeze: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  ability_jethook: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  ability_jetjellybomb: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  ability_jetleap: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  ability_jetpolarizer: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  ability_jetslam: { radius: 200, center: [0, 0, 0], source: 'BP_ItemOrb.Collider SphereRadius' },
  energy_pickup: { radius: 200, center: [0, 0, 0], source: 'BP_PickupBase.Collider SphereRadius; centred on editor orb' },
  health_pickup: { radius: 200, center: [0, 0, 90], source: 'BP_PickupBase.Collider SphereRadius' },
  arcade_token: { radius: 200, center: [0, 0, 0], source: 'BP_ArcadeToken SphereRadius' },
  arcade_token_rainbow: { radius: 200, center: [0, 0, 0], source: 'inherited BP_ArcadeToken SphereRadius' },
  blast_jelly_container: { radius: 150, center: [0, 0, 0], source: 'BP_BlastJellyContainer.Collider SphereRadius' },
  blast_jelly_container_evil: { radius: 150, center: [0, 0, 0], source: 'inherited BP_BlastJelly Collider SphereRadius' },
  blast_jelly_container_grounded: { radius: 150, center: [0, 0, 0], source: 'BP_BlastJellyContainer_Grounded.Collider SphereRadius' },
  launch_pad: { radius: 200, center: [0, 0, 80], source: 'BP_LaunchPad_Big.Capsule half-height' },
  launch_ring: { radius: 300, center: [200, 0, 0], source: 'BP_LaunchRing.BlastCapsule half-height' },
};
Object.entries(authoritativeInteractionRanges).forEach(([assetId, interactionRange]) => {
  const definition = assetDefinitions[assetId];
  if (definition && interactionRange) definition.interactionRange = interactionRange;
});
assignCatalogue(['arcade_token', 'arcade_token_rainbow', 'swanboat', 'juan'], 'gameplay', 'misc');

assignCatalogue(['torch_wall', 'torch_floor', 'chinese_lantern', 'water_pipe', 'water_pipe_etheral', 'water_pipe_rave', 'ladder', 'drone', 'spectator_drone'], 'props', 'props');
assignCatalogue(['digital_audience_gallery', 'digital_audience_gallery_synth', 'digital_audience_gallery_white', 'rio_gallery_shard', 'skypiercer_gallery_shard', 'peony_spectating_box'], 'props', 'audience');
assignCatalogue(['light_pole', 'artic_spotlight', 'artic_spotlight_child', 'spotlight', 'bg_flood_light', 'light_rims_arrow_straight', 'light_rims'], 'props', 'lights');
assignCatalogue(['crane', 'wall_monitor', 'elevator', 'window_cleaner', 'wall_monitor_blimp', 'wall_monitor_blimp_peony', 'installation_pillar', 'tower_waterfall'], 'props', 'large');
assignCatalogue(['basekit_house', 'basekit_tower', 'basekit_small_house', 'basekit_small_house_alt', 'basekit_trip_trap', 'basekit_trip_trap_no_slope'], 'props', 'architecture');
assignCatalogue(['monorail', 'destructible_leaf_pile'], 'props', 'misc');

const plannedLabels: Partial<Record<AssetId, string>> = {
  player_start: 'Player Start', time_trial_goal: 'Goal Sphere',
  enemy_plain: 'Plain Target', enemy_gun: 'Gun Target', enemy_gatling: 'Gatling Target',
  enemy_laser: 'Laser Target', enemy_cannon: 'Cannon Target', enemy_wall: 'Wall Target',
  energy_pickup: 'Gun Pickup', ability_jetleap: 'Leap Pickup', ability_jetslam: 'Slam Pickup',
  ability_jetjellybomb: 'Jelly Pickup', ability_jethook: 'Hook Pickup', ability_jetfreeze: 'Freeze Pickup',
  ability_jetpolarizer: 'Polarizer Pickup', health_pickup: 'Health Pickup',
  launch_pad: 'Launch Pad', jet_water_surface: 'Jet Bubble Plane',
  polarity_flipper: 'Polarity Flipper', hardlight_box: 'Polarity Cube',
  destructible_hard_virtual: 'Destructible Box (No Jelly)',
  destructible_hard_real_virtual: 'Destructible Box (All)',
  destructible_hard_virtual_fragile: 'Breakable Glass', statue_the_man: 'Kill Statue',
  arcade_token: 'Coin', arcade_token_rainbow: 'Rainbow Coin', swanboat: 'Enrico',
  wooden_platform: 'Wooden Platform', concrete_pillar: 'Concrete Pillar', ancient_pillar: 'Mossy Pillar',
  sky_pillar: 'Marble Pillar', basekit_small_basewall: 'Basic Wall (Legs)',
  basekit_small_basewall_alt: 'Basic Wall (No Legs)', lcd_screen: 'Polarity Display',
  basekit_small_hollow_cylinder: 'Hollow Cylinder', basekit_small_ramp: 'Ramp',
  torch_wall: 'Wall Torch', torch_floor: 'Floor Torch', water_pipe: 'Water Pipe (Gray)',
  water_pipe_etheral: 'Water Pipe (Brown)', water_pipe_rave: 'Water Pipe (Blue)',
  drone: 'Static Drone', spectator_drone: 'Moving Drone',
  digital_audience_gallery: 'Audience Gallery (Blue)',
  digital_audience_gallery_synth: 'Audience Gallery (Red)',
  digital_audience_gallery_white: 'Audience Gallery (White)', rio_gallery_shard: 'Audience Gallery (Rio)',
  skypiercer_gallery_shard: 'Audience Gallery (Mumbai)', peony_spectating_box: 'Audience Gallery (Peony)',
  artic_spotlight: 'Floor Mounted Spotlight', artic_spotlight_child: 'Ceiling Mounted Spotlight',
  bg_flood_light: 'Flood Light', light_rims_arrow_straight: 'Polarity Lit Arrow',
  light_rims: 'Polarity Lit Glow Outline', wall_monitor: 'Advertisement Monitor',
  wall_monitor_blimp: 'Blimp', wall_monitor_blimp_peony: 'Blimp (Peony)',
  installation_pillar: 'Hanging Sky Pillar', basekit_house: 'Base House',
  basekit_tower: 'Base Tower (With Bounce Pads)', basekit_small_house: 'Base House (With Ramp)',
  basekit_small_house_alt: 'Base House (No Interior)', basekit_trip_trap: 'Base Box (With Ramp)',
  basekit_trip_trap_no_slope: 'Base Box (No Ramp)', setback_bounds_waterfall: 'Small Waterfall',
  destructible_leaf_pile: 'Leaf Pile',
};
Object.entries(plannedLabels).forEach(([id, label]) => {
  assetDefinitions[id as AssetId].label = label!;
});

// JLE - Tabs&Categories.csv is the authoritative palette layout. Applying it
// after legacy defaults keeps old save IDs loadable while ensuring every
// visible button uses Dweeb's current tab, category, label, and ordering.
const catalogueLayoutIds = new Set(
  (catalogLayout as CatalogueLayoutEntry[]).map((entry) => entry.assetId),
);
for (const [assetId, definition] of Object.entries(assetDefinitions)) {
  if (!catalogueLayoutIds.has(assetId)) definition.hiddenInPalette = true;
}
(catalogLayout as CatalogueLayoutEntry[]).forEach((entry) => {
  const definition = assetDefinitions[entry.assetId];
  if (!definition) return;
  definition.label = entry.label;
  definition.hiddenInPalette = false;
  definition.catalog = entry.catalog;
  delete definition.surfaceGroup;
  delete definition.gameplayGroup;
  delete definition.propGroup;
  if (entry.catalog === 'surface') definition.surfaceGroup = entry.group as SurfaceGroup;
  if (entry.catalog === 'gameplay') definition.gameplayGroup = entry.group as GameplayGroup;
  if (entry.catalog === 'props') definition.propGroup = entry.group as PropGroup;
  // The layout's ObjectName is the approved CustomLevels runtime identifier,
  // not a display label or a GLB filename. Keep it with the asset metadata so
  // preview rendering can never be mistaken for runtime support.
  definition.runtimeObjectName = entry.objectName;
  definition.runtimeMappingStatus = entry.objectName ? 'resolved' : 'unresolved';
});
// Catalogue layout retains legacy entries for old project compatibility, but
// Crane is intentionally not offered for new placement until its behavior is
// repaired. Apply this after layout metadata, which otherwise re-enables it.
assetDefinitions.crane.hiddenInPalette = true;
assetDefinitions.arcade_token_rainbow.runtimeObjectName = 'BP_ArcadeToken';

// Explicit platform contracts supplied for the editor. Do not infer these
// from a raw FModel mesh: every other surface keeps its stock extracted size.
const configuredPlatformPreviewDimensions: Partial<Record<AssetId, [number, number, number]>> = {
  basekit_small_platform: [400, 400, 50],
  basekit_small_platform_alt_1: [400, 400, 50],
  basekit_small_platform_alt_2: [400, 400, 50],
  basekit_small_platform_alt_3: [400, 400, 50],
  sky_platform: [400, 400, 200],
  sky_platform_blue: [400, 400, 200],
  sky_platform_gold: [400, 400, 200],
  sky_platform_yellow: [400, 400, 200],
  static_basekit_floor_01: [400, 400, 50],
  static_basekit_floorcylinder_01: [400, 400, 50],
  static_basekit_floorquartercylinder_01: [400, 400, 50],
  basekit_small_ramp: [400, 400, 300],
};
Object.entries(configuredPlatformPreviewDimensions).forEach(([assetId, dimensions]) => {
  const definition = assetDefinitions[assetId as AssetId];
  if (!definition || !dimensions) return;
  definition.baseDimensions = dimensions;
  definition.previewDimensions = dimensions;
});

// These three modular BaseKit pieces are defined by exact construction
// dimensions. Their raw exports contain non-uniform baked transforms, so an
// independent bounding-box fit turns the circle into an ellipse and the
// square into a rectangle. Exact geometry is both clearer and deterministic.
const whiteSquarePlatform = assetDefinitions.static_basekit_floor_01;
if (whiteSquarePlatform) {
  whiteSquarePlatform.geometry = () => topOriginBoxGeometry(400, 400, 50);
  delete whiteSquarePlatform.previewDimensions;
}
const whiteCirclePlatform = assetDefinitions.static_basekit_floorcylinder_01;
if (whiteCirclePlatform) {
  whiteCirclePlatform.geometry = () => {
    const geometry = new THREE.CylinderGeometry(200, 200, 50, 64);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, -25);
    return geometry;
  };
  delete whiteCirclePlatform.previewDimensions;
}
const whiteQuarterPlatform = assetDefinitions.static_basekit_floorquartercylinder_01;
if (whiteQuarterPlatform) {
  whiteQuarterPlatform.geometry = () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(200, 0);
    shape.absarc(0, 0, 200, 0, Math.PI / 2, false);
    shape.lineTo(0, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 50, bevelEnabled: false, curveSegments: 32 });
    geometry.translate(0, 0, -50);
    return geometry;
  };
  delete whiteQuarterPlatform.previewDimensions;
}
const polarityGlowOutline = assetDefinitions.light_rims;
if (polarityGlowOutline) {
  // Extracted BP_LightRims component bounds are 8.215 x 8.217 x 0.255 m.
  // The outline lies flat in Unreal X/Y and sits just below its actor origin.
  // Keeping that basis here makes X/Y resizing match the runtime footprint
  // instead of presenting the frame edge-on as a tiny cube from above.
  polarityGlowOutline.geometry = () => {
    const outerX = 821.5218;
    const outerY = 821.7415;
    const rim = 31;
    const depth = 25.4767;
    const centerZ = -20.4807;
    const innerY = outerY - rim * 2;
    const parts = [
      new THREE.BoxGeometry(outerX, rim, depth).translate(0, outerY / 2 - rim / 2, centerZ),
      new THREE.BoxGeometry(outerX, rim, depth).translate(0, -outerY / 2 + rim / 2, centerZ),
      new THREE.BoxGeometry(rim, innerY, depth).translate(outerX / 2 - rim / 2, 0, centerZ),
      new THREE.BoxGeometry(rim, innerY, depth).translate(-outerX / 2 + rim / 2, 0, centerZ),
    ];
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach((part) => part.dispose());
    return geometry;
  };
  polarityGlowOutline.baseDimensions = [821.5218, 821.7415, 25.4767];
  polarityGlowOutline.baseHeight = 33.219;
  polarityGlowOutline.color = 0x5de9ff;
  polarityGlowOutline.emissive = 0x5de9ff;
}

// The preload exposes the exact same allowlist consumed by the Electron
// verifier. A preview, catalogue row, or compiler mapping must never make an
// unsupported dummy asset placeable. Definitions stay registered so legacy
// project files can still be loaded and diagnosed.
const verifierSupportedAssetIds = new Set(window.jetrunnerEditor?.verificationSupportedAssetIds || []);
if (window.jetrunnerEditor) {
  Object.entries(assetDefinitions).forEach(([assetId, definition]) => {
    const verificationSupported = verifierSupportedAssetIds.has(assetId);
    definition.verificationMappingStatus = verificationSupported ? 'supported' : 'unsupported';
    if (!verificationSupported) {
      definition.hiddenInPalette = true;
      definition.description = `Unavailable: ${definition.label} is not supported by the installed verification dummy.`;
    }
  });
}
const plannedCatalogueOrder: AssetId[] = [
  'player_start', 'time_trial_goal', 'enemy_plain', 'enemy_gun', 'enemy_gatling', 'enemy_laser', 'enemy_cannon', 'enemy_wall',
  'energy_pickup', 'ability_jetleap', 'ability_jetslam', 'ability_jetjellybomb', 'ability_jethook', 'ability_jetfreeze', 'ability_jetpolarizer', 'health_pickup',
  'blast_jelly_container', 'blast_jelly_container_evil', 'blast_jelly_container_grounded', 'launch_pad', 'launch_ring', 'jetmill', 'swing_bar', 'jet_bubble', 'jet_water_surface',
  'polarity_flipper', 'hardlight_box', 'destructible_hard_virtual', 'destructible_hard_real_virtual', 'destructible_hard_virtual_fragile', 'calculator', 'block_tree',
  'damage_box', 'laser_beam', 'laser_wall', 'water_body_big', 'kill_cloud', 'statue_the_man', 'lars', 'setback_bounds_waterfall',
  'arcade_token', 'arcade_token_rainbow', 'swanboat', 'juan',
  'wooden_platform', 'wooden_platform_2x2',
  'ice_platform_2x2', 'ice_platform_2x3', 'ice_platform_2x4', 'ice_platform_3x5', 'ice_platform_4x4',
  'rio_platform_2x2', 'rio_platform_2x3', 'rio_platform_2x4', 'rio_platform_2x5',
  'rio_platform_3x3', 'rio_platform_3x5', 'rio_platform_3x9', 'rio_platform_4x5',
  'sky_platform', 'sky_platform_blue', 'sky_platform_gold', 'sky_platform_yellow',
  'basekit_small_platform', 'basekit_small_platform_alt_1', 'basekit_small_platform_alt_2', 'basekit_small_platform_alt_3',
  'digital_platform', 'virtual_platform_dark', 'virtual_platform_orange', 'virtual_platform_purple',
  'virtual_platform_purple_orange', 'virtual_platform_white', 'virtual_platform_white_blue', 'virtual_platform_white_gold',
  'virtual_platform_white_orange', 'virtual_platform_white_red',
  'concrete_pillar', 'ancient_pillar', 'sky_pillar', 'basekit_small_cube_tower', 'capped_platform_tower',
  'skypiercer_tower_2x2', 'skypiercer_tower_2x3', 'skypiercer_tower_2x4',
  'skypiercer_tower_3x3', 'skypiercer_tower_3x4', 'skypiercer_tower_4x4',
  'basekit_small_basewall', 'basekit_small_basewall_alt', 'tower_wall',
  'skypiercer_edge_detail', 'skypiercer_midwall_detail',
  'lcd_screen', 'basekit_small_hollow_cylinder', 'basekit_small_ramp',
  'frozen_waterfall', 'skypiercer_special_1x1', 'skypiercer_special_2x2', 'skypiercer_special_2x3',
  'torch_wall', 'torch_floor', 'chinese_lantern', 'water_pipe', 'water_pipe_etheral', 'water_pipe_rave', 'ladder', 'drone', 'spectator_drone',
  'digital_audience_gallery', 'digital_audience_gallery_synth', 'digital_audience_gallery_white', 'rio_gallery_shard', 'skypiercer_gallery_shard', 'peony_spectating_box',
  'light_pole', 'artic_spotlight', 'artic_spotlight_child', 'spotlight', 'bg_flood_light', 'light_rims_arrow_straight', 'light_rims',
  'crane', 'wall_monitor', 'elevator', 'window_cleaner', 'wall_monitor_blimp', 'wall_monitor_blimp_peony', 'installation_pillar', 'tower_waterfall',
  'basekit_house', 'basekit_tower', 'basekit_small_house', 'basekit_small_house_alt', 'basekit_trip_trap', 'basekit_trip_trap_no_slope',
  'monorail', 'destructible_leaf_pile',
];

// Authoritative visual cleanup from Documents/editor changes.txt.  These are
// editor-only fallbacks: runtime class names and saved transforms remain in the
// catalogue/compiler mapping, never in this presentation table.
const editorAssetColourGroups: Array<[number, AssetId[]]> = [
  [0xf4f6ff, ['basekit_small_platform', 'basekit_small_platform_alt_1', 'basekit_small_platform_alt_3', 'virtual_platform_white', 'virtual_platform_white_red', 'virtual_platform_white_orange', 'virtual_platform_white_gold', 'virtual_platform_white_blue', 'digital_audience_gallery_white']],
  [0xff8b2d, ['basekit_small_platform_alt_2']],
  [0xf4f6ff, ['static_basekit_wallquartercylinder_01', 'static_basekit_pillar_01', 'static_basekit_wall_01', 'static_basekit_cube_01', 'static_basekit_cylinder_01', 'static_basekit_flootslope_01', 'static_basekit_ledgecylinder_01', 'static_basekit_ledgequartercylinder_01', 'static_basekit_wallslantedshort_01', 'static_baskit_smol_door_01', 'static_basekit_floor_01', 'static_basekit_floorcylinder_01', 'static_basekit_floorquartercylinder_01']],
  [0xff8b2d, ['static_baskit_smol_ledgecorner_01', 'static_baskit_smol_pillar_01', 'static_basekit_door_01', 'static_baskit_smol_ledgecylinder_01', 'static_baskit_smol_ledgefloor_01', 'static_baskit_smol_ledgequartercylinder_01']],
  [0x7b858d, ['static_concretecube_cube_001', 'static_artic_pillar_2x1', 'static_artic_pillar_3x1', 'static_artic_platform', 'static_artic_platform_2x2', 'light_pole', 'static_artic_light', 'spotlight', 'artic_spotlight', 'elevator', 'window_cleaner', 'static_effectbox_00', 'static_effectbox_01', 'static_stage_acousticpanel_01', 'static_stage_acousticpanel_02', 'static_stage_acousticpanel_03', 'static_stage_speaker', 'static_stage_speaker01', 'static_speakers_1x4_bent', 'static_strut_1x4_wall', 'static_strut_6x6', 'static_stageslope_filled', 'static_stageslope_stair', 'static_metalbeam']],
  [0x8a5132, ['static_woodensquareplatform', 'static_woodenoctagonplatform', 'static_galley_planks_gallery', 'static_foliagehouse', 'static_bench_01', 'static_tree_fallen_01', 'static_woodenbox', 'static_tree_stump_01', 'static_stone_flower_bed_01', 'static_barrel', 'ladder', 'static_sparringdummy', 'static_doublefencewithrope']],
  [0xd83c4d, ['static_tarp_meshes_sm_tarp_01', 'static_tarp_meshes_sm_tarp_03', 'static_tarp_meshes_sm_tarp_04', 'static_tarp_meshes_sm_tarp_05', 'static_tarp_meshes_sm_tarp_06', 'static_shippingcontainer', 'static_torigate01', 'static_carpet']],
  [0x3ba85e, ['static_vine01', 'static_vine02', 'static_vine05', 'static_vine06', 'static_vines_2m', 'destructible_leaf_pile', 'static_leafpile2_flatt', 'static_leafpile2_high']],
  [0xd6ae42, ['static_toweredgecapdetail_1', 'static_toweredgedetail_1', 'static_towermidwalldetail_1', 'static_fountain', 'static_artinstallation01']],
  [0xf2f6ff, ['static_snow_chunksingle_00', 'static_snow_chunksingle_01', 'static_snow_chunksingle_02', 'static_snow_chunksingle_03', 'static_snow_chunksingle_04', 'static_snow_pile_01', 'static_snow_pile_02']],
  [0x697783, ['static_2x2_rio_platform_top_brick_01', 'static_2x3_rio_platform_top_brick_01', 'static_2x3_stage_01', 'static_stage_1x1', 'static_stage_2x2', 'static_stage_3x3', 'static_stage_floor01', 'static_digitalgallery_gallery', 'rio_gallery_shard', 'wall_monitor_blimp_peony', 'drone', 'static_statueplatform', 'static_2x2_rio_house_01', 'static_2x3_rio_house_01', 'static_rio_attach_door_01', 'static_rio_attach_window_01', 'static_artinstallation02', 'static_artinstallation03', 'static_artinstallation04', 'static_stage_storage_box']],
  [0x9a6a42, ['peony_spectating_box', 'static_temple_bottom_4x4_01', 'static_temple_3x6_bottom_01', 'static_temple_bottom_4x5', 'static_sacredgroundstemple', 'static_peonytemple4x4_doors', 'static_peony_temple_5x6_2_openings', 'static_peony_temple_4x5', 'static_peony_temple_3x6', 'static_temple_tower_5x5_01']],
  [0xd9aa31, ['installation_pillar', 'static_fountain', 'static_artinstallation02', 'static_artinstallation03', 'static_artinstallation04', 'static_towermidwalldetail_1', 'static_toweredgedetail_1', 'static_toweredgecapdetail_1']],
  [0x27303a, ['static_stage_1x1', 'static_stage_2x2', 'static_2x3_stage_01', 'static_stage_3x3', 'static_stage_floor01']],
];
const editorAssetColourOverrideIds = new Set<AssetId>(
  editorAssetColourGroups.flatMap(([, ids]) => ids),
);
// These modular BaseKit pieces deliberately use their canonical solid team
// colour in-game. Extracted material slots can carry a misleading neutral
// texture, so force the requested white/orange editor treatment while keeping
// the genuine geometry.
const forcedFlatColourAssetIds = new Set<AssetId>([
  'static_basekit_ledgecylinder_01',
  'static_basekit_ledgequartercylinder_01',
  'static_baskit_smol_ledgecylinder_01',
  'static_baskit_smol_ledgefloor_01',
  'static_baskit_smol_ledgequartercylinder_01',
]);
const editorAssetRemovals: AssetId[] = ['monorail', 'spectator_drone', 'digital_platform_red', 'static_hookpad', 'skypiercer_gallery_shard', 'static_statue_theman', 'static_stage_spotlight', 'static_single_brick_01', 'static_single_brick_02', 'static_single_brick_03', 'static_platform_plank_leg'];
editorAssetColourGroups.forEach(([color, ids]) => ids.forEach((assetId) => {
  const definition = assetDefinitions[assetId];
  if (!definition) return;
  definition.color = color;
  definition.emissive = new THREE.Color(color).multiplyScalar(0.12).getHex();
}));
const whiteCylinderDefinition = assetDefinitions.static_basekit_cylinder_01;
if (whiteCylinderDefinition) {
  whiteCylinderDefinition.geometry = () => {
    const geometry = new THREE.CylinderGeometry(200, 200, 400, 32);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, -200);
    return geometry;
  };
  whiteCylinderDefinition.baseDimensions = [400, 400, 400];
}
const basicWallLegsDefinition = assetDefinitions.basekit_small_basewall;
if (basicWallLegsDefinition) {
  basicWallLegsDefinition.geometry = basicWallLegsGeometry;
  basicWallLegsDefinition.color = 0xc9e7f2;
  basicWallLegsDefinition.emissive = 0x172c38;
  basicWallLegsDefinition.baseHeight = 155;
  basicWallLegsDefinition.baseDimensions = [400, 40, 310];
  basicWallLegsDefinition.previewDimensions = [344, 12, 202];
}
const basicWallNoLegsDefinition = assetDefinitions.basekit_small_basewall_alt;
if (basicWallNoLegsDefinition) {
  basicWallNoLegsDefinition.geometry = basicWallNoLegsGeometry;
  basicWallNoLegsDefinition.color = 0xc9e7f2;
  basicWallNoLegsDefinition.emissive = 0x172c38;
  basicWallNoLegsDefinition.baseHeight = 120;
  basicWallNoLegsDefinition.baseDimensions = [400, 34, 260];
  basicWallNoLegsDefinition.previewDimensions = [388, 12, 232];
}
const basicCubePillarDefinition = assetDefinitions.basekit_small_cube_tower;
if (basicCubePillarDefinition) {
  basicCubePillarDefinition.geometry = basicCubePillarGeometry;
  basicCubePillarDefinition.color = 0xf3f5f8;
  basicCubePillarDefinition.emissive = 0x30343d;
  basicCubePillarDefinition.baseHeight = 250;
  basicCubePillarDefinition.baseDimensions = [200, 200, 500];
  basicCubePillarDefinition.previewDimensions = [200, 200, 500];
}
const mossyPillarDefinition = assetDefinitions.ancient_pillar;
if (mossyPillarDefinition) {
  mossyPillarDefinition.geometry = lippedPillarGeometry;
  mossyPillarDefinition.color = 0x9b9274;
  mossyPillarDefinition.emissive = 0x293524;
  mossyPillarDefinition.baseHeight = 50;
  mossyPillarDefinition.baseDimensions = [104, 104, 100];
}
const concretePillarDefinition = assetDefinitions.concrete_pillar;
if (concretePillarDefinition) {
  concretePillarDefinition.geometry = concretePillarGeometry;
  concretePillarDefinition.color = 0xa9adb0;
  concretePillarDefinition.emissive = 0x2b3034;
  concretePillarDefinition.baseHeight = 50;
  concretePillarDefinition.baseDimensions = [104, 104, 100];
  concretePillarDefinition.previewDimensions = [96, 96, 100];
}
const marblePillarDefinition = assetDefinitions.sky_pillar;
if (marblePillarDefinition) {
  // Preserve the extracted marble structure but normalize its preview to the
  // canonical 1 m authoring bounds requested by the runtime asset.
  marblePillarDefinition.previewDimensions = [100, 100, 100];
  marblePillarDefinition.baseDimensions = [100, 100, 100];
  marblePillarDefinition.baseHeight = 50;
}
const hollowWhiteCylinderDefinition = assetDefinitions.basekit_small_hollow_cylinder;
if (hollowWhiteCylinderDefinition) {
  hollowWhiteCylinderDefinition.geometry = hollowWhiteCylinderGeometry;
  hollowWhiteCylinderDefinition.color = 0xf4f6ff;
  hollowWhiteCylinderDefinition.emissive = 0x30343d;
  hollowWhiteCylinderDefinition.baseHeight = 200;
  hollowWhiteCylinderDefinition.baseDimensions = [400, 400, 400];
}
const whiteRampDefinition = assetDefinitions.static_basekit_flootslope_01;
if (whiteRampDefinition) {
  whiteRampDefinition.geometry = () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -50, -50, -100,  50, -50, -100,  50, -50, 0,
      -50,  50, -100,  50,  50, 0,    50,  50, -100,
      -50, -50, -100,  50, -50, 0,   -50,  50, -100,
       50, -50, 0,     50,  50, 0,   -50,  50, -100,
      -50, -50, -100, -50,  50, -100, 50,  50, -100,
      -50, -50, -100, 50,  50, -100, 50, -50, -100,
       50, -50, -100, 50,  50, -100, 50,  50, 0,
       50, -50, -100, 50,  50, 0,    50, -50, 0,
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  whiteRampDefinition.baseDimensions = [100, 100, 100];
}
// Apply extracted assembly dimensions after legacy fallback definitions so
// older hand-authored preview sizes cannot override runtime evidence.
Object.entries(blueprintVisualAssemblies).forEach(([assetId, assembly]) => {
  const definition = assetDefinitions[assetId as AssetId];
  if (!definition || !assembly) return;
  definition.baseDimensions = [...assembly.boundsCm.sizeCm] as [number, number, number];
  definition.baseHeight = Math.max(0, -assembly.boundsCm.minCm[2]);
  // Assembly bounds are authored in Unreal's left-handed coordinates, while
  // component matrices above reflect Unreal Y into Three.js Y. Mirror and
  // swap the Y extrema so selection, floor snapping, and Preview collision
  // cover the visible assembly instead of the opposite side of its origin.
  definition.canonicalBoundsCm = {
    min: [assembly.boundsCm.minCm[0], -assembly.boundsCm.maxCm[1], assembly.boundsCm.minCm[2]],
    max: [assembly.boundsCm.maxCm[0], -assembly.boundsCm.minCm[1], assembly.boundsCm.maxCm[2]],
  };
  delete definition.previewDimensions;
});
editorAssetRemovals.forEach((assetId) => {
  const definition = assetDefinitions[assetId];
  if (definition) definition.hiddenInPalette = true;
});
skyPlatformAssetIds.forEach((assetId) => {
  const definition = assetDefinitions[assetId];
  if (definition) definition.hiddenInPalette = true;
});

function assetPreviewMarkup(assetId: AssetId, definition: AssetDefinition) {
  const hasModel = Boolean(assetVisuals[assetId]);
  const profile = definition.visualProfile;
  // Numeric entities remain intact across Windows source/codepage tooling and
  // guarantee a visible silhouette while a mesh thumbnail loads or if its
  // extracted preview cannot be decoded.
  const glyph = profile === 'laserBeam' ? '&#9473;'
    : profile === 'laserWall' ? '&#9637;'
      : profile === 'jetmill' ? '&#10022;'
        : profile === 'polarity' ? '&#9673;'
          : profile === 'light' ? '&#10041;'
            : profile === 'target' ? '&#9678;'
              : hasModel ? '&#9670;' : '&#9632;';
  const colour = `#${definition.color.toString(16).padStart(6, '0')}`;
  const mode = hasModel ? 'model' : profile ? 'profile' : 'basic';
  return `<span class="asset-thumbnail asset-thumbnail--${mode}" style="--asset-preview:${colour}" data-asset-thumbnail="${assetId}" aria-hidden="true"><span class="asset-thumbnail-fallback">${glyph}</span></span><span>${definition.label}</span>`;
}

const palette = document.querySelector<HTMLDivElement>('.asset-palette')!;
for (const [assetId, definition] of Object.entries(assetDefinitions) as Array<[AssetId, AssetDefinition]>) {
  if (definition.hiddenInPalette) continue;
  if (palette.querySelector(`[data-asset-id="${assetId}"]`)) continue;
  const button = document.createElement('button');
  button.className = 'asset-button';
  button.type = 'button';
  button.dataset.catalog = definition.catalog;
  if (definition.surfaceGroup) button.dataset.surfaceGroup = definition.surfaceGroup;
  if (definition.gameplayGroup) button.dataset.gameplayGroup = definition.gameplayGroup;
  if (definition.propGroup) button.dataset.propGroup = definition.propGroup;
  button.dataset.assetId = assetId;
  button.title = definition.description || `Place ${definition.label}. Right-click it for object data.`;
  button.innerHTML = assetPreviewMarkup(assetId, definition);
  palette.append(button);
}
document.querySelectorAll<HTMLButtonElement>('.asset-button[data-asset-id]').forEach((button) => {
  const definition = assetDefinitions[button.dataset.assetId as AssetId];
  button.dataset.catalog = definition.catalog;
  delete button.dataset.surfaceGroup;
  delete button.dataset.gameplayGroup;
  delete button.dataset.propGroup;
  if (definition.surfaceGroup) button.dataset.surfaceGroup = definition.surfaceGroup;
  if (definition.gameplayGroup) button.dataset.gameplayGroup = definition.gameplayGroup;
  if (definition.propGroup) button.dataset.propGroup = definition.propGroup;
  button.title = definition.description || `Place ${definition.label}. Right-click it for object data.`;
  button.innerHTML = assetPreviewMarkup(button.dataset.assetId as AssetId, definition);
});
plannedCatalogueOrder.forEach((assetId) => {
  const button = palette.querySelector<HTMLButtonElement>(`.asset-button[data-asset-id="${assetId}"]`);
  if (button) palette.append(button);
});
(newObjectCatalog as NewObjectCatalogueEntry[]).forEach(({ assetId }) => {
  const button = palette.querySelector<HTMLButtonElement>(`.asset-button[data-asset-id="${assetId}"]`);
  if (button) palette.append(button);
});
(catalogLayout as CatalogueLayoutEntry[])
  .slice()
  .sort((left, right) => left.order - right.order)
  .forEach(({ assetId }) => {
    const button = palette.querySelector<HTMLButtonElement>(`.asset-button[data-asset-id="${assetId}"]`);
    if (button) palette.append(button);
  });

// Generate real mesh thumbnails lazily with one shared renderer. Creating a
// WebGL canvas per catalogue entry would exhaust browser contexts, while
// loading every GLB at startup would make the editor unnecessarily slow.
const assetThumbnailRenderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
assetThumbnailRenderer.setPixelRatio(1);
assetThumbnailRenderer.setSize(96, 96, false);
assetThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
assetThumbnailRenderer.setClearColor(0x000000, 0);
const assetThumbnailCamera = new THREE.OrthographicCamera(-1.35, 1.35, 1.35, -1.35, 0.01, 20);
assetThumbnailCamera.up.set(0, 0, 1);
assetThumbnailCamera.position.set(3.2, -3.2, 2.65);
assetThumbnailCamera.lookAt(0, 0, 0);
const assetThumbnailCache = new Map<AssetId, Promise<string>>();
let assetThumbnailQueue = Promise.resolve();

function disposeThumbnailObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function makeProceduralThumbnailVisual(assetId: AssetId, definition: AssetDefinition) {
  const material = new THREE.MeshStandardMaterial({
    color: definition.color,
    emissive: definition.emissive,
    emissiveIntensity: 0.35,
    roughness: 0.38,
    metalness: 0.08,
    transparent: (definition.opacity ?? 1) < 1,
    opacity: definition.opacity ?? 1,
    side: THREE.DoubleSide,
  });
  const procedural = new THREE.Mesh(definition.geometry(), material);
  procedural.userData.assetId = assetId;
  procedural.userData.entityData = defaultGameplayProperties(assetId);
  ensureProfileVisual(procedural, definition, false);
  return procedural;
}

function frameThumbnailVisual(visual: THREE.Object3D, thumbnailScene: THREE.Scene) {
  const container = new THREE.Group();
  container.add(visual);
  thumbnailScene.add(container);
  container.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(container);
  if (bounds.isEmpty()) throw new Error('Thumbnail mesh has empty bounds.');
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(largestDimension) || largestDimension <= 0.0001) throw new Error('Thumbnail mesh has invalid bounds.');
  const thumbnailScale = 2.05 / largestDimension;
  container.scale.setScalar(thumbnailScale);
  // Group translation is not affected by its own scale in Three.js. Apply
  // the scale to the bounds centre explicitly, otherwise meshes whose actor
  // origin is far from their geometry are centred outside the camera.
  container.position.copy(center).multiplyScalar(-thumbnailScale);
  container.updateMatrixWorld(true);
  return container;
}

function thumbnailContainsVisiblePixels() {
  const context = assetThumbnailRenderer.getContext();
  const pixels = new Uint8Array(96 * 96 * 4);
  context.readPixels(0, 0, 96, 96, context.RGBA, context.UNSIGNED_BYTE, pixels);
  let visiblePixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 16) visiblePixels += 1;
  }
  return visiblePixels >= 12;
}

function forceVisibleThumbnailMaterials(root: THREE.Object3D, assetId: AssetId) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    oldMaterials.forEach((material) => material.dispose());
    // Use the exact same centralized fallback material as a placed mesh. This
    // keeps catalogue colour and placed colour identical even when the Unreal
    // material graph cannot render in Chromium.
    child.material = makeFallbackVisualMaterial(assetId, 'JLE_ThumbnailFallback');
    child.visible = true;
  });
}

async function renderAssetThumbnail(assetId: AssetId) {
  const definition = assetDefinitions[assetId];
  const thumbnailScene = new THREE.Scene();
  thumbnailScene.add(new THREE.HemisphereLight(0xffffff, 0x23314e, 2.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(3, -4, 6);
  thumbnailScene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x65dfff, 1.2);
  rimLight.position.set(-4, 2, 3);
  thumbnailScene.add(rimLight);

  let visual: THREE.Object3D;
  const entry = assetVisuals[assetId];
  if (entry && !usesProceduralEditorVisual(assetId)) {
    visual = flattenVisualMeshes(await loadVisualModel(entry));
    if (repairExtractedMaterials(visual, assetId) === 0) throw new Error('No renderable thumbnail mesh.');
    applyVisualTransform(visual, entry, assetId);
  } else {
    visual = makeProceduralThumbnailVisual(assetId, definition);
  }

  let container = frameThumbnailVisual(visual, thumbnailScene);
  assetThumbnailRenderer.render(thumbnailScene, assetThumbnailCamera);
  if (!thumbnailContainsVisiblePixels() && entry && !usesProceduralEditorVisual(assetId)) {
    // Preserve the genuine extracted silhouette first. Unreal-only materials
    // can draw no pixels in Chromium even when the geometry is valid, so retry
    // the same mesh with one safe catalogue-coloured material.
    forceVisibleThumbnailMaterials(container, assetId);
    assetThumbnailRenderer.render(thumbnailScene, assetThumbnailCamera);
    editorLog('thumbnail-material-fallback', {
      assetId,
      visible: thumbnailContainsVisiblePixels(),
      reason: 'extracted-model-material-rendered-no-pixels',
    });
  }
  if (!thumbnailContainsVisiblePixels()) {
    // Only malformed/empty geometry reaches this final fallback. A visible
    // authoring shape is preferable to an empty navy card.
    thumbnailScene.remove(container);
    disposeThumbnailObject(container);
    visual = makeProceduralThumbnailVisual(assetId, definition);
    container = frameThumbnailVisual(visual, thumbnailScene);
    assetThumbnailRenderer.render(thumbnailScene, assetThumbnailCamera);
    editorLog('thumbnail-fallback', { assetId, reason: 'model-and-material-retry-rendered-no-pixels' });
  }
  const image = assetThumbnailRenderer.domElement.toDataURL('image/png');
  disposeThumbnailObject(container);
  return image;
}

function thumbnailForAsset(assetId: AssetId) {
  let pending = assetThumbnailCache.get(assetId);
  if (!pending) {
    pending = renderAssetThumbnail(assetId);
    assetThumbnailCache.set(assetId, pending);
  }
  return pending;
}

const assetThumbnailObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const target = entry.target as HTMLElement;
    assetThumbnailObserver.unobserve(target);
    const assetId = target.dataset.assetThumbnail as AssetId;
    assetThumbnailQueue = assetThumbnailQueue.then(async () => {
      try {
        const image = document.createElement('img');
        image.className = 'asset-thumbnail-image';
        image.alt = '';
        image.src = await thumbnailForAsset(assetId);
        target.querySelector('.asset-thumbnail-fallback')?.remove();
        target.append(image);
      } catch (error) {
        editorLog('thumbnail-error', {
          assetId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });
}, { root: palette, rootMargin: '120px 0px', threshold: 0.01 });
document.querySelectorAll<HTMLElement>('[data-asset-thumbnail]').forEach((thumbnail) => {
  assetThumbnailObserver.observe(thumbnail);
});

const placedAssets: THREE.Mesh[] = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const placementPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const placementPoint = new THREE.Vector3();
const placementNormal = new THREE.Vector3(0, 0, 1);
const placementNormalMatrix = new THREE.Matrix3();
const placementInstanceMatrix = new THREE.Matrix4();
const localPlacementPoint = new THREE.Vector3();
const supportWorldScale = new THREE.Vector3();
const pointerDown = new THREE.Vector2();
const selectionHelper = new THREE.BoxHelper(origin, 0xd8ff3e);
selectionHelper.visible = false;
scene.add(selectionHelper);
const selectionHighlights = new Map<THREE.Mesh, THREE.Box3Helper>();

function syncSelectionHighlights(meshes: THREE.Mesh[]) {
  const selected = new Set(meshes);
  for (const [mesh, helper] of selectionHighlights) {
    if (selected.has(mesh)) continue;
    scene.remove(helper);
    helper.geometry.dispose();
    (helper.material as THREE.Material).dispose();
    selectionHighlights.delete(mesh);
  }
  for (const mesh of selected) {
    let helper = selectionHighlights.get(mesh);
    if (!helper) {
      helper = new THREE.Box3Helper(canonicalWorldBounds(mesh), 0xd8ff3e);
      helper.userData.editorOnly = true;
      helper.raycast = () => undefined;
      selectionHighlights.set(mesh, helper);
      scene.add(helper);
    }
    helper.box.copy(canonicalWorldBounds(mesh));
    helper.updateMatrixWorld(true);
    helper.visible = !previewMode;
  }
}

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode('translate');
transformControls.setSpace('world');
transformControls.setSize(0.85);
scene.add(transformControls.getHelper());

let activeAssetId: AssetId | null = null;
let placementPreview: THREE.Mesh | null = null;
let selectedAsset: THREE.Mesh | null = null;
let transformInteraction = false;
let transformSnappingEnabled = false;
const lastTransformPointer = new THREE.Vector2();
interface ScaleDragAnchor {
  axis: 'x' | 'y' | 'z';
  side: -1 | 1;
  startWorldPosition: THREE.Vector3;
  startWorldQuaternion: THREE.Quaternion;
  startScale: THREE.Vector3;
  baseSize: THREE.Vector3;
}
let scaleDragAnchor: ScaleDragAnchor | null = null;
const multiSelectionGroup = new THREE.Group();
scene.add(multiSelectionGroup);
const singleSelectionPivot = new THREE.Group();
singleSelectionPivot.name = 'JLE_SingleSelectionPivot';
singleSelectionPivot.userData.editorOnly = true;
scene.add(singleSelectionPivot);
let multiSelectedAssets: THREE.Mesh[] = [];
let lassoEnabled = false;
let lassoDragging = false;
const lassoStart = new THREE.Vector2();
let contextAsset: THREE.Mesh | null = null;

function defaultAssetQuaternion(assetId: AssetId) {
  const rotation = assetDefinitions[assetId].defaultRotation;
  if (!rotation) return new THREE.Quaternion();
  // Same Unreal -> Three.js handedness conversion used for saved transforms.
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(rotation.roll),
    THREE.MathUtils.degToRad(-rotation.pitch),
    THREE.MathUtils.degToRad(-rotation.yaw),
    'ZYX',
  ));
}

levelNameInput.addEventListener('focus', () => {
  isEditingLevelName = true;
  pressed.clear();
  controls.enabled = false;
  transformControls.enabled = false;
  setPlacementAsset(null);
});
levelNameInput.addEventListener('blur', () => {
  isEditingLevelName = false;
  controls.enabled = true;
  transformControls.enabled = true;
  if (!levelNameInput.value.trim()) levelNameInput.value = 'Unnamed Level';
  localStorage.setItem('jle-level-name', levelNameInput.value);
  scheduleAutosave();
});

function profileGroup(mesh: THREE.Mesh) {
  let group = mesh.children.find((child) => child.name === 'JLE_ProfileVisual') as THREE.Group | undefined;
  if (!group) {
    group = new THREE.Group();
    group.name = 'JLE_ProfileVisual';
    group.userData.editorVisual = true;
    group.raycast = () => undefined;
    mesh.add(group);
  }
  return group;
}

function profileMaterial(color: number, preview: boolean, emissive = color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: preview ? 1.1 : 0.7,
    transparent: preview,
    opacity: preview ? 0.55 : 0.92,
    depthWrite: !preview,
    depthTest: !preview,
    roughness: 0.28,
    metalness: 0.12,
  });
}

function ensureProfileVisual(mesh: THREE.Mesh, definition: AssetDefinition, preview: boolean) {
  const profile = definition.visualProfile;
  // Runtime Blueprint assemblies are complete. Never create the superseded
  // hand-built wall frame alongside them, even briefly while GLBs load.
  const hasBasicWallFrame = mesh.userData.assetId === 'basekit_small_basewall'
    && !blueprintVisualAssemblies.basekit_small_basewall;
  const hasBasicWallNoLegsFrame = mesh.userData.assetId === 'basekit_small_basewall_alt'
    && !blueprintVisualAssemblies.basekit_small_basewall_alt;
  const hasMossyPillarDetail = mesh.userData.assetId === 'ancient_pillar';
  const hasConcretePillarDetail = mesh.userData.assetId === 'concrete_pillar';
  if (!profile && !hasBasicWallFrame && !hasBasicWallNoLegsFrame && !hasMossyPillarDetail && !hasConcretePillarDetail) return;
  const group = profileGroup(mesh);
  if (group.children.length > 0) return;

  if (hasBasicWallFrame) {
    const frameMaterial = profileMaterial(0x592a25, preview, 0x2c0a08);
    const frameParts = [
      [400, 30, 24, 0, 0, -12], [400, 30, 24, 0, 0, -214],
      [28, 34, 310, -186, 0, -155], [28, 34, 310, 186, 0, -155],
    ] as const;
    frameParts.forEach(([x, y, z, px, py, pz]) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), frameMaterial.clone());
      part.position.set(px, py, pz);
      group.add(part);
    });
  } else if (hasBasicWallNoLegsFrame) {
    const railMaterial = profileMaterial(0xa7492f, preview, 0x3a1009);
    for (const z of [-10, -242]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(400, 30, 20), railMaterial.clone());
      rail.position.set(0, 0, z);
      group.add(rail);
    }
  } else if (hasMossyPillarDetail) {
    const moss = profileMaterial(0x4d6e3b, preview, 0x162611);
    for (const z of [-4, -96]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(106, 106, 9), moss.clone());
      lip.position.z = z;
      group.add(lip);
    }
  } else if (hasConcretePillarDetail) {
    const bandMaterial = profileMaterial(0x747b80, preview, 0x202429);
    for (const z of [-18, -50, -82]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(102, 102, 5), bandMaterial.clone());
      band.position.z = z;
      group.add(band);
    }
  } else if (profile === 'basic') {
    // Clearly distinguish a supported Blueprint fallback from the old solid
    // colour placeholder while preserving its true authoring bounds.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: definition.color, transparent: preview, opacity: preview ? 0.55 : 0.82 }),
    );
    group.add(edges);
  } else if (profile === 'target') {
    const assetId = mesh.userData.assetId as AssetId;
    const targetColour = definition.color;
    const darkColour = new THREE.Color(definition.emissive).multiplyScalar(0.55).getHex();
    // JETRUNNER's Blueprint targets are floating circular machines: a dark
    // central disc, two luminous faceted rings and four small orbiting fins.
    // Cannon adds a short forward barrel through the centre.
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(43, 43, 28, 16),
      profileMaterial(darkColour, preview, targetColour),
    );
    core.rotation.x = Math.PI / 2;
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(55, 9, 8, 16),
      profileMaterial(targetColour, preview, targetColour),
    );
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(74, 7, 8, 16),
      profileMaterial(darkColour, preview, targetColour),
    );
    for (let index = 0; index < 4; index += 1) {
      const fin = new THREE.Mesh(
        new THREE.ConeGeometry(12, 34, 3),
        profileMaterial(targetColour, preview, targetColour),
      );
      const angle = index * Math.PI / 2 + Math.PI / 4;
      fin.rotation.z = angle - Math.PI / 2;
      fin.position.set(Math.cos(angle) * 91, Math.sin(angle) * 91, 0);
      group.add(fin);
    }
    group.add(core, innerRing, outerRing);
    if (assetId === 'enemy_cannon') {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(17, 24, 88, 12),
        profileMaterial(darkColour, preview, targetColour),
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 42;
      const muzzle = new THREE.Mesh(
        new THREE.TorusGeometry(18, 5, 7, 12),
        profileMaterial(targetColour, preview, targetColour),
      );
      muzzle.position.z = 87;
      group.add(barrel, muzzle);
    }
    // The target's forward direction is local +X. The component shapes above
    // are authored face-up for simple construction, then turned upright as a
    // single assembly so the disc faces the same direction as its arrow.
    group.rotation.y = Math.PI / 2;
  } else if (profile === 'laserBeam') {
    // BP_LaserBeam traces forward until blocked (up to BeamRangeMax=10000 cm).
    // A unit beam is resized each frame to the same first hit in the editor.
    const beamGeometry = new THREE.CylinderGeometry(10, 10, 1, 12);
    beamGeometry.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeometry, profileMaterial(0xa95cff, preview, 0x38126c));
    beam.name = 'JLE_RuntimeLaserBeam';
    beam.scale.x = 300;
    beam.position.x = 150;
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 38, 16), profileMaterial(0x251339, preview, 0xa95cff));
    emitter.rotation.z = Math.PI / 2;
    emitter.position.x = 0;
    group.add(beam, emitter);
  } else if (profile === 'laserWall') {
    // BP_LaserWall is a horizontal floor hazard, despite its historical
    // editor name. Represent its purple field and all four perimeter rails
    // rather than the old pair of upright red slabs.
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 180),
      profileMaterial(0x8f2cff, preview, 0x5d18c5),
    );
    field.position.z = 7;
    const railMaterial = profileMaterial(0xe8c7ff, preview, 0x9b47ff);
    const longRailGeometry = new THREE.CylinderGeometry(7, 7, 300, 10);
    longRailGeometry.rotateZ(Math.PI / 2);
    const shortRailGeometry = new THREE.CylinderGeometry(7, 7, 200, 10);
    const rails = [
      new THREE.Mesh(longRailGeometry, railMaterial),
      new THREE.Mesh(longRailGeometry, railMaterial.clone()),
      new THREE.Mesh(shortRailGeometry, railMaterial.clone()),
      new THREE.Mesh(shortRailGeometry, railMaterial.clone()),
    ];
    rails[0].position.set(0, 100, 12);
    rails[1].position.set(0, -100, 12);
    rails[2].position.set(150, 0, 12);
    rails[3].position.set(-150, 0, 12);
    group.add(field, ...rails);
  } else if (profile === 'jetmill') {
    // The game-facing object is a flattened movement plane. Its chevron is
    // an editor-only direction indicator, not a second gameplay object.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 20), profileMaterial(0x101318, preview));
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(18, 58, 3), profileMaterial(0xf2f6ff, preview, 0x262b34));
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(16, 0, 16);
    group.add(plate, arrow);
  } else if (profile === 'polarity') {
    const assetId = mesh.userData.assetId as AssetId;
    const isBlastJelly = assetId === 'blast_jelly_container'
      || assetId === 'blast_jelly_container_evil'
      || assetId === 'blast_jelly_container_grounded';
    const nativeRingAssets = new Set<AssetId>([
      'blast_jelly_container', 'blast_jelly_container_evil',
      'blast_jelly_container_grounded', 'jet_bubble',
    ]);
    const ringColour = nativeRingAssets.has(mesh.userData.assetId as AssetId)
      ? definition.color
      : 0x5de9ff;
    // Blast Jelly bodies are roughly 50 cm in radius. Keep their identifying
    // ring outside that silhouette so it cannot be mistaken for a Jelly Pickup.
    const indicator = new THREE.Mesh(
      new THREE.TorusGeometry(isBlastJelly ? 58 : 42, isBlastJelly ? 7 : 5, 10, 28),
      profileMaterial(ringColour, preview),
    );
    const middleRingAssets = new Set<AssetId>([
      'blast_jelly_container', 'blast_jelly_container_evil',
      'blast_jelly_container_grounded', 'jet_bubble',
    ]);
    indicator.position.z = middleRingAssets.has(mesh.userData.assetId as AssetId) ? 0 : 58;
    group.add(indicator);
  } else if (profile === 'light') {
    const light = new THREE.PointLight(0xffe1a3, preview ? 0.45 : 0.85, 750, 2);
    light.position.z = 48;
    light.castShadow = false;
    // The prop geometry already contains its flame/bulb. A second editor
    // sphere was interpreted as part of the asset and became enormous after
    // fitting/scaling. Keep illumination without adding visible glow geometry.
    group.add(light);
  }
  group.traverse((child) => {
    child.userData.editorVisual = true;
    if (child instanceof THREE.Mesh) child.raycast = () => undefined;
  });
}

function polarityColour(mesh: THREE.Mesh) {
  const data = mesh.userData.entityData as Record<string, unknown> | undefined;
  const definition = assetDefinitions[mesh.userData.assetId as AssetId];
  if (!data || !definition) return null;
  const assetId = mesh.userData.assetId as AssetId;
  if (assetId === 'light_rims') {
    return currentWorldStartingPolarity() === 1 ? 0x5de9ff : 0xff4ca5;
  }
  // These props have canonical native colours. Their polarity is gameplay
  // data, not a request to recolour the entire editor mesh cyan/pink.
  if (new Set<AssetId>([
    'blast_jelly_container', 'blast_jelly_container_evil',
    'blast_jelly_container_grounded', 'jet_bubble', 'laser_wall',
  ]).has(assetId)) return null;
  const isPolarityObject = definition.visualProfile === 'polarity'
    || definition.visualProfile === 'laserWall'
    || definition.visualProfile === 'jetmill';
  const usesPolarity = data.UsePolarity === true || (isPolarityObject && (
    typeof data.Polarity === 'boolean' || typeof data.LocalPolarity === 'boolean' || typeof data.PolarityLocal === 'boolean'
  ));
  if (!usesPolarity) return null;
  const positive = (data.LocalPolarity ?? data.Polarity ?? data.PolarityLocal ?? true) !== false;
  return positive ? 0x5de9ff : 0xff4ca5;
}

function refreshAssetPresentation(mesh: THREE.Mesh) {
  const assetId = mesh.userData.assetId as AssetId;
  const definition = assetDefinitions[assetId];
  if (!definition) return;
  const preview = Boolean(mesh.userData.isPlacementPreview);
  ensureProfileVisual(mesh, definition, preview);
  const polarity = polarityColour(mesh);
  const jetmillSpeed = Number(mesh.userData.entityData?.JetmillSpeed ?? defaultGameplayProperties(assetId).JetmillSpeed ?? 0);
  const supercharged = (assetId === 'jetmill' || assetId === 'jetmill_supercharged') && jetmillSpeed >= 1200;
  const instakillLaser = assetId === 'laser_beam' && mesh.userData.entityData?.Instakill === true;
  mesh.userData.assetLabel = supercharged ? 'Supercharged Jetmill' : definition.label;
  mesh.name = mesh.userData.assetLabel;

  mesh.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const coloured = material as THREE.MeshStandardMaterial;
      if (!coloured.color) return;
      const stored = coloured.userData.jleBaseColor as number | undefined;
      if (stored === undefined) coloured.userData.jleBaseColor = coloured.color.getHex();
      const base = new THREE.Color(stored ?? coloured.color.getHex());
      // Laser tint is an intentional gameplay-state preview: purple is the
      // regular beam, while Instakill is unambiguously red.
      if (assetId === 'laser_beam') base.set(instakillLaser ? 0xff2638 : 0xa95cff);
      if (assetId === 'polarity_flipper') base.set(mesh.userData.entityData?.Polarity === false ? 0xff354f : 0x52dfff);
      if (assetId === 'light_rims' && polarity !== null) base.set(polarity);
      if (assetId === 'sky_platform') base.set(0xe7f5ff);
      if (assetId === 'sky_platform_blue') base.set(0x4a9cff);
      if (assetId === 'sky_platform_gold') base.set(0xffc94a);
      if (assetId === 'sky_platform_yellow') base.set(0xffeb4f);
      if (supercharged) base.lerp(new THREE.Color(0xd858ff), 0.68);
      if (polarity !== null) base.lerp(new THREE.Color(polarity), 0.62);
      coloured.color.copy(base);
      if (coloured.emissive && (polarity !== null || supercharged)) {
        coloured.emissive.set(polarity ?? 0xd858ff);
        coloured.emissiveIntensity = preview ? 0.85 : 0.55;
      }
      coloured.needsUpdate = true;
    });
  });
}

function basicFallbackGeometry(label: string) {
  const name = label.toLowerCase();
  if (/ramp|slope|stair|triangle/.test(name)) {
    const shape = new THREE.Shape();
    shape.moveTo(-50, -50); shape.lineTo(50, -50); shape.lineTo(50, 50); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 100, bevelEnabled: false });
  }
  if (/wall|panel|gallery|screen|monitor|door/.test(name)) return new THREE.BoxGeometry(140, 20, 100);
  if (/pillar|tower|pole|torch|tree|crane|ladder|strut/.test(name)) {
    const geometry = new THREE.CylinderGeometry(25, 34, 220, 12);
    // Three.js cylinders are Y-up; procedural editor objects are Z-up.
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }
  if (/ring|bubble|sphere|orb|balloon|blimp/.test(name)) return new THREE.SphereGeometry(65, 16, 12);
  if (/platform|floor|carpet|tarp|water/.test(name)) return topOriginBoxGeometry(140, 140, 20);
  if (/ice|snow|rock|cliff|mountain/.test(name)) return new THREE.DodecahedronGeometry(70, 1);
  if (/beam|bar|fence|plank|pipe/.test(name)) return new THREE.CylinderGeometry(12, 12, 180, 12);
  return dummyPlaceholderGeometry();
}

const interactionRangeGeometry = new THREE.SphereGeometry(1, 24, 16);
const interactionRangeMaterial = new THREE.MeshBasicMaterial({
  color: 0x50dcff,
  transparent: true,
  opacity: 0.075,
  depthWrite: false,
  side: THREE.DoubleSide,
});
let showInteractionRanges = readProjectSettings().showInteractionRanges === true;
let pushToEdit = readProjectSettings().pushToEdit === true;
let pasteInPlace = readProjectSettings().pasteInPlace === true;
let moveOnRotatedAxes = readProjectSettings().moveOnRotatedAxes === true;
let allowFractionalObjectSizing = readProjectSettings().allowFractionalObjectSizing === true;

function attachInteractionRange(mesh: THREE.Mesh, definition: AssetDefinition, preview: boolean) {
  if (preview || !definition.interactionRange) return;
  const orb = new THREE.Mesh(interactionRangeGeometry, interactionRangeMaterial);
  orb.name = 'JLE_InteractionRange';
  orb.position.set(...definition.interactionRange.center);
  orb.scale.setScalar(definition.interactionRange.radius);
  orb.visible = showInteractionRanges;
  orb.renderOrder = 5;
  orb.userData.editorOnly = true;
  orb.userData.sharedEditorResource = true;
  orb.raycast = () => undefined;
  mesh.add(orb);
}

function makeAssetMesh(assetId: AssetId, preview = false) {
  const definition = assetDefinitions[assetId];
  const material = new THREE.MeshStandardMaterial({
    color: definition.color,
    emissive: definition.emissive,
    emissiveIntensity: preview ? 0.8 : 0.35,
    roughness: 0.38,
    metalness: 0.08,
    transparent: preview || (definition.opacity ?? 1) < 1,
    opacity: preview ? Math.min(0.62, definition.opacity ?? 1) : definition.opacity ?? 1,
    depthWrite: !preview,
    depthTest: !preview,
  });
  // Surface definitions carry authoritative editor geometry and dimensions.
  // The generic visual fallback is only for non-surface Blueprint/prop assets;
  // applying it to surfaces silently replaced Sky, Ice and other platforms
  // with the universal 140 x 140 x 20 fallback slab.
  const geometry = definition.catalog !== 'surface'
    && definition.visualProfile === 'basic'
    && !assetVisuals[assetId]
    ? basicFallbackGeometry(definition.label)
    : definition.geometry();
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(geometry, material);
  attachInteractionRange(mesh, definition, preview);
  if (assetId === 'laser_beam') material.visible = false;
  if (assetId === 'jet_water_surface') material.side = THREE.DoubleSide;
  if (assetId === 'ice_platform_4x4') {
    const faceTextures = Array.from({ length: 6 }, () => {
      const color = editorTextureLoader.load('./asset-visuals/materials/T_Ice00_C_sRGB.png');
      const normal = editorTextureLoader.load('./asset-visuals/materials/T_Ice00_N.png');
      color.colorSpace = THREE.SRGBColorSpace;
      for (const texture of [color, normal]) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      return { color, normal };
    });
    mesh.material = faceTextures.map(({ color, normal }) => new THREE.MeshPhysicalMaterial({
      map: color,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.58, 0.58),
      color: 0xa8f6ff,
      emissive: 0x073c62,
      emissiveIntensity: preview ? 0.72 : 0.3,
      roughness: 0.2,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      transparent: preview,
      opacity: preview ? 0.6 : 1,
      depthWrite: !preview,
      depthTest: !preview,
    }));
    const horizontalRims: THREE.Mesh[] = [];
    const verticalRims: THREE.Mesh[] = [];
    const updateIceVisuals = () => {
      // The source ice image contains several cells within one texture tile.
      // Unreal's dimension-block material uses a much larger world-space
      // scale; dividing by 7.5 reproduces roughly two visible repetitions on
      // a typical editor platform instead of the previous ~15.
      const sx = Math.max(0.001, Math.abs(mesh.scale.x));
      const sy = Math.max(0.001, Math.abs(mesh.scale.y));
      const sz = Math.max(0.001, Math.abs(mesh.scale.z));
      const repeats: Array<[number, number]> = [
        [sy / 7.5, sz / 7.5], [sy / 7.5, sz / 7.5],
        [sx / 7.5, sz / 7.5], [sx / 7.5, sz / 7.5],
        [sx / 7.5, sy / 7.5], [sx / 7.5, sy / 7.5],
      ];
      faceTextures.forEach(({ color, normal }, index) => {
        // Keep texel density constant on every box face. The old 0.25 floor
        // made the shorter axis stop updating while its geometry continued
        // growing, which left one side visibly stretched.
        const repeatX = Math.max(0.01, repeats[index][0]);
        const repeatY = Math.max(0.01, repeats[index][1]);
        color.repeat.set(repeatX, repeatY);
        normal.repeat.set(repeatX, repeatY);
      });
      horizontalRims.forEach((rim, index) => {
        rim.scale.set(1, 1 / sy, 1 / sz);
        rim.position.set(0, (index === 0 ? 1 : -1) * (50 - 50 / sy), -2 / sz);
      });
      verticalRims.forEach((rim, index) => {
        rim.scale.set(1 / sx, 1, 1 / sz);
        rim.position.set((index === 0 ? 1 : -1) * (50 - 50 / sx), 0, -2 / sz);
      });
    };
    mesh.onBeforeRender = updateIceVisuals;

    const rimMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8ff5ff,
      emissive: 0x0a5277,
      emissiveIntensity: preview ? 0.7 : 0.34,
      roughness: 0.24,
      metalness: 0.04,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
      transparent: preview,
      opacity: preview ? 0.52 : 1,
      depthWrite: !preview,
      depthTest: !preview,
    });
    const rimParts: Array<[number, number, 'horizontal' | 'vertical']> = [
      [100, 100, 'horizontal'], [100, 100, 'horizontal'],
      [100, 100, 'vertical'], [100, 100, 'vertical'],
    ];
    rimParts.forEach(([width, depth, orientation]) => {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(width, depth, 8), rimMaterial.clone());
      // Embed most of the rim into the top face. Only a shallow 2 cm lip is
      // visible, matching the in-game frame without a floating gap.
      rim.userData.editorDecoration = true;
      rim.raycast = () => undefined;
      (orientation === 'horizontal' ? horizontalRims : verticalRims).push(rim);
      mesh.add(rim);
    });
    // Initialise the counter-scaled frame before its first render.
    updateIceVisuals();
  }
  if (assetId === 'wooden_platform' || assetId === 'wooden_platform_2x2') {
    const makeCanvasTexture = (canvas: HTMLCanvasElement) => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    };
    const deckCanvas = document.createElement('canvas');
    deckCanvas.width = deckCanvas.height = 256;
    const deckContext = deckCanvas.getContext('2d')!;
    deckContext.fillStyle = '#6f3824';
    deckContext.fillRect(0, 0, 256, 256);
    const plankColors = ['#81452d', '#713820', '#8b4d31', '#66301f', '#794029', '#8d5035'];
    for (let plank = 0; plank < 16; plank += 1) {
      const left = plank * 16;
      deckContext.fillStyle = plankColors[plank % plankColors.length];
      deckContext.fillRect(left + 2, 0, 13, 256);
      deckContext.fillStyle = 'rgba(255,190,125,0.11)';
      deckContext.fillRect(left + 3, 0, 2, 256);
      deckContext.fillStyle = 'rgba(24,8,5,0.72)';
      deckContext.fillRect(left, 0, 2, 256);
      deckContext.fillStyle = 'rgba(32,12,8,0.34)';
      for (let y = 10 + (plank % 3) * 7; y < 256; y += 31) deckContext.fillRect(left + 12, y, 2, 3);
    }
    const sideCanvas = document.createElement('canvas');
    sideCanvas.width = sideCanvas.height = 256;
    const sideContext = sideCanvas.getContext('2d')!;
    const sideGradient = sideContext.createLinearGradient(0, 0, 0, 256);
    sideGradient.addColorStop(0, '#69747a');
    sideGradient.addColorStop(0.18, '#566168');
    sideGradient.addColorStop(0.65, '#606b70');
    sideGradient.addColorStop(1, '#444f55');
    sideContext.fillStyle = sideGradient;
    sideContext.fillRect(0, 0, 256, 256);
    const faceTextures = Array.from({ length: 6 }, (_, index) => makeCanvasTexture(index === 4 ? deckCanvas : sideCanvas));
    const concreteTexturePath = './asset-visuals/materials/T_Leaky_Paint_Grunge.png';
    editorTextureLoader.load(concreteTexturePath, (sourceTexture) => {
      sideContext.drawImage(sourceTexture.image, 0, 0, 256, 256);
      const pixels = sideContext.getImageData(0, 0, 256, 256);
      for (let offset = 0; offset < pixels.data.length; offset += 4) {
        const source = pixels.data[offset] / 255;
        // Preserve the game's grunge pattern while mapping its monochrome
        // values into the blue-neutral concrete range visible in-game.
        pixels.data[offset] = 68 + source * 92;
        pixels.data[offset + 1] = 75 + source * 94;
        pixels.data[offset + 2] = 78 + source * 96;
        pixels.data[offset + 3] = 255;
      }
      sideContext.putImageData(pixels, 0, 0);
      // Sparse recessed bolt marks match the concrete insert on the genuine
      // 1x1x1 platform without becoming noisy when the texture tiles.
      sideContext.fillStyle = 'rgba(20,25,27,0.78)';
      for (const [x, y] of [[64, 64], [190, 82], [82, 190], [198, 205]]) {
        sideContext.beginPath();
        sideContext.arc(x, y, 4, 0, Math.PI * 2);
        sideContext.fill();
      }
      faceTextures.forEach((texture, index) => {
        if (index !== 4) texture.needsUpdate = true;
      });
      sourceTexture.dispose();
      editorLog('texture', { event: 'wood-concrete-loaded', path: concreteTexturePath });
    }, undefined, (error) => editorLog('texture-error', `${concreteTexturePath}: ${String(error)}`));
    const woodMaterials = faceTextures.map((texture, index) => new THREE.MeshStandardMaterial({
      map: texture,
      color: index === 4 ? 0xffffff : 0xe1e4e4,
      emissive: index === 4 ? 0x170a04 : 0x111518,
      emissiveIntensity: preview ? 0.4 : 0.16,
      roughness: index === 4 ? 0.7 : 0.46,
      metalness: index === 4 ? 0 : 0.24,
      transparent: preview,
      opacity: preview ? 0.62 : 1,
      depthWrite: !preview,
      depthTest: !preview,
    }));
    mesh.material = woodMaterials;
    const horizontalRims: THREE.Mesh[] = [];
    const verticalRims: THREE.Mesh[] = [];
    const cornerCaps: THREE.Mesh[] = [];
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x849399,
      emissive: 0x11191c,
      emissiveIntensity: preview ? 0.45 : 0.16,
      roughness: 0.32,
      metalness: 0.62,
      transparent: preview,
      opacity: preview ? 0.62 : 1,
      depthWrite: !preview,
      depthTest: !preview,
    });
    for (let index = 0; index < 2; index += 1) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(100, 7, 7), rimMaterial.clone());
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(7, 100, 7), rimMaterial.clone());
      horizontal.userData.editorDecoration = vertical.userData.editorDecoration = true;
      horizontal.raycast = vertical.raycast = () => undefined;
      horizontalRims.push(horizontal);
      verticalRims.push(vertical);
      mesh.add(horizontal, vertical);
    }
    for (let index = 0; index < 4; index += 1) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 10), rimMaterial.clone());
      cap.userData.editorDecoration = true;
      cap.raycast = () => undefined;
      cornerCaps.push(cap);
      mesh.add(cap);
    }
    const updateWoodVisuals = () => {
      const sx = Math.max(1, Math.abs(mesh.scale.x));
      const sy = Math.max(1, Math.abs(mesh.scale.y));
      const sz = Math.max(1, Math.abs(mesh.scale.z));
      const repeats: Array<[number, number]> = [
        // BoxGeometry's +/-X faces map U to local Z and V to local Y.
        [sz, sy], [sz, sy],
        [sx, sz], [sx, sz],
        [sx, sy], [sx, sy],
      ];
      faceTextures.forEach((texture, index) => texture.repeat.set(...repeats[index]));
      horizontalRims.forEach((rim, index) => {
        rim.scale.set(1, 1 / sy, 1 / sz);
        rim.position.set(0, (index === 0 ? 1 : -1) * (50 - 3.5 / sy), 1.5 / sz);
      });
      verticalRims.forEach((rim, index) => {
        rim.scale.set(1 / sx, 1, 1 / sz);
        rim.position.set((index === 0 ? 1 : -1) * (50 - 3.5 / sx), 0, 1.5 / sz);
      });
      cornerCaps.forEach((cap, index) => {
        const xSign = index < 2 ? -1 : 1;
        const ySign = index % 2 === 0 ? -1 : 1;
        cap.scale.set(1 / sx, 1 / sy, 1 / sz);
        cap.position.set(xSign * (50 - 7.5 / sx), ySign * (50 - 7.5 / sy), 1 / sz);
      });
    };
    mesh.onBeforeRender = updateWoodVisuals;
    updateWoodVisuals();
  }
  if (
    definition.catalog === 'surface'
    && definition.surfaceGroup === 'platforms'
    && assetId !== 'ice_platform_4x4'
    && assetId !== 'wooden_platform'
    && assetId !== 'wooden_platform_2x2'
  ) {
    const family = assetId.startsWith('sky_platform')
      ? 'sky'
      : assetId.startsWith('basekit_small_platform')
        ? 'basekit'
        : 'virtual';
    const baseColor = new THREE.Color(definition.color);
    const cssColor = `#${baseColor.getHexString()}`;
    const darkColor = baseColor.clone().multiplyScalar(family === 'virtual' ? 0.12 : 0.48);
    const lightColor = baseColor.clone().lerp(new THREE.Color(0xffffff), family === 'sky' ? 0.56 : 0.24);
    const makePlatformCanvas = (top: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d')!;
      if (family === 'virtual') {
        context.fillStyle = top ? `#${darkColor.clone().multiplyScalar(1.35).getHexString()}` : `#${darkColor.getHexString()}`;
        context.fillRect(0, 0, 256, 256);
        context.strokeStyle = cssColor;
        context.globalAlpha = top ? 0.82 : 0.56;
        context.lineWidth = top ? 5 : 3;
        for (let coordinate = 0; coordinate <= 256; coordinate += 32) {
          context.beginPath(); context.moveTo(coordinate, 0); context.lineTo(coordinate, 256); context.stroke();
          context.beginPath(); context.moveTo(0, coordinate); context.lineTo(256, coordinate); context.stroke();
        }
        context.globalAlpha = 1;
        context.strokeStyle = `#${lightColor.getHexString()}`;
        context.lineWidth = 7;
        context.strokeRect(4, 4, 248, 248);
        for (const [x, y] of [[16, 16], [240, 16], [16, 240], [240, 240]]) {
          context.fillStyle = `#${lightColor.getHexString()}`;
          context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill();
        }
      } else if (family === 'sky') {
        // Sky platforms use a pale modular panel surface rather than a colour
        // wash. The blueprint variant colour is concentrated in the edging
        // and body trim.
        context.fillStyle = top ? '#dce5e9' : `#${baseColor.clone().multiplyScalar(0.58).getHexString()}`;
        context.fillRect(0, 0, 256, 256);
        context.strokeStyle = top ? 'rgba(82,101,112,0.42)' : 'rgba(235,247,255,0.32)';
        context.lineWidth = top ? 3 : 2;
        for (let coordinate = 0; coordinate <= 256; coordinate += 64) {
          context.beginPath(); context.moveTo(coordinate, 0); context.lineTo(coordinate, 256); context.stroke();
          context.beginPath(); context.moveTo(0, coordinate); context.lineTo(256, coordinate); context.stroke();
        }
        context.strokeStyle = cssColor;
        context.lineWidth = 10;
        context.strokeRect(5, 5, 246, 246);
        context.strokeStyle = 'rgba(255,255,255,0.74)';
        context.lineWidth = 3;
        context.strokeRect(11, 11, 234, 234);
      } else {
        context.fillStyle = `#${baseColor.clone().multiplyScalar(top ? 0.92 : 0.72).getHexString()}`;
        context.fillRect(0, 0, 256, 256);
        // Basekit concrete uses irregular aggregate, seams and recessed bolts.
        for (let index = 0; index < 150; index += 1) {
          const x = (index * 73) % 256;
          const y = (index * 151) % 256;
          const shade = index % 3 === 0 ? '255,255,255' : '18,28,35';
          context.fillStyle = `rgba(${shade},${index % 3 === 0 ? 0.08 : 0.12})`;
          context.fillRect(x, y, 2 + (index % 4), 2 + ((index * 3) % 4));
        }
        context.strokeStyle = 'rgba(22,34,42,0.42)';
        context.lineWidth = 4;
        context.strokeRect(3, 3, 250, 250);
        context.fillStyle = 'rgba(15,22,27,0.72)';
        for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) {
          context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill();
        }
      }
      return canvas;
    };
    const topCanvas = makePlatformCanvas(true);
    const sideCanvas = makePlatformCanvas(false);
    const platformTextures = Array.from({ length: 6 }, (_, index) => {
      const texture = new THREE.CanvasTexture(index === 4 ? topCanvas : sideCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    });
    const platformMaterials = platformTextures.map((texture, index) => new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      emissive: family === 'virtual' ? definition.color : definition.emissive,
      emissiveIntensity: family === 'virtual' ? (preview ? 0.72 : 0.42) : (preview ? 0.34 : 0.1),
      roughness: family === 'sky' ? 0.3 : family === 'virtual' ? 0.38 : 0.76,
      metalness: family === 'sky' ? 0.34 : family === 'virtual' ? 0.16 : 0.04,
      transparent: preview,
      opacity: preview ? 0.62 : 1,
      depthWrite: !preview,
      depthTest: !preview,
      side: index === 5 ? THREE.DoubleSide : THREE.FrontSide,
    }));
    mesh.material = platformMaterials;
    const updatePlatformTextures = () => {
      const dimensions = definition.baseDimensions ?? [100, 100, 100];
      const sx = Math.max(0.01, Math.abs(mesh.scale.x) * dimensions[0] / 100);
      const sy = Math.max(0.01, Math.abs(mesh.scale.y) * dimensions[1] / 100);
      const sz = Math.max(0.01, Math.abs(mesh.scale.z) * dimensions[2] / 100);
      const repeats: Array<[number, number]> = [
        [sz, sy], [sz, sy],
        [sx, sz], [sx, sz],
        [sx, sy], [sx, sy],
      ];
      platformTextures.forEach((texture, index) => texture.repeat.set(...repeats[index]));
    };
    mesh.onBeforeRender = updatePlatformTextures;
    updatePlatformTextures();
    editorLog('material', { event: 'platform-family-applied', assetId, family });
  }
  mesh.rotation.order = 'ZYX';
  mesh.quaternion.copy(defaultAssetQuaternion(assetId));
  mesh.userData.assetId = assetId;
  mesh.userData.assetLabel = definition.label;
  mesh.userData.isPlacementPreview = preview;
  mesh.userData.id = preview ? '' : crypto.randomUUID();
  mesh.userData.entityData = preview ? {} : defaultGameplayProperties(assetId);
  refreshAssetPresentation(mesh);
  if (assetId.startsWith('sky_platform') || assetId === 'ice_platform_4x4') {
    mesh.geometry.computeBoundingBox();
    const localSize = mesh.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
    editorLog('platform-dimensions', {
      event: preview ? 'preview-created' : 'object-created',
      assetId,
      localGeometryUnits: localSize.toArray(),
      canonicalRuntimeCentimetres: definition.baseDimensions,
      objectScale: mesh.scale.toArray(),
    });
  }
  if (assetId === 'crane') {
    const cableGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3500, 0, 40), new THREE.Vector3(0, 0, 1000),
      new THREE.Vector3(0, 0, 1000), new THREE.Vector3(1750, 0, 40),
      new THREE.Vector3(-3200, 0, 40), new THREE.Vector3(-3200, 0, -4700),
    ]);
    const cables = new THREE.LineSegments(cableGeometry, new THREE.LineBasicMaterial({
      color: 0x101827,
      transparent: preview,
      opacity: preview ? 0.45 : 0.9,
    }));
    cables.name = 'CraneCableDummy';
    cables.rotation.z = Math.PI;
    cables.userData.editorVisual = true;
    cables.raycast = () => undefined;
    mesh.add(cables);
  }
  if (assetId === 'water_pipe' || assetId === 'water_pipe_etheral' || assetId === 'water_pipe_rave') {
    const waterCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(78, 0, 0),
      new THREE.Vector3(104, 0, 2),
      new THREE.Vector3(122, 0, -20),
      new THREE.Vector3(122, 0, -66),
    );
    const waterGeometry = new THREE.TubeGeometry(waterCurve, 24, 48, 18, false);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: assetId === 'water_pipe_rave' ? 0x177fe8 : 0x126c78,
      emissive: assetId === 'water_pipe_rave' ? 0x062c72 : 0x063442,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: preview ? 0.38 : 0.82,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.name = 'WaterPipeFlowDummy';
    water.userData.editorVisual = true;
    water.raycast = () => undefined;
    mesh.add(water);

    // Continue the compact elbow with the pipe's full 8 m falling-water
    // column. CylinderGeometry is Y-aligned, so rotate it onto local Z.
    const fallingWaterGeometry = new THREE.CylinderGeometry(48, 48, 800, 18);
    fallingWaterGeometry.rotateX(Math.PI / 2);
    fallingWaterGeometry.translate(122, 0, -466);
    const fallingWater = new THREE.Mesh(fallingWaterGeometry, waterMaterial.clone());
    fallingWater.name = 'WaterPipeFallingColumnDummy';
    fallingWater.userData.editorVisual = true;
    fallingWater.raycast = () => undefined;
    mesh.add(fallingWater);
  }
  if (assetId === 'torch_floor') {
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff7db,
      emissive: 0xff8a24,
      emissiveIntensity: preview ? 1.6 : 2.5,
      roughness: 0.35,
      transparent: preview,
      opacity: preview ? 0.55 : 0.95,
    });
    mesh.geometry.computeBoundingBox();
    const floorZ = mesh.geometry.boundingBox?.min.z ?? 0;
    const flameGroup = new THREE.Group();
    flameGroup.position.z = floorZ;
    flameGroup.scale.setScalar(0.5);
    flameGroup.userData.editorVisual = true;
    flameGroup.raycast = () => undefined;
    mesh.add(flameGroup);
    const lowerFlame = new THREE.Mesh(new THREE.SphereGeometry(25, 12, 9), flameMaterial);
    lowerFlame.scale.set(1, 0.8, 1.35);
    lowerFlame.position.z = 128 - floorZ;
    const flameTip = new THREE.Mesh(new THREE.ConeGeometry(18, 68, 10), flameMaterial.clone());
    flameTip.position.z = 174 - floorZ;
    flameTip.rotation.z = -0.18;
    for (const flame of [lowerFlame, flameTip]) {
      flame.userData.editorVisual = true;
      flame.raycast = () => undefined;
      flameGroup.add(flame);
    }
  }
  if (assetId === 'player_start') {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 90),
      190,
      0xd8ff3e,
      58,
      32,
    );
    arrow.name = 'PlayerForwardArrow';
    mesh.add(arrow);
  }
  if (assetId.startsWith('enemy_')) {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 105),
      185,
      0xd8ff3e,
      58,
      32,
    );
    arrow.name = 'EnemyForwardArrow';
    mesh.add(arrow);
  }
  void attachAssetVisual(mesh, assetId, preview);
  updateWoodenPlatformSupports(mesh);
  return mesh;
}

function updateWoodenPlatformSupports(mesh: THREE.Mesh) {
  if (mesh.userData.assetId !== 'wooden_platform' && mesh.userData.assetId !== 'wooden_platform_2x2') return;
  mesh.updateMatrixWorld(true);
  const worldScale = mesh.getWorldScale(new THREE.Vector3());
  const scaleX = Math.max(Math.abs(worldScale.x), 0.0001);
  const scaleY = Math.max(Math.abs(worldScale.y), 0.0001);
  const scaleZ = Math.max(Math.abs(worldScale.z), 0.0001);
  const inverseX = 1 / scaleX;
  const inverseY = 1 / scaleY;
  const inverseZ = 1 / scaleZ;
  const deckBottomZ = mesh.localToWorld(new THREE.Vector3(0, 0, -100 * inverseZ)).z;
  const supportingSurfaces = placedAssets.filter((candidate) => (
    candidate !== mesh
    && assetDefinitions[candidate.userData.assetId as AssetId]?.catalog === 'surface'
  )).map((candidate) => ({
    mesh: candidate,
    bounds: new THREE.Box3().setFromObject(candidate),
  }));
  let supportIndex = 0;
  mesh.children.forEach((child) => {
    if (child.userData.genuineMeshReplacement) {
      child.visible = false;
      return;
    }
    if (child.name === 'WoodenPlatformFixedDeck') {
      child.scale.set(1, 1, inverseZ);
    } else if (child.name === 'WoodenPlatformLinearSupport') {
      const xSign = supportIndex < 2 ? -1 : 1;
      const ySign = supportIndex % 2 === 0 ? -1 : 1;
      const localX = xSign * (50 - 6 * inverseX);
      const localY = ySign * (50 - 6 * inverseY);
      const cornerWorld = mesh.localToWorld(new THREE.Vector3(localX, localY, -100 * inverseZ));
      let supportTop: number | null = null;
      supportingSurfaces.forEach(({ bounds }) => {
        const containsCorner = cornerWorld.x >= bounds.min.x - 0.01
          && cornerWorld.x <= bounds.max.x + 0.01
          && cornerWorld.y >= bounds.min.y - 0.01
          && cornerWorld.y <= bounds.max.y + 0.01;
        if (!containsCorner || bounds.max.z >= deckBottomZ - 0.01) return;
        if (supportTop === null || bounds.max.z > supportTop) supportTop = bounds.max.z;
      });
      const supportLength = supportTop === null ? 0 : deckBottomZ - supportTop;
      child.visible = supportLength > 0.01;
      child.position.set(localX, localY, -100 * inverseZ);
      child.scale.set(inverseX, inverseY, (supportLength / 100) * inverseZ);
      supportIndex += 1;
    }
  });
}

function updateAllWoodenPlatformSupports() {
  placedAssets.forEach(updateWoodenPlatformSupports);
}

function roundValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeRotationDegrees(value: number) {
  if (!Number.isFinite(value)) return 0;
  // Keep serialized Unreal rotators deterministic while preserving equivalent
  // orientations. This prevents accumulated edits from producing 360, 720,
  // or negative-zero angles that are difficult for users to reason about.
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : roundValue(normalized);
}

function serializeTransform(mesh: THREE.Mesh) {
  const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
  const worldQuaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
  const worldScale = mesh.getWorldScale(new THREE.Vector3());
  // Unreal FRotator composes yaw (Z), pitch (Y), then roll (X).
  const worldRotation = new THREE.Euler().setFromQuaternion(worldQuaternion, 'ZYX');
  return {
    position: {
      x: roundValue(worldPosition.x),
      // Three.js is right-handed; Unreal is left-handed. Mirror Y for both
      // translation and rotation so the complete transform uses one frame.
      y: roundValue(-worldPosition.y),
      z: roundValue(worldPosition.z),
    },
    rotation: {
      // Reflecting Three's Y axis into Unreal's left-handed frame produces
      // Qunreal=(-Qthree.x, Qthree.y, -Qthree.z, Qthree.w). These signs create
      // the equivalent FRotator consumed by unrealQuaternion().
      pitch: normalizeRotationDegrees(-THREE.MathUtils.radToDeg(worldRotation.y)),
      // THREE is right-handed while Unreal uses a left-handed Z-up frame.
      // Mirroring the Y axis reverses pitch and yaw; roll keeps its sign.
      yaw: normalizeRotationDegrees(-THREE.MathUtils.radToDeg(worldRotation.z)),
      roll: normalizeRotationDegrees(THREE.MathUtils.radToDeg(worldRotation.x)),
    },
    scale: {
      x: roundValue(worldScale.x),
      y: roundValue(worldScale.y),
      z: roundValue(worldScale.z),
    },
  };
}

function serializeRuntimeTransform(mesh: THREE.Mesh) {
  const transform = serializeTransform(mesh);
  const assetId = mesh.userData.assetId as AssetId;
  const isWaterPipe = assetId === 'water_pipe'
    || assetId === 'water_pipe_etheral'
    || assetId === 'water_pipe_rave';
  const usesSafeDecorativeRotation = isWaterPipe || assetId === 'torch_wall';
  const wallNormal = mesh.userData.wallSnapNormal as
    | { x: number; y: number; z: number }
    | undefined;
  const hasWallNormal = Boolean(wallNormal && Math.abs(wallNormal.z) < 0.9);

  if (usesSafeDecorativeRotation) {
    // Export only an upright wall-facing yaw. Avoid passing editor pitch/roll
    // into orientation-sensitive Blueprint child components.
    const safeRotation = assetDefinitions[assetId].defaultRotation;
    // Three.js Y is mirrored when converted to Unreal coordinates.
    const wallYaw = hasWallNormal && wallNormal
      ? THREE.MathUtils.radToDeg(Math.atan2(-wallNormal.y, wallNormal.x))
      : 0;
    transform.rotation = {
      pitch: normalizeRotationDegrees(safeRotation?.pitch ?? 0),
      yaw: normalizeRotationDegrees((safeRotation?.yaw ?? 0) + wallYaw + (isWaterPipe ? 180 : 0)),
      roll: normalizeRotationDegrees(safeRotation?.roll ?? 0),
    };
  }

  if (isWaterPipe) {
    // Move the genuine pipe one metre away from the wall along the exact face
    // normal captured during placement. This is deliberately independent of
    // the editor dummy and the Blueprint actor's safe fixed rotation.
    if (hasWallNormal && wallNormal) {
      transform.position.x = roundValue(transform.position.x + wallNormal.x * 100);
      // serializeTransform mirrors Three.js Y into Unreal Y.
      transform.position.y = roundValue(transform.position.y - wallNormal.y * 100);
    }
  }
  if (assetId === 'torch_floor') {
    // Sink the genuine actor slightly so its tripod feet sit on the surface.
    transform.position.z = roundValue(transform.position.z - 15);
  }
  return transform;
}

function goalUniformScale(mesh: THREE.Mesh, preferredAxis: 'x' | 'y' | 'z' = 'x') {
  if (mesh.userData.assetId !== 'time_trial_goal') return;
  const worldScale = mesh.getWorldScale(new THREE.Vector3());
  const uniformScale = Math.max(0.001, Math.abs(worldScale[preferredAxis]));
  const parentScale = mesh.parent?.getWorldScale(new THREE.Vector3())
    ?? new THREE.Vector3(1, 1, 1);
  mesh.scale.set(
    uniformScale / Math.max(Math.abs(parentScale.x), 0.0001),
    uniformScale / Math.max(Math.abs(parentScale.y), 0.0001),
    uniformScale / Math.max(Math.abs(parentScale.z), 0.0001),
  );
}

function constrainAssetScale(
  mesh: THREE.Mesh,
  preferredAxis: 'x' | 'y' | 'z' = 'x',
  activeAxisOnly = false,
) {
  const definition = assetDefinitions[mesh.userData.assetId as AssetId];
  if (!definition) return;
  if (!activeAxisOnly && (mesh.userData.assetId === 'static_basekit_floor_01'
    || mesh.userData.assetId === 'static_basekit_floorcylinder_01'
    || mesh.userData.assetId === 'static_basekit_floorquartercylinder_01')) {
    const planarAxis = preferredAxis === 'y' ? 'y' : 'x';
    const planarScale = Math.max(0.001, Math.abs(Number.isFinite(mesh.scale[planarAxis]) ? mesh.scale[planarAxis] : 1));
    mesh.scale.x = planarScale;
    mesh.scale.y = planarScale;
  }
  for (const axis of ['x', 'y', 'z'] as const) {
    if (activeAxisOnly && axis !== preferredAxis) continue;
    if (definition.resizeAxes && !definition.resizeAxes.includes(axis)) {
      mesh.scale[axis] = 1;
      continue;
    }
    // Only generic static-mesh catalogue entries use transform scale directly
    // end-to-end. Blueprint construction scripts and gameplay collision are
    // not reliable below 1.0 and remain restricted even in Advanced mode.
    const fractionalSizingSupported = String(mesh.userData.assetId).startsWith('static_');
    const minimumScale = allowFractionalObjectSizing && fractionalSizingSupported ? 0.25 : 1;
    const requestedScale = Number.isFinite(mesh.scale[axis]) ? mesh.scale[axis] : minimumScale;
    mesh.scale[axis] = Math.max(minimumScale, requestedScale);
  }
}

function constrainMultiSelectionScale() {
  for (const axis of ['x', 'y', 'z'] as const) {
    let minimumGroupScale = 0.0001;
    for (const mesh of multiSelectedAssets) {
      const definition = assetDefinitions[mesh.userData.assetId as AssetId];
      if (definition?.resizeAxes && !definition.resizeAxes.includes(axis)) continue;
      const currentScale = Math.max(Math.abs(mesh.scale[axis]), 0.0001);
      const fractionalSizingSupported = String(mesh.userData.assetId).startsWith('static_');
      const minimumScale = allowFractionalObjectSizing && fractionalSizingSupported ? 0.25 : 1;
      minimumGroupScale = Math.max(minimumGroupScale, minimumScale / currentScale);
    }
    const requestedScale = Number.isFinite(multiSelectionGroup.scale[axis])
      ? multiSelectionGroup.scale[axis]
      : minimumGroupScale;
    multiSelectionGroup.scale[axis] = Math.max(minimumGroupScale, requestedScale);
  }
}

function updateTransformAxisVisibility() {
  const mode = transformControls.getMode();
  const definition = selectedAsset
    ? assetDefinitions[selectedAsset.userData.assetId as AssetId]
    : undefined;
  const axes = mode === 'scale' && multiSelectedAssets.length === 0
    ? definition?.resizeAxes
    : undefined;
  transformControls.showX = !axes || axes.includes('x');
  transformControls.showY = !axes || axes.includes('y');
  transformControls.showZ = !axes || axes.includes('z');
}

interface AssetSnapshot {
  assetId: AssetId;
  id: string;
  entityData: Record<string, string | number | boolean>;
  wallSnapNormal?: { x: number; y: number; z: number };
  transform: ReturnType<typeof serializeTransform>;
}

const HISTORY_LIMIT = 10;
const undoHistory: AssetSnapshot[][] = [];
const redoHistory: AssetSnapshot[][] = [];
let objectClipboard: AssetSnapshot[] = [];

function updateHistoryControls() {
  undoButton.disabled = undoHistory.length === 0;
  redoButton.disabled = redoHistory.length === 0;
}

function captureEditorState(): AssetSnapshot[] {
  return placedAssets.map((mesh) => ({
    assetId: mesh.userData.assetId as AssetId,
    id: mesh.userData.id,
    entityData: { ...(mesh.userData.entityData || {}) },
    wallSnapNormal: mesh.userData.wallSnapNormal
      ? { ...mesh.userData.wallSnapNormal }
      : undefined,
    transform: serializeTransform(mesh),
  }));
}

function createMeshFromSnapshot(snapshot: AssetSnapshot, freshId = false) {
  const mesh = makeAssetMesh(snapshot.assetId);
  mesh.userData.id = freshId ? crypto.randomUUID() : snapshot.id;
  mesh.userData.entityData = {
    ...defaultGameplayProperties(snapshot.assetId),
    ...snapshot.entityData,
  };
  mesh.userData.wallSnapNormal = snapshot.wallSnapNormal
    ? { ...snapshot.wallSnapNormal }
    : undefined;
  const { position, rotation, scale } = snapshot.transform;
  // Inverse of serializeTransform's Three.js -> Unreal Y reflection.
  mesh.position.set(position.x, -position.y, position.z);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation.roll),
    THREE.MathUtils.degToRad(-rotation.pitch),
    THREE.MathUtils.degToRad(-rotation.yaw),
    'ZYX',
  );
  mesh.scale.set(scale.x, scale.y, scale.z);
  goalUniformScale(mesh);
  constrainAssetScale(mesh);
  updateWoodenPlatformSupports(mesh);
  return mesh;
}

function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((child) => {
    if (child.userData.sharedEditorResource) return;
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line)) return;
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function disposePlacedMesh(mesh: THREE.Mesh) {
  // Selected meshes are temporarily parented to a transform pivot (or the
  // multi-selection group), so scene.remove(mesh) is a no-op for them. Remove
  // from the actual parent to prevent a disposed, unselectable visual ghost
  // being reattached when selection state is cleared.
  mesh.removeFromParent();
  disposeObjectResources(mesh);
}

function restoreEditorState(snapshot: AssetSnapshot[]) {
  selectPlacedAsset(null);
  clearMultiSelection();
  placedAssets.splice(0).forEach(disposePlacedMesh);
  snapshot.forEach((item) => {
    const mesh = createMeshFromSnapshot(item);
    placedAssets.push(mesh);
    scene.add(mesh);
  });
  updateAllWoodenPlatformSupports();
  updateUniqueAssetAvailability();
}

interface EditorProjectFile {
  projectFormat: 'jle-editor-project-v1';
  savedAt: string;
  levelId: string;
  displayName: string;
  environment: string;
  timeOfDay: string;
  /** Optional for projects saved before selectable subway roofs. */
  subwayLayout?: 'roof' | 'two-layer';
  /** Optional for projects written before world polarity was exposed. */
  worldStartingPolarity?: number;
  assets: AssetSnapshot[];
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  verification?: VerificationRecord;
}

interface VerificationRecord {
  authorTime: number;
  platinumTime: number;
  goldTime: number;
  silverTime: number;
  contentFingerprint: string;
  verifiedAt: string;
}

let verification: VerificationRecord | undefined;
let verificationSessionFingerprint = '';
let autosaveTimer: number | null = null;
let autosaveSuppressed = false;
let saveInFlight = false;
let saveQueued = false;
let lastSavedPath = '';

function captureProjectFile(): EditorProjectFile {
  return {
    projectFormat: 'jle-editor-project-v1',
    savedAt: new Date().toISOString(),
    levelId: currentLevelId,
    displayName: levelNameInput.value.trim() || 'Unnamed Level',
    environment: environmentSelect.value,
    timeOfDay: timeOfDaySelect.value,
    subwayLayout: subwayLayoutSelect.value === 'two-layer' ? 'two-layer' : 'roof',
    worldStartingPolarity: currentWorldStartingPolarity(),
    assets: captureEditorState(),
    camera: {
      position: {
        x: roundValue(camera.position.x),
        y: roundValue(camera.position.y),
        z: roundValue(camera.position.z),
      },
      target: {
        x: roundValue(controls.target.x),
        y: roundValue(controls.target.y),
        z: roundValue(controls.target.z),
      },
    },
    verification,
  };
}

function verificationFingerprint() {
  const state = JSON.stringify({
    environment: environmentSelect.value,
    timeOfDay: timeOfDaySelect.value,
    subwayLayout: subwayLayoutSelect.value,
    worldStartingPolarity: currentWorldStartingPolarity(),
    assets: captureEditorState(),
  });
  let hash = 2166136261;
  for (let index = 0; index < state.length; index += 1) {
    hash ^= state.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function currentWorldStartingPolarity() {
  const definition = worldPropertyDefinitions.worldStartingPolarity;
  return Number(validateGameplayProperty(definition, worldStartingPolarityCheckbox.checked ? 1 : 0));
}

function currentVerification() {
  return verification?.contentFingerprint === verificationFingerprint() ? verification : undefined;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}

function medalRoundingStep(authorTime: number) {
  if (authorTime < 30) return 0.1;
  if (authorTime < 60) return 0.2;
  if (authorTime < 120) return 0.5;
  return 1;
}

function roundedMedalTime(value: number, step: number) {
  return Math.round(value / step) * step;
}

function createVerificationRecord(authorTime: number, fingerprint: string): VerificationRecord {
  const step = medalRoundingStep(authorTime);
  return {
    authorTime,
    platinumTime: roundedMedalTime(authorTime * 1.5, step),
    goldTime: roundedMedalTime(authorTime * 2, step),
    silverTime: roundedMedalTime(authorTime * 2.5, step),
    contentFingerprint: fingerprint,
    verifiedAt: new Date().toISOString(),
  };
}

function medalOrderError(record: Pick<VerificationRecord, 'authorTime' | 'platinumTime' | 'goldTime' | 'silverTime'>) {
  if (record.platinumTime < record.authorTime) return 'Diamond time cannot be faster than the Author time.';
  if (record.goldTime < record.platinumTime) return 'Gold time cannot be faster than the Diamond time.';
  if (record.silverTime < record.goldTime) return 'Silver time cannot be faster than the Gold time.';
  return null;
}

function updateVerificationDisplay() {
  const record = currentVerification();
  exportButton.disabled = !record;
  exportButton.hidden = !record;
  if (!record) {
    verificationStatus.textContent = verification
      ? 'Level changed — verify this version again before sharing.'
      : 'Unverified — beat this version before sharing.';
    verificationMedals.hidden = true;
    verificationMedals.textContent = '';
    medalTargets.hidden = true;
    medalTargets.replaceChildren();
    return;
  }
  verificationStatus.textContent = 'Verified and ready to share.';
  verificationMedals.hidden = false;
  verificationMedals.innerHTML = `
    <span>Author <b>${formatTime(record.authorTime)}</b></span>
    <span>Diamond <b>${formatTime(record.platinumTime)}</b></span>
    <span>Gold <b>${formatTime(record.goldTime)}</b></span>
    <span>Silver <b>${formatTime(record.silverTime)}</b></span>
  `;
  medalTargets.hidden = false;
  medalTargets.replaceChildren();
  Object.values(medalPropertyDefinitions).forEach((definition) => {
    const medalKey = definition.key as 'platinumTime' | 'goldTime' | 'silverTime';
    const row = document.createElement('label');
    row.className = 'entity-field';
    const label = document.createElement('span');
    label.textContent = definition.label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(definition.step ?? 0.1);
    input.min = String(definition.min ?? 0);
    input.value = String(record[medalKey]);
    const commit = () => {
      const value = validateGameplayProperty(definition, Number(input.value));
      const candidate = { ...record, [medalKey]: Number(value) };
      const orderError = medalOrderError(candidate);
      if (orderError) {
        input.value = String(record[medalKey]);
        showEditorNotice(orderError, 'error');
        return;
      }
      verification = candidate;
      updateVerificationDisplay();
      scheduleAutosave();
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
    });
    row.append(label, input);
    medalTargets.append(row);
  });
}

async function saveEditorProject(showConfirmation = false) {
  if (autosaveSuppressed || !window.jetrunnerEditor) return;
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  saveInFlight = true;
  try {
    const result = await window.jetrunnerEditor.saveProject(captureProjectFile());
    if (result.error) throw new Error(result.error);
    if (result.filePath) lastSavedPath = result.filePath;
    if (result.filePath) rememberRecent(levelNameInput.value.trim() || 'Unnamed Level', result.filePath);
    if (showConfirmation) {
      showEditorNotice(`Level saved: ${result.filePath}`, 'success');
    }
  } catch (error) {
    showEditorNotice(
      `Could not save level: ${error instanceof Error ? error.message : String(error)}`,
      'error',
    );
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      void saveEditorProject(false);
    }
  }
}

function scheduleAutosave() {
  if (autosaveSuppressed || !window.jetrunnerEditor) return;
  updateVerificationDisplay();
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = null;
    void saveEditorProject(false);
  }, 350);
}

function parseProjectFile(value: unknown): EditorProjectFile {
  editorLog('load', '[LOAD] Validating project schema');
  if (!value || typeof value !== 'object') throw new Error('[LOAD:SCHEMA] The save file is empty.');
  const project = value as Partial<EditorProjectFile>;
  if (project.projectFormat !== 'jle-editor-project-v1') {
    throw new Error(`[LOAD:SCHEMA] Unsupported saved-level format: ${String(project.projectFormat || 'missing')}.`);
  }
  if ((typeof project.levelId !== 'string' && typeof project.levelId !== 'number') || !Array.isArray(project.assets)) {
    throw new Error('[LOAD:SCHEMA] The saved level is missing its identity or assets array.');
  }

  const aliasCandidates = new Map<string, AssetId | null>();
  const addAlias = (alias: string | undefined, assetId: AssetId) => {
    if (!alias) return;
    const key = alias.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key) return;
    const previous = aliasCandidates.get(key);
    aliasCandidates.set(key, previous && previous !== assetId ? null : assetId);
  };
  Object.entries(assetDefinitions).forEach(([assetId, definition]) => {
    addAlias(assetId, assetId);
    addAlias(definition.label, assetId);
    addAlias(definition.runtimeObjectName, assetId);
  });

  const assets = project.assets.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new Error(`[LOAD:OBJECT] Object ${index} is not a valid object record.`);
    }
    const item = rawItem as AssetSnapshot;
    if (typeof item.assetId !== 'string' || !item.assetId.trim()) {
      throw new Error(`[LOAD:OBJECT] Object ${index} has no AssetId.`);
    }
    let assetId = item.assetId;
    if (!(assetId in assetDefinitions)) {
      const aliasKey = assetId.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const resolvedAlias = aliasCandidates.get(aliasKey);
      if (resolvedAlias) {
        editorLog('load', `[LOAD] Object ${index}: legacy AssetId '${assetId}' -> '${resolvedAlias}'`);
        assetId = resolvedAlias;
      } else {
        // Removed catalogue entries remain loadable and visible, but cannot
        // be newly placed or exported until a real runtime mapping exists.
        assetDefinitions[assetId] = {
          label: `${assetId.replace(/[_-]+/g, ' ')} (Legacy)`,
          color: 0x8b6aa8,
          emissive: 0x160b24,
          baseHeight: 0,
          geometry: () => topOriginBoxGeometry(100, 100, 100),
          baseDimensions: [100, 100, 100],
          catalog: 'props',
          propGroup: 'misc',
          hiddenInPalette: true,
          runtimeMappingStatus: 'unresolved',
          verificationMappingStatus: 'unsupported',
          description: `Legacy saved object '${assetId}'. Its original data is preserved, but it cannot be exported without a verified runtime mapping.`,
        };
        editorLog('load', `[LOAD] Object ${index}: preserving unsupported legacy AssetId '${assetId}' with fallback visual`);
      }
    }
    if (!item.transform || !item.transform.position || !item.transform.rotation || !item.transform.scale) {
      throw new Error(`[LOAD:TRANSFORM] Object ${index} '${assetDefinitions[assetId].label}' (${assetId}) has an incomplete transform.`);
    }
    const transformValues = [
      ...Object.values(item.transform.position),
      ...Object.values(item.transform.rotation),
      ...Object.values(item.transform.scale),
    ];
    if (transformValues.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
      throw new Error(`[LOAD:TRANSFORM] Object ${index} '${assetDefinitions[assetId].label}' (${assetId}) contains a non-finite transform value.`);
    }
    editorLog('load', `[LOAD] Resolving object ${index}: ${assetDefinitions[assetId].label} (${assetId})`);
    return {
      ...item,
      assetId,
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      entityData: item.entityData && typeof item.entityData === 'object' ? item.entityData : {},
    };
  });

  return {
    ...(project as EditorProjectFile),
    levelId: String(project.levelId),
    displayName: typeof project.displayName === 'string' && project.displayName.trim()
      ? project.displayName
      : 'Unnamed Level',
    environment: typeof project.environment === 'string' ? project.environment : 'Environment_CentralPark',
    timeOfDay: typeof project.timeOfDay === 'string' ? project.timeOfDay : 'Scenario_YankeyDoodleMorning',
    subwayLayout: project.subwayLayout === 'two-layer' ? 'two-layer' : 'roof',
    assets,
  };
}

type ProjectLoadResult = { canceled: boolean; filePath?: string; projectData?: unknown; missing?: boolean; error?: string; installAfterOpen?: boolean };
async function loadEditorProject(preloadedResult?: ProjectLoadResult) {
  if (!window.jetrunnerEditor) {
    showEditorNotice('Loading is available in the desktop app.', 'error');
    return false;
  }
  editorLog('load', `[LOAD] Opening: ${preloadedResult?.filePath || '<file picker>'}`);
  const result = preloadedResult ?? await window.jetrunnerEditor.loadProject();
  if (result.canceled) return false;
  if (result.error) {
    showEditorNotice(`Could not load level: ${result.error}`, 'error');
    return false;
  }
  try {
    editorLog('load', `[LOAD] File read: ${result.filePath || '<unknown path>'}`);
    editorLog('load', '[LOAD] JSON parsed');
    const project = parseProjectFile(result.projectData);
    editorLog('load', `[LOAD] Schema version: ${project.projectFormat}`);
    editorLog('load', `[LOAD] Level ID: ${project.levelId}`);
    editorLog('load', `[LOAD] Objects: ${project.assets.length}`);
    autosaveSuppressed = true;
    if (autosaveTimer !== null) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    currentLevelId = project.levelId;
    verification = project.verification;
    sessionStorage.setItem('jle-current-level-id', currentLevelId);
    levelNameInput.value = project.displayName || 'Unnamed Level';
    localStorage.setItem('jle-level-name', levelNameInput.value);
    if ([...environmentSelect.options].some((option) => option.value === project.environment)) {
      environmentSelect.value = project.environment;
      localStorage.setItem('jle-environment', project.environment);
    }
    if ([...timeOfDaySelect.options].some((option) => option.value === project.timeOfDay)) {
      timeOfDaySelect.value = project.timeOfDay;
      localStorage.setItem('jle-time-of-day', project.timeOfDay);
    }
    subwayLayoutSelect.value = project.subwayLayout === 'two-layer' ? 'two-layer' : 'roof';
    localStorage.setItem('jle-subway-layout', subwayLayoutSelect.value);
    worldStartingPolarityCheckbox.checked = Number(validateGameplayProperty(
      worldPropertyDefinitions.worldStartingPolarity,
      project.worldStartingPolarity ?? 1,
    )) === 1;
    localStorage.setItem('jle-world-starting-polarity', String(currentWorldStartingPolarity()));
    applyEditorEnvironmentPreview();
    restoreEditorState(project.assets);
    editorLog('load', '[LOAD] Scene created');
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryControls();
    if (project.camera) {
      const savedCameraPosition = new THREE.Vector3(
        project.camera.position.x,
        project.camera.position.y,
        project.camera.position.z,
      );
      const savedCameraTarget = new THREE.Vector3(
        project.camera.target.x,
        project.camera.target.y,
        project.camera.target.z,
      );
      const savedDistance = savedCameraPosition.distanceTo(savedCameraTarget);
      const targetIsOutsideAuthoringArea = savedCameraTarget.length() > controls.maxDistance;
      const distanceIsInvalid = !Number.isFinite(savedDistance) || savedDistance > controls.maxDistance;
      if (targetIsOutsideAuthoringArea || distanceIsInvalid) {
        editorLog('camera', {
          event: 'invalid-saved-camera-reset',
          position: vectorLogValue(savedCameraPosition),
          target: vectorLogValue(savedCameraTarget),
          distance: Number(savedDistance.toFixed(2)),
          maxDistance: controls.maxDistance,
        });
        resetCamera();
      } else {
      camera.position.set(
        project.camera.position.x,
        project.camera.position.y,
        project.camera.position.z,
      );
      controls.target.set(
        project.camera.target.x,
        project.camera.target.y,
        project.camera.target.z,
      );
      controls.update();
      }
    }
    focusCameraOnPlayerStart();
    lastSavedPath = result.filePath || '';
    if (result.filePath) rememberRecent(project.displayName, result.filePath);
    updateVerificationDisplay();
    editorLog('load', `[LOAD] Complete: ${project.displayName}`);
    showEditorNotice(`Loaded ${project.displayName}.`, 'success');
    return true;
  } catch (error) {
    editorLog('load-error', {
      filePath: result.filePath || null,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    showEditorNotice(
      `Could not load level: ${error instanceof Error ? error.message : String(error)}`,
      'error',
    );
    return false;
  } finally {
    autosaveSuppressed = false;
  }
}

window.jetrunnerEditor?.onExternalProject((result) => {
  void (async () => {
    if (!(await loadEditorProject(result)) || !result.installAfterOpen) return;
    const { errors, data } = buildLevelData();
    if (errors.length || !data) {
      showEditorNotice(`The opened .JLE could not be installed: ${errors.join(' ')}`, 'error');
      return;
    }
    showEditorNotice('Building and installing the opened .JLE level...', 'working');
    const install = await window.jetrunnerEditor?.exportAndCompile(data);
    if (install?.pipelineError) showEditorNotice(install.pipelineError, 'error');
    else if (!install?.canceled) showEditorNotice('The .JLE level was installed successfully.', 'success');
  })();
});

function recordHistory() {
  undoHistory.push(captureEditorState());
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift();
  redoHistory.length = 0;
  updateHistoryControls();
}

function undoEditorChange() {
  const previous = undoHistory.pop();
  if (!previous) return;
  redoHistory.push(captureEditorState());
  if (redoHistory.length > HISTORY_LIMIT) redoHistory.shift();
  restoreEditorState(previous);
  updateHistoryControls();
  scheduleAutosave();
}

function redoEditorChange() {
  const next = redoHistory.pop();
  if (!next) return;
  undoHistory.push(captureEditorState());
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift();
  restoreEditorState(next);
  updateHistoryControls();
  scheduleAutosave();
}

undoButton.addEventListener('click', undoEditorChange);
redoButton.addEventListener('click', redoEditorChange);

function selectedMeshes() {
  return multiSelectedAssets.length > 0 ? [...multiSelectedAssets] : selectedAsset ? [selectedAsset] : [];
}

function copySelection() {
  objectClipboard = selectedMeshes().map((mesh) => ({
    assetId: mesh.userData.assetId as AssetId,
    id: '',
    entityData: { ...(mesh.userData.entityData || {}) },
    wallSnapNormal: mesh.userData.wallSnapNormal
      ? { ...mesh.userData.wallSnapNormal }
      : undefined,
    transform: serializeTransform(mesh),
  }));
}

function pasteSelection() {
  if (objectClipboard.length === 0) return;
  const pasteable = objectClipboard.filter((item) => {
    if (item.assetId !== 'player_start') return true;
    return !placedAssets.some((mesh) => mesh.userData.assetId === 'player_start');
  });
  if (pasteable.length === 0) return;
  recordHistory();
  const pasted = pasteable.map((item) => {
    const clone: AssetSnapshot = {
      ...item,
      transform: {
        ...item.transform,
        position: {
          x: item.transform.position.x + (pasteInPlace ? 0 : 100),
          y: item.transform.position.y + (pasteInPlace ? 0 : 100),
          z: item.transform.position.z,
        },
      },
    };
    const mesh = createMeshFromSnapshot(clone, true);
    placedAssets.push(mesh);
    scene.add(mesh);
    return mesh;
  });
  updateAllWoodenPlatformSupports();
  updateUniqueAssetAvailability();
  selectAssetGroup(pasted);
  scheduleAutosave();
}

function buildLevelData(options: { verification?: boolean } = {}) {
  const playerStarts = placedAssets.filter((mesh) => mesh.userData.assetId === 'player_start');
  const goals = placedAssets.filter((mesh) => mesh.userData.assetId === 'time_trial_goal');
  const errors: string[] = [];
  if (playerStarts.length !== 1) errors.push('Place exactly one Player Start.');
  if (goals.length < 1) errors.push('Place at least one Finish Goal.');
  if (errors.length > 0) return { errors, data: null };

  const authoredDisplayName = levelNameInput.value.trim() || 'Unnamed Level';
  const canonicalAuthoredName = authoredDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!options.verification && canonicalAuthoredName === 'verification') {
    return {
      errors: ['“Verification” is reserved for the internal verification level. Choose another level name.'],
      data: null,
    };
  }
  const displayName = options.verification ? 'Verification' : authoredDisplayName;
  const levelId = options.verification ? 'JLE_VERIFICATION_LEVEL' : currentLevelId;
  // Package identity is derived from the stable levelId by the compiler.
  // Keep levelName as the exact authored title for older consumers instead
  // of destructively replacing spaces and punctuation here.
  const levelName = displayName;
  const playerStart = playerStarts[0];
  const playerTransform = serializeTransform(playerStart);
  const goalTransforms = goals.map((goal) => {
    const transform = serializeTransform(goal);
    const uniformScale = transform.scale.x;
    transform.scale = { x: uniformScale, y: uniformScale, z: uniformScale };
    return transform;
  });

  const objectMeshes = placedAssets.filter((mesh) => (
    mesh.userData.assetId !== 'player_start'
    && mesh.userData.assetId !== 'time_trial_goal'
  ));
  const unresolvedRuntimeAssets = [...new Set(objectMeshes
    .filter((mesh) => assetDefinitions[mesh.userData.assetId as AssetId]?.runtimeMappingStatus !== 'resolved')
    .map((mesh) => assetDefinitions[mesh.userData.assetId as AssetId]?.label || mesh.userData.assetId))];
  if (unresolvedRuntimeAssets.length > 0) {
    errors.push(`These assets do not have verified runtime mappings: ${unresolvedRuntimeAssets.join(', ')}.`);
  }
  const verificationUnsupportedAssets = [...new Set(objectMeshes
    .filter((mesh) => assetDefinitions[mesh.userData.assetId as AssetId]?.verificationMappingStatus === 'unsupported')
    .map((mesh) => {
      const assetId = mesh.userData.assetId as AssetId;
      return `${assetDefinitions[assetId]?.label || assetId} (${assetId})`;
    }))];
  if (verificationUnsupportedAssets.length > 0) {
    errors.push(`These assets are not supported by the verification dummy and cannot be exported: ${verificationUnsupportedAssets.join(', ')}.`);
  }
  const medalRecord = options.verification ? null : currentVerification();
  const medalError = medalRecord ? medalOrderError(medalRecord) : null;
  if (medalError) errors.push(medalError);
  if (errors.length > 0) return { errors, data: null };

  return {
    errors: [],
    data: {
      frameworkVersion: 'jle-uasset-v1',
      levelId,
      levelName,
      displayName,
      worldSettings: {
        defaultRuleset: '/Flashback/Rulesets/TimeTrial/Ruleset_TimeTrial.Ruleset_TimeTrial',
        levelDefinition: '/Game/Mods/CustomLevels/LevelDef_MyFirstLevel.LevelDef_MyFirstLevel',
        // A project's UUID remains stable for editing/sharing, while each
        // materially different verified revision receives its own leaderboard.
        // Display-name-only renames are excluded from the content fingerprint.
        leaderboardId: options.verification
          ? levelId
          : `${levelId}_${verificationFingerprint()}`,
        isMenuWorld: false,
        energyAtStart: 0.0,
        worldStartingPolarity: currentWorldStartingPolarity(),
        isFlashbackWorld: false,
        environment: environmentSelect.value,
        subwayLayout: environmentSelect.value === 'Environment_NewYorkSubway'
          ? subwayLayoutSelect.value
          : undefined,
        skybox: timeOfDaySelect.value,
        timeOfDay: timeOfDaySelect.value,
      },
      playerStart: {
        position: playerTransform.position,
        rotation: playerTransform.rotation,
        teamId: 0,
        gameModeGameplayTag: 'TimeTrial',
        teamGameplayTag: '',
      },
      timeTrialGoal: {
        assetPath: '/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere',
        ...goalTransforms[0],
      },
      timeTrialGoals: goalTransforms.map((transform) => ({
        assetPath: '/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere',
        ...transform,
      })),
      objects: objectMeshes.map((mesh, index) => ({
        id: mesh.userData.id || `obj_${String(index + 1).padStart(3, '0')}`,
        placeholderAssetId: DUMMY_PLACEHOLDER_ID,
        assetId: mesh.userData.assetId,
        assetLabel: assetDefinitions[mesh.userData.assetId as AssetId].label,
        runtimeObjectName: assetDefinitions[mesh.userData.assetId as AssetId].runtimeObjectName,
        entityData: mesh.userData.entityData || {},
        ...serializeRuntimeTransform(mesh),
      })),
      // JETRUNNER medal fields are FloatProperty values measured in seconds.
      // 0.001 is the smallest positive development target we can represent
      // without changing normal authored medal configuration.
      medalTimes: options.verification ? {
        authorTime: 0.001,
        platinumTime: 0.001,
        goldTime: 0.001,
        silverTime: 0.001,
      } : currentVerification(),
    },
  };
}

let editorNoticeTimer: number | null = null;
function showEditorNotice(message: string, kind: 'working' | 'success' | 'error') {
  if (editorNoticeTimer !== null) window.clearTimeout(editorNoticeTimer);
  editorNotice.textContent = message;
  editorNotice.className = `editor-notice visible ${kind}`;
  if (kind !== 'working') {
    editorNoticeTimer = window.setTimeout(() => {
      editorNotice.className = 'editor-notice';
      editorNoticeTimer = null;
    }, 4200);
  }
}

function showPipelineConsole() {
  pipelineConsole.classList.add('visible');
}

function appendPipelineConsole(message: string) {
  if (pipelineConsoleOutput.textContent === 'Ready. Pipeline output will appear here.') {
    pipelineConsoleOutput.textContent = '';
  }
  pipelineConsoleOutput.textContent += `${message}\n`;
  pipelineConsoleOutput.scrollTop = pipelineConsoleOutput.scrollHeight;
}

document.querySelector('#close-console')!.addEventListener('click', () => {
  pipelineConsole.classList.remove('visible');
});
document.querySelector('#clear-console')!.addEventListener('click', () => {
  pipelineConsoleOutput.textContent = '';
});
const editorOptions = document.querySelector<HTMLElement>('#editor-options')!;
const showInteractionRangesCheckbox = document.querySelector<HTMLInputElement>('#show-interaction-ranges')!;
showInteractionRangesCheckbox.checked = showInteractionRanges;
showInteractionRangesCheckbox.addEventListener('change', () => {
  showInteractionRanges = showInteractionRangesCheckbox.checked;
  const settings = readProjectSettings();
  writeProjectSettings({ ...settings, showInteractionRanges });
  scene.traverse((child) => {
    if (child.name === 'JLE_InteractionRange') child.visible = showInteractionRanges;
  });
});
const pushToEditCheckbox = document.querySelector<HTMLInputElement>('#push-to-edit')!;
pushToEditCheckbox.checked = pushToEdit;
pushToEditCheckbox.addEventListener('change', () => {
  pushToEdit = pushToEditCheckbox.checked;
  const settings = readProjectSettings();
  writeProjectSettings({ ...settings, pushToEdit });
  if (pushToEdit) setTransformMode('translate');
});
const pasteInPlaceCheckbox = document.querySelector<HTMLInputElement>('#paste-in-place')!;
pasteInPlaceCheckbox.checked = pasteInPlace;
pasteInPlaceCheckbox.addEventListener('change', () => {
  pasteInPlace = pasteInPlaceCheckbox.checked;
  const settings = readProjectSettings();
  writeProjectSettings({ ...settings, pasteInPlace });
});
const moveOnRotatedAxesCheckbox = document.querySelector<HTMLInputElement>('#move-on-rotated-axes')!;
moveOnRotatedAxesCheckbox.checked = moveOnRotatedAxes;
moveOnRotatedAxesCheckbox.addEventListener('change', () => {
  moveOnRotatedAxes = moveOnRotatedAxesCheckbox.checked;
  const settings = readProjectSettings();
  writeProjectSettings({ ...settings, moveOnRotatedAxes });
  updateTransformSpace();
});
const allowFractionalObjectSizingCheckbox = document.querySelector<HTMLInputElement>('#allow-fractional-object-sizing')!;
allowFractionalObjectSizingCheckbox.checked = allowFractionalObjectSizing;
allowFractionalObjectSizingCheckbox.addEventListener('change', () => {
  allowFractionalObjectSizing = allowFractionalObjectSizingCheckbox.checked;
  const settings = readProjectSettings();
  writeProjectSettings({ ...settings, allowFractionalObjectSizing });
  if (!allowFractionalObjectSizing) placedAssets.forEach((mesh) => constrainAssetScale(mesh));
  scheduleAutosave();
});
function openEditorOptions() { editorOptions.hidden = false; }
function closeEditorOptions() { editorOptions.hidden = true; }
document.querySelector<HTMLButtonElement>('#editor-option-save')!.addEventListener('click', () => {
  void saveEditorProject(true);
});
document.querySelector<HTMLButtonElement>('#editor-option-load')!.addEventListener('click', async () => {
  if (await loadEditorProject()) closeEditorOptions();
});
document.querySelector<HTMLButtonElement>('#editor-option-advanced')!.addEventListener('click', showAdvancedOptions);
document.querySelector<HTMLButtonElement>('#editor-option-keybinds')!.addEventListener('click', () => showOptions(false));
document.querySelector<HTMLButtonElement>('#editor-option-home')!.addEventListener('click', () => { closeEditorOptions(); showHome(); });

verifyButton.addEventListener('click', async () => {
  const { errors, data } = buildLevelData({ verification: true });
  if (!data) {
    showEditorNotice(errors.join(' '), 'error');
    return;
  }
  if (!window.jetrunnerEditor) {
    showEditorNotice('Verification is available in the desktop app.', 'error');
    return;
  }
  verifyButton.disabled = true;
  pipelineConsoleOutput.textContent = '';
  showPipelineConsole();
  showEditorNotice('Building the verification copy...', 'working');
  const removeStatusListener = window.jetrunnerEditor.onPipelineStatus((status) => {
    if (status.stage === 'console') appendPipelineConsole(status.message);
    else showEditorNotice(status.message, status.stage === 'error' ? 'error' : 'working');
  });
  try {
    const result = await window.jetrunnerEditor.beginVerification(data);
    if (result.pipelineError) throw new Error(result.pipelineError);
    if (result.canceled) return;
    verificationSessionFingerprint = verificationFingerprint();
    checkVerificationButton.disabled = false;
    showEditorNotice('Verification is running. Keep playing, then finish verification.', 'success');
  } catch (error) {
    showEditorNotice(`Verification failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    removeStatusListener();
    verifyButton.disabled = false;
  }
});

async function finishVerification() {
  if (!window.jetrunnerEditor || checkVerificationButton.disabled) return Boolean(currentVerification());
  checkVerificationButton.disabled = true;
  showEditorNotice('Closing JETRUNNER and reading your best verification time...', 'working');
  const result = await window.jetrunnerEditor.readVerification();
  if (result.error) {
    showEditorNotice(`Could not read verification: ${result.error}`, 'error');
    checkVerificationButton.disabled = false;
    return false;
  }
  if (!result.found || !result.time) {
    await window.jetrunnerEditor.cleanupVerification();
    updateVerificationDisplay();
    showEditorNotice('No completed verification run was found. Start verification again and finish the level.', 'error');
    return false;
  }
  if (verificationSessionFingerprint !== verificationFingerprint()) {
    await window.jetrunnerEditor.cleanupVerification();
    updateVerificationDisplay();
    showEditorNotice('The level changed during verification. Start a new verification run.', 'error');
    return false;
  }
  verification = createVerificationRecord(result.time, verificationSessionFingerprint);
  updateVerificationDisplay();
  scheduleAutosave();
  const cleanup = await window.jetrunnerEditor.cleanupVerification();
  if (cleanup.error) {
    showEditorNotice(
      `Verified! Author time: ${formatTime(result.time)}. The temporary verification pak could not be removed: ${cleanup.error}`,
      'error',
    );
    return true;
  }
  showEditorNotice(`Verified! Author time: ${formatTime(result.time)}. Temporary verification pak removed.`, 'success');
  return true;
}

checkVerificationButton.addEventListener('click', async () => {
  await finishVerification();
});

document.querySelector<HTMLButtonElement>('#export-level')!.addEventListener('click', async () => {
  if (!currentVerification() && !checkVerificationButton.disabled) {
    const finished = await finishVerification();
    if (!finished) return;
  }
  if (!currentVerification()) {
    updateVerificationDisplay();
    showEditorNotice('This version must be beaten with Verify before it can be exported for sharing.', 'error');
    return;
  }
  const { errors, data } = buildLevelData();
  if (!data) {
    showEditorNotice(errors.join(' '), 'error');
    return;
  }
  if (!window.jetrunnerEditor) {
    showEditorNotice('Export is available in the desktop app.', 'error');
    return;
  }

  exportButton.disabled = true;
  pipelineConsoleOutput.textContent = '';
  showPipelineConsole();
  showEditorNotice('Exporting level JSON...', 'working');
  const removeStatusListener = window.jetrunnerEditor.onPipelineStatus((status) => {
    if (status.stage === 'console') {
      appendPipelineConsole(status.message);
      return;
    }
    showEditorNotice(status.message, status.stage === 'error' ? 'error' : 'working');
  });
  try {
    const result = await window.jetrunnerEditor.exportAndCompile(data);
    if (result.canceled) {
      editorNotice.className = 'editor-notice';
    } else if (result.pipelineError) {
      appendPipelineConsole(`[failure] ${result.pipelineError}`);
      if (result.logPath) appendPipelineConsole(`[log] ${result.logPath}`);
      showPipelineConsole();
      showEditorNotice('Pipeline failed — see the pipeline console for details.', 'error');
    } else {
      showEditorNotice(`Level packaged and installed successfully: ${result.installedPak}`, 'success');
    }
  } catch (error) {
    appendPipelineConsole(`[unexpected error] ${error instanceof Error ? error.stack || error.message : String(error)}`);
    showPipelineConsole();
    showEditorNotice('Export failed — see the pipeline console for details.', 'error');
  } finally {
    removeStatusListener();
    updateVerificationDisplay();
  }
});

updateVerificationDisplay();

function updateReadout(mesh: THREE.Mesh | null) {
  if (!mesh) {
    readout.textContent = 'X —  Y —  Z —';
    return;
  }
  const { x, y, z } = mesh.getWorldPosition(new THREE.Vector3());
  readout.textContent = `X ${(x / 100).toFixed(0)} m  Y ${(y / 100).toFixed(0)} m  Z ${(z / 100).toFixed(1)} m`;
}

function selectPlacedAsset(mesh: THREE.Mesh | null) {
  clearMultiSelection();
  if (selectedAsset?.parent === singleSelectionPivot) scene.attach(selectedAsset);
  selectedAsset = mesh;
  selectionHelper.visible = false;
  selectionHighlights.forEach((helper) => { helper.visible = false; });
  syncSelectionHighlights(mesh ? [mesh] : []);
  if (mesh) {
    selectionHelper.setFromObject(mesh);
    const center = canonicalWorldBounds(mesh).getCenter(new THREE.Vector3());
    singleSelectionPivot.position.copy(center);
    singleSelectionPivot.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
    singleSelectionPivot.scale.set(1, 1, 1);
    singleSelectionPivot.updateMatrixWorld(true);
    singleSelectionPivot.attach(mesh);
    transformControls.attach(singleSelectionPivot);
  } else {
    transformControls.detach();
  }
  updateTransformAxisVisibility();
  updateReadout(mesh);
  if (mesh && entityInspector.classList.contains('visible')) {
    contextAsset = mesh;
    entityTitle.textContent = `${mesh.userData.assetLabel} data`;
    renderEntityFields(mesh);
  } else if (!mesh && entityInspector.classList.contains('visible')) {
    contextAsset = null;
    entityTitle.textContent = 'Entity data';
    entityFields.replaceChildren();
  }
}

function clearMultiSelection() {
  if (multiSelectedAssets.length === 0) return;
  transformControls.detach();
  for (const mesh of multiSelectedAssets) scene.attach(mesh);
  multiSelectedAssets = [];
  multiSelectionGroup.position.set(0, 0, 0);
  multiSelectionGroup.rotation.set(0, 0, 0);
  multiSelectionGroup.scale.set(1, 1, 1);
}

function selectAssetGroup(meshes: THREE.Mesh[]) {
  clearMultiSelection();
  if (selectedAsset?.parent === singleSelectionPivot) scene.attach(selectedAsset);
  selectedAsset = null;
  if (meshes.length === 0) {
    syncSelectionHighlights([]);
    selectionHelper.visible = false;
    transformControls.detach();
    if (entityInspector.classList.contains('visible')) {
      contextAsset = null;
      entityTitle.textContent = 'Entity data';
      entityFields.replaceChildren();
    }
    return;
  }
  if (meshes.length === 1) {
    selectPlacedAsset(meshes[0]);
    return;
  }
  const center = new THREE.Box3().setFromObject(meshes[0]);
  meshes.slice(1).forEach((mesh) => center.expandByObject(mesh));
  multiSelectionGroup.position.copy(center.getCenter(new THREE.Vector3()));
  multiSelectedAssets = meshes;
  syncSelectionHighlights(meshes);
  meshes.forEach((mesh) => multiSelectionGroup.attach(mesh));
  selectionHelper.setFromObject(multiSelectionGroup);
  selectionHelper.visible = false;
  transformControls.attach(multiSelectionGroup);
  updateTransformAxisVisibility();
  if (entityInspector.classList.contains('visible')) {
    contextAsset = null;
    entityTitle.textContent = 'Multiple objects selected';
    entityFields.replaceChildren();
    const message = document.createElement('p');
    message.className = 'entity-empty';
    message.textContent = 'Select one object to edit its gameplay properties.';
    entityFields.append(message);
  }
}

function updateTransformSpace() {
  transformControls.setSpace(
    transformControls.getMode() === 'translate' && moveOnRotatedAxes ? 'local' : 'world',
  );
}

function setTransformMode(mode: TransformControlsMode) {
  transformControls.setMode(mode);
  updateTransformSpace();
  updateTransformAxisVisibility();
  document.querySelectorAll<HTMLButtonElement>('.transform-button[data-transform-mode]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.transformMode === mode);
  });
}

function setTransformSnapping(enabled: boolean) {
  transformSnappingEnabled = enabled;
  transformControls.setTranslationSnap(enabled ? 100 : null);
  transformControls.setRotationSnap(enabled ? THREE.MathUtils.degToRad(22.5) : null);
  // Scale snapping is applied by exact local dimensions in objectChange below,
  // rather than as a percentage, so every axis lands on 0.1 m increments.
  transformControls.setScaleSnap(null);
  document.body.classList.toggle('transform-snapping', enabled);
}

const CANONICAL_GRID_CM = 100;
const GRID_SQUARE_CENTER_CM = CANONICAL_GRID_CM / 2;
function snapCoordinateToSquareCenter(value: number, step = CANONICAL_GRID_CM) {
  const centerOffset = step === CANONICAL_GRID_CM ? GRID_SQUARE_CENTER_CM : step / 2;
  return Math.round((value - centerOffset) / step) * step + centerOffset;
}
function snapMeshWorldPositionToFootprintGrid(mesh: THREE.Mesh) {
  const world = mesh.getWorldPosition(new THREE.Vector3());
  const bounds = canonicalWorldBounds(mesh);
  const center = bounds.getCenter(new THREE.Vector3());
  for (const axis of ['x', 'y'] as const) {
    const snappedCenter = snapCoordinateToSquareCenter(center[axis]);
    world[axis] += snappedCenter - center[axis];
  }
  world.z = Math.round(world.z / CANONICAL_GRID_CM) * CANONICAL_GRID_CM;
  mesh.position.copy(mesh.parent ? mesh.parent.worldToLocal(world) : world);
  mesh.updateMatrixWorld(true);
}

function canonicalWorldBounds(mesh: THREE.Mesh) {
  const canonical = assetDefinitions[mesh.userData.assetId as AssetId]?.canonicalBoundsCm;
  mesh.updateMatrixWorld(true);
  if (mesh.userData.hasAuthoritativeVisualBounds || !canonical) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return (mesh.geometry.boundingBox?.clone() ?? new THREE.Box3()).applyMatrix4(mesh.matrixWorld);
  }
  const bounds = new THREE.Box3();
  for (const x of [canonical.min[0], canonical.max[0]]) {
    for (const y of [canonical.min[1], canonical.max[1]]) {
      for (const z of [canonical.min[2], canonical.max[2]]) {
        bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
      }
    }
  }
  return bounds;
}

function snapSelectedDimensions(mesh: THREE.Mesh, activeAxis: 'x' | 'y' | 'z') {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  if (!bounds) return;

  const baseSize = bounds.getSize(new THREE.Vector3());
  const gridStep = 100;
  const sourceScale = mesh.scale[activeAxis];
  const direction = Math.sign(sourceScale) || 1;
  const dimension = Math.max(
    gridStep,
    Math.round((baseSize[activeAxis] * Math.abs(sourceScale)) / gridStep) * gridStep,
  );
  mesh.scale[activeAxis] = direction * (dimension / baseSize[activeAxis]);
}

function beginOneSidedScaleDrag(mesh: THREE.Mesh) {
  if (transformControls.getMode() !== 'scale') return null;
  const axisName = transformControls.axis?.toLowerCase();
  if (axisName !== 'x' && axisName !== 'y' && axisName !== 'z') return null;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  if (!mesh.geometry.boundingBox) return null;

  // The resize control is attached to the centred pivot, not the asset's
  // authored transform origin. Surface actors commonly place that origin on
  // their top face, so anchoring from mesh.getWorldPosition() changes Z by
  // half/full block heights as soon as a horizontal resize begins.
  const center = singleSelectionPivot.getWorldPosition(new THREE.Vector3());
  const quaternion = singleSelectionPivot.getWorldQuaternion(new THREE.Quaternion());
  const direction = new THREE.Vector3(
    axisName === 'x' ? 1 : 0,
    axisName === 'y' ? 1 : 0,
    axisName === 'z' ? 1 : 0,
  ).applyQuaternion(quaternion);
  const projectedCenter = center.clone().project(camera);
  const projectedPositive = center.clone().addScaledVector(direction, 100).project(camera);
  const screenDirection = new THREE.Vector2(
    projectedPositive.x - projectedCenter.x,
    projectedPositive.y - projectedCenter.y,
  );
  const pointerDirection = lastTransformPointer.clone().sub(new THREE.Vector2(projectedCenter.x, projectedCenter.y));
  const side: -1 | 1 = pointerDirection.dot(screenDirection) >= 0 ? 1 : -1;
  const worldScale = mesh.getWorldScale(new THREE.Vector3());
  worldScale.set(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
  return {
    axis: axisName,
    side,
    startWorldPosition: center,
    startWorldQuaternion: quaternion,
    startScale: singleSelectionPivot.scale.clone(),
    baseSize: mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(worldScale),
  } satisfies ScaleDragAnchor;
}

function applyOneSidedScaleAnchor(mesh: THREE.Mesh) {
  if (!scaleDragAnchor) return;
  const { axis, side, startWorldPosition, startWorldQuaternion, startScale, baseSize } = scaleDragAnchor;
  const scaleTarget = mesh.parent === singleSelectionPivot ? singleSelectionPivot : mesh;
  const sizeChange = baseSize[axis] * (Math.abs(scaleTarget.scale[axis]) - Math.abs(startScale[axis]));
  const direction = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0,
  ).applyQuaternion(startWorldQuaternion);
  const anchoredWorldPosition = startWorldPosition.clone().addScaledVector(direction, side * sizeChange / 2);
  if (mesh.parent === singleSelectionPivot) {
    singleSelectionPivot.position.copy(anchoredWorldPosition);
    singleSelectionPivot.updateMatrixWorld(true);
    return;
  }
  if (mesh.parent) mesh.position.copy(mesh.parent.worldToLocal(anchoredWorldPosition));
  else mesh.position.copy(anchoredWorldPosition);
}

function snapSingleSelectionPivotDimensions(mesh: THREE.Mesh, activeAxis: 'x' | 'y' | 'z') {
  if (!scaleDragAnchor || scaleDragAnchor.axis !== activeAxis) return;
  const baseDimension = scaleDragAnchor.baseSize[activeAxis];
  if (baseDimension <= 0.001) return;
  const dimension = Math.max(
    CANONICAL_GRID_CM,
    Math.round((baseDimension * Math.abs(singleSelectionPivot.scale[activeAxis])) / CANONICAL_GRID_CM)
      * CANONICAL_GRID_CM,
  );
  const childScale = Math.max(Math.abs(mesh.scale[activeAxis]), 0.0001);
  const definition = assetDefinitions[mesh.userData.assetId as AssetId];
  if (definition.resizeAxes && !definition.resizeAxes.includes(activeAxis)) {
    singleSelectionPivot.scale[activeAxis] = 1;
    return;
  }
  singleSelectionPivot.scale[activeAxis] = Math.max(1 / childScale, dimension / baseDimension);
}

function lockInactiveSingleSelectionScaleAxes(activeAxis: 'x' | 'y' | 'z') {
  if (!scaleDragAnchor) return;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (axis !== activeAxis) singleSelectionPivot.scale[axis] = scaleDragAnchor.startScale[axis];
  }
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  const bounds = renderer.domElement.getBoundingClientRect();
  lastTransformPointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}, { capture: true });

transformControls.addEventListener('mouseDown', () => {
  recordHistory();
  transformInteraction = true;
  controls.enabled = false;
  scaleDragAnchor = selectedAsset && multiSelectedAssets.length === 0
    ? beginOneSidedScaleDrag(selectedAsset)
    : null;
});
transformControls.addEventListener('mouseUp', () => {
  const completedSingleScale = Boolean(
    selectedAsset
    && selectedAsset.parent === singleSelectionPivot
    && transformControls.getMode() === 'scale',
  );
  if (selectedAsset?.parent === singleSelectionPivot) scene.attach(selectedAsset);
  if (completedSingleScale && selectedAsset) {
    const preferredScaleAxis = scaleDragAnchor?.axis ?? 'x';
    goalUniformScale(selectedAsset, preferredScaleAxis);
    constrainAssetScale(selectedAsset, preferredScaleAxis, true);
    updateAllWoodenPlatformSupports();
    syncSelectionHighlights([selectedAsset]);
    updateReadout(selectedAsset);
  }
  if (transformSnappingEnabled && transformControls.getMode() === 'translate') {
    const moved = multiSelectedAssets.length > 0 ? multiSelectedAssets : selectedAsset ? [selectedAsset] : [];
    moved.forEach(snapMeshWorldPositionToFootprintGrid);
    syncSelectionHighlights(moved);
  }
  if (selectedAsset) {
    const center = canonicalWorldBounds(selectedAsset).getCenter(new THREE.Vector3());
    singleSelectionPivot.position.copy(center);
    singleSelectionPivot.quaternion.copy(selectedAsset.getWorldQuaternion(new THREE.Quaternion()));
    singleSelectionPivot.scale.set(1, 1, 1);
    singleSelectionPivot.updateMatrixWorld(true);
    singleSelectionPivot.attach(selectedAsset);
    transformControls.attach(singleSelectionPivot);
  }
  controls.enabled = true;
  scheduleAutosave();
  scaleDragAnchor = null;
  window.setTimeout(() => { transformInteraction = false; }, 0);
});
transformControls.addEventListener('objectChange', () => {
  const activeAxis = transformControls.axis?.toLowerCase();
  const preferredScaleAxis: 'x' | 'y' | 'z' =
    activeAxis?.includes('y') ? 'y' : activeAxis?.includes('z') ? 'z' : 'x';
  if (multiSelectedAssets.length > 0) {
    if (transformControls.getMode() === 'scale') {
      constrainMultiSelectionScale();
      multiSelectedAssets.forEach((mesh) => {
        goalUniformScale(mesh, preferredScaleAxis);
        updateWoodenPlatformSupports(mesh);
      });
    }
    updateAllWoodenPlatformSupports();
    selectionHelper.setFromObject(multiSelectionGroup);
    syncSelectionHighlights(multiSelectedAssets);
    scheduleAutosave();
    return;
  }
  if (!selectedAsset) return;
  if (transformControls.getMode() === 'scale' && selectedAsset.parent === singleSelectionPivot) {
    lockInactiveSingleSelectionScaleAxes(preferredScaleAxis);
    if (transformSnappingEnabled) snapSingleSelectionPivotDimensions(selectedAsset, preferredScaleAxis);
    applyOneSidedScaleAnchor(selectedAsset);
  }
  // A normal single selection is resized through singleSelectionPivot so the
  // gizmo stays centred. Its world scale is committed and snapped in mouseUp
  // after scene.attach() bakes the pivot transform onto the actual asset.
  // Keep this path for any direct-attached legacy selection.
  if (transformControls.getMode() === 'scale' && selectedAsset.parent !== singleSelectionPivot) {
    if (transformSnappingEnabled) snapSelectedDimensions(selectedAsset, preferredScaleAxis);
    goalUniformScale(selectedAsset, preferredScaleAxis);
    constrainAssetScale(selectedAsset, preferredScaleAxis, true);
    applyOneSidedScaleAnchor(selectedAsset);
  }
  updateAllWoodenPlatformSupports();
  selectionHelper.setFromObject(selectedAsset);
  syncSelectionHighlights([selectedAsset]);
  updateReadout(selectedAsset);
  scheduleAutosave();
});

function setPlacementAsset(assetId: AssetId | null) {
  if (assetId && assetDefinitions[assetId]?.runtimeMappingStatus !== 'resolved') {
    showEditorNotice(`${assetDefinitions[assetId]?.label || assetId} does not have a verified in-game mapping and cannot be placed.`, 'error');
    return;
  }
  if (assetId && assetDefinitions[assetId]?.verificationMappingStatus === 'unsupported') {
    showEditorNotice(`${assetDefinitions[assetId]?.label || assetId} is not supported by the installed verification dummy and cannot be placed.`, 'error');
    return;
  }
  if (assetId === 'player_start') {
    const existingUniqueAsset = placedAssets.find((mesh) => mesh.userData.assetId === assetId);
    if (existingUniqueAsset) {
      selectPlacedAsset(existingUniqueAsset);
      return;
    }
  }
  activeAssetId = assetId;
  document.querySelectorAll<HTMLButtonElement>('.asset-button').forEach((button) => {
    button.classList.toggle('selected', button.dataset.assetId === assetId);
  });
  if (placementPreview) {
    scene.remove(placementPreview);
    disposeObjectResources(placementPreview);
    placementPreview = null;
  }
  if (assetId) {
    selectPlacedAsset(null);
    placementPreview = makeAssetMesh(assetId, true);
    placementPreview.visible = false;
    scene.add(placementPreview);
  }
}

function updateUniqueAssetAvailability() {
  document.querySelectorAll<HTMLButtonElement>('.asset-button[data-asset-id]').forEach((button) => {
    const assetId = button.dataset.assetId as AssetId;
    const definition = assetDefinitions[assetId];
    if (!definition || definition.runtimeMappingStatus === 'resolved') return;
    button.disabled = true;
    button.title = `${definition.label} has no verified in-game mapping and cannot be exported.`;
  });
  for (const assetId of ['player_start'] as const) {
    const exists = placedAssets.some((mesh) => mesh.userData.assetId === assetId);
    const button = document.querySelector<HTMLButtonElement>(`.asset-button[data-asset-id="${assetId}"]`);
    if (!button) continue;
    button.disabled = exists;
    button.title = exists ? `Only one ${assetDefinitions[assetId].label} can be placed` : `Place ${assetDefinitions[assetId].label}`;
  }
}

function updatePointer(event: PointerEvent) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function updatePlacementPreview(event: PointerEvent) {
  if (!placementPreview || !activeAssetId) return;
  updatePointer(event);
  const placedAssetHit = raycaster.intersectObjects(placedAssets, false)[0];
  const subwayPlatformHit = raycaster.intersectObjects(
    environmentPreviewGroup.children.filter((child) => child.userData.environmentPlacementSurface),
    false,
  ).find((hit) => Boolean(hit.face));
  const assetHit = placedAssetHit && subwayPlatformHit
    ? (placedAssetHit.distance <= subwayPlatformHit.distance ? placedAssetHit : subwayPlatformHit)
    : placedAssetHit ?? subwayPlatformHit;

  if (assetHit && assetHit.face) {
    placementPoint.copy(assetHit.point);
    const environmentSurface = assetHit.object.userData.environmentPlacementSurface === true;
    const surfaceMatrix = assetHit.object.matrixWorld.clone();
    if (assetHit.object instanceof THREE.InstancedMesh && assetHit.instanceId !== undefined) {
      assetHit.object.getMatrixAt(assetHit.instanceId, placementInstanceMatrix);
      surfaceMatrix.multiply(placementInstanceMatrix);
    }
    placementNormalMatrix.getNormalMatrix(surfaceMatrix);
    placementNormal.copy(assetHit.face.normal).applyMatrix3(placementNormalMatrix).normalize();

    // When snapping, snap within the supporting object's own rotated local
    // coordinate system so placements stay aligned to angled surfaces.
    if (transformSnappingEnabled && !environmentSurface) {
      localPlacementPoint.copy(placementPoint);
      assetHit.object.worldToLocal(localPlacementPoint);
      assetHit.object.getWorldScale(supportWorldScale);
      const localNormal = assetHit.face.normal;
      const normalAxis = Math.abs(localNormal.x) > Math.abs(localNormal.y)
        ? (Math.abs(localNormal.x) > Math.abs(localNormal.z) ? 'x' : 'z')
        : (Math.abs(localNormal.y) > Math.abs(localNormal.z) ? 'y' : 'z');
      const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
      for (const axis of axes) {
        if (axis === normalAxis) continue;
        const localStep = 100 / Math.max(Math.abs(supportWorldScale[axis]), 0.0001);
        localPlacementPoint[axis] = snapCoordinateToSquareCenter(localPlacementPoint[axis], localStep);
      }
      assetHit.object.localToWorld(localPlacementPoint);
      placementPoint.copy(localPlacementPoint);
    } else if (transformSnappingEnabled) {
      placementPoint.x = snapCoordinateToSquareCenter(placementPoint.x);
      placementPoint.y = snapCoordinateToSquareCenter(placementPoint.y);
    }
  } else if (!raycaster.ray.intersectPlane(placementPlane, placementPoint)) {
    placementPreview.visible = false;
    return;
  } else {
    placementNormal.set(0, 0, 1);
    if (transformSnappingEnabled) {
      placementPoint.x = snapCoordinateToSquareCenter(placementPoint.x);
      placementPoint.y = snapCoordinateToSquareCenter(placementPoint.y);
    }
  }

  placementPreview.visible = true;
  const defaultRotation = defaultAssetQuaternion(activeAssetId);
  if (Math.abs(placementNormal.z) < 0.9) {
    // Wall snapping uses only the horizontal X/Y component of the wall normal.
    // This changes yaw around world Z while preserving an upright pitch/roll.
    const wallYaw = Math.atan2(placementNormal.y, placementNormal.x);
    const wallFacingRotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      wallYaw,
    );
    placementPreview.quaternion.copy(wallFacingRotation).multiply(defaultRotation);
    placementPreview.userData.wallSnapNormal = {
      x: placementNormal.x,
      y: placementNormal.y,
      z: placementNormal.z,
    };
  } else {
    // Floors and ceilings never alter object orientation.
    placementPreview.quaternion.copy(defaultRotation);
    placementPreview.userData.wallSnapNormal = undefined;
  }
  const definition = assetDefinitions[activeAssetId];
  // Measure the rendered object instead of adding the legacy fixed 0.5/1 m
  // offsets. This keeps models with top, centre and bottom origins alike flush
  // with floors, ceilings and walls.
  const savedPosition = placementPreview.position.clone();
  placementPreview.position.set(0, 0, 0);
  placementPreview.updateMatrixWorld(true);
  const bounds = canonicalWorldBounds(placementPreview);
  placementPreview.position.copy(savedPosition);
  let placementOffset = definition.baseHeight;
  if (!bounds.isEmpty()) {
    let minimumProjection = Number.POSITIVE_INFINITY;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          minimumProjection = Math.min(minimumProjection, new THREE.Vector3(x, y, z).dot(placementNormal));
        }
      }
    }
    placementOffset = -minimumProjection;
  }
  placementPreview.position.copy(placementPoint).addScaledVector(
    placementNormal,
    placementOffset,
  );
  updateReadout(placementPreview);
}

document.querySelectorAll<HTMLButtonElement>('.asset-button').forEach((button) => {
  button.addEventListener('click', () => setPlacementAsset(button.dataset.assetId as AssetId));
});
function showCatalogue(catalog: AssetDefinition['catalog']) {
  document.querySelectorAll<HTMLButtonElement>('.catalog-tab').forEach((button) => {
    button.classList.toggle('selected', button.dataset.catalog === catalog);
  });
  const surfaceGroups = document.querySelector<HTMLElement>('#surface-groups')!;
  const gameplayGroups = document.querySelector<HTMLElement>('#gameplay-groups')!;
  const propGroups = document.querySelector<HTMLElement>('#prop-groups')!;
  surfaceGroups.hidden = catalog !== 'surface';
  gameplayGroups.hidden = catalog !== 'gameplay';
  propGroups.hidden = catalog !== 'props';
  if (catalog === 'gameplay') showGameplayGroup('game');
  else if (catalog === 'props') showPropGroup('props');
  else showSurfaceGroup('platforms');
}
function showPropGroup(group: PropGroup) {
  document.querySelectorAll<HTMLButtonElement>('.prop-group').forEach((button) => {
    button.classList.toggle('selected', button.dataset.propGroup === group);
  });
  document.querySelectorAll<HTMLButtonElement>('.asset-button').forEach((button) => {
    button.hidden = button.dataset.catalog !== 'props' || button.dataset.propGroup !== group;
  });
}
function showSurfaceGroup(group: NonNullable<AssetDefinition['surfaceGroup']>) {
  document.querySelectorAll<HTMLButtonElement>('.surface-group').forEach((button) => {
    button.classList.toggle('selected', button.dataset.surfaceGroup === group);
  });
  document.querySelectorAll<HTMLButtonElement>('.asset-button').forEach((button) => {
    button.hidden = button.dataset.catalog !== 'surface' || button.dataset.surfaceGroup !== group;
  });
}
function showGameplayGroup(group: NonNullable<AssetDefinition['gameplayGroup']>) {
  document.querySelectorAll<HTMLButtonElement>('.gameplay-group').forEach((button) => {
    button.classList.toggle('selected', button.dataset.gameplayGroup === group);
  });
  document.querySelectorAll<HTMLButtonElement>('.asset-button').forEach((button) => {
    button.hidden = button.dataset.catalog !== 'gameplay' || button.dataset.gameplayGroup !== group;
  });
}
document.querySelectorAll<HTMLButtonElement>('.gameplay-group').forEach((button) => {
  if (button.classList.contains('surface-group') || button.classList.contains('prop-group')) return;
  button.addEventListener('click', () => showGameplayGroup(button.dataset.gameplayGroup as NonNullable<AssetDefinition['gameplayGroup']>));
});
document.querySelectorAll<HTMLButtonElement>('.prop-group').forEach((button) => {
  button.addEventListener('click', () => showPropGroup(button.dataset.propGroup as PropGroup));
});
document.querySelectorAll<HTMLButtonElement>('.surface-group').forEach((button) => {
  button.addEventListener('click', () => showSurfaceGroup(button.dataset.surfaceGroup as NonNullable<AssetDefinition['surfaceGroup']>));
});
document.querySelectorAll<HTMLButtonElement>('.catalog-tab').forEach((button) => {
  button.addEventListener('click', () => showCatalogue(button.dataset.catalog as AssetDefinition['catalog']));
});
showCatalogue('surface');
document.querySelectorAll<HTMLButtonElement>('.transform-button[data-transform-mode]').forEach((button) => {
  button.addEventListener('click', () => setTransformMode(button.dataset.transformMode as TransformControlsMode));
});
document.querySelector<HTMLButtonElement>('#deselect-asset')!.addEventListener('click', () => {
  setPlacementAsset(null);
  selectPlacedAsset(null);
});
function setLassoEnabled(enabled: boolean) {
  lassoEnabled = enabled;
  document.querySelector<HTMLButtonElement>('#lasso-tool')!.classList.toggle('selected', enabled);
  setPlacementAsset(null);
  renderer.domElement.style.cursor = enabled ? 'crosshair' : '';
}
document.querySelector<HTMLButtonElement>('#lasso-tool')!.addEventListener('click', () => {
  setLassoEnabled(!lassoEnabled);
});

renderer.domElement.addEventListener('pointermove', updatePlacementPreview);
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (isEditingLevelName || previewMode) return;
  pointerDown.set(event.clientX, event.clientY);
  if (lassoEnabled && event.button === 0) {
    lassoDragging = true;
    controls.enabled = false;
    const bounds = renderer.domElement.getBoundingClientRect();
    lassoStart.set(event.clientX - bounds.left, event.clientY - bounds.top);
    lassoRectangle.style.left = `${lassoStart.x}px`;
    lassoRectangle.style.top = `${lassoStart.y}px`;
    lassoRectangle.style.width = '0px';
    lassoRectangle.style.height = '0px';
    lassoRectangle.classList.add('visible');
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!lassoDragging) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  lassoRectangle.style.left = `${Math.min(lassoStart.x, x)}px`;
  lassoRectangle.style.top = `${Math.min(lassoStart.y, y)}px`;
  lassoRectangle.style.width = `${Math.abs(x - lassoStart.x)}px`;
  lassoRectangle.style.height = `${Math.abs(y - lassoStart.y)}px`;
});
renderer.domElement.addEventListener('pointerleave', () => {
  if (placementPreview) placementPreview.visible = false;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (isEditingLevelName || previewMode) return;
  if (lassoDragging) {
    lassoDragging = false;
    controls.enabled = true;
    lassoRectangle.classList.remove('visible');
    const bounds = renderer.domElement.getBoundingClientRect();
    const endX = event.clientX - bounds.left;
    const endY = event.clientY - bounds.top;
    const left = Math.min(lassoStart.x, endX);
    const rightEdge = Math.max(lassoStart.x, endX);
    const top = Math.min(lassoStart.y, endY);
    const bottom = Math.max(lassoStart.y, endY);
    const selected = placedAssets.filter((mesh) => {
      const projected = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      const screenX = (projected.x * 0.5 + 0.5) * bounds.width;
      const screenY = (-projected.y * 0.5 + 0.5) * bounds.height;
      return projected.z >= -1 && projected.z <= 1 && screenX >= left && screenX <= rightEdge && screenY >= top && screenY <= bottom;
    });
    selectAssetGroup(selected);
    setLassoEnabled(false);
    setTransformMode('translate');
    return;
  }
  if (transformInteraction || event.button !== 0 || pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;

  if (activeAssetId && placementPreview?.visible) {
    recordHistory();
    const placed = makeAssetMesh(activeAssetId);
    placed.position.copy(placementPreview.position);
    placed.rotation.copy(placementPreview.rotation);
    placed.userData.wallSnapNormal = placementPreview.userData.wallSnapNormal
      ? { ...placementPreview.userData.wallSnapNormal }
      : undefined;
    scene.add(placed);
    placedAssets.push(placed);
    if (activeAssetId.startsWith('sky_platform') || activeAssetId === 'ice_platform_4x4') {
      placed.updateMatrixWorld(true);
      const finalBounds = new THREE.Box3().setFromObject(placed);
      editorLog('platform-dimensions', {
        event: 'object-placed',
        assetId: activeAssetId,
        finalWorldUnits: finalBounds.getSize(new THREE.Vector3()).toArray(),
        position: placed.position.toArray(),
        objectScale: placed.scale.toArray(),
      });
    }
    updateAllWoodenPlatformSupports();
    updateUniqueAssetAvailability();
    setPlacementAsset(null);
    selectPlacedAsset(placed);
    scheduleAutosave();
    return;
  }

  updatePointer(event);
  const hit = raycaster.intersectObjects(placedAssets, false)[0];
  const hitMesh = hit?.object as THREE.Mesh | undefined;
  if (event.shiftKey && hitMesh) {
    const current = selectedMeshes();
    const next = current.includes(hitMesh)
      ? current.filter((mesh) => mesh !== hitMesh)
      : [...current, hitMesh];
    selectAssetGroup(next);
  } else {
    selectPlacedAsset(hitMesh ?? null);
  }
});

renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  updatePointer(event as PointerEvent);
  const hit = raycaster.intersectObjects(placedAssets, false)[0];
  if (!hit) return;
  contextAsset = hit.object as THREE.Mesh;
  selectPlacedAsset(contextAsset);
  entityTitle.textContent = `${contextAsset.userData.assetLabel} data`;
  renderEntityFields(contextAsset);
  entityInspector.classList.add('visible');
  entityInspector.setAttribute('aria-hidden', 'false');
});

function openInspectorForSelection() {
  if (!selectedAsset || multiSelectedAssets.length > 0) {
    showEditorNotice('Select one object to open its data.', 'error');
    return;
  }
  contextAsset = selectedAsset;
  entityTitle.textContent = `${contextAsset.userData.assetLabel} data`;
  renderEntityFields(contextAsset);
  entityInspector.classList.add('visible');
  entityInspector.setAttribute('aria-hidden', 'false');
  entityFields.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
}

function friendlyName(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function addEntityField(section: string, key: string, value: unknown, editable = true) {
  const row = document.createElement('label');
  row.className = 'entity-field';
  const name = document.createElement('span');
  name.textContent = friendlyName(key);
  const input = document.createElement('input');
  input.dataset.section = section;
  input.dataset.key = key;
  input.disabled = !editable;
  input.type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text';
  if (input.type === 'checkbox') input.checked = Boolean(value);
  else input.value = String(value ?? '');
  if (input.type === 'number') input.step = '0.1';
  row.append(name, input);
  entityFields.append(row);
}

function addGameplayPropertyField(definition: GameplayPropertyDefinition, value: GameplayPropertyValue) {
  const row = document.createElement('label');
  row.className = 'entity-field';
  const name = document.createElement('span');
  name.textContent = definition.label;
  const input = document.createElement('input');
  input.dataset.section = 'entityData';
  input.dataset.key = definition.key;
  input.dataset.propertyKey = definition.key;
  input.type = definition.kind === 'boolean' ? 'checkbox' : definition.kind === 'text' ? 'text' : 'number';
  if (input.type === 'checkbox') input.checked = Boolean(value);
  else input.value = String(value);
  if (definition.kind === 'integer') input.step = '1';
  else if (definition.kind === 'number') input.step = String(definition.step ?? 0.1);
  if (definition.min !== undefined) input.min = String(definition.min);
  if (definition.max !== undefined) input.max = String(definition.max);
  row.append(name, input);
  entityFields.append(row);
}

function addEntityHeading(text: string) {
  const heading = document.createElement('h3');
  heading.textContent = text;
  entityFields.append(heading);
}

function renderEntityFields(mesh: THREE.Mesh) {
  entityFields.replaceChildren();
  const transform = serializeTransform(mesh);
  const resizeAxes = assetDefinitions[mesh.userData.assetId as AssetId].resizeAxes;
  for (const [section, values] of Object.entries(transform)) {
    addEntityHeading(friendlyName(section));
    Object.entries(values).forEach(([key, value]) => {
      const editable = !(
        section === 'scale'
        && (
          (mesh.userData.assetId === 'time_trial_goal' && key !== 'x')
          || (resizeAxes && !resizeAxes.includes(key as 'x' | 'y' | 'z'))
        )
      );
      addEntityField(section, key, value, editable);
    });
  }
  addEntityHeading('Gameplay properties');
  const properties = gameplayPropertiesForAsset(mesh.userData.assetId as AssetId);
  if (properties.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'entity-empty';
    empty.textContent = 'This object has no editable gameplay properties.';
    entityFields.append(empty);
  } else {
    const data = mesh.userData.entityData || {};
    properties.forEach((definition) => addGameplayPropertyField(
      definition,
      validateGameplayProperty(definition, data[definition.key] ?? definition.defaultValue),
    ));
  }
}

function closeEntityInspector() {
  entityInspector.classList.remove('visible');
  entityInspector.setAttribute('aria-hidden', 'true');
  contextAsset = null;
}
document.querySelector('#entity-close')!.addEventListener('click', closeEntityInspector);
document.querySelector('#entity-cancel')!.addEventListener('click', closeEntityInspector);
document.querySelector('#entity-save')!.addEventListener('click', () => {
  if (!contextAsset) return;
  try {
    recordHistory();
    const transform = serializeTransform(contextAsset);
    const data: Record<string, string | number | boolean> = { ...(contextAsset.userData.entityData || {}) };
    const propertyDefinitions = new Map(
      gameplayPropertiesForAsset(contextAsset.userData.assetId as AssetId).map((definition) => [definition.key, definition]),
    );
    entityFields.querySelectorAll<HTMLInputElement>('input[data-section]').forEach((input) => {
      if (input.disabled) return;
      const section = input.dataset.section!;
      const key = input.dataset.key!;
      const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
      if (input.type === 'number' && !Number.isFinite(value)) throw new Error(`${friendlyName(key)} must be a number.`);
      if (section === 'entityData') {
        const definition = propertyDefinitions.get(key);
        if (!definition) return;
        data[key] = validateGameplayProperty(definition, value);
      }
      else (transform as unknown as Record<string, Record<string, number>>)[section][key] = Number(value);
    });
    if (contextAsset.userData.assetId === 'time_trial_goal') {
      transform.scale.y = transform.scale.x;
      transform.scale.z = transform.scale.x;
    }
    // Inspector values are Unreal coordinates; the viewport uses Three.js.
    contextAsset.position.set(
      transform.position.x,
      -transform.position.y,
      transform.position.z,
    );
    contextAsset.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation.roll),
      THREE.MathUtils.degToRad(-transform.rotation.pitch),
      THREE.MathUtils.degToRad(-transform.rotation.yaw),
      'ZYX',
    );
    contextAsset.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    goalUniformScale(contextAsset);
    constrainAssetScale(contextAsset);
    updateAllWoodenPlatformSupports();
    contextAsset.userData.entityData = data;
    refreshAssetPresentation(contextAsset);
    selectionHelper.setFromObject(contextAsset);
    updateReadout(contextAsset);
    closeEntityInspector();
    showEditorNotice('Entity data updated.', 'success');
    scheduleAutosave();
  } catch (error) {
    showEditorNotice(error instanceof Error ? error.message : String(error), 'error');
  }
});
entityInspector.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>('#entity-save')!.click();
  }
});

function resetCamera() {
  camera.position.set(2200, -2200, 1650);
  controls.target.set(0, 0, 150);
  controls.update();
}

function focusCameraOnPlayerStart() {
  const playerStart = placedAssets.find((mesh) => mesh.userData.assetId === 'player_start');
  if (!playerStart) {
    resetCamera();
    return;
  }
  const spawn = playerStart.position;
  controls.target.set(spawn.x, spawn.y, spawn.z + 100);
  camera.position.set(spawn.x + 1400, spawn.y - 1400, spawn.z + 1000);
  controls.update();
  editorLog('camera', {
    event: 'focused-player-start',
    spawn: vectorLogValue(spawn),
    position: vectorLogValue(camera.position),
    target: vectorLogValue(controls.target),
  });
}

resetCamera();

const pressed = new Set<string>();
let previewMode = false;
let previewYaw = 0;
let previewPitch = 0;
let previewPointerLockAcquired = false;
let previewVerticalVelocity = 0;
let previewGrounded = false;
let savedEditorCamera: { position: THREE.Vector3; quaternion: THREE.Quaternion; target: THREE.Vector3 } | null = null;

function applyPreviewCameraRotation() {
  const horizontal = Math.cos(previewPitch);
  const direction = new THREE.Vector3(
    horizontal * Math.cos(previewYaw),
    horizontal * Math.sin(previewYaw),
    Math.sin(previewPitch),
  );
  camera.up.set(0, 0, 1);
  camera.lookAt(camera.position.clone().add(direction));
}

function enterPreviewMode() {
  if (previewMode) return;
  savedEditorCamera = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone() };
  const playerStart = placedAssets.find((mesh) => mesh.userData.assetId === 'player_start');
  if (playerStart) {
    camera.position.copy(playerStart.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0, 170));
    camera.quaternion.copy(playerStart.getWorldQuaternion(new THREE.Quaternion()));
  }
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'ZYX');
  previewPitch = 0;
  previewYaw = euler.z;
  applyPreviewCameraRotation();
  previewMode = true;
  previewVerticalVelocity = 0;
  previewGrounded = false;
  previewPointerLockAcquired = false;
  pressed.clear();
  controls.enabled = false;
  transformControls.detach();
  selectionHelper.visible = false;
  selectionHighlights.forEach((helper) => { helper.visible = false; });
  previewIndicator.hidden = false;
  previewButton.textContent = 'Exit Preview';
  document.body.classList.add('preview-mode');
  void renderer.domElement.requestPointerLock();
}

function exitPreviewMode() {
  if (!previewMode) return;
  previewMode = false;
  previewPointerLockAcquired = false;
  pressed.clear();
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  if (savedEditorCamera) {
    camera.position.copy(savedEditorCamera.position);
    camera.quaternion.copy(savedEditorCamera.quaternion);
    controls.target.copy(savedEditorCamera.target);
  }
  controls.enabled = true;
  previewIndicator.hidden = true;
  previewButton.textContent = 'Preview';
  document.body.classList.remove('preview-mode');
  const selection = selectedMeshes();
  syncSelectionHighlights(selection);
  if (selection.length > 1) selectAssetGroup(selection);
  else selectPlacedAsset(selection[0] ?? null);
}

previewButton.addEventListener('click', () => previewMode ? exitPreviewMode() : enterPreviewMode());
document.addEventListener('pointerlockchange', () => {
  // Browsers reserve the first Escape press for releasing pointer lock and
  // may not dispatch that keydown to the page. Treat lock release as the same
  // complete exit action so Preview never needs a second Escape press.
  if (document.pointerLockElement === renderer.domElement) {
    previewPointerLockAcquired = true;
  } else if (previewMode && previewPointerLockAcquired) {
    exitPreviewMode();
  }
});
document.addEventListener('mousemove', (event) => {
  if (!previewMode || document.pointerLockElement !== renderer.domElement) return;
  previewYaw -= event.movementX * 0.002;
  previewPitch = THREE.MathUtils.clamp(previewPitch - event.movementY * 0.002, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  applyPreviewCameraRotation();
});
window.addEventListener('keydown', (event) => {
  if (previewMode && event.code === 'Escape') {
    event.preventDefault();
    exitPreviewMode();
    return;
  }
  if (previewMode && event.code === 'Space') {
    event.preventDefault();
    if (previewGrounded) {
      previewVerticalVelocity = 470;
      previewGrounded = false;
    }
    return;
  }
  if (event.code === 'Escape' && !event.repeat && !optionsScreen.hidden) {
    event.preventDefault();
    closeKeybindOptions();
    return;
  }
  if (event.code === 'Escape' && !event.repeat && !advancedOptionsScreen.hidden) {
    event.preventDefault();
    closeAdvancedOptions();
    return;
  }
  const cameraCodes = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    editorShortcuts.cameraDown.code, editorShortcuts.cameraUp.code,
    'ShiftLeft', 'ShiftRight',
  ];
  if (event.target instanceof HTMLSelectElement) {
    // Native selects retain focus after a choice is made. Let a movement key
    // hand control straight back to the viewport instead of swallowing it.
    if (cameraCodes.includes(event.code)) event.target.blur();
    else return;
  }
  if (
    isEditingLevelName
    || event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || (event.target instanceof HTMLElement && event.target.isContentEditable)
  ) return;
  if (event.ctrlKey && !event.repeat) {
    if (event.code === 'KeyC') {
      event.preventDefault();
      copySelection();
      return;
    }
    if (event.code === 'KeyV') {
      event.preventDefault();
      pasteSelection();
      return;
    }
    if (event.code === 'KeyZ') {
      event.preventDefault();
      undoEditorChange();
      return;
    }
    if (event.code === 'KeyY') {
      event.preventDefault();
      redoEditorChange();
      return;
    }
  }
  if (!event.repeat && !event.altKey && !event.metaKey && !event.ctrlKey) {
    if (shortcutMatches('move', event.code)) {
      event.preventDefault();
      setTransformMode('translate');
      return;
    }
    if (shortcutMatches('rotate', event.code)) {
      event.preventDefault();
      setTransformMode('rotate');
      return;
    }
    if (shortcutMatches('scale', event.code)) {
      event.preventDefault();
      setTransformMode('scale');
      return;
    }
    if (shortcutMatches('lasso', event.code)) {
      event.preventDefault();
      setLassoEnabled(!lassoEnabled);
      return;
    }
    if (shortcutMatches('inspector', event.code)) {
      event.preventDefault();
      openInspectorForSelection();
      return;
    }
  }
  if (cameraCodes.includes(event.code)) {
    pressed.add(event.code);
    event.preventDefault();
  }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') setTransformSnapping(true);
  if (event.code === 'KeyF' && !event.repeat) resetCamera();
  if (event.code === 'Escape' && !event.repeat) {
    if (!editorOptions.hidden) { closeEditorOptions(); return; }
    openEditorOptions();
    return;
  }
  if ((event.code === 'Delete' || event.code === 'Backspace') && !event.repeat) {
    const deleting = selectedMeshes();
    if (deleting.length === 0) return;
    recordHistory();
    clearMultiSelection();
    deleting.forEach((mesh) => {
      const index = placedAssets.indexOf(mesh);
      if (index >= 0) placedAssets.splice(index, 1);
      disposePlacedMesh(mesh);
    });
    updateAllWoodenPlatformSupports();
    selectPlacedAsset(null);
    updateUniqueAssetAvailability();
    scheduleAutosave();
  }
});
window.addEventListener('keyup', (event) => {
  pressed.delete(event.code);
  if (pushToEdit && (
    shortcutMatches('rotate', event.code)
    || shortcutMatches('scale', event.code)
  )) setTransformMode('translate');
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    setTransformSnapping(pressed.has('ShiftLeft') || pressed.has('ShiftRight'));
  }
});
window.addEventListener('blur', () => {
  pressed.clear();
  if (pushToEdit) setTransformMode('translate');
  setTransformSnapping(false);
});

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const movement = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 0, 1);
const laserPreviewRaycaster = new THREE.Raycaster();
let previousTime = performance.now();

function updateRuntimeLaserBeamPreviews() {
  for (const laser of placedAssets) {
    if (laser.userData.assetId !== 'laser_beam') continue;
    const beam = laser.getObjectByName('JLE_RuntimeLaserBeam');
    if (!beam) continue;
    const origin = laser.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(laser.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    // Start beyond the emitter so the trace cannot immediately hit geometry
    // sharing the laser's mounting surface.
    origin.addScaledVector(direction, 20);
    laserPreviewRaycaster.set(origin, direction);
    laserPreviewRaycaster.near = 0;
    laserPreviewRaycaster.far = 10000;
    const candidates = placedAssets.filter((candidate) => candidate !== laser);
    const hit = laserPreviewRaycaster.intersectObjects(candidates, false)[0];
    const authoredLength = 300 * Math.max(Math.abs(laser.getWorldScale(new THREE.Vector3()).x), 0.001);
    const worldLength = Math.max(40, Math.min(authoredLength, (hit?.distance ?? authoredLength) + 20));
    const worldScale = laser.getWorldScale(new THREE.Vector3());
    const localLength = worldLength / Math.max(Math.abs(worldScale.x), 0.0001);
    beam.scale.x = localLength;
    beam.position.x = localLength / 2;
  }
}

function moveCamera(deltaSeconds: number) {
  const forwardAmount = Number(pressed.has('KeyW')) - Number(pressed.has('KeyS'));
  const rightAmount = Number(pressed.has('KeyD')) - Number(pressed.has('KeyA'));
  const verticalAmount = Number(pressed.has(editorShortcuts.cameraUp.code))
    - Number(pressed.has(editorShortcuts.cameraDown.code));
  if (previewMode) {
    movePreviewPlayer(deltaSeconds, forwardAmount, rightAmount);
    return;
  }
  if (forwardAmount === 0 && rightAmount === 0 && verticalAmount === 0) return;

  camera.getWorldDirection(forward);
  if (!previewMode) forward.z = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 1, 0);
  forward.normalize();
  right.crossVectors(forward, worldUp).normalize();
  movement.copy(forward).multiplyScalar(forwardAmount)
    .addScaledVector(right, rightAmount)
    .addScaledVector(worldUp, verticalAmount)
    .normalize();

  const fast = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
  const speed = fast ? 2400 : 800;
  movement.multiplyScalar(speed * deltaSeconds);
  camera.position.add(movement);
  if (!previewMode) controls.target.add(movement);
}

const previewCollisionRaycaster = new THREE.Raycaster();
const PREVIEW_EYE_HEIGHT = 170;
const PREVIEW_RADIUS = 35;
const PREVIEW_STEP_HEIGHT = 45;
type PreviewCollisionShape = 'box' | 'circle' | 'quarter-circle' | 'octagon';
type PreviewCollisionProxy = {
  shape: PreviewCollisionShape;
  size: [number, number, number];
  center?: [number, number];
};
// Traversal proxies deliberately describe the walkable slab, excluding
// cables, supports and decorative undersides from Preview collision.
const previewPlatformCollision: Partial<Record<AssetId, PreviewCollisionProxy>> = {
  static_basekit_floor_01: { shape: 'box', size: [400, 400, 50] },
  static_basekit_floorcylinder_01: { shape: 'circle', size: [400, 400, 50] },
  static_basekit_floorquartercylinder_01: { shape: 'quarter-circle', size: [400, 400, 50], center: [0, 0] },
  static_ice_platform01: { shape: 'box', size: [400, 400, 50] },
  static_artic_platform: { shape: 'box', size: [100, 100, 50] },
  static_artic_platform_2x2: { shape: 'box', size: [200, 200, 50] },
  static_snow_01: { shape: 'box', size: [100, 100, 50] },
  static_woodenoctagonplatform: { shape: 'octagon', size: [400, 400, 50] },
  static_woodensquareplatform: { shape: 'box', size: [400, 400, 50] },
  static_2x2_rio_platform_flat_01: { shape: 'box', size: [200, 200, 50] },
  static_2x2_rio_platform_top_brick_01: { shape: 'box', size: [200, 200, 50] },
  static_2x3_rio_platform_top_brick_01: { shape: 'box', size: [200, 300, 50] },
  static_stage_1x1: { shape: 'box', size: [100, 100, 50] },
  static_stage_2x2: { shape: 'box', size: [200, 200, 50] },
  static_stage_2x3: { shape: 'box', size: [200, 300, 50] },
  static_stage_floor01: { shape: 'box', size: [300, 300, 25] },
  static_specialplatform2x7_1: { shape: 'box', size: [200, 700, 50] },
};
function previewCollisionMeshes() {
  return placedAssets.filter((mesh) => assetDefinitions[mesh.userData.assetId as AssetId]?.catalog === 'surface');
}
function previewProxyContains(proxy: PreviewCollisionProxy, x: number, y: number) {
  const [width, depth] = proxy.size;
  const centerX = proxy.center?.[0] ?? 0;
  const centerY = proxy.center?.[1] ?? 0;
  const localX = x - centerX;
  const localY = y - centerY;
  if (proxy.shape === 'circle') return localX * localX + localY * localY <= (width / 2) ** 2;
  if (proxy.shape === 'quarter-circle') {
    return localX >= 0 && localY >= 0 && localX * localX + localY * localY <= (width / 2) ** 2;
  }
  if (proxy.shape === 'octagon') {
    const half = width / 2;
    return Math.abs(localX) <= half && Math.abs(localY) <= half
      && Math.abs(localX) + Math.abs(localY) <= half * (1 + Math.SQRT1_2);
  }
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= depth / 2;
}
function previewProxyGroundAt(mesh: THREE.Mesh, proxy: PreviewCollisionProxy, x: number, y: number, startZ: number) {
  mesh.updateMatrixWorld(true);
  const inverse = mesh.matrixWorld.clone().invert();
  const ray = new THREE.Ray(new THREE.Vector3(x, y, startZ), new THREE.Vector3(0, 0, -1)).applyMatrix4(inverse);
  if (Math.abs(ray.direction.z) < 1e-6) return null;
  const distance = -ray.origin.z / ray.direction.z;
  if (distance < 0) return null;
  const local = ray.at(distance, new THREE.Vector3());
  if (!previewProxyContains(proxy, local.x, local.y)) return null;
  const point = local.applyMatrix4(mesh.matrixWorld);
  if (point.z > startZ + 0.01) return null;
  return { distance: startZ - point.z, point, object: mesh } as THREE.Intersection;
}
function previewGroundAt(x: number, y: number, startZ: number) {
  const proxyHits = previewCollisionMeshes().flatMap((mesh) => {
    const proxy = previewPlatformCollision[mesh.userData.assetId as AssetId];
    const hit = proxy ? previewProxyGroundAt(mesh, proxy, x, y, startZ) : null;
    return hit ? [hit] : [];
  });
  previewCollisionRaycaster.set(new THREE.Vector3(x, y, startZ), new THREE.Vector3(0, 0, -1));
  previewCollisionRaycaster.near = 0;
  previewCollisionRaycaster.far = 10000;
  const ordinaryMeshes = previewCollisionMeshes().filter(
    (mesh) => !previewPlatformCollision[mesh.userData.assetId as AssetId],
  );
  return [...proxyHits, ...previewCollisionRaycaster.intersectObjects(ordinaryMeshes, false)]
    .sort((a, b) => a.distance - b.distance)[0];
}
function previewCollisionBounds(object: THREE.Mesh) {
  const proxy = previewPlatformCollision[object.userData.assetId as AssetId];
  if (!proxy) return canonicalWorldBounds(object);
  const [width, depth, thickness] = proxy.size;
  const centerX = proxy.center?.[0] ?? 0;
  const centerY = proxy.center?.[1] ?? 0;
  return new THREE.Box3(
    new THREE.Vector3(centerX - width / 2, centerY - depth / 2, -thickness),
    new THREE.Vector3(centerX + width / 2, centerY + depth / 2, 0),
  ).applyMatrix4(object.matrixWorld);
}
function previewHorizontalBlocked(position: THREE.Vector3, currentFeetZ: number) {
  for (const object of previewCollisionMeshes()) {
    const bounds = previewCollisionBounds(object);
    if (bounds.max.z <= currentFeetZ + PREVIEW_STEP_HEIGHT) continue;
    if (bounds.min.z >= position.z - 8) continue;
    if (position.x + PREVIEW_RADIUS > bounds.min.x && position.x - PREVIEW_RADIUS < bounds.max.x
      && position.y + PREVIEW_RADIUS > bounds.min.y && position.y - PREVIEW_RADIUS < bounds.max.y) return true;
  }
  return false;
}
function movePreviewPlayer(deltaSeconds: number, forwardAmount: number, rightAmount: number) {
  camera.getWorldDirection(forward);
  forward.z = 0;
  if (forward.lengthSq() < 0.001) forward.set(1, 0, 0);
  forward.normalize();
  right.crossVectors(forward, worldUp).normalize();
  movement.copy(forward).multiplyScalar(forwardAmount).addScaledVector(right, rightAmount);
  if (movement.lengthSq() > 0) movement.normalize().multiplyScalar(650 * deltaSeconds);
  const currentFeetZ = camera.position.z - PREVIEW_EYE_HEIGHT;
  for (const axis of ['x', 'y'] as const) {
    const candidate = camera.position.clone();
    candidate[axis] += movement[axis];
    const ground = previewGroundAt(candidate.x, candidate.y, camera.position.z + PREVIEW_STEP_HEIGHT);
    const climb = ground ? ground.point.z - currentFeetZ : Number.POSITIVE_INFINITY;
    if (!previewHorizontalBlocked(candidate, currentFeetZ) || climb <= PREVIEW_STEP_HEIGHT) {
      camera.position[axis] = candidate[axis];
      if (ground && climb > 0 && climb <= PREVIEW_STEP_HEIGHT) camera.position.z = ground.point.z + PREVIEW_EYE_HEIGHT;
    }
  }
  previewVerticalVelocity -= 980 * deltaSeconds;
  const proposedZ = camera.position.z + previewVerticalVelocity * deltaSeconds;
  if (previewVerticalVelocity <= 0) {
    const ground = previewGroundAt(camera.position.x, camera.position.y, camera.position.z + 5);
    const floorEyeZ = ground ? ground.point.z + PREVIEW_EYE_HEIGHT : Number.NEGATIVE_INFINITY;
    if (proposedZ <= floorEyeZ) {
      camera.position.z = floorEyeZ;
      previewVerticalVelocity = 0;
      previewGrounded = true;
      return;
    }
  }
  previewGrounded = false;
  camera.position.z = proposedZ;
}

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(viewport);

function animate(time: number) {
  const delta = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  moveCamera(delta);
  updateRuntimeLaserBeamPreviews();
  if (!previewMode) controls.update();
  skyDome.position.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
