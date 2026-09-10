'use client';

import { useState, useEffect } from 'react';
import {
  isFileSource,
  matchesFileSource,
  type DataSourceType,
  type DatabaseSourceType,
  type FileSourceType
} from '../lib/data-sources';
import { Button, EmptyState, Field, IconButton, Input, StatusDot, cx } from './ui/Primitives';
import { IconCheck, IconClose, IconData, IconFile, IconLock, IconPlug, IconTrash } from './ui/Icons';
import { quotaFor } from '../lib/spark/quotas';
import type { Tier } from '../lib/api';

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
  plan: Tier | null;
  onUpgrade?: () => void;
}

type TabType = DataSourceType;

// Per-file-source copy for the shared upload panel. The three file tabs are the
// same UI over a different extension filter.
const FILE_TAB_COPY: Record<FileSourceType, { title: string; blurb: string; noun: string }> = {
  csv: {
    title: 'Upload a CSV file',
    blurb: 'Select a CSV file from your computer to analyze with SPARK Engine',
    noun: 'CSV'
  },
  xlsx: {
    title: 'Upload an Excel workbook',
    blurb: 'Select an .xlsx or .xls workbook — every sheet becomes its own table',
    noun: 'workbook'
  },
  json: {
    title: 'Upload a JSON file',
    blurb: 'Select a .json file — an array of records works best',
    noun: 'JSON'
  }
};

// Field spec for the generic database connection form — every DB tab except
// Supabase (which takes one connection-string textarea, handled separately)
// renders from this.
interface DbField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  optional?: boolean;
  span?: 2;
}

const DB_FIELDS: Partial<Record<DatabaseSourceType, DbField[]>> = {
  mysql: [
    { key: 'host', label: 'Host', placeholder: 'localhost' },
    { key: 'port', label: 'Port', placeholder: '3306' },
    { key: 'user', label: 'Username', placeholder: 'root' },
    { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    { key: 'database', label: 'Database', placeholder: 'my_database', span: 2 },
    { key: 'table', label: 'Table', placeholder: 'Leave blank for all tables', optional: true, span: 2 },
  ],
  postgresql: [
    { key: 'host', label: 'Host', placeholder: 'localhost' },
    { key: 'port', label: 'Port', placeholder: '5432' },
    { key: 'user', label: 'Username', placeholder: 'postgres' },
    { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    { key: 'database', label: 'Database', placeholder: 'my_database', span: 2 },
    { key: 'table', label: 'Table', placeholder: 'Leave blank for all tables', optional: true, span: 2 },
  ],
  sqlite: [
    { key: 'filePath', label: 'Database file path', placeholder: 'C:\\path\\to\\database.db', span: 2 },
    { key: 'table', label: 'Table', placeholder: 'Leave blank for all tables', optional: true, span: 2 },
  ],
};

const DB_LABEL: Record<DatabaseSourceType, string> = {
  mysql: 'MySQL',
  sqlite: 'SQLite',
  postgresql: 'PostgreSQL',
  supabase: 'Supabase',
};

// A connection is ready to attempt once every non-optional field has a value.
function isDbConfigComplete(type: DatabaseSourceType, config: any): boolean {
  if (type === 'supabase') return !!config.connectionString?.trim();
  const fields = DB_FIELDS[type] ?? [];
  return fields.every((f) => f.optional || String(config[f.key] ?? '').trim().length > 0);
}

export default function FileUpload({ isOpen, onClose, onFileSelected, currentDatasetType, plan, onUpgrade }: FileUploadProps) {
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

  const CONFIG_FOR: Record<DatabaseSourceType, { config: any; setConfig: (c: any) => void }> = {
    mysql: { config: mysqlConfig, setConfig: setMysqlConfig },
    sqlite: { config: sqliteConfig, setConfig: setSqliteConfig },
    postgresql: { config: postgresConfig, setConfig: setPostgresConfig },
    supabase: { config: supabaseConfig, setConfig: setSupabaseConfig },
  };

  useEffect(() => {
    if (isOpen) {
      loadCSVFiles();
      loadSavedConnections();

      // The modal fully unmounts on close (page.tsx renders it only while
      // showFileUpload is true), so isConnected/connectionType would otherwise
      // reset to their initial false/null on every reopen and show "Connect
      // to dataset" even though a source is already connected. currentDatasetType
      // is the parent's real-time source of truth — resync from it on open.
      setIsConnected(!!currentDatasetType);
      setConnectionType(currentDatasetType);
      if (currentDatasetType) setActiveTab(currentDatasetType);

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

    // TIERS.txt's "DB connections saved" limit.
    const limit = quotaFor(plan).savedConnections;
    if (limit !== null && savedConnections.length >= limit) {
      alert(`Your plan can save up to ${limit} connection${limit === 1 ? '' : 's'}. Delete one, or upgrade for more.`);
      onUpgrade?.();
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
  };

  const deleteConnection = (id: string) => {
    if (confirm('Are you sure you want to delete this saved connection?')) {
      const updated = savedConnections.filter(conn => conn.id !== id);
      setSavedConnections(updated);
      localStorage.setItem('savedDatabaseConnections', JSON.stringify(updated));
    }
  };

  const loadSavedConnection = (conn: SavedConnection) => {
    CONFIG_FOR[conn.type].setConfig(conn.config);
    setActiveTab(conn.type);
    // Mark that this connection is from saved list
    setIsFromSavedConnection(true);
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadProgress({ stage: 'starting', progress: 0, message: 'Preparing upload...' });

    try {
      if (window.electronAPI) {
        // TIERS.txt's CSV size limit — checked in the main process before
        // any copy/import happens, not after (see electron/main.js).
        const csvSizeGb = quotaFor(plan).csvSizeGb;
        const maxSizeBytes = csvSizeGb != null ? csvSizeGb * 1024 ** 3 : undefined;
        const result = await window.electronAPI.uploadCSV(maxSizeBytes);
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
        const config = CONFIG_FOR[dbType].config;

        const result = await window.electronAPI.connectDatabase({
          type: dbType,
          config,
          allowedTypes: quotaFor(plan).allowedSources,
        });

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
    if (connectionType && connectionType in CONFIG_FOR) {
      saveConnection(connectionType as DatabaseSourceType, CONFIG_FOR[connectionType as DatabaseSourceType].config);
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
          const result = await window.electronAPI.deleteCSV(fileName);
          if (result.success) {
            loadCSVFiles();
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

  const tabs: { id: TabType; label: string; kind: 'file' | 'db' }[] = [
    { id: 'csv', label: 'CSV', kind: 'file' },
    { id: 'xlsx', label: 'Excel', kind: 'file' },
    { id: 'json', label: 'JSON', kind: 'file' },
    { id: 'mysql', label: 'MySQL', kind: 'db' },
    { id: 'sqlite', label: 'SQLite', kind: 'db' },
    { id: 'postgresql', label: 'PostgreSQL', kind: 'db' },
    { id: 'supabase', label: 'Supabase', kind: 'db' },
  ];

  // The upload dialog accepts every supported type, so the shared file list is
  // filtered down to the tab the user is actually looking at.
  const visibleFiles = isFileSource(activeTab)
    ? csvFiles.filter(file => matchesFileSource(file.name, activeTab as FileSourceType))
    : [];

  if (!isOpen) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label="Data sources">
      {/* Tabs */}
      <div className="flex gap-5 overflow-x-auto border-b border-line-subtle px-6">
        {tabs.map((tab) => {
          const isActiveConnection = currentDatasetType === tab.id;
          const isLocked = !quotaFor(plan).allowedSources.includes(tab.id);
          const isDisabled = isLocked || !!(currentDatasetType && currentDatasetType !== tab.id);
          const Icon = tab.kind === 'db' ? IconData : IconFile;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (isLocked) onUpgrade?.();
                else if (!isDisabled) setActiveTab(tab.id);
              }}
              disabled={isDisabled && !isLocked}
              title={isLocked ? `Upgrade to unlock ${tab.label}` : undefined}
              className={cx(
                'relative flex shrink-0 items-center gap-1.5 -mb-px border-b pb-2.5 pt-3 text-sm transition-colors duration-1 ease-out',
                activeTab === tab.id
                  ? 'border-accent text-ink'
                  : isLocked
                  ? 'border-transparent text-faint hover:text-muted'
                  : isDisabled
                  ? 'cursor-not-allowed border-transparent text-faint opacity-45'
                  : 'border-transparent text-faint hover:text-muted'
              )}
            >
              <Icon size={13} />
              {tab.label}
              {isLocked && <IconLock size={11} className="text-faint" />}
              {isActiveConnection && <StatusDot state="connected" className="ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="mx-auto min-h-0 w-full max-w-[720px] flex-1 overflow-y-auto px-6 py-6">
        {uploadProgress && (
          <div className="mb-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
              <div
                className={cx(
                  'h-full transition-all duration-300',
                  uploadProgress.stage === 'error' ? 'bg-negative' : 'bg-accent'
                )}
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
            <p className={cx('mt-1.5 text-sm', uploadProgress.stage === 'error' ? 'text-negative' : 'text-muted')}>
              {uploadProgress.message}
            </p>
            {uploadProgress.stage === 'error' && uploadProgress.message.includes('Upgrade') && onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="mt-1 text-sm text-accent transition-colors duration-1 hover:text-accent-hi"
              >
                View plans →
              </button>
            )}
          </div>
        )}

        {isFileSource(activeTab) && (
          <FileSourcePanel
            copy={FILE_TAB_COPY[activeTab as FileSourceType]}
            files={visibleFiles}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            onDelete={handleDeleteCSV}
            onUpload={handleUpload}
            uploading={isUploading}
            formatFileSize={formatFileSize}
          />
        )}

        {!isFileSource(activeTab) && (
          <DatabasePanel
            type={activeTab as DatabaseSourceType}
            config={CONFIG_FOR[activeTab as DatabaseSourceType].config}
            setConfig={CONFIG_FOR[activeTab as DatabaseSourceType].setConfig}
            connected={isConnected && connectionType === activeTab}
            connectionLabel={connectionLabel}
            savedConnections={savedConnections.filter((c) => c.type === activeTab)}
            onLoadSaved={loadSavedConnection}
            onDeleteSaved={deleteConnection}
            fromSaved={isFromSavedConnection}
            uploading={isUploading}
            onConnect={() => handleDatabaseConnect(activeTab as DatabaseSourceType)}
            onDisconnect={handleDisconnect}
            onSaveConnection={handleSaveConnection}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-line-subtle px-6 py-3">
        <span className="flex-1" />
        <Button onClick={onClose}>Cancel</Button>
        {isFileSource(activeTab) && visibleFiles.length > 0 && (
          !isConnected || connectionType !== activeTab ? (
            <Button
              variant="primary"
              onClick={() => handleConnectFile(activeTab as FileSourceType)}
              disabled={!selectedFile || isUploading}
              loading={isUploading}
            >
              <IconPlug size={12} />
              Connect to dataset
            </Button>
          ) : (
            <Button onClick={handleDisconnectFile}>
              <IconClose size={12} />
              Disconnect
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/* ============================================================
   File source panel — shared by CSV, Excel and JSON
   ============================================================ */

function FileSourcePanel({
  copy,
  files,
  selectedFile,
  onSelect,
  onDelete,
  onUpload,
  uploading,
  formatFileSize,
}: {
  copy: { title: string; blurb: string; noun: string };
  files: CSVFile[];
  selectedFile: string;
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
  onUpload: () => void;
  uploading: boolean;
  formatFileSize: (bytes: number) => string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-line px-8 py-10 text-center">
        <IconFile size={28} className="mx-auto text-faint" />
        <h3 className="mt-3 text-base font-medium text-ink">{copy.title}</h3>
        <p className="mt-1 text-sm text-muted">{copy.blurb}</p>
        <Button variant="primary" className="mt-5" onClick={onUpload} disabled={uploading} loading={uploading}>
          Browse & upload
        </Button>
      </div>

      <div>
        <h3 className="eyebrow mb-2">Available datasets</h3>
        {files.length === 0 ? (
          <EmptyState
            title={`No ${copy.noun} datasets yet`}
            body="Upload your first dataset to get started."
          />
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => onSelect(file.name)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-1 ease-out',
                  selectedFile === file.name
                    ? 'border-accent-line bg-accent-soft'
                    : 'border-line-subtle hover:border-line'
                )}
              >
                <span
                  className={cx(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selectedFile === file.name ? 'border-accent bg-accent' : 'border-line'
                  )}
                >
                  {selectedFile === file.name && <IconCheck size={10} className="text-accent-ink" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-ink">{file.name}</span>
                  <span className="block text-xs text-faint">{formatFileSize(file.size)}</span>
                </span>
                <IconButton
                  label="Delete"
                  tone="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.name);
                  }}
                >
                  <IconTrash size={13} />
                </IconButton>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Database panel — shared by MySQL, PostgreSQL, SQLite, Supabase
   ============================================================ */

function DatabasePanel({
  type,
  config,
  setConfig,
  connected,
  connectionLabel,
  savedConnections,
  onLoadSaved,
  onDeleteSaved,
  fromSaved,
  uploading,
  onConnect,
  onDisconnect,
  onSaveConnection,
}: {
  type: DatabaseSourceType;
  config: any;
  setConfig: (c: any) => void;
  connected: boolean;
  connectionLabel: (type: DatabaseSourceType, config: any) => string;
  savedConnections: SavedConnection[];
  onLoadSaved: (conn: SavedConnection) => void;
  onDeleteSaved: (id: string) => void;
  fromSaved: boolean;
  uploading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSaveConnection: () => void;
}) {
  if (connected) {
    return (
      <div className="rounded-xl border border-accent-line bg-accent-soft p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
            <IconCheck size={14} className="text-accent-ink" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-medium text-ink">Connected to {DB_LABEL[type]}</h3>
            <p className="truncate text-sm text-muted">{connectionLabel(type, config)}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className={fromSaved ? 'w-full' : 'flex-1'} onClick={onDisconnect}>
            Disconnect
          </Button>
          {!fromSaved && (
            <Button variant="primary" className="flex-1" onClick={onSaveConnection}>
              Save connection
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {savedConnections.length > 0 && (
        <div>
          <h3 className="eyebrow mb-2">Saved connections</h3>
          <div className="space-y-1.5">
            {savedConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-2 rounded-lg border border-line-subtle px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onLoadSaved(conn)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-base text-ink transition-colors duration-1 hover:text-accent"
                >
                  <IconData size={13} className="shrink-0 text-faint" />
                  <span className="truncate">{conn.name}</span>
                </button>
                <IconButton label="Delete" tone="danger" onClick={() => onDeleteSaved(conn.id)}>
                  <IconTrash size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-base font-medium text-ink">{DB_LABEL[type]} connection</h3>

        {type === 'supabase' ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-line-subtle bg-surface2 px-3.5 py-2.5 text-sm leading-relaxed text-muted">
              In your Supabase dashboard go to{' '}
              <span className="text-ink">Project Settings → Database → Connection string</span>, copy the{' '}
              <span className="text-ink">URI</span>, and replace{' '}
              <code className="text-accent">[YOUR-PASSWORD]</code> with your database password.
              <br />
              <span className="text-faint">
                Tip: prefer the connection pooler URI — direct connections are IPv6-only on the free tier.
              </span>
            </p>

            <Field label="Connection string">
              <textarea
                value={config.connectionString}
                onChange={(e) => setConfig({ ...config, connectionString: e.target.value })}
                placeholder="postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
                rows={3}
                spellCheck={false}
                className="w-full resize-none rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-xs text-ink placeholder:text-faint transition-colors duration-1 ease-out hover:border-[#3A3B3B] focus:border-accent-line focus:outline-none"
              />
            </Field>

            <Field label="Table" optional>
              <Input
                value={config.table}
                onChange={(e) => setConfig({ ...config, table: e.target.value })}
                placeholder="Leave blank for all tables"
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {(DB_FIELDS[type] ?? []).map((f) => (
              <div key={f.key} className={f.span === 2 ? 'col-span-2' : undefined}>
                <Field label={f.label} optional={f.optional}>
                  <Input
                    type={f.type ?? 'text'}
                    value={config[f.key]}
                    onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                </Field>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="primary"
          className="mt-5 w-full"
          onClick={onConnect}
          disabled={uploading || !isDbConfigComplete(type, config)}
          loading={uploading}
        >
          <IconPlug size={12} />
          Connect & import all tables
        </Button>
      </div>
    </div>
  );
}
