const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { autoUpdater } = require('electron-updater');
const { ModularUpdater, compareVersions } = require('./modular-updater.cjs');
const {
  surfaceAssetIds: verifiedSurfaceAssetIds,
  verificationObjectAssetIds,
} = require('./verification-assets.cjs');
const developmentRoot = path.join(__dirname, '..', '..');
const runtimeRoot = app.isPackaged ? process.resourcesPath : developmentRoot;
const uassetPipeline = path.join(runtimeRoot, 'UAssetPipeline', 'Build-JLELevel.ps1');
const frameworkVersion = 'jle-uasset-v1';
const verificationLevelId = 'JLE_VERIFICATION_LEVEL';
const verificationResetTime = 999999;
let currentProjectPath = null;
// Keep the user-facing title separate from the stable level ID in the save
// data. This lets an author rename a project without changing its identity.
let currentProjectDisplayName = null;
let verificationInstalledPak = null;
let verificationArtifacts = null;
let sessionLogPath = null;
let mainWindow = null;
let availableEditorUpdate = null;
let updaterConfigured = false;
let updateCheckPromise = null;
let modularUpdater = null;
let modularUpdateOffer = null;
let activePayloadPath = null;
let activePayloadConfirmed = false;
let pendingExternalProjectPath = process.argv.find((argument) => /\.jle$/i.test(argument)) || null;

function sendEditorUpdateState(state) {
  mainWindow?.webContents.send('update:state', state);
}

function releaseNotesText(value) {
  if (typeof value === 'string') return value.slice(0, 12000);
  if (Array.isArray(value)) return value
    .map((entry) => typeof entry === 'string' ? entry : entry?.note || entry?.body || '')
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12000);
  return '';
}

function currentUpdateCheckResult() {
  const fullUpdate = availableEditorUpdate;
  return {
    available: Boolean(modularUpdateOffer || fullUpdate),
    version: modularUpdateOffer?.version || fullUpdate?.version,
    notes: fullUpdate ? releaseNotesText(fullUpdate.releaseNotes) : undefined,
  };
}

function checkForEditorUpdates() {
  if (!app.isPackaged) return Promise.resolve({ available: false });
  // A level-open request must wait for an automatic check already in flight,
  // rather than treating the temporary "checking" state as "no update".
  if (updateCheckPromise) return updateCheckPromise;
  if (updaterConfigured) return Promise.resolve(currentUpdateCheckResult());
  updaterConfigured = true;
  updateCheckPromise = performEditorUpdateCheck().finally(() => { updateCheckPromise = null; });
  return updateCheckPromise;
}

async function performEditorUpdateCheck() {
  try {
    const releaseResponse = await fetch('https://api.github.com/repos/Dave-III/Jetrunner-level-editor/releases/latest', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `JLE/${app.getVersion()}` }, signal: AbortSignal.timeout(8000) });
    if (releaseResponse.ok) {
      const release = await releaseResponse.json();
      const descriptorAsset = release.assets?.find((asset) => asset.name === 'payload-release.json');
      if (descriptorAsset) {
        const descriptorResponse = await fetch(descriptorAsset.browser_download_url);
        const descriptor = descriptorResponse.ok ? await descriptorResponse.json() : null;
        const currentPayloadVersion = (await modularUpdater.readState()).active || app.getVersion();
        const descriptorIsNewer = descriptor?.version && compareVersions(descriptor.version, currentPayloadVersion) > 0;
        if (descriptor?.updateType === 'payload' && descriptorIsNewer) {
          const manifestAsset = release.assets?.find((asset) => asset.name === descriptor.manifestAsset);
          const manifestResponse = manifestAsset && await fetch(manifestAsset.browser_download_url);
          if (manifestResponse?.ok) {
            modularUpdateOffer = { version: descriptor.version, manifest: await manifestResponse.json(), release };
            availableEditorUpdate = null;
            sendEditorUpdateState({ status: 'available', version: descriptor.version, updateType: 'payload', notes: releaseNotesText(release.body) });
            return { available: true, version: descriptor.version, notes: releaseNotesText(release.body) };
          }
        }
        // The release descriptor is authoritative for this launcher. Once
        // the installed payload/launcher version is current, never fall
        // through to electron-updater: its separate feed can retain a stale
        // version and re-offer an update which is already installed.
        if (descriptor?.version && !descriptorIsNewer) {
          availableEditorUpdate = null;
          // Keep the current release's notes available after a restart so the
          // renderer can present them once to someone who has just updated.
          sendEditorUpdateState({ status: 'current', version: descriptor.version, notes: releaseNotesText(release.body) });
          return { available: false, version: currentPayloadVersion, notes: releaseNotesText(release.body) };
        }
      }
    }
  } catch (error) {
    appendApplicationLog('payload-updater-warning', `Payload discovery failed; using full updater fallback: ${error?.stack || error}`);
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  // GitHub release assets can stall indefinitely when electron-updater builds
  // an NSIS differential plan from many byte-range requests. A full installer
  // transfer is less bandwidth-efficient, but reliably reports progress and
  // is the safe fallback for every supported JLE installation.
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.logger = {
    info: (message) => appendApplicationLog('updater', message),
    warn: (message) => appendApplicationLog('updater-warning', message),
    error: (message) => appendApplicationLog('updater-error', message),
    debug: (message) => appendApplicationLog('updater-debug', message),
  };
  autoUpdater.on('error', (error) => {
    mainWindow?.setProgressBar(-1);
    sendEditorUpdateState({ status: 'error' });
    appendApplicationLog('updater-error', error?.stack || error);
  });
  autoUpdater.on('download-progress', ({ percent }) => {
    mainWindow?.setProgressBar(Math.max(0, Math.min(1, percent / 100)));
    sendEditorUpdateState({ status: 'downloading', version: availableEditorUpdate?.version, percent });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    mainWindow?.setProgressBar(-1);
    sendEditorUpdateState({ status: 'downloaded', version: info?.version || availableEditorUpdate?.version });
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Editor update ready',
      message: 'The JETRUNNER Level Editor update is ready to install.',
      detail: 'Install it now? The editor will close and reopen automatically.',
      buttons: ['Install and restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (answer.response === 0) autoUpdater.quitAndInstall(false, true);
  });
  try {
    const result = await autoUpdater.checkForUpdates();
    const available = result?.updateInfo?.version && compareVersions(result.updateInfo.version, app.getVersion()) > 0;
    availableEditorUpdate = available ? result.updateInfo : null;
    sendEditorUpdateState(available
      ? { status: 'available', version: result.updateInfo.version, notes: releaseNotesText(result.updateInfo.releaseNotes) }
      : { status: 'current', version: app.getVersion(), notes: releaseNotesText(result?.updateInfo?.releaseNotes) });
    return {
      available: Boolean(available),
      version: available ? result.updateInfo.version : undefined,
      notes: releaseNotesText(result?.updateInfo?.releaseNotes),
    };
  } catch (error) {
    sendEditorUpdateState({ status: 'error' });
    appendApplicationLog('updater-error', error?.stack || error);
  }
  return { available: false };
}

ipcMain.handle('update:check-now', async () => checkForEditorUpdates());

ipcMain.handle('update:download', async () => {
  if (app.isPackaged && modularUpdateOffer) {
    const offer = modularUpdateOffer;
    try {
      const assetUrls = new Map((offer.release.assets || []).map((asset) => [asset.name, asset.browser_download_url]));
      const result = await modularUpdater.install(offer.manifest, {
        resolveUrl: (file) => assetUrls.get(file.assetName),
        progress: ({ percent }) => sendEditorUpdateState({ status: 'downloading', version: offer.version, percent, updateType: 'payload' }),
        healthCheck: async (candidate) => {
          const html = await fs.readFile(path.join(candidate, 'index.html'), 'utf8');
          if (!/<script[^>]+src=/i.test(html) || !/<div[^>]+id=["']app["']/i.test(html)) return false;
          for (const match of html.matchAll(/(?:src|href)=["']\.\/?([^"'#?]+)["']/gi)) await fs.access(path.join(candidate, ...match[1].split('/')));
          return true;
        },
      });
      modularUpdateOffer = null;
      sendEditorUpdateState({ status: 'downloaded', version: offer.version, updateType: 'payload' });
      const answer = await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Editor update ready', message: `JLE ${offer.version} is installed and verified.`, detail: 'Restart now to use it? The previous editor remains available for recovery.', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1 });
      if (answer.response === 0) { app.relaunch(); app.quit(); }
      return { started: true, updateType: 'payload', result: result.kind };
    } catch (error) {
      appendApplicationLog('payload-updater-error', error?.stack || error);
      sendEditorUpdateState({ status: 'error', detail: error instanceof Error ? error.message : String(error) });
      return { started: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (!app.isPackaged || !availableEditorUpdate) return { started: false };
  sendEditorUpdateState({ status: 'downloading', version: availableEditorUpdate.version, percent: 0 });
  await autoUpdater.downloadUpdate();
  return { started: true };
});

ipcMain.handle('update:recovery-status', async () => ({ ...(await modularUpdater.readState()), root: modularUpdater.root }));
ipcMain.handle('update:rollback', async () => {
  const result = await modularUpdater.rollback();
  if (result.rolledBack) { app.relaunch(); app.quit(); }
  return result;
});
ipcMain.handle('update:open-recovery', async () => shell.openPath(modularUpdater.root));
ipcMain.on('update:payload-ready', () => { activePayloadConfirmed = true; appendApplicationLog('payload-updater', 'Active payload completed renderer startup health handshake.'); });

async function openExternalProject(filePath) {
  if (!filePath || !/\.jle$/i.test(filePath)) return;
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(contents);
    const isCurrentJle = parsed?.format === 'JLE' && parsed?.version === 1;
    const isLegacyJle = parsed?.format === 'jle-level' && parsed?.formatVersion === 1;
    if (/\.jle$/i.test(filePath) && !isCurrentJle && !isLegacyJle) {
      throw new Error('This .JLE file has a malformed or unsupported format/version.');
    }
    if ((!isCurrentJle && !isLegacyJle) || !parsed.editableLevelData) {
      throw new Error('This is not a supported JLE level file.');
    }
    if (isCurrentJle && (parsed.levelId !== parsed.editableLevelData.levelId || parsed.displayName !== parsed.editableLevelData.displayName)) {
      throw new Error('The JLE metadata does not match its editable level data.');
    }
    if (parsed.editableLevelData.projectFormat !== 'jle-editor-project-v1'
        || !Array.isArray(parsed.editableLevelData.assets)) {
      throw new Error('The JLE editable level data is malformed.');
    }
    currentProjectPath = filePath;
    currentProjectDisplayName = parsed.displayName;
    mainWindow?.webContents.send('project:external-open', {
      canceled: false, filePath, projectData: parsed.editableLevelData, installAfterOpen: true,
    });
  } catch (error) {
    mainWindow?.webContents.send('project:external-open', {
      canceled: false, filePath, error: error instanceof Error ? error.message : String(error),
    });
  }
}

ipcMain.handle('app:quit', () => {
  app.quit();
  return { quitting: true };
});

// The preload runs in Electron's sandbox and cannot import local CJS files.
// It requests this immutable snapshot synchronously during bridge setup.
ipcMain.on('verification:supported-assets', (event) => {
  event.returnValue = [...new Set([
    ...verificationObjectAssetIds,
    'player_start',
    'time_trial_goal',
  ])];
});

function packagedReleaseRoot() {
  const executableDirectory = path.dirname(process.execPath);
  return path.basename(executableDirectory).toLowerCase() === 'runtime'
    ? path.dirname(executableDirectory)
    : executableDirectory;
}

function savedLevelsDirectory() {
  return path.join(app.getPath('documents'), 'Jetrunner Level Editor', 'Levels');
}

function logsDirectory(category) {
  const root = path.join(app.getPath('documents'), 'Jetrunner Level Editor', 'Logs');
  return category ? path.join(root, category) : root;
}

function levelOutputDirectory() {
  return path.join(app.getPath('documents'), 'Jetrunner Level Editor', 'Output');
}

function pipelineWorkspaceDirectory() {
  return path.join(app.getPath('userData'), 'PipelineWorkspace');
}

async function retainNewestLogs(directory, maximum = 5) {
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const logs = await Promise.all(entries
    .filter((entry) => entry.isFile() && /\.log$/i.test(entry.name))
    .map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      return { filePath, mtimeMs: (await fs.stat(filePath)).mtimeMs };
    }));
  logs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  await Promise.all(logs.slice(maximum).map(({ filePath }) => fs.rm(filePath, { force: true })));
}

function appendApplicationLog(source, message) {
  if (!sessionLogPath) return;
  const line = `[${new Date().toISOString()}] [${source}] ${String(message)}\n`;
  void fs.appendFile(sessionLogPath, line, 'utf8').catch(() => {});
}

async function captureLatestJETRUNNERLog() {
  const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  const gameLogs = path.join(localAppData, 'JETRUNNER', 'Saved', 'Logs');
  let entries;
  try {
    entries = await fs.readdir(gameLogs, { withFileTypes: true });
  } catch {
    return null;
  }
  let latest = null;
  for (const entry of entries) {
    if (!entry.isFile() || !/\.log$/i.test(entry.name)) continue;
    const source = path.join(gameLogs, entry.name);
    const stat = await fs.stat(source);
    if (!latest || stat.mtimeMs > latest.mtimeMs) latest = { source, mtimeMs: stat.mtimeMs };
  }
  if (!latest) return null;
  const directory = logsDirectory('Game');
  await fs.mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destination = path.join(directory, `JETRUNNER-latest--${stamp}.log`);
  await fs.copyFile(latest.source, destination);
  await retainNewestLogs(directory, 5);
  return destination;
}

async function availableProjectPath(saveDirectory, displayName) {
  const safeName = String(displayName || 'Unnamed Level')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Unnamed_Level';
  let suffix = 0;
  while (true) {
    const numberedName = suffix === 0 ? safeName : `${safeName}_${suffix}`;
    const candidate = path.join(saveDirectory, `${numberedName}.jle`);
    try {
      await fs.access(candidate);
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

async function renamedProjectPath(saveDirectory, displayName) {
  const destination = await availableProjectPath(saveDirectory, displayName);
  if (!currentProjectPath || path.resolve(destination) === path.resolve(currentProjectPath)) return destination;
  await fs.rename(currentProjectPath, destination);
  return destination;
}
const surfaceAssetIds = new Set(verifiedSurfaceAssetIds);
const allowedAssetIds = new Set(verificationObjectAssetIds);
const allowedEnvironments = new Set([
  '',
  'Environment_CentralPark', 'Environment_NewYorkSubway',
  'Env_Rio_FreeOfCorruption', 'Environment_Skypiercer',
  'Environment_Skypiercer_CityCapture_Mumbai_Bitmap',
  'Environment_Geiranger', 'Environment_Seoul',
  'Backdrop_Peony_Mountainrange_ProcPlusLandscape',
  'Scenario_RainbowDimension',
]);
const allowedTimesOfDay = new Set([
  '',
  'Scenario_YankeyDoodleMorning', 'Scenario_YankeyDoodleDay',
  'Scenario_TheNightThatNeverSleeps', 'Scenario_CityStorm',
  'Scenario_GoldenFall', 'Scenario_YankeyWinter', 'Scenario_WinterNight',
  'Scenario_Subway', 'Scenario_EtheralSubway', 'Scenario_SubwayRave',
  'Scenario_Rio_Dawn', 'Scenario_TropicDay', 'Scenario_TropicEvening',
  'Scenario_Rio_Night', 'Scenario_CarnivalDay',
  'Scenario_MumbaiMorning', 'Scenario_MumbaiDay', 'Scenario_MumbaiEvening',
  'Scenario_DayAboveTheClouds', 'Scenario_NightAboveTheClouds',
  'Scenario_IdylicSpringMorning', 'Scenario_IdylicSpringDay',
  'Scenario_IdylicDay', 'Scenario_IdylicEvening', 'Scenario_IdylicNight',
  'Scenario_IdylicMorning', 'Scenario_FortMorning', 'Scenario_VibrantDay',
  'Scenario_DauntingEvening', 'Scenario_PurpleDay', 'Scenario_PurpleNight',
  'Scenario_MistyMorning', 'Scenario_MistyMountainDay',
  'Scenario_MistyEvening', 'Scenario_MistyNight', 'Scenario_MistyDay',
  'Scenario_MistyHalloween', 'Scenario_Virtual_WhiteCity',
  'Scenario_Virtual_MoonRiver', 'Scenario_Virtual_SynthCity',
  'Scenario_Virtual_Aurora', 'Scenario_Virtual_CyberStadium',
  'Scenario_Virtual_Mountains',
]);
const shippedLevelDefinitions = `AmmoClimb ArmsRace Belfries Bombardier BreakSpeed ComingThrough CoolCoolMountain Cooldown CrossIce Disco DoubleTrouble DreamsEnd EnterJetFreeze EnterJetHook EnterJetLeap EnterJetSlam Escalation Facade Fastlane Fortress GripAndSlide Harbor Highroller HighTech HookJungle Hopper Iceberg IceClimber IceIsNice Infiltration JetValley KeepItCool Kickoff Limbo Lobby OnTheRopes Pillars PolarShift Reinforcements RimeRim RiseAndFall RoundRave SacredGrounds Serenity Shutdown Skater Skydiving Spire StageFright StageSet TheCrevasse TheDistance TheGreatWall TheOldTracks TheSummit ThroughTheWindow TowerWithin Unstopable Watchtower Dev_Ready Garbage_Downhill Garbage_DualTowers Garbage_EM14 Garbage_LyuFjord4 Garbage_LyusWelcome Garbage_WhyLyu Havi_Labyrinth Havi_LazerMazer Havi_Run Havi_TheCage Havi_Void Havi_WallRunner Map_Museum_CentralPark_Fall_Lyu3 Museum_Concept_LyuJam1 Museum_Havi_TheBend Museum_Prototyping_Mille_01 Museum_Vegard_Concept_Levels_001 Museum_Vegard_Concept_Levels_003 Puzzle_ChoiceOfUntoldConsequences Puzzle_MazeOfTheCuriousTraveler Puzzle_PathOfTheTrueBeliever Puzzle_QuestionOfDauntingImportance Puzzle_TowerOfHopesAndDreams Puzzle_WallsOfProfoundRumination Recycling_BlastCircuit Recycling_Flyer Recycling_Highrise Recycling_Leaper Recycling_NotReady Recycling_Roundabout Tryhard_ArenaCanals Tryhard_ArenaForgottenLands Tryhard_ArenaFortNight Tryhard_ArenaTowers Tryhard_HighBar Tryhard_PunchingCranes`;
const canonicalLevelName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const reservedLevelNames = new Set();
for (const definitionName of shippedLevelDefinitions.split(/\s+/)) {
  reservedLevelNames.add(canonicalLevelName(definitionName));
  const parts = definitionName.split('_');
  if (parts.length > 1) reservedLevelNames.add(canonicalLevelName(parts.at(-1)));
}
reservedLevelNames.add(canonicalLevelName('Verification'));

function assertFiniteTransform(name, transform) {
  for (const group of ['position', 'rotation', 'scale']) {
    if (!transform || !transform[group]) throw new Error(`${name} is missing ${group}.`);
    for (const axis of ['x', 'y', 'z']) {
      const key = group === 'rotation' ? { x: 'pitch', y: 'yaw', z: 'roll' }[axis] : axis;
      if (!Number.isFinite(transform[group][key])) {
        throw new Error(`${name} has an invalid ${group}.${key}.`);
      }
    }
  }
  if (transform.scale.x === 0 || transform.scale.y === 0 || transform.scale.z === 0) {
    throw new Error(`${name} cannot have a zero scale axis.`);
  }
}

function validateWorkingLevelContract(levelData) {
  if (!levelData || typeof levelData !== 'object') throw new Error('Level data is missing.');
  if (levelData.frameworkVersion !== frameworkVersion) {
    throw new Error(`Unsupported level framework. Expected ${frameworkVersion}.`);
  }
  if (
    typeof levelData.levelId !== 'string'
    || (!/^jle_[0-9a-f-]{36}$/i.test(levelData.levelId) && levelData.levelId !== verificationLevelId)
  ) {
    throw new Error('The level is missing its stable custom level ID.');
  }
  const isInternalVerification = levelData.levelId === verificationLevelId
    && canonicalLevelName(levelData.displayName) === canonicalLevelName('Verification');
  if (reservedLevelNames.has(canonicalLevelName(levelData.displayName)) && !isInternalVerification) {
    throw new Error(`“${levelData.displayName}” is an official JETRUNNER level name. Choose a unique custom name so it cannot share that level's leaderboard.`);
  }
  const settings = levelData.worldSettings;
  if (!settings || settings.defaultRuleset !== '/Flashback/Rulesets/TimeTrial/Ruleset_TimeTrial.Ruleset_TimeTrial') {
    throw new Error('The working TimeTrial ruleset is required.');
  }
  const validLeaderboardId = settings.leaderboardId === levelData.levelId
    || new RegExp(`^${levelData.levelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_[0-9a-f]{8}$`, 'i')
      .test(settings.leaderboardId);
  if (!validLeaderboardId) {
    throw new Error('The editor leaderboard ID does not match this level UUID and content revision.');
  }
  if (settings.isMenuWorld !== false) throw new Error('isMenuWorld must be false.');
  if (!allowedEnvironments.has(settings.environment)) {
    throw new Error('Select a supported JETRUNNER environment.');
  }
  if (settings.environment === 'Environment_NewYorkSubway'
      && settings.subwayLayout !== undefined
      && !['roof', 'two-layer'].includes(settings.subwayLayout)) {
    throw new Error('Select a supported subway roof layout.');
  }
  if (!allowedTimesOfDay.has(settings.timeOfDay)
      || settings.skybox !== settings.timeOfDay) {
    throw new Error('Select a supported JETRUNNER time of day.');
  }
  if (!levelData.playerStart) throw new Error('Exactly one Player Start is required.');
  if (levelData.playerStart.gameModeGameplayTag !== 'TimeTrial') {
    throw new Error('Player Start must use the TimeTrial gameplay tag.');
  }
  assertFiniteTransform('Player Start', { ...levelData.playerStart, scale: { x: 1, y: 1, z: 1 } });
  const goals = Array.isArray(levelData.timeTrialGoals) && levelData.timeTrialGoals.length > 0
    ? levelData.timeTrialGoals
    : levelData.timeTrialGoal ? [levelData.timeTrialGoal] : [];
  if (goals.length === 0) throw new Error('At least one Finish Goal is required.');
  goals.forEach((goal, index) => {
    const label = goals.length === 1 ? 'Finish Goal' : `Finish Goal ${index + 1}`;
    assertFiniteTransform(label, goal);
    const goalScale = goal.scale;
    if (
      Math.abs(goalScale.x - goalScale.y) > 0.0001
      || Math.abs(goalScale.x - goalScale.z) > 0.0001
    ) {
      throw new Error(`${label} scale must be uniform on X, Y, and Z.`);
    }
  });
  if (!Array.isArray(levelData.objects) || levelData.objects.length === 0) {
    throw new Error('At least one collision platform is required.');
  }
  let platformCount = 0;
  levelData.objects.forEach((object, index) => {
    if (!object || !allowedAssetIds.has(object.assetId)) {
      const assetId = typeof object?.assetId === 'string' ? object.assetId : 'missing';
      const displayName = typeof object?.assetLabel === 'string' && object.assetLabel.trim()
        ? ` '${object.assetLabel.trim()}'`
        : '';
      throw new Error(`Object ${index + 1}${displayName} uses unsupported AssetId '${assetId}'.`);
    }
    if (surfaceAssetIds.has(object.assetId)) platformCount += 1;
    assertFiniteTransform(`Object ${index + 1}`, object);
  });
  if (platformCount === 0) throw new Error('At least one supported collision platform is required for gameplay.');
}

function runCommand(file, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    const attach = (stream, target, source) => {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        target.push(chunk);
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || '';
        for (const line of lines) if (line.trim()) onLine(source, line);
      });
      stream.on('end', () => {
        if (pending.trim()) onLine(source, pending);
      });
    };
    attach(child.stdout, stdout, 'stdout');
    attach(child.stderr, stderr, 'stderr');
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10 * 60 * 1000);
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Could not start '${file}': ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const result = { stdout: stdout.join(''), stderr: stderr.join(''), exitCode: code };
      if (timedOut) {
        const error = new Error(`Command timed out after 10 minutes: ${file}`);
        error.result = result;
        reject(error);
      } else if (code === 0) resolve(result);
      else {
        const error = new Error(`Pipeline exited with code ${code}.`);
        error.result = result;
        reject(error);
      }
    });
  });
}

ipcMain.handle('project:save', async (_event, projectData) => {
  try {
    if (!projectData || projectData.projectFormat !== 'jle-editor-project-v1') {
      throw new Error('The editor project data is invalid.');
    }
    if (canonicalLevelName(projectData.displayName) === canonicalLevelName('Verification')) {
      throw new Error('“Verification” is reserved for the internal verification level. Choose another level name.');
    }
    // Loaded projects stay beside their original file. New projects use the
    // canonical Saved Levels directory. A rename changes only the filename,
    // never the level's storage location or identity.
    const saveDirectory = currentProjectPath ? path.dirname(currentProjectPath) : savedLevelsDirectory();
    await fs.mkdir(saveDirectory, { recursive: true });
    if (!currentProjectPath) {
      currentProjectPath = await availableProjectPath(saveDirectory, projectData.displayName);
      currentProjectDisplayName = projectData.displayName;
      appendApplicationLog('project', `Created project path: ${currentProjectPath}`);
    } else if (projectData.displayName !== currentProjectDisplayName) {
      const previousPath = currentProjectPath;
      currentProjectPath = await renamedProjectPath(saveDirectory, projectData.displayName);
      currentProjectDisplayName = projectData.displayName;
      appendApplicationLog('project', `Renamed project file: ${previousPath} -> ${currentProjectPath}`);
    }
    const shareableFile = /\.json$/i.test(currentProjectPath)
      ? projectData
      : {
        format: 'JLE',
        version: 1,
        levelId: projectData.levelId,
        displayName: projectData.displayName,
        editableLevelData: projectData,
      };
    await fs.writeFile(
      currentProjectPath,
      `${JSON.stringify(shareableFile, null, 2)}\n`,
      'utf8',
    );
    return { canceled: false, filePath: currentProjectPath };
  } catch (error) {
    return { canceled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('project:load', async (event) => {
  try {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const defaultPath = savedLevelsDirectory();
    await fs.mkdir(defaultPath, { recursive: true });
    const selection = await dialog.showOpenDialog(owner, {
      title: 'Load a saved JETRUNNER level',
      defaultPath,
      properties: ['openFile'],
      filters: [{ name: 'JETRUNNER levels', extensions: ['jle', 'json'] }],
    });
    if (selection.canceled || selection.filePaths.length === 0) return { canceled: true };
    const filePath = selection.filePaths[0];
    appendApplicationLog('load', `[LOAD] Opening: ${filePath}`);
    const contents = await fs.readFile(filePath, 'utf8');
    appendApplicationLog('load', '[LOAD] File read');
    const parsed = JSON.parse(contents);
    const isCurrentJle = parsed?.format === 'JLE' && parsed?.version === 1;
    const isLegacyJle = parsed?.format === 'jle-level' && parsed?.formatVersion === 1;
    if (/\.jle$/i.test(filePath) && !isCurrentJle && !isLegacyJle) {
      throw new Error('This .JLE file has a malformed or unsupported format/version.');
    }
    const projectData = parsed?.format === 'JLE' && parsed?.version === 1
      ? parsed.editableLevelData
      : parsed?.format === 'jle-level' && parsed?.formatVersion === 1
        ? parsed.editableLevelData : parsed;
    appendApplicationLog('load', `[LOAD] JSON parsed; schema=${projectData?.projectFormat || 'missing'}; objects=${Array.isArray(projectData?.assets) ? projectData.assets.length : 'invalid'}`);
    const isLegacyCompilerJson = projectData?.frameworkVersion === 'jle-uasset-v1'
      && Array.isArray(projectData?.objects)
      && projectData?.playerStart;
    if (!projectData || (projectData.projectFormat !== 'jle-editor-project-v1' && !isLegacyCompilerJson)) {
      throw new Error('This is not a supported JETRUNNER editor save.');
    }
    currentProjectPath = filePath;
    currentProjectDisplayName = projectData.displayName || null;
    appendApplicationLog('load', `[LOAD] IPC complete: ${filePath}`);
    return { canceled: false, filePath, projectData };
  } catch (error) {
    appendApplicationLog('load-error', error instanceof Error ? error.stack || error.message : String(error));
    return { canceled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('project:load-recent', async (_event, filePath) => {
  try {
    appendApplicationLog('load', `[LOAD] Opening recent: ${filePath}`);
    const contents = await fs.readFile(filePath, 'utf8');
    appendApplicationLog('load', '[LOAD] File read');
    const parsed = JSON.parse(contents);
    const projectData = parsed?.format === 'JLE' && parsed?.version === 1
      ? parsed.editableLevelData
      : parsed?.format === 'jle-level' && parsed?.formatVersion === 1
        ? parsed.editableLevelData : parsed;
    appendApplicationLog('load', `[LOAD] JSON parsed; schema=${projectData?.projectFormat || 'missing'}; objects=${Array.isArray(projectData?.assets) ? projectData.assets.length : 'invalid'}`);
    const isLegacyCompilerJson = projectData?.frameworkVersion === 'jle-uasset-v1'
      && Array.isArray(projectData?.objects)
      && projectData?.playerStart;
    if (!projectData || (projectData.projectFormat !== 'jle-editor-project-v1' && !isLegacyCompilerJson)) {
      throw new Error('This is not a supported JETRUNNER editor save.');
    }
    currentProjectPath = filePath;
    currentProjectDisplayName = projectData.displayName || null;
    appendApplicationLog('load', `[LOAD] Recent IPC complete: ${filePath}`);
    return { canceled: false, filePath, projectData };
  } catch (error) {
    appendApplicationLog('load-error', `${filePath}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    return { canceled: false, missing: error?.code === 'ENOENT', error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('project:new', async () => {
  currentProjectPath = null;
  currentProjectDisplayName = null;
  appendApplicationLog('project', 'Started a new unsaved project.');
  return { ready: true };
});

async function directoryExists(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

const jetrunnerRelativePaks = path.join('JETRUNNER', 'Content', 'Paks');
const jetrunnerRelativeExecutable = path.join('JETRUNNER', 'Binaries', 'Win64', 'JetrunnerGame.exe');

async function validateJETRUNNERPaks(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  const possiblePaks = [
    resolved,
    path.join(resolved, jetrunnerRelativePaks),
  ];
  for (const gamePaksDirectory of possiblePaks) {
    if (!await directoryExists(gamePaksDirectory)) continue;
    const gameRoot = gameInstallRootFromPaks(gamePaksDirectory);
    try {
      const executable = await fs.stat(path.join(gameRoot, jetrunnerRelativeExecutable));
      if (executable.isFile() && executable.size > 1024) return gamePaksDirectory;
    } catch {
      // A folder named JETRUNNER is not sufficient; keep checking candidates.
    }
  }
  return null;
}

async function steamInstallRoots() {
  const roots = new Set([
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam'),
  ]);
  const powerShell = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
  );
  try {
    const registry = await runCommand(powerShell, [
      '-NoProfile', '-NonInteractive', '-Command',
      "(Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath",
    ], () => {});
    const registryRoot = String(registry.stdout || '').trim();
    if (registryRoot) roots.add(registryRoot.replace(/\//g, '\\'));
  } catch {
    // Steam can be absent or its registry key unavailable.
  }
  for (const steamRoot of [...roots]) {
    try {
      const libraryVdf = await fs.readFile(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const match of libraryVdf.matchAll(/"path"\s+"([^"]+)"/g)) {
        roots.add(match[1].replace(/\\\\/g, '\\'));
      }
    } catch {
      // Not every candidate is a Steam root.
    }
  }
  return [...roots];
}

async function findJETRUNNERPaks() {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    const remembered = await validateJETRUNNERPaks(settings.gamePaksDirectory);
    if (remembered) return remembered;
  } catch {
    // First launch or an outdated setting; continue with Steam discovery.
  }

  for (const steamRoot of await steamInstallRoots()) {
    const candidate = path.join(
      steamRoot, 'steamapps', 'common', 'JETRUNNER', 'JETRUNNER', 'Content', 'Paks',
    );
    const validated = await validateJETRUNNERPaks(candidate);
    if (validated) return validated;
  }
  return null;
}

async function rememberJETRUNNERPaks(gamePaksDirectory) {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  let settings = {};
  try { settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch {}
  settings.gamePaksDirectory = gamePaksDirectory;
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function normalizeGameLauncher(value) {
  return value === 'epic' || value === 'steam' ? value : 'steam';
}

async function gameLauncherPreference() {
  try {
    const settings = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf8'));
    return normalizeGameLauncher(settings.gameLauncher);
  } catch {
    return 'steam';
  }
}

ipcMain.handle('game:get-launcher', async () => ({ launcher: await gameLauncherPreference() }));
ipcMain.handle('game:set-launcher', async (_event, launcher) => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  let settings = {};
  try { settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch {}
  settings.gameLauncher = normalizeGameLauncher(launcher);
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return { launcher: settings.gameLauncher };
});

// Only these executable names, inside the JETRUNNER installation selected by
// the user, are eligible for termination. This prevents the editor from ever
// closing an unrelated process with a similar name.
const jetrunnerProcessNames = [
  // Current Steam build.
  'JetrunnerGame.exe',
  // Preserve compatibility with older/public executable names.
  'JETRUNNER.exe',
  'JETRUNNER-Win64-Shipping.exe',
];

function gameInstallRootFromPaks(gamePaksDirectory) {
  // <install>/JETRUNNER/Content/Paks -> <install>
  return path.resolve(gamePaksDirectory, '..', '..', '..');
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findRunningJETRUNNERProcesses(gamePaksDirectory, options = {}) {
  const requireInstallPath = options.requireInstallPath !== false;
  const gameRoot = gameInstallRootFromPaks(gamePaksDirectory);
  const powerShell = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
  );
  const nameFilters = jetrunnerProcessNames.map((name) => `Name = '${name}'`).join(' OR ');
  const command = [
    `$gameRoot = [IO.Path]::GetFullPath(${JSON.stringify(gameRoot)}).TrimEnd('\\')`,
    `$requireInstallPath = $${requireInstallPath ? 'true' : 'false'}`,
    `Get-CimInstance Win32_Process -Filter ${JSON.stringify(nameFilters)} | Where-Object {`,
    '  -not $requireInstallPath -or ($_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).StartsWith($gameRoot, [StringComparison]::OrdinalIgnoreCase))',
    '} | ForEach-Object { [string]::Concat($_.ProcessId, [char]124, $_.Name, [char]124, $_.ExecutablePath) }',
  ].join('; ');
  // -EncodedCommand avoids Windows command-line quote stripping around the
  // CIM filter and executable path (both can contain spaces).
  const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
  const result = await runCommand(powerShell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand], () => {});
  return String(result.stdout || '').split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pid, name, executablePath = ''] = line.split('|');
      return { pid: Number(pid), name, executablePath };
    })
    .filter((candidate) => Number.isInteger(candidate.pid)
      && jetrunnerProcessNames.some((name) => name.toLowerCase() === candidate.name.toLowerCase()));
}

async function ensureJETRUNNERIsClosed(gamePaksDirectory, status, consoleLine) {
  const running = await findRunningJETRUNNERProcesses(gamePaksDirectory);
  if (running.length === 0) return;

  const summary = running.map(({ name, pid }) => `${name} (PID ${pid})`).join(', ');
  status('preflight', 'JETRUNNER detected — closing the game before replacing its custom-level pak...');
  consoleLine('preflight', `Requesting clean JETRUNNER shutdown: ${summary}`);
  const powerShell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  for (const { pid } of running) {
    try {
      await runCommand(powerShell, [
        '-NoProfile', '-NonInteractive', '-Command',
        `$process = Get-Process -Id ${pid} -ErrorAction Stop; if (-not $process.CloseMainWindow()) { exit 2 }`,
      ], consoleLine);
    } catch (error) {
      const remaining = await findRunningJETRUNNERProcesses(gamePaksDirectory);
      if (remaining.some((process) => process.pid === pid)) {
        throw new Error('JETRUNNER must be closed normally before JLE can replace its level pak. Close it from its menu, then retry.');
      }
    }
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await findRunningJETRUNNERProcesses(gamePaksDirectory)).length === 0) {
      status('preflight', 'JETRUNNER closed. Continuing with pak packaging and installation.');
      consoleLine('preflight', 'Confirmed that JETRUNNER has exited.');
      return;
    }
    await pause(250);
  }
  throw new Error('JETRUNNER did not finish its clean shutdown. Close it normally and wait a moment before retrying so its shader cache can be saved.');
}

async function assertReadableFile(filePath, label, minimumBytes = 1) {
  if (!filePath) throw new Error(`${label} path was not returned by the pipeline.`);
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < minimumBytes) {
      throw new Error(`${label} is missing or unexpectedly small: ${filePath}`);
    }
    return stat;
  } finally {
    await handle.close();
  }
}

async function findJetSaveFiles() {
  const localAppData = process.env.LOCALAPPDATA
    || path.join(app.getPath('home'), 'AppData', 'Local');
  const root = path.join(localAppData, 'JETRUNNER', 'Saved', 'SaveGames');
  const found = [];
  async function walk(directory) {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(candidate);
      else if (/^JetSaveGame\.sav$/i.test(entry.name)) found.push(candidate);
    }
  }
  await walk(root);
  return found;
}

function findBestTimeOffset(buffer, levelId = verificationLevelId) {
  const identity = Buffer.from(`${levelId}LB1\0`, 'utf8');
  let identityAt = buffer.indexOf(identity);
  while (identityAt >= 0) {
    const end = Math.min(buffer.length, identityAt + 2048);
    const bestAt = buffer.indexOf(Buffer.from('BestTime\0', 'utf8'), identityAt + identity.length);
    if (bestAt >= 0 && bestAt < end) {
      const typeAt = buffer.indexOf(Buffer.from('FloatProperty\0', 'utf8'), bestAt);
      if (typeAt >= 0 && typeAt < end) {
        // UE5 writes four tag bytes, a five-byte FloatProperty size/type
        // trailer, then the little-endian float value.
        const valueOffset = typeAt + Buffer.byteLength('FloatProperty\0') + 9;
        if (valueOffset + 4 <= buffer.length) {
          const candidate = buffer.readFloatLE(valueOffset);
          if (Number.isFinite(candidate) && candidate >= 0) return valueOffset;
        }
      }
    }
    identityAt = buffer.indexOf(identity, identityAt + identity.length);
  }
  return -1;
}

async function readVerificationBestTime() {
  const candidates = await findJetSaveFiles();
  let latest = null;
  for (const filePath of candidates) {
    const stat = await fs.stat(filePath);
    if (!latest || stat.mtimeMs > latest.mtimeMs) latest = { filePath, mtimeMs: stat.mtimeMs };
  }
  if (!latest) return { found: false };
  const buffer = await fs.readFile(latest.filePath);
  const offset = findBestTimeOffset(buffer);
  if (offset < 0) return { found: false, savePath: latest.filePath };
  const time = buffer.readFloatLE(offset);
  return {
    found: Number.isFinite(time) && time > 0 && time < verificationResetTime,
    time,
    savePath: latest.filePath,
    offset,
  };
}

async function prepareVerificationSave() {
  const existing = await readVerificationBestTime();
  if (!existing.savePath || existing.offset === undefined) return false;
  const backupDirectory = path.join(savedLevelsDirectory(), 'Verification Backups');
  await fs.mkdir(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copyFile(existing.savePath, path.join(backupDirectory, `JetSaveGame-${stamp}.sav`));
  const buffer = await fs.readFile(existing.savePath);
  buffer.writeFloatLE(verificationResetTime, existing.offset);
  await fs.writeFile(existing.savePath, buffer);
  return true;
}

async function exportAndCompile(event, levelData, options = {}) {
  let activeStage = 'level validation';
  const status = (stage, message) => {
    if (!['console', 'error', 'complete'].includes(stage)) activeStage = stage;
    event.sender.send('level:pipeline-status', { stage, message });
  };
  try {
    validateWorkingLevelContract(levelData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    status('error', message);
    return { canceled: false, pipelineError: message };
  }
  const exportDirectory = path.join(app.getPath('documents'), 'JETRUNNER Level Editor', 'Levels');
  await fs.mkdir(exportDirectory, { recursive: true });
  const safeLevelName = String(levelData.levelName || 'Unnamed_Level').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeLevelId = String(levelData.levelId || 'unassigned').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const exportPath = path.join(exportDirectory, `${safeLevelName}--${safeLevelId}.json`);
  const json = `${JSON.stringify(levelData, null, 2)}\n`;
  await fs.writeFile(exportPath, json, 'utf8');
  const logDirectory = logsDirectory('Pipeline');
  await fs.mkdir(logDirectory, { recursive: true });
  const logStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logDirectory, `${safeLevelName}--${logStamp}.log`);
  const logLines = [];
  const friendlyPipelineText = (source, rawMessage) => {
    const message = String(rawMessage || '').trim();
    if (!message) return null;
    if (/^\{.*"Success"\s*:\s*true.*\}$/i.test(message)) return null;
    if (/^\s*at\s+\S+|FullyQualifiedErrorId|CategoryInfo\s*:|^\s*(?:\+\s|~{3,}|\d+\s+\|)/i.test(message)) return null;
    const replacements = [
      [/^Creating the tokenized/i, 'Preparing the level data'],
      [/^Converting (.+?)\.json/i, 'Converting $1 into a JETRUNNER asset'],
      [/^Packaging the V11 pak/i, 'Packaging the finished level'],
      [/^Installing JLE output/i, 'Installing the level into JETRUNNER'],
      [/unsupported AssetId/i, 'An object in this level is not supported by the installed CustomLevels framework. Fix: remove or replace that object, or install the matching CustomLevels framework manually.'],
      [/JLE build workspace.*(?:Program Files|access.*denied)|Program Files.*UAssetPipeline.*(?:Projects|Packaging)/i, 'JLE cannot write to the old Program Files build workspace. Fix: install the latest JLE update. Temporary workaround: right-click JLE and choose Run as administrator.'],
      [/is locked or unavailable/i, 'The JLE build workspace is temporarily locked. Fix: close any other JLE packaging attempt, wait a moment, then retry.'],
      [/being used by another process/i, 'A required file is temporarily in use. Fix: close JETRUNNER and any other JLE packaging attempt, then retry.'],
      [/access.*denied|access to the path.*is denied/i, 'Windows denied access to a required location. Fix: check folder permissions and antivirus protection; for an old Program Files installation, run JLE as administrator or update it.'],
      [/timed out/i, 'A packaging tool stopped responding. Fix: check for antivirus/security prompts, close them if present, then retry.'],
      [/could not start|is not recognized as an internal or external command/i, 'A bundled packaging tool could not be started. Fix: reinstall or update JLE, then retry.'],
      [/produced no map asset/i, 'The converter did not create the map asset. Fix: update or reinstall JLE; if this continues, share the pipeline log with the level author.'],
      [/produced no LevelDef asset/i, 'The converter did not create the level definition. Fix: update or reinstall JLE; if this continues, share the pipeline log with the level author.'],
      [/JETRUNNER did not finish its clean shutdown|running JETRUNNER process/i, 'JETRUNNER is still closing or running. Fix: close JETRUNNER completely, wait a moment for it to finish, then retry.'],
      [/Dweeb's CustomLevels mod was not found/i, "The required CustomLevels framework is missing. Fix: manually install it in JETRUNNER\\Content\\Paks\\JLE, then retry."],
    ];
    let friendly = message;
    for (const [pattern, replacement] of replacements) {
      if (pattern.test(message)) {
        friendly = replacement.includes('$') ? message.replace(pattern, replacement) : replacement;
        break;
      }
    }
    const label = source === 'stderr' || source === 'error' ? 'Problem'
      : source === 'preflight' ? 'Check'
        : source === 'pipeline' ? 'JLE'
          : 'Step';
    return `[${label}] ${friendly}`;
  };
  const consoleLine = (source, message) => {
    if (source === 'stdout') {
      if (/^Creating the tokenized/i.test(message)) activeStage = 'compilation';
      else if (/^Converting /i.test(message)) activeStage = 'UAsset conversion';
      else if (/^Packaging the V11 pak/i.test(message)) activeStage = 'pak generation';
      else if (/^Installing JLE output/i.test(message)) activeStage = 'pak installation';
    }
    const rawLine = `[${new Date().toLocaleTimeString()}] [${source}] ${message}`;
    logLines.push(rawLine);
    const friendlyLine = friendlyPipelineText(source, message);
    if (friendlyLine) status('console', friendlyLine);
    if (source === 'stderr') console.error(rawLine);
    else console.log(rawLine);
  };
  consoleLine('pipeline', `Export JSON: ${exportPath}`);
  consoleLine('pipeline', `Log file: ${logPath}`);

  try {
    let gamePaks = await findJETRUNNERPaks();
    if (!gamePaks) {
      const owner = BrowserWindow.fromWebContents(event.sender);
      const selection = await dialog.showOpenDialog(owner, {
        title: 'Select the JETRUNNER game folder or Content\\Paks folder',
        properties: ['openDirectory'],
      });
      if (selection.canceled || selection.filePaths.length === 0) {
        return { canceled: true, filePath: exportPath };
      }
      gamePaks = await validateJETRUNNERPaks(selection.filePaths[0]);
      if (!gamePaks) {
        throw new Error('The selected folder is not a valid JETRUNNER installation. Select the JETRUNNER folder or its JETRUNNER\\Content\\Paks folder.');
      }
    }
    await rememberJETRUNNERPaks(gamePaks);

    // Both normal export/install and verification use this shared path. Do
    // not let the packager replace an installed pak while the game owns it.
    await ensureJETRUNNERIsClosed(gamePaks, status, consoleLine);
    status('compile', 'Writing the UAssetAPI map and LevelDef JSON...');
    const powerShell = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
    );
    const result = await runCommand(powerShell, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', uassetPipeline,
      '-LevelData', exportPath,
      '-GamePaksDirectory', gamePaks,
      '-WorkspaceRoot', pipelineWorkspaceDirectory(),
      '-NodePath', process.execPath,
      '-NodeIsElectron',
    ], consoleLine);
    const outputLines = String(result.stdout || '').trim().split(/\r?\n/).reverse();
    const payloadLine = outputLines.find((line) => line.startsWith('{') && line.endsWith('}'));
    if (!payloadLine) {
      throw new Error(`The UAsset pipeline returned no completion record. ${result.stderr || result.stdout || ''}`);
    }
    const payload = JSON.parse(payloadLine);
    status('install', 'Verifying generated and installed pak files...');
    await assertReadableFile(payload.Pak, 'Generated pak', 1024);
    await assertReadableFile(payload.InstalledPak, 'Installed pak', 1024);
    consoleLine('pipeline', `Installed pak: ${payload.InstalledPak}`);
    let publishedPak = payload.Pak;
    if (!options.temporary) {
      const outputDirectory = levelOutputDirectory();
      await fs.mkdir(outputDirectory, { recursive: true });
      publishedPak = path.join(outputDirectory, path.basename(payload.Pak));
      await fs.copyFile(payload.Pak, publishedPak);
      await assertReadableFile(publishedPak, 'Published pak', 1024);
      consoleLine('pipeline', `Output pak: ${publishedPak}`);
    }
    status('complete', 'Level converted, packaged, and installed successfully.');
    if (!options.temporary) shell.showItemInFolder(publishedPak);
    return {
      canceled: false,
      filePath: exportPath,
      outputPak: publishedPak,
      installedPak: payload.InstalledPak,
      // Preserve the canonical Content/Paks directory selected or discovered
      // above. Verification paks live several folders beneath it, so the
      // install root cannot be reconstructed safely from InstalledPak.
      gamePaksDirectory: gamePaks,
      logPath,
      levelId: levelData.levelId,
      temporary: Boolean(options.temporary),
    };
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const stderr = String(error?.result?.stderr || '').trim();
    const detail = stderr ? ` ${stderr.slice(-1200)}` : '';
    const message = `${activeStage} failed: ${baseMessage}${detail}`;
    consoleLine('error', message);
    status('error', `${activeStage} failed. The console explains what happened and the full diagnostic log is saved at ${logPath}`);
    return { canceled: false, filePath: exportPath, pipelineError: message, logPath };
  } finally {
    // The pipeline needs a plain JSON file while generating the pak, but the
    // user's editable level is the .jle project. Do not leave this temporary
    // compiler input beside their saved projects after the run finishes.
    await fs.rm(exportPath, { force: true }).catch((error) => {
      consoleLine('cleanup', `Could not remove temporary compiler JSON: ${error instanceof Error ? error.message : String(error)}`);
    });
    await fs.writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
    await retainNewestLogs(logDirectory, 5);
  }
}

ipcMain.handle('level:export-and-compile', exportAndCompile);
ipcMain.on('editor:log', (_event, payload) => {
  const source = String(payload?.source || 'renderer').replace(/[\r\n]/g, ' ');
  const message = typeof payload?.message === 'string'
    ? payload.message
    : JSON.stringify(payload?.message ?? '');
  appendApplicationLog(source, message);
});

async function removeVerificationArtifacts() {
  const artifacts = verificationArtifacts || {};
  const removableFiles = [verificationInstalledPak, artifacts.installedPak, artifacts.outputPak, artifacts.filePath]
    .filter(Boolean);
  const allowedFileRoots = [
    path.join(pipelineWorkspaceDirectory(), 'Output'),
    path.join(runtimeRoot, 'UAssetPipeline', 'Output'),
    path.join(app.getPath('documents'), 'JETRUNNER Level Editor', 'Levels'),
  ];
  if (artifacts.gamePaks) allowedFileRoots.push(path.join(artifacts.gamePaks, 'JLE'));
  const errors = [];
  for (const candidate of new Set(removableFiles)) {
    const target = path.resolve(candidate);
    const inAllowedRoot = allowedFileRoots.some((root) => {
      const prefix = `${path.resolve(root)}${path.sep}`.toLowerCase();
      return target.toLowerCase().startsWith(prefix);
    });
    if (!inAllowedRoot || (target.toLowerCase().endsWith('.pak') && !/^jle-verification(?:level)?\.pak$/i.test(path.basename(target)))) {
      errors.push(`Refused unexpected verification cleanup path: ${target}`);
      continue;
    }
    try {
      await fs.rm(target, { force: true });
    } catch (error) {
      errors.push(`${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const projectDirectory = path.join(pipelineWorkspaceDirectory(), 'Projects', 'VERIFICATIONLEVEL');
  try {
    await fs.rm(projectDirectory, { recursive: true, force: true });
  } catch (error) {
    errors.push(`${projectDirectory}: ${error instanceof Error ? error.message : String(error)}`);
  }
  verificationInstalledPak = null;
  verificationArtifacts = null;
  return { removed: errors.length === 0, errors };
}

async function waitForJETRUNNERStart(gamePaks, status, consoleLine) {
  status('verification-launch', 'Waiting for JETRUNNER to start...');
  let running = [];
  for (let attempt = 0; attempt < 90; attempt += 1) {
    // Launch acknowledgement only observes an exact executable name. Do not
    // require ExecutablePath here: standard-user CIM sessions can redact that
    // property even though ProcessId and Name are available. Destructive
    // termination continues to use the installation-path-verified default.
    running = await findRunningJETRUNNERProcesses(gamePaks, { requireInstallPath: false });
    if (running.length > 0) break;
    await pause(1000);
  }
  if (running.length === 0) {
    throw new Error('Verification launch failed: JETRUNNER did not start within 90 seconds.');
  }
  consoleLine('verification-launch', `JETRUNNER started: ${running.map(({ pid, name, executablePath }) => `${name} PID ${pid}${executablePath ? ` at ${executablePath}` : ' (path unavailable)'}`).join(', ')}`);
  status('verification-result', 'Verification is running. Keep playing until you are happy with your best time.');
}

async function launchJETRUNNERForVerification(gamePaks) {
  if (await gameLauncherPreference() !== 'epic') {
    // JETRUNNER defines DX12 as option1 and DX11 as option2 in Steam. Select
    // its native DX11 launch entry so Steam performs the required bootstrap.
    await shell.openExternal('steam://launch/2865670/option2');
    return;
  }
  const executable = path.join(gameInstallRootFromPaks(gamePaks), jetrunnerRelativeExecutable);
  try {
    const stat = await fs.stat(executable);
    if (!stat.isFile() || stat.size <= 1024) throw new Error('missing executable');
  } catch {
    throw new Error('Epic Games launch failed: the selected JETRUNNER installation does not contain JetrunnerGame.exe. Select the correct game folder in the export prompt and retry.');
  }
  // Epic installations have no Steam launch URI. Start the selected game
  // executable directly, using the same DX11 renderer JLE requests on Steam.
  const game = spawn(executable, ['-d3d11'], { detached: true, stdio: 'ignore', windowsHide: true });
  game.unref();
}

ipcMain.handle('verification:begin', async (event, levelData) => {
  const status = (stage, message) => event.sender.send('level:pipeline-status', { stage, message });
  const consoleLine = (source, message) => status('console', `[${new Date().toLocaleTimeString()}] [${source}] ${message}`);
  const verificationData = JSON.parse(JSON.stringify(levelData));
  verificationData.levelId = verificationLevelId;
  verificationData.levelName = 'Verification';
  verificationData.displayName = 'Verification';
  verificationData.worldSettings.leaderboardId = verificationLevelId;
  verificationData.verificationMode = true;
  const result = await exportAndCompile(event, verificationData, { temporary: true });
  if (result.canceled) return result;
  if (result.pipelineError) {
    verificationArtifacts = { ...result };
    const cleanup = await removeVerificationArtifacts();
    return { ...result, cleanupError: cleanup.errors.join('; ') || undefined };
  }
  verificationInstalledPak = result.installedPak || null;
  const gamePaks = result.gamePaksDirectory || null;
  verificationArtifacts = { ...result, gamePaks };
  try {
    status('verification-save', 'Preparing a clean verification result slot...');
    const savePrepared = await prepareVerificationSave();
    if (!savePrepared) consoleLine('verification-save', 'No prior verification record existed; a new record will be accepted.');
    status('verification-launch', 'Launching JETRUNNER for verification...');
    await launchJETRUNNERForVerification(gamePaks);
    await waitForJETRUNNERStart(gamePaks, status, consoleLine);
    return { ...result, started: true, savePrepared };
  } catch (error) {
    await captureLatestJETRUNNERLog().catch(() => {});
    if (gamePaks) {
      await ensureJETRUNNERIsClosed(gamePaks, status, consoleLine).catch((closeError) => {
        consoleLine('cleanup', `Could not close JETRUNNER during failure cleanup: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
      });
    }
    const cleanup = await removeVerificationArtifacts();
    const message = error instanceof Error ? error.message : String(error);
    const cleanupError = cleanup.errors.join('; ') || undefined;
    return {
      ...result,
      pipelineError: cleanupError ? `${message} Cleanup also failed: ${cleanupError}` : message,
      cleanupError,
    };
  }
});

ipcMain.handle('verification:cleanup', async () => {
  const result = await removeVerificationArtifacts();
  return { removed: result.removed, error: result.errors.join('; ') || undefined };
});

ipcMain.handle('verification:read', async () => {
  try {
    const gamePaks = verificationArtifacts?.gamePaks;
    if (!gamePaks) throw new Error('There is no active verification session.');
    const silentStatus = () => {};
    const consoleLine = (source, message) => appendApplicationLog(source, message);
    await ensureJETRUNNERIsClosed(gamePaks, silentStatus, consoleLine);
    await captureLatestJETRUNNERLog();
    const result = await readVerificationBestTime();
    return { found: result.found, time: result.found ? result.time : undefined };
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : String(error) };
  }
});

function createWindow() {
  const recoverFromStartupFailure = (reason) => {
    if (activePayloadConfirmed || !modularUpdater) return;
    void modularUpdater.rollback().then((result) => {
      if (result.rolledBack) { appendApplicationLog('payload-updater', `Rolled back after renderer startup failure: ${reason}`); app.relaunch(); app.quit(); }
    }).catch((error) => appendApplicationLog('payload-updater-error', error?.stack || error));
  };
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    fullscreen: true,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#090d12',
    title: 'JETRUNNER Level Editor',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'juan.png')
      : path.join(__dirname, '..', 'src', 'assets', 'juan.png'),
    // A hidden auto-menu appears whenever Alt is tapped on Windows, which
    // conflicts with UE-style Alt+Drag. This editor has no menu commands, so
    // remove that menu rather than intercepting Alt and losing modifier input.
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.removeMenu();
  window.setMenuBarVisibility(false);
  window.once('ready-to-show', () => {
    window.setFullScreen(true);
    window.show();
    window.focus();
  });
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    appendApplicationLog(`renderer:${level}`, `${message} (${sourceId || 'renderer'}:${line || 0})`);
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    appendApplicationLog('renderer-load-error', `${code} ${description} ${url}`);
    recoverFromStartupFailure(`${code} ${description}`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    appendApplicationLog('renderer-process-gone', JSON.stringify(details));
    recoverFromStartupFailure(details?.reason || 'renderer process ended');
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    window.loadURL(devServer);
  } else {
    window.loadFile(path.join(activePayloadPath || path.join(__dirname, '..', 'dist'), 'index.html'));
  }
  window.webContents.once('did-finish-load', () => {
    if (pendingExternalProjectPath) {
      const filePath = pendingExternalProjectPath;
      pendingExternalProjectPath = null;
      void openExternalProject(filePath);
    }
  });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', (_event, argv) => {
  const filePath = argv.find((argument) => /\.jle$/i.test(argument));
  if (filePath) void openExternalProject(filePath);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  modularUpdater = new ModularUpdater({ root: path.join(app.getPath('userData'), 'ModularUpdates'), bundledPayload: path.join(__dirname, '..', 'dist'), launcherVersion: app.getVersion(), logger: (level, message) => appendApplicationLog(`payload-updater-${level}`, message) });
  try { activePayloadPath = await modularUpdater.activePayload(); } catch (error) { activePayloadPath = path.join(__dirname, '..', 'dist'); appendApplicationLog('payload-updater-error', `Recovery state could not be initialized; using bundled editor: ${error?.stack || error}`); }
  // A forced close during verification can leave only this reserved temporary
  // pak behind. It is never a user level, so remove it before a new session.
  const discoveredPaks = await findJETRUNNERPaks();
  const staleVerificationPaks = discoveredPaks
    ? ['JLE-VERIFICATIONLEVEL.pak', 'JLE-Verification.pak'].map(
      (fileName) => path.join(discoveredPaks, 'JLE', fileName),
    ) : [];
  await Promise.all(staleVerificationPaks.map((filePath) => fs.rm(filePath, { force: true }).catch(() => {})));
  await retainNewestLogs(logsDirectory(), 5);
  const directory = logsDirectory('Editor');
  await fs.mkdir(directory, { recursive: true });
  await retainNewestLogs(directory, 4);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  sessionLogPath = path.join(directory, `Editor-session--${stamp}.log`);
  await fs.writeFile(sessionLogPath, `[${new Date().toISOString()}] [app] Editor started\n`, 'utf8');
  createWindow();
  mainWindow?.webContents.once('did-finish-load', () => {
    setTimeout(() => void checkForEditorUpdates(), 4000);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
