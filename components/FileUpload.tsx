'use client';

import { useState, useEffect } from 'react';
import {
  isFileSource,
  matchesFileSource,
  type DataSourceType,
  type DatabaseSourceType,
  type FileSourceType
} from '../lib/data-sources';
import { motion, AnimatePresence } from 'framer-motion';

interface CSVFile {
  name: string;
  path: string;
  size: number;
  modified: Date;
}

interface SavedConnection {
  id: string;
  type: DatabaseSourceType;
  name: string;
  config: any;
  savedAt: Date;
}

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: CSVFile, type: DataSourceType, config?: any) => void;
  currentDatasetType: DataSourceType | null;
}

type TabType = DataSourceType;

// Per-file-source copy for the shared upload panel. The three file tabs are the
// same UI over a different extension filter.
const FILE_TAB_COPY: Record<FileSourceType, { icon: string; title: string; blurb: string; noun: string }> = {
  csv: {
    icon: '📊',
    title: 'Upload New CSV File',
    blurb: 'Select a CSV file from your computer to analyze with SPARK Engine',
    noun: 'CSV'
  },
  xlsx: {
    icon: '📗',
    title: 'Upload New Excel Workbook',
    blurb: 'Select an .xlsx or .xls workbook — every sheet becomes its own table',
    noun: 'workbook'
  },
  json: {
    icon: '📋',
    title: 'Upload New JSON File',
    blurb: 'Select a .json file — an array of records works best',
    noun: 'JSON'
  }
};

export default function FileUpload({ isOpen, onClose, onFileSelected, currentDatasetType }: FileUploadProps) {
  const [activeTab, setActiveTab] = useState<TabType>('csv');
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
  } | null>(null);

  // Connection status
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<DataSourceType | null>(null);
  const [isFromSavedConnection, setIsFromSavedConnection] = useState(false);
  
  // Saved connections
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);

  // Database connection states
  const [mysqlConfig, setMysqlConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: '',
    password: '',
    database: '',
    table: ''
  });

  const [sqliteConfig, setSqliteConfig] = useState({
    filePath: '',
    table: ''
  });

  const [postgresConfig, setPostgresConfig] = useState({
    host: 'localhost',
    port: '5432',
    user: '',
    password: '',
    database: '',
    table: ''
  });

  // Supabase takes the whole connection URI rather than separate fields - it is
  // what the dashboard gives you, and it carries the pooler host that keeps
  // free-tier projects reachable over IPv4.
  const [supabaseConfig, setSupabaseConfig] = useState({
    connectionString: '',
    table: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadCSVFiles();
      loadSavedConnections();
      
      // Listen for upload progress
      if (window.electronAPI) {
        const progressHandler = (event: any, progress: any) => {
          setUploadProgress(progress);
          if (progress.stage === 'complete') {
            setTimeout(() => {
              setUploadProgress(null);
              setIsUploading(false);
              loadCSVFiles();
            }, 2000);
          } else if (progress.stage === 'error') {
            setTimeout(() => {
              setUploadProgress(null);
              setIsUploading(false);
            }, 3000);
          }
        };
        
        window.electronAPI.onUploadProgress(progressHandler);
        
        return () => {
          if (window.electronAPI) {
            window.electronAPI.removeAllListeners('upload-progress');
          }
        };
      }
    }
  }, [isOpen]);

  const loadCSVFiles = async () => {
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.listCSVFiles();
        setCsvFiles(files);
      }
    } catch (error) {
      console.error('Error loading CSV files:', error);
    }
  };

  // Human-readable name for a connection, used for saved entries and the label
  // shown once connected.
  const connectionLabel = (type: DatabaseSourceType, config: any): string => {
    if (type === 'sqlite') {
      return String(config.filePath || '').split(/[\\/]/).pop() || 'database.db';
    }
    if (type === 'supabase') {
      // Pull the project ref out of the host: db.<ref>.supabase.co, or
      // postgres.<ref> as the pooler username.
      try {
        const url = new URL(config.connectionString);
        const fromHost = /^db\.([a-z0-9]+)\.supabase\./i.exec(url.hostname);
        if (fromHost) return `${fromHost[1]} (Supabase)`;
        const fromUser = /^postgres\.([a-z0-9]+)$/i.exec(decodeURIComponent(url.username || ''));
        if (fromUser) return `${fromUser[1]} (Supabase)`;
        return `${url.hostname} (Supabase)`;
      } catch {
        return 'Supabase project';
      }
    }
    return `${config.database}@${config.host}`;
  };

  const loadSavedConnections = () => {
    try {
      const saved = localStorage.getItem('savedDatabaseConnections');
      if (saved) {
        setSavedConnections(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved connections:', error);
    }
  };

  const saveConnection = (type: DatabaseSourceType, config: any) => {
    const connectionName = connectionLabel(type, config);

    // Check if connection already exists
    const existingConnection = savedConnections.find(conn => 
      conn.type === type && conn.name === connectionName
    );
    
    if (existingConnection) {
      alert('This connection is already saved!');
      return;
    }
    
    const newConnection: SavedConnection = {
      id: Date.now().toString(),
      type,
      name: connectionName,
      config,
      savedAt: new Date()
    };
    
    const updated = [...savedConnections, newConnection];
    setSavedConnections(updated);
    localStorage.setItem('savedDatabaseConnections', JSON.stringify(updated));
    alert('Connection saved successfully!');
  };

  const deleteConnection = (id: string) => {
    if (confirm('Are you sure you want to delete this saved connection?')) {
      const updated = savedConnections.filter(conn => conn.id !== id);
      setSavedConnections(updated);
      localStorage.setItem('savedDatabaseConnections', JSON.stringify(updated));
    }
  };

  const loadSavedConnection = (conn: SavedConnection) => {
    if (conn.type === 'mysql') {
      setMysqlConfig(conn.config);
      setActiveTab('mysql');
    } else if (conn.type === 'sqlite') {
      setSqliteConfig(conn.config);
      setActiveTab('sqlite');
    } else if (conn.type === 'postgresql') {
      setPostgresConfig(conn.config);
      setActiveTab('postgresql');
    } else if (conn.type === 'supabase') {
      setSupabaseConfig(conn.config);
      setActiveTab('supabase');
    }
    
    // Mark that this connection is from saved list
    setIsFromSavedConnection(true);
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadProgress({ stage: 'starting', progress: 0, message: 'Preparing upload...' });
    
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.uploadCSV();
        if (result.success) {
          setUploadProgress({ stage: 'complete', progress: 100, message: 'Upload completed successfully!' });
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
            loadCSVFiles();
          }, 2000);
        } else {
          setUploadProgress({ stage: 'error', progress: 0, message: result.error || 'Upload failed' });
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadProgress({ stage: 'error', progress: 0, message: 'Upload failed' });
      setTimeout(() => {
        setUploadProgress(null);
        setIsUploading(false);
      }, 3000);
    }
  };

  const handleDatabaseConnect = async (dbType: DatabaseSourceType) => {
    setIsUploading(true);
    setUploadProgress({ stage: 'starting', progress: 0, message: 'Connecting to database...' });
    
    try {
      if (window.electronAPI) {
        let config;
        if (dbType === 'mysql') config = mysqlConfig;
        else if (dbType === 'sqlite') config = sqliteConfig;
        else if (dbType === 'supabase') config = supabaseConfig;
        else config = postgresConfig;

        const result = await window.electronAPI.connectDatabase({ type: dbType, config });

        if (result.success) {
          setIsConnected(true);
          setConnectionType(dbType);

          // Create a file object to pass to parent
          const connectionName = connectionLabel(dbType, config);

          const connectionFile = {
            name: connectionName,
            path: result.files?.[0]?.path || '',
            size: 0,
            modified: new Date()
          };
          
          // Notify parent component with config
          onFileSelected(connectionFile, dbType, config);
          
          setUploadProgress({ stage: 'complete', progress: 100, message: result.message });
          
          // Wait a bit before closing to ensure backend is ready
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
            onClose(); // Close the modal
          }, 2000); // Increased to 2 seconds
        } else {
          setUploadProgress({ stage: 'error', progress: 0, message: result.error || 'Connection failed' });
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error connecting to database:', error);
      setUploadProgress({ stage: 'error', progress: 0, message: 'Connection failed' });
      setTimeout(() => {
        setUploadProgress(null);
        setIsUploading(false);
      }, 3000);
    }
  };

  const handleDisconnect = async () => {
    if (connectionType && window.electronAPI) {
      try {
        await window.electronAPI.disconnectDatabase({ type: connectionType as any });
        console.log(`✅ Disconnected from ${connectionType}`);
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
    
    setIsConnected(false);
    setConnectionType(null);
    setIsFromSavedConnection(false);
    setSelectedFile('');
    
    // Clear parent's dataset type
    onFileSelected({ name: '', path: '', size: 0, modified: new Date() }, 'csv');
    
    loadCSVFiles();
  };

  const handleSaveConnection = () => {
    if (connectionType === 'mysql') {
      saveConnection('mysql', mysqlConfig);
    } else if (connectionType === 'sqlite') {
      saveConnection('sqlite', sqliteConfig);
    } else if (connectionType === 'postgresql') {
      saveConnection('postgresql', postgresConfig);
    } else if (connectionType === 'supabase') {
      saveConnection('supabase', supabaseConfig);
    }
  };

  // Imports the selected upload into DuckDB. Shared by the CSV, Excel and JSON
  // tabs - the main process routes on the file's extension, so the only thing
  // that differs here is which source type the parent is told about.
  const handleConnectFile = async (fileType: FileSourceType) => {
    const file = csvFiles.find(f => f.name === selectedFile);
    if (!file) return;

    const noun = FILE_TAB_COPY[fileType].noun;
    setIsUploading(true);
    setUploadProgress({ stage: 'importing', progress: 50, message: `Importing ${noun} into database...` });

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.importCSVToDuckDB({
          filePath: file.path,
          fileName: file.name
        });

        if (result.success) {
          setIsConnected(true);
          setConnectionType(fileType);
          onFileSelected(file, fileType);
          // A workbook reports every sheet it created; a CSV or JSON reports one table.
          const imported = result.tableNames && result.tableNames.length > 1
            ? `Imported ${result.tableNames.length} sheets as tables`
            : `${noun} imported successfully!`;
          setUploadProgress({ stage: 'complete', progress: 100, message: imported });
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
          }, 2000);
        } else {
          throw new Error(result.error || 'Import failed');
        }
      }
    } catch (error: any) {
      setUploadProgress({ stage: 'error', progress: 0, message: `Import failed: ${error.message}` });
      setTimeout(() => {
        setUploadProgress(null);
        setIsUploading(false);
      }, 3000);
    }
  };

  // CSV, Excel and JSON tables share one bucket in DuckDB, so disconnecting any
  // of them clears every uploaded-file table.
  const handleDisconnectFile = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.disconnectDatabase({ type: (connectionType as DataSourceType) || 'csv' });
        console.log('✅ Disconnected from uploaded files');
      }
    } catch (error) {
      console.error('Error disconnecting file source:', error);
    }

    setIsConnected(false);
    setConnectionType(null);
    setSelectedFile('');

    // Clear parent's dataset
    onFileSelected({ name: '', path: '', size: 0, modified: new Date() }, 'csv');
  };

  const handleDeleteCSV = async (fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      try {
        if (window.electronAPI) {
          // Call electron API to delete the file
          const result = await window.electronAPI.deleteCSV(fileName);
          if (result.success) {
            // Refresh the file list
            loadCSVFiles();
            // Clear selection if deleted file was selected
            if (selectedFile === fileName) {
              setSelectedFile('');
            }
          } else {
            alert(`Failed to delete file: ${result.error}`);
          }
        }
      } catch (error) {
        console.error('Error deleting CSV:', error);
        alert('Failed to delete file');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'csv' as TabType, label: 'CSV Upload', icon: '📊' },
    { id: 'xlsx' as TabType, label: 'Excel', icon: '📗' },
    { id: 'json' as TabType, label: 'JSON', icon: '📋' },
    { id: 'mysql' as TabType, label: 'MySQL', icon: '🐬' },
    { id: 'sqlite' as TabType, label: 'SQLite', icon: '💾' },
    { id: 'postgresql' as TabType, label: 'PostgreSQL', icon: '🐘' },
    { id: 'supabase' as TabType, label: 'Supabase', icon: '⚡' }
  ];

  // The upload dialog accepts every supported type, so the shared file list is
  // filtered down to the tab the user is actually looking at.
  const visibleFiles = isFileSource(activeTab)
    ? csvFiles.filter(file => matchesFileSource(file.name, activeTab as FileSourceType))
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-950 rounded-3xl border-2 border-orange-600/30 p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl">🗄️</span>
              <h2 className="text-2xl font-bold text-orange-500 font-mono">DATA SOURCE MANAGER</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto">
              {tabs.map((tab) => {
                const isActiveConnection = currentDatasetType === tab.id;
                const isDisabled = !!(currentDatasetType && currentDatasetType !== tab.id);
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`relative px-6 py-3 rounded-xl font-mono font-bold transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-orange-600 to-purple-600 text-white shadow-lg shadow-orange-600/30'
                        : isDisabled
                        ? 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {/* Green dot indicator for active connection */}
                    {isActiveConnection && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-slate-950"></span>
                      </span>
                    )}
                    {tab.icon} {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Progress Bar */}
            {uploadProgress && (
              <div className="mb-6">
                <div className="bg-slate-800 rounded-full h-3 mb-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      uploadProgress.stage === 'error' ? 'bg-red-500' : 'bg-orange-600'
                    }`}
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
                <p className={`text-sm font-mono ${
                  uploadProgress.stage === 'error' ? 'text-red-400' : 'text-orange-500'
                }`}>
                  {uploadProgress.message}
                </p>
              </div>
            )}

            {/* File upload tabs - CSV, Excel and JSON share this panel */}
            {isFileSource(activeTab) && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-orange-600/30 rounded-2xl p-8 text-center bg-slate-900/30">
                  <div className="mb-4">
                    <span className="text-6xl">{FILE_TAB_COPY[activeTab as FileSourceType].icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-orange-500 mb-2">
                    {FILE_TAB_COPY[activeTab as FileSourceType].title}
                  </h3>
                  <p className="text-slate-400 mb-6">
                    {FILE_TAB_COPY[activeTab as FileSourceType].blurb}
                  </p>

                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="px-8 py-4 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-all shadow-lg shadow-orange-600/30"
                  >
                    {isUploading ? '⏳ Uploading...' : '📁 Browse & Upload'}
                  </button>
                </div>

                {/* File List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-orange-500 font-mono">📋 AVAILABLE DATASETS</h3>
                  
                  {visibleFiles.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <span className="text-4xl mb-4 block">📂</span>
                      <p>No {FILE_TAB_COPY[activeTab as FileSourceType].noun} datasets uploaded yet</p>
                      <p className="text-sm">Upload your first dataset to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleFiles.map((file, index) => (
                        <motion.div
                          key={file.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedFile === file.name
                              ? 'border-orange-500 bg-orange-600/10'
                              : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => setSelectedFile(file.name)}
                            >
                              <span className="text-2xl">{FILE_TAB_COPY[activeTab as FileSourceType].icon}</span>
                              <div>
                                <h4 className="font-bold text-white">{file.name}</h4>
                                <p className="text-sm text-slate-400">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {selectedFile === file.name && (
                                <span className="text-orange-500 text-xl">✓</span>
                              )}
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                selectedFile === file.name
                                  ? 'border-orange-500 bg-orange-500'
                                  : 'border-slate-500'
                              }`} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCSV(file.name);
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MySQL Tab */}
            {activeTab === 'mysql' && (
              <div className="space-y-4">
                {/* Saved Connections */}
                {savedConnections.filter(c => c.type === 'mysql').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-orange-500 mb-3 font-mono">💾 SAVED CONNECTIONS</h3>
                    <div className="space-y-2">
                      {savedConnections.filter(c => c.type === 'mysql').map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                          <button
                            onClick={() => loadSavedConnection(conn)}
                            className="flex-1 text-left text-white hover:text-orange-500 transition-colors"
                          >
                            🐬 {conn.name}
                          </button>
                          <button
                            onClick={() => deleteConnection(conn.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isConnected || connectionType !== 'mysql' ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-orange-600/20">
                    <h3 className="text-lg font-bold text-orange-500 mb-4 font-mono">🐬 MySQL Connection</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Host</label>
                        <input
                          type="text"
                          value={mysqlConfig.host}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, host: e.target.value})}
                          placeholder="localhost"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Port</label>
                        <input
                          type="text"
                          value={mysqlConfig.port}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, port: e.target.value})}
                          placeholder="3306"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Username</label>
                        <input
                          type="text"
                          value={mysqlConfig.user}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, user: e.target.value})}
                          placeholder="root"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Password</label>
                        <input
                          type="password"
                          value={mysqlConfig.password}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, password: e.target.value})}
                          placeholder="••••••••"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Database</label>
                        <input
                          type="text"
                          value={mysqlConfig.database}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, database: e.target.value})}
                          placeholder="my_database"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Table (Optional)</label>
                        <input
                          type="text"
                          value={mysqlConfig.table}
                          onChange={(e) => setMysqlConfig({...mysqlConfig, table: e.target.value})}
                          placeholder="Leave blank for all tables"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDatabaseConnect('mysql')}
                      disabled={isUploading || !mysqlConfig.user || !mysqlConfig.database}
                      className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                    >
                      {isUploading ? '⏳ Connecting...' : '🔗 Connect & Import All Tables'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">✅</span>
                      <div>
                        <h3 className="text-xl font-bold text-green-400">Connected to MySQL</h3>
                        <p className="text-slate-300">{mysqlConfig.database}@{mysqlConfig.host}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDisconnect}
                        className={`${isFromSavedConnection ? 'w-full' : 'flex-1'} px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors`}
                      >
                        🔌 Disconnect
                      </button>
                      {!isFromSavedConnection && (
                        <button
                          onClick={handleSaveConnection}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 rounded-lg text-white font-bold transition-all"
                        >
                          💾 Save Connection
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SQLite Tab */}
            {activeTab === 'sqlite' && (
              <div className="space-y-4">
                {/* Saved Connections */}
                {savedConnections.filter(c => c.type === 'sqlite').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-orange-500 mb-3 font-mono">💾 SAVED CONNECTIONS</h3>
                    <div className="space-y-2">
                      {savedConnections.filter(c => c.type === 'sqlite').map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                          <button
                            onClick={() => loadSavedConnection(conn)}
                            className="flex-1 text-left text-white hover:text-orange-500 transition-colors"
                          >
                            💾 {conn.name}
                          </button>
                          <button
                            onClick={() => deleteConnection(conn.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isConnected || connectionType !== 'sqlite' ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-orange-600/20">
                    <h3 className="text-lg font-bold text-orange-500 mb-4 font-mono">💾 SQLite Connection</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Database File Path</label>
                        <input
                          type="text"
                          value={sqliteConfig.filePath}
                          onChange={(e) => setSqliteConfig({...sqliteConfig, filePath: e.target.value})}
                          placeholder="C:\path\to\database.db"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Table (Optional)</label>
                        <input
                          type="text"
                          value={sqliteConfig.table}
                          onChange={(e) => setSqliteConfig({...sqliteConfig, table: e.target.value})}
                          placeholder="Leave blank for all tables"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDatabaseConnect('sqlite')}
                      disabled={isUploading || !sqliteConfig.filePath}
                      className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                    >
                      {isUploading ? '⏳ Connecting...' : '🔗 Connect & Import All Tables'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">✅</span>
                      <div>
                        <h3 className="text-xl font-bold text-green-400">Connected to SQLite</h3>
                        <p className="text-slate-300">{sqliteConfig.filePath}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDisconnect}
                        className={`${isFromSavedConnection ? 'w-full' : 'flex-1'} px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors`}
                      >
                        🔌 Disconnect
                      </button>
                      {!isFromSavedConnection && (
                        <button
                          onClick={handleSaveConnection}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 rounded-lg text-white font-bold transition-all"
                        >
                          💾 Save Connection
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PostgreSQL Tab */}
            {activeTab === 'postgresql' && (
              <div className="space-y-4">
                {/* Saved Connections */}
                {savedConnections.filter(c => c.type === 'postgresql').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-orange-500 mb-3 font-mono">💾 SAVED CONNECTIONS</h3>
                    <div className="space-y-2">
                      {savedConnections.filter(c => c.type === 'postgresql').map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                          <button
                            onClick={() => loadSavedConnection(conn)}
                            className="flex-1 text-left text-white hover:text-orange-500 transition-colors"
                          >
                            🐘 {conn.name}
                          </button>
                          <button
                            onClick={() => deleteConnection(conn.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isConnected || connectionType !== 'postgresql' ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-orange-600/20">
                    <h3 className="text-lg font-bold text-orange-500 mb-4 font-mono">🐘 PostgreSQL Connection</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Host</label>
                        <input
                          type="text"
                          value={postgresConfig.host}
                          onChange={(e) => setPostgresConfig({...postgresConfig, host: e.target.value})}
                          placeholder="localhost"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Port</label>
                        <input
                          type="text"
                          value={postgresConfig.port}
                          onChange={(e) => setPostgresConfig({...postgresConfig, port: e.target.value})}
                          placeholder="5432"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Username</label>
                        <input
                          type="text"
                          value={postgresConfig.user}
                          onChange={(e) => setPostgresConfig({...postgresConfig, user: e.target.value})}
                          placeholder="postgres"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Password</label>
                        <input
                          type="password"
                          value={postgresConfig.password}
                          onChange={(e) => setPostgresConfig({...postgresConfig, password: e.target.value})}
                          placeholder="••••••••"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Database</label>
                        <input
                          type="text"
                          value={postgresConfig.database}
                          onChange={(e) => setPostgresConfig({...postgresConfig, database: e.target.value})}
                          placeholder="my_database"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Table (Optional)</label>
                        <input
                          type="text"
                          value={postgresConfig.table}
                          onChange={(e) => setPostgresConfig({...postgresConfig, table: e.target.value})}
                          placeholder="Leave blank for all tables"
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDatabaseConnect('postgresql')}
                      disabled={isUploading || !postgresConfig.user || !postgresConfig.database}
                      className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                    >
                      {isUploading ? '⏳ Connecting...' : '🔗 Connect & Import All Tables'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">✅</span>
                      <div>
                        <h3 className="text-xl font-bold text-green-400">Connected to PostgreSQL</h3>
                        <p className="text-slate-300">{postgresConfig.database}@{postgresConfig.host}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDisconnect}
                        className={`${isFromSavedConnection ? 'w-full' : 'flex-1'} px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors`}
                      >
                        🔌 Disconnect
                      </button>
                      {!isFromSavedConnection && (
                        <button
                          onClick={handleSaveConnection}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 rounded-lg text-white font-bold transition-all"
                        >
                          💾 Save Connection
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supabase Tab */}
            {activeTab === 'supabase' && (
              <div className="space-y-4">
                {/* Saved Connections */}
                {savedConnections.filter(c => c.type === 'supabase').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-orange-500 mb-3 font-mono">💾 SAVED CONNECTIONS</h3>
                    <div className="space-y-2">
                      {savedConnections.filter(c => c.type === 'supabase').map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                          <button
                            onClick={() => loadSavedConnection(conn)}
                            className="flex-1 text-left text-white hover:text-orange-500 transition-colors"
                          >
                            ⚡ {conn.name}
                          </button>
                          <button
                            onClick={() => deleteConnection(conn.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isConnected || connectionType !== 'supabase' ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-orange-600/20">
                    <h3 className="text-lg font-bold text-orange-500 mb-4 font-mono">⚡ Supabase Connection</h3>

                    <div className="mb-4 p-4 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-slate-400 leading-relaxed">
                      In your Supabase dashboard go to{' '}
                      <span className="text-orange-500">Project Settings → Database → Connection string</span>, copy the{' '}
                      <span className="text-orange-500">URI</span>, and replace{' '}
                      <code className="text-orange-400">[YOUR-PASSWORD]</code> with your database password.
                      <br />
                      <span className="text-slate-500">
                        Tip: prefer the connection pooler URI — direct connections are IPv6-only on the free tier.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 text-sm mb-2">Connection String</label>
                      <textarea
                        value={supabaseConfig.connectionString}
                        onChange={(e) => setSupabaseConfig({...supabaseConfig, connectionString: e.target.value})}
                        placeholder="postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
                        rows={3}
                        spellCheck={false}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-orange-500 resize-none"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-slate-300 text-sm mb-2">Table (Optional)</label>
                      <input
                        type="text"
                        value={supabaseConfig.table}
                        onChange={(e) => setSupabaseConfig({...supabaseConfig, table: e.target.value})}
                        placeholder="Leave blank for all tables"
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <button
                      onClick={() => handleDatabaseConnect('supabase')}
                      disabled={isUploading || !supabaseConfig.connectionString.trim()}
                      className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                    >
                      {isUploading ? '⏳ Connecting...' : '🔗 Connect & Import All Tables'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">✅</span>
                      <div>
                        <h3 className="text-xl font-bold text-green-400">Connected to Supabase</h3>
                        <p className="text-slate-300">{connectionLabel('supabase', supabaseConfig)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDisconnect}
                        className={`${isFromSavedConnection ? 'w-full' : 'flex-1'} px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors`}
                      >
                        🔌 Disconnect
                      </button>
                      {!isFromSavedConnection && (
                        <button
                          onClick={handleSaveConnection}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 rounded-lg text-white font-bold transition-all"
                        >
                          💾 Save Connection
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-mono transition-colors"
              >
                Cancel
              </button>
              {isFileSource(activeTab) && visibleFiles.length > 0 && (
                !isConnected || connectionType !== activeTab ? (
                  <button
                    onClick={() => handleConnectFile(activeTab as FileSourceType)}
                    disabled={!selectedFile || isUploading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-mono transition-all"
                  >
                    {isUploading ? '⏳ Connecting...' : '🔗 Connect to Dataset'}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectFile}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors"
                  >
                    🔌 Disconnect
                  </button>
                )
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
