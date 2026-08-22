export {};

declare global {
  interface Window {
    jetrunnerEditor?: {
      exportAndCompile: (levelData: unknown) => Promise<{
        canceled: boolean;
        filePath?: string;
        installedPak?: string;
        outputPak?: string;
        pipelineError?: string;
        logPath?: string;
      }>;
      beginVerification: (levelData: unknown) => Promise<{
        canceled: boolean;
        installedPak?: string;
        pipelineError?: string;
        logPath?: string;
        savePrepared?: boolean;
        started?: boolean;
        found?: boolean;
        time?: number;
        cleaned?: boolean;
        cleanupError?: string;
      }>;
      readVerification: () => Promise<{
        found: boolean;
        time?: number;
        error?: string;
      }>;
      cleanupVerification: () => Promise<{ removed: boolean; error?: string }>;
      saveProject: (projectData: unknown) => Promise<{
        canceled: boolean;
        filePath?: string;
        error?: string;
      }>;
      loadProject: () => Promise<{
        canceled: boolean;
        filePath?: string;
        projectData?: unknown;
        error?: string;
      }>;
      loadRecentProject: (filePath: string) => Promise<{
        canceled: boolean; missing?: boolean; filePath?: string; projectData?: unknown; error?: string;
      }>;
      onExternalProject: (callback: (result: {
        canceled: boolean; filePath?: string; projectData?: unknown; error?: string; installAfterOpen?: boolean;
      }) => void) => () => void;
      beginNewProject: () => Promise<{ ready: boolean; error?: string }>;
      quitApp: () => Promise<{ quitting: boolean }>;
      checkForEditorUpdate: () => Promise<{ available: boolean }>;
      downloadEditorUpdate: () => Promise<{ started: boolean }>;
      payloadReady: () => void;
      getRecoveryStatus: () => Promise<{ active: string | null; previous: string | null; knownGood: string | null; pending: string | null; root: string }>;
      rollbackEditor: () => Promise<{ rolledBack: boolean }>;
      openRecoveryFolder: () => Promise<string>;
      getGameLauncher: () => Promise<{ launcher: 'steam' | 'epic' }>;
      setGameLauncher: (launcher: 'steam' | 'epic') => Promise<{ launcher: 'steam' | 'epic' }>;
      onEditorUpdateState: (callback: (state: {
        status: 'available' | 'downloading' | 'downloaded' | 'current' | 'error';
        version?: string;
        percent?: number;
        updateType?: 'payload' | 'full';
        detail?: string;
        notes?: string;
      }) => void) => () => void;
      verificationSupportedAssetIds: string[];
      logEditor: (source: string, message: unknown) => void;
      onPipelineStatus: (callback: (status: { stage: string; message: string }) => void) => () => void;
    };
  }
}
