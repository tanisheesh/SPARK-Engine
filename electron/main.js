const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Optional auto-updater (only if available)
let autoUpdater = null;
try {
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;
  console.log('✅ Auto-updater loaded successfully');
} catch (error) {
  console.log('⚠️ Auto-updater not available:', error.message);
  console.log('   This is normal for development builds');
}

// Import API handler and DuckDB client
const { setMainWindow } = require('./api-handler');
const duckdbClient = require('./duckdb-client');
const localLlmClient = require('./local-llm-client');
const { performSystemCheck } = require('./system-check');
const DatabaseConnector = require('./database-connector');
const sourceRegistry = require('./source-registry');
const secureStore = require('./secure-store');
const profiler = require('./privacy/synthesize');

// App settings directory - cross-platform (Windows: %APPDATA%, macOS: ~/Library/Application Support)
const settingsDir = app.getPath('userData');
const settingsFile = path.join(settingsDir, 'settings.json');
const uploadsDir = path.join(settingsDir, 'uploads');

// Create directories if they don't exist
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.ico'), // Use .ico for Windows
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    backgroundColor: '#000000',
    title: 'SPARK Engine - Voice Data Analytics',
    autoHideMenuBar: true, // Hide menu bar
    menuBarVisible: false   // Disable menu bar completely
  });

  // Load the app - ONLY static files (no web server)
  const isDev = process.env.NODE_ENV === 'development';
  
  // Always load from static build - no web server
  const indexPath = path.join(__dirname, '../out/index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // If no build exists, show error
    mainWindow.loadURL(`data:text/html,<html><body style="background:#000;color:#fff;font-family:monospace;padding:50px;text-align:center;"><h1>⚠️ Build Required</h1><p>Please run: <code>npm run build</code></p><p>Then restart the app</p></body></html>`);
  }
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    
    // Set mainWindow reference in API handler
    setMainWindow(mainWindow);

    // Warm up the local fallback model in the background (non-blocking) so
    // it's ready if Groq turns out to be down when the user actually asks
    // a question, instead of paying the cold-load cost during an outage.
    localLlmClient.preload();

    // Check for updates
    if (!isDev && autoUpdater) {
      try {
        autoUpdater.checkForUpdatesAndNotify();
      } catch (updateError) {
        console.error('Update check failed:', updateError);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event listeners
app.whenReady().then(async () => {
  // Move any plaintext API keys out of settings.json into the OS-encrypted
  // store. Runs before anything reads settings, so the rest of the app only
  // ever sees keys via secureStore.
  secureStore.init(settingsDir);
  const migratedKeys = secureStore.migrateFromSettings(settingsFile);
  if (migratedKeys.length) {
    console.log('🔐 Encrypted ' + migratedKeys.join(', ') + ' at rest. Rotate them: the plaintext copy may exist in a backup.');
  }

  // Register custom protocol for OAuth callback
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('spark-engine', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('spark-engine');
  }

  // Enforce single instance
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    console.log('Another instance is already running. Exiting...');
    app.quit();
    return;
  }
  
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle OAuth callback from deep link (Windows)
    const deepLink = commandLine.find(arg => arg.startsWith('spark-engine://'));
    if (deepLink) {
      mainWindow.webContents.send('oauth-callback', deepLink);
    }
  });

  // Handle OAuth callback on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('oauth-callback', url);
    }
  });
  
  // Perform system requirements check first
  const systemCheckPassed = await performSystemCheck();
  
  if (!systemCheckPassed) {
    console.log('🛑 Application terminated due to system requirements');
    app.quit();
    return;
  }
  
  // Clean up DuckDB on startup (fresh start every time)
  console.log('🧹 Cleaning up DuckDB from previous session...');
  try {
    const dbFile = path.join(settingsDir, 'data.duckdb');
    await duckdbClient.reset(dbFile);
    console.log('✅ DuckDB cleaned up successfully');

    // Clean up csv_data directory (old SQLite/DB exported CSVs)
    const csvDataDir = path.join(settingsDir, 'csv_data');
    if (fs.existsSync(csvDataDir)) {
      fs.readdirSync(csvDataDir).forEach(f => {
        try { fs.unlinkSync(path.join(csvDataDir, f)); } catch (e) {}
      });
      console.log('✅ csv_data cleaned up');
    }
  } catch (cleanupError) {
    console.error('⚠️ Failed to cleanup DuckDB:', cleanupError);
  }
  
  createWindow();
  
  // Disable default menu completely
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Release the DuckDB file lock cleanly before the process exits
app.on('before-quit', () => {
  duckdbClient.closeSync();
});

// IPC handlers
ipcMain.handle('get-settings', () => {
  try {
    let stored = {};
    if (fs.existsSync(settingsFile)) {
      stored = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
    // Keys live encrypted in secrets.json, not in settings.json, and are merged
    // back in here so the rest of the app sees the shape it always saw.
    return { ...stored, ...secureStore.getAllSecrets() };
  } catch (error) {
    console.error('Error reading settings:', error);
  }
  return {};
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    // Validate the privacy level in main rather than trusting the renderer:
    // an unrecognised value must fall back to the safest working default, not
    // be written to disk where api-handler would later read it back.
    const merged = { ...settings };
    const level = settings && settings.privacy && settings.privacy.level;
    merged.privacy = {
      ...(settings.privacy || {}),
      level: ['standard', 'strict', 'local'].includes(level) ? level : 'standard',
    };

    // Route key material to the encrypted store and keep it out of settings.json
    // entirely — including defensively, if a future caller passes one in.
    for (const field of secureStore.KEY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(merged, field)) {
        secureStore.setSecret(field, merged[field]);
        delete merged[field];
      }
    }

    fs.writeFileSync(settingsFile, JSON.stringify(merged, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-csv', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'json'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'Excel Workbooks', extensions: ['xlsx', 'xls'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0];

    // Validate file extension against every supported file source
    if (!sourceRegistry.isSupportedFile(sourcePath)) {
      return { success: false, error: 'Please select a CSV, Excel (.xlsx/.xls) or JSON file' };
    }

    // Validate file exists and is readable
    try {
      const stats = fs.statSync(sourcePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Selected item is not a file' };
      }
    } catch (error) {
      return { success: false, error: 'Cannot access the selected file' };
    }
    
    const fileName = path.basename(sourcePath);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const destPath = path.join(uploadsDir, safeFileName);
    
    try {
      const stats = fs.statSync(sourcePath);
      
      // For large files, don't copy - just reference the original path.
      // Excel is excluded: a workbook is row-capped by the format itself, and it
      // has to be converted to staged CSVs anyway, so referencing buys nothing.
      const canReferenceInPlace = sourceRegistry.sourceForFile(sourcePath) !== 'xlsx';

      if (stats.size > 500 * 1024 * 1024 && canReferenceInPlace) { // > 500MB
        console.log(`Large file detected (${(stats.size / (1024*1024*1024)).toFixed(2)}GB), using direct reference`);
        
        // Create a symlink or just store the original path
        const fileInfo = {
          name: safeFileName,
          originalPath: path.resolve(sourcePath), // Use absolute path
          size: stats.size,
          modified: stats.mtime,
          isReference: true
        };
        
        // Save file reference instead of copying
        const referencesFile = path.join(settingsDir, 'file-references.json');
        let references = [];
        if (fs.existsSync(referencesFile)) {
          try {
            references = JSON.parse(fs.readFileSync(referencesFile, 'utf8'));
          } catch (error) {
            console.error('Error reading references file:', error);
            references = [];
          }
        }
        
        // Remove existing reference if any
        references = references.filter(ref => ref.name !== safeFileName);
        references.push(fileInfo);
        
        fs.writeFileSync(referencesFile, JSON.stringify(references, null, 2));
        
        // Import in background for large files (don't block UI)
        console.log(`📊 Starting import for large file: ${safeFileName} (${(stats.size / (1024*1024*1024)).toFixed(2)}GB)`);
        mainWindow.webContents.send('upload-progress', {
          stage: 'importing',
          progress: 50,
          message: 'Importing file into database (this may take a few minutes)...'
        });

        importFileIntoDuckDB(sourcePath, safeFileName)
          .then(() => {
            mainWindow.webContents.send('upload-progress', {
              stage: 'complete',
              progress: 100,
              message: 'File imported successfully!'
            });
          })
          .catch((error) => {
            console.error('❌ Failed to import file into DuckDB:', error);
            mainWindow.webContents.send('upload-progress', {
              stage: 'error',
              progress: 0,
              message: `Import failed: ${error.message}`
            });
          });

        return {
          success: true, 
          fileName: safeFileName, 
          path: path.resolve(sourcePath), // Use original path
          size: stats.size,
          isReference: true
        };
      } else {
        // Small files - copy normally with progress tracking
        const totalSize = stats.size;
        let copiedSize = 0;
        
        // Send initial progress
        mainWindow.webContents.send('upload-progress', {
          stage: 'copying',
          progress: 0,
          message: 'Starting file copy...'
        });
        
        // Use streaming copy for progress tracking with timeout
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(sourcePath);
          const writeStream = fs.createWriteStream(destPath);
          
          // Add 5-minute timeout
          const timeout = setTimeout(() => {
            readStream.destroy();
            writeStream.destroy();
            reject(new Error('Upload timeout - file copy took too long'));
          }, 5 * 60 * 1000); // 5 minutes
          
          readStream.on('data', (chunk) => {
            copiedSize += chunk.length;
            const progress = Math.round((copiedSize / totalSize) * 100);
            mainWindow.webContents.send('upload-progress', {
              stage: 'copying',
              progress,
              message: `Copying file... ${progress}%`
            });
          });
          
          readStream.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          
          writeStream.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          
          writeStream.on('finish', () => {
            clearTimeout(timeout);
            mainWindow.webContents.send('upload-progress', {
              stage: 'complete',
              progress: 100,
              message: 'File uploaded successfully!'
            });
            resolve();
          });
          
          readStream.pipe(writeStream);
        });
        
        // Import into DuckDB (CSV / JSON / every sheet of an Excel workbook)
        try {
          await importFileIntoDuckDB(destPath, safeFileName);
        } catch (importError) {
          console.error('Failed to import file into DuckDB:', importError);
        }
        
        return { success: true, fileName: safeFileName, path: destPath, size: stats.size };
      }
      
    } catch (error) {
      mainWindow.webContents.send('upload-progress', {
        stage: 'error',
        progress: 0,
        message: `Upload failed: ${error.message}`
      });
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'No file selected' };
});

// Table name for an uploaded file: strip the extension first, then sanitise.
// (Sanitising first would turn "sales.csv" into "sales_csv", since the dot
// becomes an underscore before the extension can be stripped.)
function tableNameForFile(fileName) {
  const base = path.basename(fileName).replace(/\.(csv|xlsx|xls|json)$/i, '');
  return sourceRegistry.sanitizeIdentifier(base);
}

/**
 * Import one uploaded file into DuckDB, routing on its extension.
 * CSV and JSON each become a single table; an Excel workbook becomes one table
 * per sheet. Returns every table it created.
 */
async function importFileIntoDuckDB(filePath, fileName) {
  const dbFile = path.resolve(path.join(settingsDir, 'data.duckdb'));
  const absolutePath = path.resolve(filePath);
  const source = sourceRegistry.sourceForFile(fileName);

  if (source === 'json') {
    const tableName = tableNameForFile(fileName);
    await duckdbClient.importJSON(dbFile, tableName, absolutePath);
    console.log(`✅ JSON imported into DuckDB as table: ${tableName}`);
    return [tableName];
  }

  if (source === 'xlsx') {
    const { convertWorkbookToCSVs } = require('./xlsx-importer');
    const stagingDir = path.join(settingsDir, 'csv_data');
    console.log(`📗 Converting workbook: ${fileName}`);
    const sheets = await convertWorkbookToCSVs(absolutePath, stagingDir);

    const tableNames = [];
    for (const sheet of sheets) {
      await duckdbClient.importCSV(dbFile, sheet.tableName, sheet.csvPath);
      tableNames.push(sheet.tableName);
      // The staged CSV has served its purpose once DuckDB has the rows.
      try { fs.unlinkSync(sheet.csvPath); } catch (e) { /* best effort */ }
    }
    console.log(`✅ Workbook imported as ${tableNames.length} table(s): ${tableNames.join(', ')}`);
    return tableNames;
  }

  const tableName = tableNameForFile(fileName);
  await duckdbClient.importCSV(dbFile, tableName, absolutePath);
  console.log(`✅ CSV imported into DuckDB as table: ${tableName}`);
  return [tableName];
}

// Streaming file copy for large files
async function streamCopyFile(source, dest, progressCallback) {
  return new Promise((resolve, reject) => {
    const sourceStats = fs.statSync(source);
    const totalSize = sourceStats.size;
    let copiedSize = 0;
    
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(dest);
    
    readStream.on('data', (chunk) => {
      copiedSize += chunk.length;
      const progress = Math.round((copiedSize / totalSize) * 100);
      progressCallback(progress);
    });
    
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    
    readStream.pipe(writeStream);
  });
}

ipcMain.handle('list-csv-files', () => {
  try {
    const files = [];
    
    // Get copied files from uploads directory
    if (fs.existsSync(uploadsDir)) {
      const uploadedFiles = fs.readdirSync(uploadsDir)
        .filter(file => sourceRegistry.isSupportedFile(file))
        .map(file => {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
            isReference: false
          };
        });
      files.push(...uploadedFiles);
    }
    
    // Get referenced files (large files)
    const referencesFile = path.join(settingsDir, 'file-references.json');
    if (fs.existsSync(referencesFile)) {
      const references = JSON.parse(fs.readFileSync(referencesFile, 'utf8'));
      
      // Verify referenced files still exist
      const validReferences = references.filter(ref => {
        if (fs.existsSync(ref.originalPath)) {
          return true;
        } else {
          console.log(`Referenced file no longer exists: ${ref.originalPath}`);
          return false;
        }
      });
      
      // Update references file if some files were removed
      if (validReferences.length !== references.length) {
        fs.writeFileSync(referencesFile, JSON.stringify(validReferences, null, 2));
      }
      
      files.push(...validReferences.map(ref => ({
        name: ref.name,
        path: ref.originalPath,
        size: ref.size,
        modified: ref.modified,
        isReference: true
      })));
    }
    
    return files;
  } catch (error) {
    console.error('Error listing CSV files:', error);
    return [];
  }
});

// Delete CSV file handler
ipcMain.handle('delete-csv', (event, fileName) => {
  try {
    // Check in uploads directory
    const uploadPath = path.join(uploadsDir, fileName);
    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
      console.log(`Deleted CSV file: ${fileName}`);
      return { success: true };
    }
    
    // Check in references file
    const referencesFile = path.join(settingsDir, 'file-references.json');
    if (fs.existsSync(referencesFile)) {
      let references = JSON.parse(fs.readFileSync(referencesFile, 'utf8'));
      const originalLength = references.length;
      
      // Remove the reference
      references = references.filter(ref => ref.name !== fileName);
      
      if (references.length < originalLength) {
        fs.writeFileSync(referencesFile, JSON.stringify(references, null, 2));
        console.log(`Removed reference for: ${fileName}`);
        return { success: true };
      }
    }
    
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error deleting CSV file:', error);
    return { success: false, error: error.message };
  }
});

// Import CSV to DuckDB handler
ipcMain.handle('import-csv-to-duckdb', async (event, { filePath, fileName }) => {
  try {
    console.log(`📊 Starting import: ${fileName}`);

    const tableNames = await importFileIntoDuckDB(filePath, fileName);

    // An Excel workbook yields one table per sheet; CSV and JSON yield one.
    const message = tableNames.length > 1
      ? `Imported ${tableNames.length} sheets: ${tableNames.join(', ')}`
      : `Imported as table: ${tableNames[0]}`;

    return {
      success: true,
      tableName: tableNames[0],
      tableNames,
      message
    };
  } catch (error) {
    console.error('❌ Failed to import file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Disconnect database handler - clean up all imported tables
ipcMain.handle('disconnect-database', async (event, { type }) => {
  try {
    console.log(`🔌 Disconnecting ${type}...`);

    const dbFile = path.join(settingsDir, 'data.duckdb');
    const safeDbFile = path.resolve(dbFile);

    // Database sources drop only their own prefixed tables; the file sources
    // (CSV/Excel/JSON) share one bucket, so disconnecting any of them clears
    // every table that came from an uploaded file.
    const whereExtra = sourceRegistry.tableFilterForSource(type);

    if (whereExtra) {
      const dropped = await duckdbClient.dropTablesWhere(safeDbFile, whereExtra);
      if (dropped > 0) {
        console.log(`✅ Cleaned up ${dropped} ${type} tables`);
      }
    }

    return { success: true, message: `Disconnected from ${type}` };
  } catch (error) {
    console.error('Error disconnecting:', error);
    return { success: false, error: error.message };
  }
});

// Database connector handler
ipcMain.handle('connect-database', async (event, { type, config }) => {
  try {
    const DatabaseConnector = require('./database-connector');
    const connector = new DatabaseConnector();

    // Always wipe ALL tables before connecting - close connection and recreate DuckDB file
    try {
      const dbFile = path.join(settingsDir, 'data.duckdb');
      await duckdbClient.reset(dbFile);
      // Column profiles describe data that no longer exists once the file is
      // wiped. The cache key includes the row count, but a re-import with the
      // same shape and different values would otherwise reuse a stale profile.
      profiler.clearProfileCache();
      console.log('🧹 Pre-connect cleanup: DuckDB wiped for fresh start');
    } catch (e) { console.log('⚠️ Pre-connect cleanup skipped:', e.message); }

    mainWindow.webContents.send('upload-progress', {
      stage: 'connecting',
      progress: 30,
      message: `Connecting to ${type.toUpperCase()}...`
    });
    
    const result = await connector.connect(type, config);
    
    if (result.success) {
      mainWindow.webContents.send('upload-progress', {
        stage: 'complete',
        progress: 100,
        message: result.message
      });
    } else {
      mainWindow.webContents.send('upload-progress', {
        stage: 'error',
        progress: 0,
        message: result.error
      });
    }
    
    return result;
  } catch (error) {
    console.error('Database connection error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get database schema for ER diagrams
ipcMain.handle('get-database-schema', async (event, { connectionType, connectionConfig }) => {
  try {
    console.log('📊 Extracting schema for:', connectionType);
    
    if (connectionType === 'mysql') {
      // Use MySQL INFORMATION_SCHEMA directly
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection(connectionConfig);
      
      // Get all tables
      const [tables] = await connection.query(
        'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
        [connectionConfig.database]
      );
      
      const schema = {};
      const graph = {};
      
      // Get columns for each table
      for (const { TABLE_NAME } of tables) {
        const [columns] = await connection.query(
          'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
          [connectionConfig.database, TABLE_NAME]
        );
        
        schema[TABLE_NAME] = columns.map(c => c.COLUMN_NAME);
      }
      
      // Get foreign key relationships
      const [foreignKeys] = await connection.query(`
        SELECT 
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [connectionConfig.database]);
      
      // Build graph from foreign keys
      for (const fk of foreignKeys) {
        if (!graph[fk.TABLE_NAME]) {
          graph[fk.TABLE_NAME] = [];
        }
        
        graph[fk.TABLE_NAME].push({
          to: fk.REFERENCED_TABLE_NAME,
          type: "N:1",
          column: fk.COLUMN_NAME,
          referencedColumn: fk.REFERENCED_COLUMN_NAME
        });
      }
      
      await connection.end();
      
      console.log('✅ MySQL schema extracted:', Object.keys(schema).length, 'tables');
      console.log('🔗 Relationships found:', Object.keys(graph).length, 'tables with FKs');
      
      return { success: true, schema, graph };
      
    } else if (connectionType === 'postgresql' || connectionType === 'supabase') {
      // Use PostgreSQL INFORMATION_SCHEMA directly. Supabase is the same wire
      // protocol, so it shares this path - it just arrives as a connection URI
      // and needs TLS.
      const { Client } = require('pg');

      let clientConfig;
      if (connectionType === 'supabase') {
        const { parseSupabaseConnectionString } = require('./database-connector');
        clientConfig = {
          ...parseSupabaseConnectionString(connectionConfig.connectionString),
          ssl: { rejectUnauthorized: false }
        };
      } else {
        clientConfig = connectionConfig;
      }

      const client = new Client(clientConfig);
      await client.connect();
      
      // Get all tables
      const tablesResult = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
      );
      
      const schema = {};
      const graph = {};
      
      // Get columns for each table
      for (const { table_name } of tablesResult.rows) {
        const columnsResult = await client.query(
          'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
          [table_name]
        );
        
        schema[table_name] = columnsResult.rows.map(c => c.column_name);
      }
      
      // Get foreign key relationships
      const fkResult = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS referenced_table_name,
          ccu.column_name AS referenced_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      `);
      
      // Build graph from foreign keys
      for (const fk of fkResult.rows) {
        if (!graph[fk.table_name]) {
          graph[fk.table_name] = [];
        }
        
        graph[fk.table_name].push({
          to: fk.referenced_table_name,
          type: "N:1",
          column: fk.column_name,
          referencedColumn: fk.referenced_column_name
        });
      }
      
      await client.end();
      
      console.log(`✅ ${connectionType === 'supabase' ? 'Supabase' : 'PostgreSQL'} schema extracted:`, Object.keys(schema).length, 'tables');
      console.log('🔗 Relationships found:', Object.keys(graph).length, 'tables with FKs');
      
      return { success: true, schema, graph };
      
    } else if (connectionType === 'sqlite') {
      // Use SQLite's pragma commands
      const sqlite3 = require('better-sqlite3');
      const db = sqlite3(connectionConfig.database);
      
      // Get all tables
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      
      const schema = {};
      const graph = {};
      
      // Get columns and foreign keys for each table
      for (const { name } of tables) {
        // Get columns
        const columns = db.prepare(`PRAGMA table_info(${name})`).all();
        schema[name] = columns.map(c => c.name);
        
        // Get foreign keys
        const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${name})`).all();
        
        if (foreignKeys.length > 0) {
          graph[name] = [];
          
          for (const fk of foreignKeys) {
            graph[name].push({
              to: fk.table,
              type: "N:1",
              column: fk.from,
              referencedColumn: fk.to
            });
          }
        }
      }
      
      db.close();
      
      console.log('✅ SQLite schema extracted:', Object.keys(schema).length, 'tables');
      console.log('🔗 Relationships found:', Object.keys(graph).length, 'tables with FKs');
      
      return { success: true, schema, graph };
      
    } else {
      // For CSV or unknown types, use DuckDB
      const dbFile = path.join(settingsDir, 'data.duckdb');
      const safeDbFile = path.resolve(dbFile);

      // Get all tables
      const tables = await duckdbClient.getTables(safeDbFile, `table_name NOT LIKE '%_schema'`);

      if (tables.length === 0) {
        return { success: false, error: 'No tables found in database' };
      }

      const schema = {};
      const graph = {};

      // Get columns for each table
      for (const { table_name } of tables) {
        const columns = await duckdbClient.getColumns(safeDbFile, table_name);
        schema[table_name] = columns.map(c => c.column_name);
      }
      
      // Uploaded files carry no foreign keys, so relationships are inferred from
      // column names: a `customer_id` column points at a customers table.
      const tableNames = Object.keys(schema);

      for (const table_name of tableNames) {
        const columns = schema[table_name];
        const fkColumns = columns.filter(c => c.endsWith('_id') && c !== 'id');

        if (fkColumns.length > 0) {
          graph[table_name] = [];

          for (const fkCol of fkColumns) {
            const referenced = findReferencedTable(fkCol, table_name, tableNames);
            if (referenced) {
              graph[table_name].push({
                to: referenced,
                type: "N:1",
                column: fkCol
              });
            }
          }
        }
      }
      
      console.log('✅ DuckDB schema extracted:', Object.keys(schema).length, 'tables');
      console.log('🔗 Relationships inferred:', Object.keys(graph).length, 'tables with FKs');
      
      return { success: true, schema, graph };
    }
  } catch (error) {
    console.error('Error extracting schema:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Guess which table a foreign-key-looking column points at.
 *
 * Uploaded files have no real constraints, so this matches on naming: an
 * `customer_id` column looks for a `customer` or `customers` table. Tables are
 * matched on their trailing segment as well as their full name, because a table
 * imported from a workbook is prefixed with the file and sheet
 * ("sales_2026_customers"), and a bare-name comparison would never match it.
 *
 * @param {string} fkColumn    e.g. "customer_id"
 * @param {string} selfTable   the table the column belongs to (never self-links)
 * @param {string[]} tableNames every table currently in DuckDB
 * @returns {string|null} the referenced table name
 */
function findReferencedTable(fkColumn, selfTable, tableNames) {
  const stem = fkColumn.replace(/_id$/, '').toLowerCase();
  if (!stem) return null;

  // Singular and plural spellings of the entity the column refers to.
  const forms = new Set([stem, `${stem}s`, stem.replace(/s$/, '')]);
  const candidates = tableNames.filter(t => t !== selfTable);

  // An exact table-name match is the strongest signal.
  const exact = candidates.find(t => forms.has(t.toLowerCase()));
  if (exact) return exact;

  // Otherwise match the table's trailing name segment, which is what survives
  // the workbook/sheet prefix. Prefer the longest match so "order_items" wins
  // over "items" when both exist.
  const suffixMatches = candidates.filter(t => {
    const lower = t.toLowerCase();
    return [...forms].some(form => lower.endsWith(`_${form}`));
  });
  if (suffixMatches.length === 0) return null;

  return suffixMatches.sort((a, b) => b.length - a.length)[0];
}

async function handleFileUpload() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send('file-uploaded', result.filePaths[0]);
  }
}

// Auto updater events (only if available)
if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    autoUpdater.quitAndInstall();
  });
}