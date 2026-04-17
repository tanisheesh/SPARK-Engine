const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

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

// Import API handler and DuckDB installer
const { setMainWindow } = require('./api-handler');
const { ensureDuckDB } = require('./duckdb-installer');
const { performSystemCheck } = require('./system-check');
const DatabaseConnector = require('./database-connector');

// App settings directory
const settingsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'spark-engine');
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
    
    // Auto-install DuckDB if needed (silent)
    try {
      const duckdbSuccess = await ensureDuckDB();
      if (!duckdbSuccess) {
        console.error('⚠️ DuckDB installation failed - some features may not work');
        // Show user notification about DuckDB issue
        mainWindow.webContents.send('system-notification', {
          type: 'warning',
          message: 'Database engine installation failed. Please restart the application or install DuckDB manually.'
        });
      }
    } catch (error) {
      console.error('❌ DuckDB setup error:', error);
      mainWindow.webContents.send('system-notification', {
        type: 'error',
        message: 'Database setup failed. Some features may not work properly.'
      });
    }
    
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
    if (fs.existsSync(dbFile)) {
      // Delete the entire DuckDB file for fresh start
      fs.unlinkSync(dbFile);
      console.log('✅ DuckDB cleaned up successfully');
    }
    
    // Also clean up WAL files if they exist
    const walFile = dbFile + '.wal';
    if (fs.existsSync(walFile)) {
      fs.unlinkSync(walFile);
    }

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

// IPC handlers
ipcMain.handle('get-settings', () => {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading settings:', error);
  }
  return {};
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
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
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0];
    
    // Validate file extension
    if (!sourcePath.toLowerCase().endsWith('.csv')) {
      return { success: false, error: 'Please select a valid CSV file' };
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
      
      // For large files, don't copy - just reference the original path
      if (stats.size > 500 * 1024 * 1024) { // > 500MB
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
        
        // Import CSV into DuckDB (async, don't wait for large files)
        const dbFile = path.join(settingsDir, 'data.duckdb');
        const safeDbFile = path.resolve(dbFile);
        const tableName = safeFileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.csv$/i, '');
        
        // Find DuckDB executable
        let duckdbCommand = 'duckdb';
        const appDir = path.dirname(process.execPath);
        const possiblePaths = [
          path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
          path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
        ];
        
        for (const duckdbPath of possiblePaths) {
          if (fs.existsSync(duckdbPath)) {
            duckdbCommand = `"${path.resolve(duckdbPath)}"`;
            break;
          }
        }
        
        const { exec } = require('child_process');
        
        // Import CSV in background for large files (don't block UI)
        console.log(`📊 Starting CSV import for large file: ${safeFileName} (${(stats.size / (1024*1024*1024)).toFixed(2)}GB)`);
        mainWindow.webContents.send('upload-progress', {
          stage: 'importing',
          progress: 50,
          message: 'Importing CSV into database (this may take a few minutes)...'
        });
        
        const createTableCmd = `${duckdbCommand} "${safeDbFile}" -c "CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${path.resolve(sourcePath)}'"`;
        
        // Run import in background
        exec(createTableCmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Failed to import CSV into DuckDB:', error);
            mainWindow.webContents.send('upload-progress', {
              stage: 'error',
              progress: 0,
              message: `Import failed: ${error.message}`
            });
          } else {
            console.log(`✅ CSV imported into DuckDB as table: ${tableName}`);
            mainWindow.webContents.send('upload-progress', {
              stage: 'complete',
              progress: 100,
              message: 'CSV imported successfully!'
            });
          }
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
        
        // Import CSV into DuckDB
        try {
          const dbFile = path.join(settingsDir, 'data.duckdb');
          const safeDbFile = path.resolve(dbFile);
          const tableName = safeFileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.csv$/i, '');
          
          // Find DuckDB executable
          let duckdbCommand = 'duckdb';
          const appDir = path.dirname(process.execPath);
          const possiblePaths = [
            path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
            path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
          ];
          
          for (const duckdbPath of possiblePaths) {
            if (fs.existsSync(duckdbPath)) {
              duckdbCommand = `"${path.resolve(duckdbPath)}"`;
              break;
            }
          }
          
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          // Create table from CSV
          const createTableCmd = `${duckdbCommand} "${safeDbFile}" -c "CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${destPath}'"`;
          await execAsync(createTableCmd, { timeout: 120000 });
          
          console.log(`✅ CSV imported into DuckDB as table: ${tableName}`);
        } catch (importError) {
          console.error('Failed to import CSV into DuckDB:', importError);
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
        .filter(file => file.endsWith('.csv'))
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
    console.log(`📊 Starting CSV import: ${fileName}`);
    
    const dbFile = path.join(settingsDir, 'data.duckdb');
    const safeDbFile = path.resolve(dbFile);
    const tableName = fileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.csv$/i, '');
    
    // Find DuckDB executable
    let duckdbCommand = 'duckdb';
    const appDir = path.dirname(process.execPath);
    const possiblePaths = [
      path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
      path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
    ];
    
    for (const duckdbPath of possiblePaths) {
      if (fs.existsSync(duckdbPath)) {
        duckdbCommand = `"${path.resolve(duckdbPath)}"`;
        break;
      }
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Create table from CSV
    const createTableCmd = `${duckdbCommand} "${safeDbFile}" -c "CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${path.resolve(filePath)}'"`;
    
    console.log(`🔄 Importing CSV into DuckDB table: ${tableName}`);
    await execAsync(createTableCmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
    
    console.log(`✅ CSV imported successfully as table: ${tableName}`);
    
    return {
      success: true,
      tableName: tableName,
      message: `CSV imported as table: ${tableName}`
    };
  } catch (error) {
    console.error('❌ Failed to import CSV:', error);
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
    
    // Find DuckDB executable
    let duckdbCommand = 'duckdb';
    const appDir = path.dirname(process.execPath);
    const possiblePaths = [
      path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
      path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
    ];
    
    for (const duckdbPath of possiblePaths) {
      if (fs.existsSync(duckdbPath)) {
        duckdbCommand = `"${path.resolve(duckdbPath)}"`;
        break;
      }
    }
    
    // Get table prefix based on type
    let prefix = '';
    if (type === 'mysql') prefix = 'mysql_%';
    else if (type === 'sqlite') prefix = 'sqlite_%';
    else if (type === 'postgresql') prefix = 'postgres_%';
    else if (type === 'csv') {
      // For CSV, drop all tables that don't have database prefixes
      const cleanupSQL = `
        SELECT 'DROP TABLE IF EXISTS ' || table_name || ';' as drop_stmt
        FROM information_schema.tables 
        WHERE table_schema='main' 
        AND table_name NOT LIKE 'mysql_%' 
        AND table_name NOT LIKE 'sqlite_%' 
        AND table_name NOT LIKE 'postgres_%'
      `;
      
      const { stdout: dropStmts } = await execAsync(`${duckdbCommand} "${safeDbFile}" -json -c "${cleanupSQL}"`, { timeout: 10000 });
      const drops = JSON.parse(dropStmts.trim() || '[]');
      
      if (drops.length > 0) {
        const dropSQL = drops.map(d => d.drop_stmt).join(' ');
        await execAsync(`${duckdbCommand} "${safeDbFile}" -c "${dropSQL}"`, { timeout: 30000 });
        console.log(`✅ Cleaned up ${drops.length} CSV tables`);
      }
      
      return { success: true, message: `Disconnected from ${type}` };
    }
    
    if (prefix) {
      // Get all tables with this prefix
      const cleanupSQL = `
        SELECT 'DROP TABLE IF EXISTS ' || table_name || ';' as drop_stmt
        FROM information_schema.tables 
        WHERE table_schema='main' AND table_name LIKE '${prefix}'
      `;
      
      const { stdout: dropStmts } = await execAsync(`${duckdbCommand} "${safeDbFile}" -json -c "${cleanupSQL}"`, { timeout: 10000 });
      const drops = JSON.parse(dropStmts.trim() || '[]');
      
      if (drops.length > 0) {
        const dropSQL = drops.map(d => d.drop_stmt).join(' ');
        await execAsync(`${duckdbCommand} "${safeDbFile}" -c "${dropSQL}"`, { timeout: 30000 });
        console.log(`✅ Cleaned up ${drops.length} ${type} tables`);
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

    // Always wipe ALL tables before connecting - delete and recreate DuckDB file
    try {
      const dbFile = path.join(settingsDir, 'data.duckdb');
      if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
      const walFile = dbFile + '.wal';
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
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
      
    } else if (connectionType === 'postgresql') {
      // Use PostgreSQL INFORMATION_SCHEMA directly
      const { Client } = require('pg');
      const client = new Client(connectionConfig);
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
      
      console.log('✅ PostgreSQL schema extracted:', Object.keys(schema).length, 'tables');
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
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);
      
      const dbFile = path.join(settingsDir, 'data.duckdb');
      const safeDbFile = path.resolve(dbFile);
      
      // Find DuckDB executable
      let duckdbCommand = 'duckdb';
      const appDir = path.dirname(process.execPath);
      const possiblePaths = [
        path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
      ];
      
      for (const duckdbPath of possiblePaths) {
        if (fs.existsSync(duckdbPath)) {
          duckdbCommand = `"${path.resolve(duckdbPath)}"`;
          break;
        }
      }
      
      // Get all tables
      const tablesSQL = `SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_name NOT LIKE '%_schema'`;
      const { stdout: tablesOutput } = await execPromise(`${duckdbCommand} "${safeDbFile}" -json -c "${tablesSQL}"`, { timeout: 10000 });
      const tables = JSON.parse(tablesOutput.trim() || '[]');
      
      if (tables.length === 0) {
        return { success: false, error: 'No tables found in database' };
      }
      
      const schema = {};
      const graph = {};
      
      // Get columns for each table
      for (const { table_name } of tables) {
        const columnsSQL = `SELECT column_name FROM information_schema.columns WHERE table_name='${table_name}' ORDER BY ordinal_position`;
        const { stdout: columnsOutput } = await execPromise(`${duckdbCommand} "${safeDbFile}" -json -c "${columnsSQL}"`, { timeout: 10000 });
        const columns = JSON.parse(columnsOutput.trim() || '[]');
        
        schema[table_name] = columns.map(c => c.column_name);
      }
      
      // For CSV, try to infer relationships from column names
      for (const table_name of Object.keys(schema)) {
        const columns = schema[table_name];
        const fkColumns = columns.filter(c => c.endsWith('_id') && c !== 'id');
        
        if (fkColumns.length > 0) {
          graph[table_name] = [];
          
          for (const fkCol of fkColumns) {
            const fkBaseName = fkCol.replace(/_id$/, '');
            
            // Look for matching table
            for (const t of Object.keys(schema)) {
              if (t === fkBaseName || t === fkBaseName + 's' || t + 's' === fkBaseName) {
                graph[table_name].push({
                  to: t,
                  type: "N:1"
                });
                break;
              }
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