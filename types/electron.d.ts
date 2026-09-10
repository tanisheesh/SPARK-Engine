// Electron API types
import type { DataSourceType, DatabaseSourceType } from '../lib/data-sources';

/** Connection state of the outbound relay link used by SPARK Mobile. */
export interface RemoteStatus {
  state: 'idle' | 'connecting' | 'online' | 'retrying' | 'error';
  relayUrl: string | null;
  deviceName: string | null;
  /** 'pairing' is the dev-only code mode; 'account' is a real Cognito token. */
  mode: 'pairing' | 'account';
  pairingCode: string | null;
  lastError: string | null;
  busy: boolean;
}

/** The dataset a remote question runs against. `path` is set for file sources
    only; database sources are already resident in DuckDB. */
export interface RemoteSource {
  type: DataSourceType;
  name: string;
  path?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      uploadCSV: (maxSizeBytes?: number) => Promise<any>;
      listCSVFiles: () => Promise<any>;
      deleteCSV: (fileName: string) => Promise<any>;
      // Handles CSV, JSON and Excel. A workbook returns one table per sheet in
      // tableNames; tableName is the first of them.
      importCSVToDuckDB: (data: { filePath: string; fileName: string }) => Promise<{ success: boolean; tableName?: string; tableNames?: string[]; message?: string; error?: string }>;
      processQuery: (data: any) => Promise<any>;
      generateTTS: (data: any) => Promise<any>;
      openExternal: (url: string) => Promise<any>;
      connectDatabase: (data: { type: DatabaseSourceType, config: any, allowedTypes?: DataSourceType[] }) => Promise<any>;
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

      /* ---------- Remote sessions (SPARK Mobile) ---------- */
      remoteStatus: () => Promise<RemoteStatus>;
      remoteConnect: (data: { relayUrl: string; token: string; deviceName?: string }) =>
        Promise<{ success: boolean; status?: RemoteStatus; error?: string }>;
      remoteDisconnect: () => Promise<{ success: boolean; status: RemoteStatus }>;
      /** Tells main which dataset a remote question should run against. */
      remoteSetSource: (source: RemoteSource | null) => Promise<{ success: boolean }>;
      /** Pushes the renderer's conversations into main's mirror and receives
          the merged list back — this is how mobile turns reach the desktop UI. */
      syncConversations: (conversations: unknown[]) =>
        Promise<{ success: boolean; conversations: unknown[]; error?: string }>;
      onRemoteStatus: (callback: (event: unknown, status: RemoteStatus) => void) => void;
      onConversationsUpdated: (
        callback: (
          event: unknown,
          payload: { reason: string; conversationId: string; conversations: unknown[] }
        ) => void
      ) => void;
    };
    // Loaded from https://checkout.razorpay.com/v1/checkout.js by PricingScreen.
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description?: string;
      order_id: string;
      prefill?: { email?: string; name?: string };
      theme?: { color?: string };
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

export {};