const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed Electron preloads can only require a small built-in module set.
// Keep catalogue/verifier data in the main process and retrieve this small,
// immutable snapshot through IPC instead of importing a local CJS module here.
const verificationSupportedAssetIds = ipcRenderer.sendSync('verification:supported-assets');

contextBridge.exposeInMainWorld('jetrunnerEditor', {
  exportAndCompile: (levelData) => ipcRenderer.invoke('level:export-and-compile', levelData),
  beginVerification: (levelData) => ipcRenderer.invoke('verification:begin', levelData),
  readVerification: () => ipcRenderer.invoke('verification:read'),
  cleanupVerification: () => ipcRenderer.invoke('verification:cleanup'),
  saveProject: (projectData) => ipcRenderer.invoke('project:save', projectData),
  loadProject: () => ipcRenderer.invoke('project:load'),
  loadRecentProject: (filePath) => ipcRenderer.invoke('project:load-recent', filePath),
  onExternalProject: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('project:external-open', listener);
    return () => ipcRenderer.removeListener('project:external-open', listener);
  },
  beginNewProject: () => ipcRenderer.invoke('project:new'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  downloadEditorUpdate: () => ipcRenderer.invoke('update:download'),
  onEditorUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
  payloadReady: () => ipcRenderer.send('update:payload-ready'),
  getRecoveryStatus: () => ipcRenderer.invoke('update:recovery-status'),
  rollbackEditor: () => ipcRenderer.invoke('update:rollback'),
  openRecoveryFolder: () => ipcRenderer.invoke('update:open-recovery'),
  getGameLauncher: () => ipcRenderer.invoke('game:get-launcher'),
  setGameLauncher: (launcher) => ipcRenderer.invoke('game:set-launcher', launcher),
  // This comes from the same module as the main-process verifier allowlist.
  verificationSupportedAssetIds: Array.isArray(verificationSupportedAssetIds)
    ? [...verificationSupportedAssetIds]
    : [],
  logEditor: (source, message) => ipcRenderer.send('editor:log', { source, message }),
  onPipelineStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('level:pipeline-status', listener);
    return () => ipcRenderer.removeListener('level:pipeline-status', listener);
  },
});
