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
      verificationSupportedAssetIds: string[];
      logEditor: (source: string, message: unknown) => void;
      onPipelineStatus: (callback: (status: { stage: string; message: string }) => void) => () => void;
    };
  }
}
