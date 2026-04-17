const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // File operations
  uploadCSV: () => ipcRenderer.invoke('upload-csv'),
  listCSVFiles: () => ipcRenderer.invoke('list-csv-files'),
  deleteCSV: (fileName) => ipcRenderer.invoke('delete-csv', fileName),
  importCSVToDuckDB: (data) => ipcRenderer.invoke('import-csv-to-duckdb', data),
  
  // Database connectors
  connectDatabase: (data) => ipcRenderer.invoke('connect-database', data),
  disconnectDatabase: (data) => ipcRenderer.invoke('disconnect-database', data),
  getDatabaseSchema: (data) => ipcRenderer.invoke('get-database-schema', data),
  
  // Query processing (replaces web API)
  processQuery: (data) => ipcRenderer.invoke('process-query', data),
  
  // TTS generation (separate from query)
  generateTTS: (data) => ipcRenderer.invoke('generate-tts', data),
  
  // System operations
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onFileUploaded: (callback) => ipcRenderer.on('file-uploaded', callback),
  onUploadProgress: (callback) => ipcRenderer.on('upload-progress', callback),
  onQueryProgress: (callback) => ipcRenderer.on('query-progress', callback),
  onSystemNotification: (callback) => ipcRenderer.on('system-notification', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // OAuth callback
  onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', callback),
});