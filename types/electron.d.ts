// Electron API types
import type { DataSourceType, DatabaseSourceType } from '../lib/data-sources';

declare global {
  interface Window {
    electronAPI?: {
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      uploadCSV: () => Promise<any>;
      listCSVFiles: () => Promise<any>;
      deleteCSV: (fileName: string) => Promise<any>;
      // Handles CSV, JSON and Excel. A workbook returns one table per sheet in
      // tableNames; tableName is the first of them.
      importCSVToDuckDB: (data: { filePath: string; fileName: string }) => Promise<{ success: boolean; tableName?: string; tableNames?: string[]; message?: string; error?: string }>;
      processQuery: (data: any) => Promise<any>;
      generateTTS: (data: any) => Promise<any>;
      openExternal: (url: string) => Promise<any>;
      connectDatabase: (data: { type: DatabaseSourceType, config: any }) => Promise<any>;
      // Any source can be disconnected, including the file bucket.
      disconnectDatabase: (data: { type: DataSourceType }) => Promise<any>;
      getDatabaseSchema: (data: { connectionType: string; connectionConfig: any }) => Promise<{ success: boolean; schema?: any; graph?: any; error?: string }>;
      onOpenSettings: (callback: () => void) => void;
      onFileUploaded: (callback: (event: any, filePath: string) => void) => void;
      onUploadProgress: (callback: (event: any, progress: any) => void) => void;
      onQueryProgress: (callback: (event: any, progress: any) => void) => void;
      onSystemNotification: (callback: (event: any, notification: any) => void) => void;
      removeAllListeners: (channel: string) => void;
      onOAuthCallback: (callback: (event: any, url: string) => void) => void;
    };
  }
}

export {};