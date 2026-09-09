const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { dialog, BrowserWindow } = require('electron');

// System Requirements
const REQUIREMENTS = {
  minRam: 4 * 1024 * 1024 * 1024, // 4GB in bytes
  minStorage: 500 * 1024 * 1024,  // 500MB in bytes
  supportedOS: ['win32', 'darwin', 'linux'],
  minNodeVersion: '16.0.0'
};

/**
 * Check available disk space
 * @param {string} dirPath - Directory path to check
 * @returns {number} - Available space in bytes
 */
function getAvailableSpace(dirPath) {
  try {
    const platform = os.platform();
    let command;
    
    if (platform === 'win32') {
      // Windows: Use PowerShell to get free space
      const drive = path.parse(dirPath).root;
      command = `powershell "Get-WmiObject -Class Win32_LogicalDisk -Filter \\"DeviceID='${drive.replace('\\', '')}'\\" | Select-Object -ExpandProperty FreeSpace"`;
    } else if (platform === 'darwin') {
      // macOS: Use df command
      command = `df -k "${dirPath}" | tail -1 | awk '{print $4 * 1024}'`;
    } else {
      // Linux: Use df command
      command = `df -k "${dirPath}" | tail -1 | awk '{print $4 * 1024}'`;
    }
    
    const result = execSync(command, { encoding: 'utf8' }).trim();
    return parseInt(result) || 0;
  } catch (error) {
    console.warn('Could not check disk space:', error.message);
    return REQUIREMENTS.minStorage; // Assume we have enough space if check fails
  }
}

/**
 * Check if system meets minimum requirements
 * @returns {Object} { passed: boolean, issues: string[] }
 */
function checkSystemRequirements() {
  const issues = [];
  
  try {
    // Check Operating System
    const platform = os.platform();
    if (!REQUIREMENTS.supportedOS.includes(platform)) {
      issues.push(`Unsupported operating system: ${platform}. Supported: Windows, macOS, Linux`);
    }
    
    // Check RAM
    const totalRam = os.totalmem();
    const ramGB = (totalRam / (1024 * 1024 * 1024)).toFixed(1);
    if (totalRam < REQUIREMENTS.minRam) {
      issues.push(`Insufficient RAM: ${ramGB}GB detected. Minimum required: 4GB`);
    }
    
    // Check available storage
    const homeDir = os.homedir();
    const availableSpace = getAvailableSpace(homeDir);
    const spaceGB = (availableSpace / (1024 * 1024 * 1024)).toFixed(1);
    
    if (availableSpace < REQUIREMENTS.minStorage) {
      issues.push(`Insufficient storage: ${spaceGB}GB available. Minimum required: 0.5GB`);
    }
    
    // Check CPU architecture
    const arch = os.arch();
    if (arch !== 'x64' && arch !== 'arm64') {
      issues.push(`Unsupported CPU architecture: ${arch}. Supported: x64, arm64`);
    }
    
    // Check Node.js version (for development info)
    const nodeVersion = process.version;
    console.log(`Node.js version: ${nodeVersion}`);
    
    return {
      passed: issues.length === 0,
      issues: issues,
      systemInfo: {
        os: platform,
        arch: arch,
        ram: `${ramGB}GB`,
        storage: `${spaceGB}GB available`,
        nodeVersion: nodeVersion
      }
    };
    
  } catch (error) {
    console.error('System check failed:', error);
    return {
      passed: false,
      issues: [`System check failed: ${error.message}`],
      systemInfo: null
    };
  }
}

/**
 * Show system requirements dialog
 * @param {Object} checkResult - Result from checkSystemRequirements()
 * @returns {boolean} - Whether user wants to continue despite issues
 */
async function showSystemRequirementsDialog(checkResult) {
  if (checkResult.passed) {
    return true; // All good, continue
  }
  
  const issuesList = checkResult.issues.map(issue => `• ${issue}`).join('\n');
  
  const result = await dialog.showMessageBox(null, {
    type: 'warning',
    title: 'System Requirements Not Met',
    message: 'Your system does not meet the minimum requirements for SPARK Engine',
    detail: `Issues found:\n\n${issuesList}\n\nMinimum Requirements:\n• Windows 7+ / macOS 10.12+ / Ubuntu 16.04+\n• 4GB RAM\n• 500MB free storage\n• 64-bit processor\n\nThe application may not work properly on this system.`,
    buttons: ['Exit Application', 'Continue Anyway'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    normalizeAccessKeys: false
  });
  
  return result.response === 1; // Continue if user clicked "Continue Anyway"
}

/**
 * Show system check progress
 */
function showSystemCheckSplash() {
  const splash = new BrowserWindow({
    width: 450,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Get the icon path and convert to base64
  // In production, icon is in extraResources; in dev it's in public/
  let iconBase64 = '';
  try {
    const { app } = require('electron');
    const possiblePaths = [
      path.join(process.resourcesPath, 'icon.png'),           // production extraResources
      path.join(__dirname, '../public/icon.png'),              // dev
      path.join(app.getAppPath(), 'public/icon.png'),          // packaged app
    ];
    for (const iconPath of possiblePaths) {
      if (fs.existsSync(iconPath)) {
        const iconBuffer = fs.readFileSync(iconPath);
        iconBase64 = `data:image/png;base64,${iconBuffer.toString('base64')}`;
        break;
      }
    }
  } catch (error) {
    console.error('Failed to load icon:', error);
  }

  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: #0f0a1a;
          color: white;
        }
        body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          position: relative;
        }
        /* Background grid pattern */
        body::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, #1a1221 1px, transparent 1px),
                      linear-gradient(to bottom, #1a1221 1px, transparent 1px);
          background-size: 4rem 4rem;
          mask-image: radial-gradient(ellipse 80% 50% at 50% 50%, #000 70%, transparent 110%);
          -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 50%, #000 70%, transparent 110%);
          pointer-events: none;
        }
        .logo-container {
          position: relative;
          width: 150px;
          height: 150px;
          margin-bottom: 30px;
          z-index: 1;
          border-radius: 50%;
          border: 4px solid rgba(217, 119, 6, 0.5);
          background: linear-gradient(135deg, #0f172a, #1e293b);
          box-shadow: 0 0 30px rgba(217, 119, 6, 0.4);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .logo-text {
          font-size: 32px;
          font-weight: 900;
          background: linear-gradient(to right, #D97706, #EA580C, #D97706);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 30px;
          letter-spacing: 3px;
          text-shadow: 0 0 20px rgba(217, 119, 6, 0.3);
          z-index: 1;
        }
        .status {
          font-size: 16px;
          font-weight: 400;
          color: rgba(217, 119, 6, 0.7);
          text-align: center;
          margin-top: 10px;
          z-index: 1;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(217, 119, 6, 0.1);
          border-top: 4px solid #D97706;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 20px 0;
          box-shadow: 0 0 20px rgba(217, 119, 6, 0.3);
          z-index: 1;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        /* Animated blobs */
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.3;
          animation: float 8s ease-in-out infinite;
          pointer-events: none;
        }
        .blob-orange {
          width: 300px;
          height: 300px;
          background: rgba(217, 119, 6, 0.3);
          top: 10%;
          left: 15%;
          animation-delay: 0s;
        }
        .blob-purple {
          width: 300px;
          height: 300px;
          background: rgba(139, 92, 246, 0.2);
          bottom: 10%;
          right: 15%;
          animation-delay: 2s;
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
      </style>
    </head>
    <body>
      <div class="blob blob-orange"></div>
      <div class="blob blob-purple"></div>
      
      <div class="logo-container">
        <img src="${iconBase64}" alt="SPARK Engine Logo" class="logo-image" />
      </div>
      
      <div class="logo-text">SPARK ENGINE</div>
      <div class="spinner"></div>
      <div class="status">Checking System Requirements ...</div>
    </body>
    </html>
  `;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  
  return splash;
}
/**
 * Perform system check and handle the result
 * @returns {boolean} - Whether the application should continue
 */
async function performSystemCheck() {
  console.log('🔍 Performing system requirements check...');
  
  // Show splash screen
  const splash = showSystemCheckSplash();
  
  // Add a small delay to show the splash
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const checkResult = checkSystemRequirements();
  
  // Close splash screen
  splash.close();
  
  if (checkResult.passed) {
    console.log('✅ System requirements check passed');
    if (checkResult.systemInfo) {
      console.log('System Info:', checkResult.systemInfo);
    }
    return true;
  } else {
    console.log('❌ System requirements check failed');
    console.log('Issues:', checkResult.issues);
    
    // Show dialog and get user choice
    const shouldContinue = await showSystemRequirementsDialog(checkResult);
    
    if (shouldContinue) {
      console.log('⚠️  User chose to continue despite system requirements not being met');
    } else {
      console.log('🛑 User chose to exit due to system requirements');
    }
    
    return shouldContinue;
  }
}

module.exports = {
  checkSystemRequirements,
  showSystemRequirementsDialog,
  performSystemCheck,
  REQUIREMENTS
};