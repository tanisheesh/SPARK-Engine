const { dialog, shell } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');

const execAsync = promisify(exec);

async function checkDuckDB() {
  try {
    // Check if DuckDB is available in PATH
    await execAsync('duckdb --version', { timeout: 5000 });
    return true;
  } catch (error) {
    // Check if local DuckDB exists in app directory
    const appDir = path.dirname(process.execPath);
    const localDuckDB = path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb');
    
    if (fs.existsSync(localDuckDB)) {
      try {
        await execAsync(`"${localDuckDB}" --version`, { timeout: 5000 });
        return true;
      } catch (localError) {
        console.log('Local DuckDB exists but not working, will reinstall');
        return false;
      }
    }
    
    return false;
  }
}

async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function extractZip(zipPath, extractPath) {
  const AdmZip = require('adm-zip');
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    return true;
  } catch (error) {
    console.error('Extract error:', error);
    return false;
  }
}

async function autoInstallDuckDB() {
  try {
    console.log('🦆 Auto-installing DuckDB...');
    
    const platform = os.platform();
    const appDir = path.dirname(process.execPath);
    const tempDir = path.join(os.tmpdir(), 'duckdb-install');
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let downloadUrl, fileName, executableName;
    
    if (platform === 'win32') {
      downloadUrl = 'https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-windows-amd64.zip';
      fileName = 'duckdb-windows.zip';
      executableName = 'duckdb.exe';
    } else if (platform === 'darwin') {
      downloadUrl = 'https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-osx-universal.zip';
      fileName = 'duckdb-mac.zip';
      executableName = 'duckdb';
    } else if (platform === 'linux') {
      downloadUrl = 'https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip';
      fileName = 'duckdb-linux.zip';
      executableName = 'duckdb';
    } else {
      throw new Error('Unsupported platform');
    }
    
    const zipPath = path.join(tempDir, fileName);
    const extractPath = path.join(tempDir, 'extracted');
    
    // Download DuckDB
    console.log('📥 Downloading DuckDB...');
    await downloadFile(downloadUrl, zipPath);
    
    // Extract ZIP
    console.log('📦 Extracting DuckDB...');
    await extractZip(zipPath, extractPath);
    
    // Find the executable
    const files = fs.readdirSync(extractPath);
    const duckdbFile = files.find(file => file.includes('duckdb') && (platform === 'win32' ? file.endsWith('.exe') : !file.includes('.')));
    
    if (!duckdbFile) {
      throw new Error('DuckDB executable not found in archive');
    }
    
    const sourcePath = path.join(extractPath, duckdbFile);
    const targetPath = path.join(appDir, executableName);
    
    // Copy to app directory
    console.log('📋 Installing DuckDB...');
    fs.copyFileSync(sourcePath, targetPath);
    
    // Make executable on Unix systems
    if (platform !== 'win32') {
      fs.chmodSync(targetPath, '755');
    }
    
    // Add to PATH environment for this process
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(appDir)) {
      process.env.PATH = `${appDir}${path.delimiter}${currentPath}`;
    }
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('✅ DuckDB installed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ DuckDB auto-install failed:', error);
    return false;
  }
}

async function ensureDuckDB() {
  const isInstalled = await checkDuckDB();
  if (isInstalled) {
    console.log('✅ DuckDB already available');
    return true;
  }
  
  console.log('🔍 DuckDB not found, auto-installing...');
  const success = await autoInstallDuckDB();
  
  if (success) {
    // Verify installation worked
    const verified = await checkDuckDB();
    if (verified) {
      console.log('✅ DuckDB installation verified successfully!');
      return true;
    } else {
      console.error('❌ DuckDB installation verification failed');
      return false;
    }
  }
  
  return false;
}

module.exports = { checkDuckDB, ensureDuckDB };