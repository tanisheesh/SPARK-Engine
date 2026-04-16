// Electron API types
declare global {
  interface Window {
    electronAPI?: {
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      uploadCSV: () => Promise<any>;
      listCSVFiles: () => Promise<any>;
      deleteCSV: (fileName: string) => Promise<any>;
      importCSVToDuckDB: (data: { filePath: string; fileName: string }) => Promise<{ success: boolean; tableName?: string; message?: string; error?: string }>;
      processQuery: (data: any) => Promise<any>;
      generateTTS: (data: any) => Promise<any>;
      openExternal: (url: string) => Promise<any>;
      connectDatabase: (data: { type: 'mysql' | 'sqlite' | 'postgresql', config: any }) => Promise<any>;
      disconnectDatabase: (data: { type: 'mysql' | 'sqlite' | 'postgresql' }) => Promise<any>;
      getDatabaseSchema: (data: { connectionType: string; connectionConfig: any }) => Promise<{ success: boolean; schema?: any; graph?: any; error?: string }>;
      onOpenSettings: (callback: () => void) => void;
      onFileUploaded: (callback: (event: any, filePath: string) => void) => void;
      onUploadProgress: (callback: (event: any, progress: any) => void) => void;
      onQueryProgress: (callback: (event: any, progress: any) => void) => void;
      onSystemNotification: (callback: (event: any, notification: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export {};