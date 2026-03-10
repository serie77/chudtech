/**
 * Setup script - Copies frontend files from public-gui to railway-web/public
 * Run with: node setup.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'public-gui');
const DEST_DIR = path.join(__dirname, 'public');

// Files to copy
const FILES_TO_COPY = [
  'index.html',
  'styles.css',
  'renderer.js'
];

// Folders to copy
const FOLDERS_TO_COPY = [
  'images'
];

// Create destination directory if it doesn't exist
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  console.log('✅ Created public/ directory');
}

// Copy files
FILES_TO_COPY.forEach(file => {
  const srcPath = path.join(SOURCE_DIR, file);
  const destPath = path.join(DEST_DIR, file);
  
  if (fs.existsSync(srcPath)) {
    let content = fs.readFileSync(srcPath, 'utf8');
    
    // Modify renderer.js to be web-compatible
    if (file === 'renderer.js') {
      content = makeWebCompatible(content);
    }
    
    fs.writeFileSync(destPath, content);
    console.log(`✅ Copied: ${file}`);
  } else {
    console.log(`⚠️  Not found: ${file}`);
  }
});

// Copy folders recursively
FOLDERS_TO_COPY.forEach(folder => {
  const srcPath = path.join(SOURCE_DIR, folder);
  const destPath = path.join(DEST_DIR, folder);
  
  if (fs.existsSync(srcPath)) {
    copyFolderRecursive(srcPath, destPath);
    console.log(`✅ Copied folder: ${folder}`);
  } else {
    console.log(`⚠️  Folder not found: ${folder}`);
  }
});

// Helper function to copy folders recursively
function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Make renderer.js web-compatible by removing Electron-specific code
function makeWebCompatible(content) {
  // Remove require('electron') line
  content = content.replace(/const\s*{\s*ipcRenderer\s*}\s*=\s*require\(['"]electron['"]\);?/g, 
    '// Electron ipcRenderer removed for web - using fetch API instead');
  
  // Comment out require('fs') and require('path')
  content = content.replace(/const\s*fs\s*=\s*require\(['"]fs['"]\);?/g, 
    '// const fs = require("fs"); // Removed for web');
  content = content.replace(/const\s*path\s*=\s*require\(['"]path['"]\);?/g, 
    '// const path = require("path"); // Removed for web');
  
  // Replace ipcRenderer.invoke calls with fetch API
  content = content.replace(/ipcRenderer\.invoke\(['"]translate-text['"]/g, 
    'translateTextWeb(');
  content = content.replace(/ipcRenderer\.invoke\(['"]show-open-dialog['"]/g, 
    'showOpenDialogWeb(');
  content = content.replace(/ipcRenderer\.invoke\(['"]save-edited-image['"]/g, 
    'saveEditedImageWeb(');
  
  // Add web compatibility layer at the top
  const webCompat = `
// =====================================================
// WEB COMPATIBILITY LAYER
// =====================================================
// These functions replace Electron IPC calls with fetch API calls

async function translateTextWeb({ text, sourceLang, targetLang }) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang })
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function showOpenDialogWeb(options) {
  // Web doesn't have native file dialogs, use input element
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.properties?.includes('openDirectory')) {
      input.webkitdirectory = true;
    }
    input.onchange = (e) => {
      resolve({ canceled: false, filePaths: Array.from(e.target.files).map(f => f.name) });
    };
    input.click();
  });
}

async function saveEditedImageWeb({ imageFolder, filename, base64Data }) {
  // In web, we can download the file instead
  const link = document.createElement('a');
  link.href = 'data:image/png;base64,' + base64Data;
  link.download = filename;
  link.click();
  return { success: true, filename };
}

// Override localStorage-based config saving for web
function saveConfigWeb(config) {
  localStorage.setItem('deployConfig', JSON.stringify(config));
}

function loadConfigWeb() {
  try {
    return JSON.parse(localStorage.getItem('deployConfig') || '{}');
  } catch {
    return {};
  }
}

function saveWalletsWeb(wallets) {
  localStorage.setItem('wallets', JSON.stringify(wallets));
}

function loadWalletsWeb() {
  try {
    return JSON.parse(localStorage.getItem('wallets') || '[]');
  } catch {
    return [];
  }
}

// WebSocket connection - use current host
function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return protocol + '//' + window.location.host;
}

`;

  // Prepend web compatibility layer
  content = webCompat + content;
  
  // Replace hardcoded WebSocket URLs
  content = content.replace(/ws:\/\/149\.28\.53\.76:\d+/g, "' + getWebSocketUrl() + '");
  content = content.replace(/wss?:\/\/[^'"]+/g, "' + getWebSocketUrl() + '");
  
  // Replace file system operations with localStorage
  content = content.replace(/fs\.readFileSync/g, '// fs.readFileSync');
  content = content.replace(/fs\.writeFileSync/g, '// fs.writeFileSync');
  content = content.replace(/fs\.existsSync/g, '// fs.existsSync');
  
  return content;
}

console.log('');
console.log('🚀 Setup complete! Your railway-web/public folder is ready.');
console.log('');
console.log('Next steps:');
console.log('1. Review the files in railway-web/public/');
console.log('2. Make any additional modifications to renderer.js');
console.log('3. Test locally: npm install && npm start');
console.log('4. Deploy to Railway: railway up');
