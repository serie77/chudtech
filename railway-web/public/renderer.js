
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

// Electron ipcRenderer removed for web - using fetch API instead

// Global state
let websocket = null;
let currentTab = 'deploy';


// DOM elements
const elements = {
    // Server status
    serverStatus: document.getElementById('serverStatus'),
    serverStatusText: document.getElementById('serverStatusText'),
    
    // Platform indicators
    platformIndicators: document.querySelectorAll('.platform-indicator'),
    
    // Settings elements
    imageFolder: document.getElementById('imageFolder'),
    browseFolderBtn: document.getElementById('browseFolderBtn'),
    currentImageName: document.getElementById('currentImageName'),
    currentImageTime: document.getElementById('currentImageTime'),
    imagePreview: document.getElementById('imagePreview'),
    autoRefreshImages: document.getElementById('autoRefreshImages'),
    saveWindowPosition: document.getElementById('saveWindowPosition'),
    saveCurrentPosition: document.getElementById('saveCurrentPosition'),
    resetWindowPosition: document.getElementById('resetWindowPosition'),
    
    // Keybind elements
    translateDeployKeybind: document.getElementById('translateDeployKeybind'),
    clearTranslateDeployKeybind: document.getElementById('clearTranslateDeployKeybind'),
    
    // Whitelist elements
    pumpWhitelist: document.getElementById('pumpWhitelist'),
    bonkWhitelist: document.getElementById('bonkWhitelist'),
    bagsWhitelist: document.getElementById('bagsWhitelist'),
    rayWhitelist: document.getElementById('rayWhitelist'),
    bnbWhitelist: document.getElementById('bnbWhitelist'),
    usd1Whitelist: document.getElementById('usd1Whitelist'),
    pumpWhitelistTags: document.getElementById('pumpWhitelistTags'),
    bonkWhitelistTags: document.getElementById('bonkWhitelistTags'),
    bagsWhitelistTags: document.getElementById('bagsWhitelistTags'),
    rayWhitelistTags: document.getElementById('rayWhitelistTags'),
    bnbWhitelistTags: document.getElementById('bnbWhitelistTags'),
    usd1WhitelistTags: document.getElementById('usd1WhitelistTags'),
    
    // Deploy page image elements
    imagePreviewDeploy: document.getElementById('imagePreviewDeploy'),
    
    // Preset button elements
    presetButtonName: document.getElementById('presetButtonName'),
    presetNamePrefix: document.getElementById('presetNamePrefix'),
    presetNameSuffix: document.getElementById('presetNameSuffix'),
    presetTickerPrefix: document.getElementById('presetTickerPrefix'),
    presetTickerSuffix: document.getElementById('presetTickerSuffix'),
    addPresetButton: document.getElementById('addPresetButton'),
    presetButtonsList: document.getElementById('presetButtonsList'),
    deployPresetButtons: document.getElementById('deployPresetButtons'),
    
    // Tab navigation
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Platform deploy buttons (now handled via combined buttons)
    
    // Form inputs
    tokenName: document.getElementById('tokenName'),
    tokenSymbol: document.getElementById('tokenSymbol'),
    nameCharCounter: document.getElementById('nameCharCounter'),
    tickerCharCounter: document.getElementById('tickerCharCounter'),
    twitter: document.getElementById('twitter'),
    website: document.getElementById('website'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    translateBtn: document.getElementById('translateBtn'),
    translateDeployBtn: document.getElementById('translateDeployBtn'),
    buyAmount: document.getElementById('buyAmount'),
    bnbAmount: document.getElementById('bnbAmount'),
    usd1Amount: document.getElementById('usd1Amount'),
    multiDeployCheck: document.getElementById('multiDeployCheck'),
    multiDeploy: document.getElementById('multiDeploy'),
    multiDeployValue: document.getElementById('multiDeployValue'),
    openAxiom: document.getElementById('openAxiom'),
    
    // Bags config
    bagsFeeClaimer: document.getElementById('bagsFeeClaimer'),

    multiDeploySection: document.getElementById('multiDeploySection'),
    
    // Deploy buttons (combined buttons are handled via event delegation)
    imageEditorBtn: document.getElementById('imageEditorBtn'),
    mainBtn: document.getElementById('mainBtn'),
    
    // Image editor elements
    imageEditorModal: document.getElementById('imageEditorModal'),
    imageEditorCanvas: document.getElementById('imageEditorCanvas'),
    closeImageEditor: document.getElementById('closeImageEditor'),
    dropZone: document.getElementById('dropZone'),
    uploadOverlayBtn: document.getElementById('uploadOverlayBtn'),
    overlayFileInput: document.getElementById('overlayFileInput'),
    overlayOpacity: document.getElementById('overlayOpacity'),
    opacityValue: document.getElementById('opacityValue'),
    hueShift: document.getElementById('hueShift'),
    hueValue: document.getElementById('hueValue'),
    sizeValue: document.getElementById('sizeValue'),
    rotationKnob: document.getElementById('rotationKnob'),
    rotationValue: document.getElementById('rotationValue'),
    resetOverlay: document.getElementById('resetOverlay'),
    clearOverlays: document.getElementById('clearOverlays'),
    cancelImageEdit: document.getElementById('cancelImageEdit'),
    applyImageEdit: document.getElementById('applyImageEdit'),
    
    // Wallet tab
    // Wallet elements - Solana
    solanaWalletName: document.getElementById('solanaWalletName'),
    solanaApiKey: document.getElementById('solanaApiKey'),
    importSolanaBtn: document.getElementById('importSolanaBtn'),
    solanaImportResult: document.getElementById('solanaImportResult'),
    solanaResultName: document.getElementById('solanaResultName'),
    solanaWalletList: document.getElementById('solanaWalletList'),
    
    // Wallet elements - BNB
    bnbWalletName: document.getElementById('bnbWalletName'),
    bnbApiKey: document.getElementById('bnbApiKey'),
    importBnbBtn: document.getElementById('importBnbBtn'),
    bnbImportResult: document.getElementById('bnbImportResult'),
    bnbResultName: document.getElementById('bnbResultName'),
    bnbWalletList: document.getElementById('bnbWalletList'),
    
    // Logs
    logsOutput: document.getElementById('logsOutput'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    scrollBottomBtn: document.getElementById('scrollBottomBtn'),
    
    // Status
    connectionStatus: document.getElementById('connectionStatus'),
    lastActivity: document.getElementById('lastActivity'),
    
    // Loading and toasts
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    toastContainer: document.getElementById('toastContainer')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // CLEAR ALL FORM FIELDS ON LOAD - prevent pre-filled garbage
    const tokenNameInput = document.getElementById('tokenName');
    const tokenSymbolInput = document.getElementById('tokenSymbol');
    const twitterInput = document.getElementById('twitter');
    const websiteInput = document.getElementById('website');
    
    if (tokenNameInput) tokenNameInput.value = '';
    if (tokenSymbolInput) tokenSymbolInput.value = '';
    if (twitterInput) twitterInput.value = '';
    if (websiteInput) websiteInput.value = '';
    
    // Reset character counters
    const nameCounter = document.getElementById('nameCharCounter');
    const tickerCounter = document.getElementById('tickerCharCounter');
    if (nameCounter) nameCounter.textContent = '0/32';
    if (tickerCounter) tickerCounter.textContent = '0/13'; // 13 char limit
    
    console.log('[INIT] Form initialized empty');
    
    initializeTabs();
    initializePlatformIndicators();
    initializeDeployButtons();
    initializeWalletImport();
    initializeLogs();
    initializeMultiDeploy();
    initializeSettings();
    initializeClipboardMonitoring();
    initializeKeyBindings();
    initializeWhitelists();
    initializePresetButtons();
    initializeHttpApi();
    initializeCharacterCounters();
    initializeTweetPaste(); // Add tweet paste functionality
    loadConfigToUI();
    
    // Try to connect to server immediately
    connectWebSocket();
});

// Tab handling
function initializeTabs() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update tab content
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });
    
    updateLastActivity(`Switched to ${tab} tab`);
    
    // If switching to wallet tab, show API key help popup
    if (tab === 'wallet') {
        showApiKeyHelpPopup();
    }
}

function showApiKeyHelpPopup() {
    const popup = document.createElement('div');
    popup.className = 'api-key-help-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Need an API Key?</h3>
                <button class="popup-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="popup-body">
                <p>Don't know how to get an API key?</p>
                <p><strong>Check 'How to get an API key' here:</strong></p>
                <a href="https://j7tracker.com/external/docs" target="_blank" class="popup-link">
                    https://j7tracker.com/external/docs
                </a>
            </div>
            <div class="popup-footer">
                <button class="popup-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Got it!</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 10000);
}

// Settings handling
let imageMonitorInterval = null;
let currentImagePath = null;

// Clipboard monitoring
let clipboardMonitorInterval = null;
let lastClipboardContent = '';

function initializeSettings() {
    // Browse folder button
    elements.browseFolderBtn.addEventListener('click', async () => {
        try {
            // Electron ipcRenderer removed for web - using fetch API instead
            const result = await showOpenDialogWeb(, {
                properties: ['openDirectory'],
                title: 'Select Image Folder'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0];
                elements.imageFolder.value = folderPath;
                config.imageFolder = folderPath;
                saveConfig();
                startImageMonitoring();
                
                // Do an immediate scan for existing images
                findLatestImage(folderPath).then(latestImage => {
                    if (latestImage) {
                        currentImagePath = latestImage;
                        updateImagePreview(latestImage);
                    }
                });
                
                updateLastActivity(`Image folder set: ${folderPath}`);
        }
    } catch (error) {
            console.error('Error selecting folder:', error);
            showToast('Error', 'Failed to select folder', 'error');
        }
    });
    
    // Auto-refresh checkbox
    elements.autoRefreshImages.addEventListener('change', () => {
        if (elements.autoRefreshImages.checked) {
            startImageMonitoring();
        } else {
            stopImageMonitoring();
        }
        config.autoRefreshImages = elements.autoRefreshImages.checked;
        saveConfig();
    });
    
    // Window position settings
    elements.saveWindowPosition.addEventListener('change', () => {
        config.windowPosition.savePosition = elements.saveWindowPosition.checked;
        saveConfig();
        
        if (config.windowPosition.savePosition) {
            // Save current position immediately when enabled
            saveCurrentWindowPosition();
        }
    });
    
    elements.saveCurrentPosition.addEventListener('click', () => {
        saveCurrentWindowPosition();
        showToast('Success', 'Window position saved', 'success');
    });
    
    elements.resetWindowPosition.addEventListener('click', () => {
        resetWindowPosition();
        showToast('Success', 'Window position reset', 'success');
    });
    
    // Keybind settings
    elements.translateDeployKeybind.addEventListener('click', () => {
        elements.translateDeployKeybind.focus();
    });
    
    elements.translateDeployKeybind.addEventListener('keydown', (event) => {
        event.preventDefault();
        
        // Get the key name
        let keyName = event.key;
        
        // Format special keys nicely
        if (keyName === ' ') keyName = 'Space';
        if (keyName.length === 1) keyName = keyName.toUpperCase();
        
        // Handle modifier keys
        const modifiers = [];
        if (event.ctrlKey && keyName !== 'Control') modifiers.push('Ctrl');
        if (event.altKey && keyName !== 'Alt') modifiers.push('Alt');
        if (event.shiftKey && keyName !== 'Shift') modifiers.push('Shift');
        
        // Build the full key combination
        const fullKey = modifiers.length > 0 ? `${modifiers.join('+')}+${keyName}` : keyName;
        
        // Update the input
        elements.translateDeployKeybind.value = fullKey;
        
        // Save to config
        config.keybinds.translateAndDeploy = fullKey;
        saveConfig();
        
        showToast('Success', `Keybind set to: ${fullKey}`, 'success');
    });
    
    elements.clearTranslateDeployKeybind.addEventListener('click', () => {
        elements.translateDeployKeybind.value = '';
        config.keybinds.translateAndDeploy = '';
        saveConfig();
        showToast('Success', 'Keybind cleared', 'success');
    });
}

function saveCurrentWindowPosition() {
    try {
        // Electron ipcRenderer removed for web - using fetch API instead
        ipcRenderer.invoke('get-window-bounds').then(bounds => {
            config.windowPosition.x = bounds.x;
            config.windowPosition.y = bounds.y;
            config.windowPosition.width = bounds.width;
            config.windowPosition.height = bounds.height;
            saveConfig();
        });
    } catch (error) {
        console.error('Error saving window position:', error);
    }
}

function resetWindowPosition() {
    try {
        // Electron ipcRenderer removed for web - using fetch API instead
        config.windowPosition.x = null;
        config.windowPosition.y = null;
        config.windowPosition.width = null;
        config.windowPosition.height = null;
        saveConfig();
        
        // Reset window to default position
        ipcRenderer.invoke('reset-window-position');
    } catch (error) {
        console.error('Error resetting window position:', error);
    }
}

function restoreWindowPosition() {
    if (config.windowPosition.savePosition && 
        config.windowPosition.x !== null && 
        config.windowPosition.y !== null) {
        try {
            // Electron ipcRenderer removed for web - using fetch API instead
            ipcRenderer.invoke('set-window-bounds', {
                x: config.windowPosition.x,
                y: config.windowPosition.y,
                width: config.windowPosition.width || 800,
                height: config.windowPosition.height || 600
            });
        } catch (error) {
            console.error('Error restoring window position:', error);
        }
    }
}

function startImageMonitoring() {
    stopImageMonitoring(); // Clear any existing interval
    
    const folderPath = elements.imageFolder.value;
    if (!folderPath || !elements.autoRefreshImages.checked) return;
    
    imageMonitorInterval = setInterval(async () => {
        try {
            const latestImage = await findLatestImage(folderPath);
            if (latestImage && latestImage !== currentImagePath) {
                currentImagePath = latestImage;
                updateImagePreview(latestImage);
            }
        } catch (error) {
            console.error('Error monitoring images:', error);
        }
    }, 1); // 1ms interval as requested
}

function stopImageMonitoring() {
    if (imageMonitorInterval) {
        clearInterval(imageMonitorInterval);
        imageMonitorInterval = null;
    }
}

async function findLatestImage(folderPath) {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        if (!// fs.existsSync(folderPath)) {
            return null;
        }
        
        const files = fs.readdirSync(folderPath);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        
        let latestFile = null;
        let latestTime = 0;
        
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const ext = path.extname(file).toLowerCase();
            
            if (imageExtensions.includes(ext)) {
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() > latestTime) {
                    latestTime = stats.mtime.getTime();
                    latestFile = filePath;
                }
            }
        }
        
        return latestFile;
    } catch (error) {
        console.error('Error finding latest image:', error);
        return null;
    }
}

function updateImagePreview(imagePath) {
    if (!imagePath) {
        // Update Settings tab
        elements.currentImageName.textContent = 'No image detected';
        elements.currentImageTime.textContent = '';
        elements.imagePreview.innerHTML = '<span class="preview-placeholder">No image to preview</span>';
        
        // Update Deploy tab - just show placeholder
        elements.imagePreviewDeploy.innerHTML = '<span class="preview-placeholder">No image to preview</span>';
        return;
    }
    
    try {
        // const path = require("path"); // Removed for web
        // const fs = require("fs"); // Removed for web
        
        const fileName = path.basename(imagePath);
        const stats = fs.statSync(imagePath);
        const modTime = new Date(stats.mtime).toLocaleTimeString();
        
        // Update Settings tab
        elements.currentImageName.textContent = fileName;
        elements.currentImageTime.textContent = `Modified: ${modTime}`;
        
        // Create image preview for Settings tab
        const img = document.createElement('img');
        img.src = `file://${imagePath}`;
        img.alt = fileName;
        
        elements.imagePreview.innerHTML = '';
        elements.imagePreview.appendChild(img);
        
        // Update Deploy tab - just show image without text
        const imgDeploy = document.createElement('img');
        imgDeploy.src = `file://${imagePath}`;
        imgDeploy.alt = fileName;
        
        elements.imagePreviewDeploy.innerHTML = '';
        elements.imagePreviewDeploy.appendChild(imgDeploy);
        
        updateLastActivity(`Image updated: ${fileName}`);
        
        // PRE-UPLOAD: Automatically upload image to IPFS when it changes
        try {
            const imageBuffer = // fs.readFileSync(imagePath);
            const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            
            // Clear any previous cached data
            window.cachedIpfsUri = null;
            window.prebuiltTx = null;
            
            // Pre-upload to IPFS
            preUploadImage(imageDataUrl);
        } catch (preUploadError) {
            console.error('[PRE-UPLOAD] Failed to read image:', preUploadError);
        }
    } catch (error) {
        console.error('Error updating image preview:', error);
        // Update Settings tab
        elements.currentImageName.textContent = 'Error loading image';
        elements.currentImageTime.textContent = '';
        
        // Update Deploy tab
        elements.imagePreviewDeploy.innerHTML = '<span class="preview-placeholder">Error loading image</span>';
    }
}

function getCurrentImagePath() {
    return currentImagePath;
}

// ==================== PRE-UPLOAD & PRE-BUILD ====================
// Cache for pre-uploaded IPFS URI and pre-built transactions
window.cachedIpfsUri = null;
window.uploadedImageUrl = null; // Filebase image URL
window.prebuiltTx = null;
window.readyTxId = null; // txId for instant blast
window.currentImageData = null; // Cache image data to avoid re-reading
window.lastPreBuildHash = null; // Track what was pre-built
let prebuildTimeout = null;

// Update ready state indicator
function updateReadyState() {
    const hasImage = window.currentImageData !== null;
    const hasIpfs = window.cachedIpfsUri !== null;
    const hasTx = window.prebuiltTx === true;
    const hasName = elements.tokenName.value.trim().length > 0;
    const hasTicker = elements.tokenSymbol.value.trim().length > 0;
    
    const isReady = hasIpfs && hasTx && hasName && hasTicker;
    
    // Update status text
    if (elements.serverStatusText) {
        if (isReady) {
            elements.serverStatusText.textContent = '✓ READY';
            elements.serverStatusText.style.color = '#10b981';
        } else if (hasImage && !hasIpfs) {
            elements.serverStatusText.textContent = 'Uploading...';
            elements.serverStatusText.style.color = '#f59e0b';
        } else if (hasIpfs && !hasTx && hasName && hasTicker) {
            elements.serverStatusText.textContent = 'Building...';
            elements.serverStatusText.style.color = '#f59e0b';
        } else {
            elements.serverStatusText.textContent = 'Connected';
            elements.serverStatusText.style.color = '#10b981';
        }
    }
}

// Pre-upload image to IPFS - BACKGROUND, NON-BLOCKING
function preUploadImage(imageData) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log('🔴 [PRE-UPLOAD] Skipping - not connected');
        return;
    }
    
    console.log(`🟡 [PRE-UPLOAD] Starting... ${Math.round(imageData.length / 1024)}KB`);
    window.currentImageData = imageData;
    updateReadyState();
    
    // Fire and forget - don't await
    websocket.send(JSON.stringify({
        type: 'pre_upload',
        image_data: imageData
    }));
}

// Pre-build transaction - IMMEDIATE when conditions are met
function preBuildTransaction() {
    const T0 = Date.now();
    
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log('🔴 [PRE-BUILD] Not connected');
        return;
    }
    if (!window.cachedIpfsUri) {
        console.log('🔴 [PRE-BUILD] No IPFS URI yet - waiting for upload');
        return;
    }
    if (!window.currentImageData) {
        console.log('🔴 [PRE-BUILD] No image data');
        return;
    }
    
    const name = elements.tokenName.value.trim();
    const ticker = elements.tokenSymbol.value.trim();
    const buyAmount = parseFloat(elements.buyAmount.value) || 7;
    const twitter = elements.twitter.value.trim();
    const website = elements.website.value.trim();
    
    if (!name || !ticker) {
        console.log('🔴 [PRE-BUILD] Need name AND ticker');
        return;
    }
    
    // Check if we already pre-built this exact combination (only name/ticker matter for tx)
    const currentHash = `${name}|${ticker}|${buyAmount}`;
    if (window.lastPreBuildHash === currentHash && window.prebuiltTx === true) {
        console.log('🟢 [PRE-BUILD] Already cached for:', name, ticker);
        return;
    }
    
    console.log(`🟡 [PRE-BUILD] T+0ms Starting: "${name}" (${ticker}) ${buyAmount} SOL`);
    console.log(`🟡 [PRE-BUILD] Twitter: ${twitter || 'NONE'}, Website: ${website || 'NONE'}`);
    window.prebuiltTx = false; // Mark as building
    window.lastPreBuildHash = currentHash;
    window.readyTxId = null; // Clear old txId
    updateReadyState();
    
    websocket.send(JSON.stringify({
        type: 'pre_build',
        name: name,
        ticker: ticker,
        buy_amount: buyAmount,
        twitter: twitter,      // Include Twitter!
        website: website,      // Include Website!
        image_data: window.currentImageData
    }));
    
    console.log(`🟡 [PRE-BUILD] T+${Date.now()-T0}ms Sent to server`);
    addLog('info', `🔧 Pre-building: ${name} (${ticker}) ${twitter ? '+ Twitter' : ''} ${website ? '+ Website' : ''}`);
}

// Debounce 300ms - only build after user STOPS typing
function triggerPreBuild() {
    clearTimeout(prebuildTimeout);
    prebuildTimeout = setTimeout(() => {
        const name = elements.tokenName.value.trim();
        const ticker = elements.tokenSymbol.value.trim();
        if (name && ticker) {
            console.log('🔵 [TRIGGER] User stopped typing, building for:', name, ticker);
            preBuildTransaction();
        }
    }, 300);
}

// Clipboard monitoring functions
function initializeClipboardMonitoring() {
    startClipboardMonitoring();
}

function startClipboardMonitoring() {
    clipboardMonitorInterval = setInterval(async () => {
        try {
            const { clipboard } = require('electron');
            const clipboardText = clipboard.readText();
            
            if (clipboardText && clipboardText !== lastClipboardContent) {
                lastClipboardContent = clipboardText;
                handleClipboardChange(clipboardText);
        }
    } catch (error) {
            // Silently ignore clipboard errors
        }
    }, 1); // 1ms interval as requested
}

function handleClipboardChange(text) {
    const trimmedText = text.trim();
    
    // Check if it's ONLY a social media URL (standalone link, not HTML or multi-line content)
    const isSocialMediaUrl = (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) && 
                             (trimmedText.includes('twitter.com') || trimmedText.includes('x.com') || 
                              trimmedText.includes('truthsocial.com') || trimmedText.includes('instagram.com')) &&
                             !trimmedText.includes('\n') && 
                             !trimmedText.includes('<') && 
                             !trimmedText.includes('>') &&
                             trimmedText.length < 500; // Reasonable URL length limit
    
    // DEBUG: Log what we're trying to match
    console.log('🔍 Clipboard content length:', trimmedText.length);
    console.log('🔍 Is social media URL:', isSocialMediaUrl);
    
    if (isSocialMediaUrl) {
        // Extract username from URL for fee claimer
        const urlParts = trimmedText.split('/');
        let usernameIndex = -1;
        let platform = '';
        
        // Find the platform and get username index
        if (trimmedText.includes('twitter.com')) {
            usernameIndex = urlParts.findIndex(part => part === 'twitter.com') + 1;
            platform = 'Twitter';
        } else if (trimmedText.includes('x.com')) {
            usernameIndex = urlParts.findIndex(part => part === 'x.com') + 1;
            platform = 'X';
        } else if (trimmedText.includes('truthsocial.com')) {
            usernameIndex = urlParts.findIndex(part => part === 'truthsocial.com') + 1;
            platform = 'Truth Social';
        } else if (trimmedText.includes('instagram.com')) {
            usernameIndex = urlParts.findIndex(part => part === 'instagram.com') + 1;
            platform = 'Instagram';
        }
        
        const username = urlParts[usernameIndex] || 'unknown';
        const cleanUsername = username.startsWith('@') ? username : `@${username}`;
        
        // ONLY fill Twitter field - DO NOT touch name/symbol
        elements.twitter.value = trimmedText;
        
        // Auto-extract username for fee claimer
        elements.bagsFeeClaimer.value = cleanUsername;
        
        updateLastActivity(`Auto-filled Twitter: ${cleanUsername}`);
    }
    
    // REMOVED: Do NOT auto-fill token name from clipboard!
    // Users must manually enter name and symbol
    // This prevents garbage from appearing in the name field
}

function stopClipboardMonitoring() {
    if (clipboardMonitorInterval) {
        clearInterval(clipboardMonitorInterval);
        clipboardMonitorInterval = null;
    }
}

// Platform indicators handling
function initializePlatformIndicators() {
    elements.platformIndicators.forEach(indicator => {
        indicator.addEventListener('click', () => {
            const platform = indicator.dataset.platform;
            setDefaultPlatform(platform);
        });
    });
}

function setDefaultPlatform(platform) {
    // Update active indicator
    elements.platformIndicators.forEach(indicator => {
        indicator.classList.toggle('active', indicator.dataset.platform === platform);
    });
    
    // Update Letter button color to match selected platform
    updateLetterButtonColor(platform);
    
    // Show/hide axiom checkbox based on platform (disable for Bags)
    updateAxiomCheckboxVisibility(platform);
    
    // Save to config
    config.defaultPlatform = platform;
    saveConfig();
    
    updateLastActivity(`Default platform: ${platform.toUpperCase()}`);
}

function updatePlatformUI(platform) {
    // Update active indicator
    elements.platformIndicators.forEach(indicator => {
        indicator.classList.toggle('active', indicator.dataset.platform === platform);
    });
    
    // Update Letter button color to match selected platform
    updateLetterButtonColor(platform);
    
    // Show/hide axiom checkbox based on platform (disable for Bags)
    updateAxiomCheckboxVisibility(platform);
    
    // DON'T save to config - this is just for UI feedback during deploy
}

function updateAxiomCheckboxVisibility(platform) {
    const axiomCheckboxRow = document.querySelector('.checkbox-row');
    const axiomCheckbox = document.getElementById('openAxiom');
    const axiomLabel = axiomCheckboxRow?.querySelector('label');
    
    if (!axiomCheckboxRow || !axiomCheckbox) return;
    
    // Always show the checkbox
    axiomCheckboxRow.style.display = 'block';
    
    if (platform === 'bnb') {
        // Gray out and disable for BNB (different blockchain) but keep it checked
        axiomCheckbox.disabled = true;
        // Don't uncheck - just disable
        if (axiomLabel) {
            axiomLabel.style.opacity = '0.5';
            axiomLabel.style.cursor = 'not-allowed';
        }
    } else {
        // Enable for all other platforms (BONK, PUMP, RAY, BAGS)
        axiomCheckbox.disabled = false;
        if (axiomLabel) {
            axiomLabel.style.opacity = '1';
            axiomLabel.style.cursor = 'pointer';
        }
    }
}

function updateLetterButtonColor(platform) {
    // Letter buttons are now integrated into combined buttons
    // Color is handled by CSS classes for each platform
    return;
}

function getDefaultPlatform() {
    const activeIndicator = document.querySelector('.platform-indicator.active');
    return activeIndicator ? activeIndicator.dataset.platform : 'bonk';
}



// Multi-deploy handling
function initializeMultiDeploy() {
    elements.multiDeployCheck.addEventListener('change', () => {
        const enabled = elements.multiDeployCheck.checked;
        elements.multiDeploy.disabled = !enabled;
        if (!enabled) {
            elements.multiDeploy.value = '1';
            elements.multiDeployValue.textContent = '1';
        }
    });
    
    // Update slider value display
    elements.multiDeploy.addEventListener('input', () => {
        elements.multiDeployValue.textContent = elements.multiDeploy.value;
    });
}



// WebSocket handling - ROBUST RECONNECTION LOGIC
let reconnectAttempts = 0;
const maxReconnectAttempts = 50; // Keep trying for a long time
const reconnectDelay = 2000; // 2 seconds

async function checkServerHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch('http://127.0.0.1:8080/', { 
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

async function initConnection() {
    updateConnectionStatus('Checking server...');
    console.log('[WS] Checking if Local Server is running...');
    
    const serverUp = await checkServerHealth();
    if (serverUp) {
        console.log('[WS] Server health check passed, connecting WebSocket...');
        connectWebSocket();
    } else {
        console.log('[WS] Server not responding, retrying in 3s...');
        updateConnectionStatus('Server not running');
        setTimeout(initConnection, 3000);
    }
}

function updateConnectionStatus(status) {
    if (elements.serverStatusText) elements.serverStatusText.textContent = status;
    if (elements.connectionStatus) elements.connectionStatus.textContent = status;
    
    // Update server status indicator
    if (elements.serverStatus) {
        elements.serverStatus.classList.remove('online', 'connecting');
        if (status === 'Connected') {
            elements.serverStatus.classList.add('online');
        } else if (status === 'Connecting...') {
            elements.serverStatus.classList.add('connecting');
        }
    }
}

function connectWebSocket() {
    if (websocket) {
        websocket.close();
    }
    
    // ALWAYS use local server - NEVER j7tracker.com
    const serverUrl = '' + getWebSocketUrl() + '/';
    
    updateConnectionStatus('Connecting...');
    console.log(`[WS] Attempting connection to ${serverUrl}`);
    addLog('info', `🔌 Connecting to Local Server: ${serverUrl}`);
    
    try {
        websocket = new WebSocket(serverUrl);
        
        websocket.onopen = () => {
            console.log('[WS] Connected successfully to Local Server');
            reconnectAttempts = 0; // Reset on successful connection
            updateConnectionStatus('Connected');
            updateLastActivity('Connected to Local Server');
            addLog('success', '✅ Connected to Local Deploy Server');
            showToast('Connected', 'Successfully connected to Local Deploy Server', 'success');
        };
        
        websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('[WS] Failed to parse message:', error);
            }
        };
        
        websocket.onclose = (event) => {
            console.log(`[WS] Disconnected, code: ${event.code}`);
            updateConnectionStatus('Disconnected');
            updateLastActivity('Disconnected from Local Server');
            addLog('warning', `⚠️ Disconnected from Local Server (code: ${event.code})`);
            
            // Robust reconnection
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`[WS] Reconnecting in ${reconnectDelay/1000}s... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                addLog('info', `🔄 Reconnecting... Attempt ${reconnectAttempts}`);
                setTimeout(connectWebSocket, reconnectDelay);
            } else {
                console.log('[WS] Max reconnect attempts reached');
                updateConnectionStatus('Connection Failed - Is server running?');
                addLog('error', '❌ Max reconnect attempts reached. Please restart server.');
                showToast('Error', 'Cannot connect to Local Server. Is it running?', 'error');
            }
        };
        
        websocket.onerror = (error) => {
            console.error('[WS] Error:', error);
            // Don't update status here - onclose will handle it
        };
        
    } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
        updateConnectionStatus('Connection Failed');
        addLog('error', `❌ WebSocket creation failed: ${error.message}`);
    }
}

function disconnectWebSocket() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
}

function handleWebSocketMessage(data) {
    // Log all WebSocket messages received (except tweets to reduce spam)
    if (data.type !== 'tweet' && data.type !== 'j7_tweet') {
        console.log('WebSocket message:', data);
        addLog('info', `📥 WebSocket Receive: ${JSON.stringify(data)}`);
    }
    
    switch (data.type) {
        case 'connected':
            // Connection message already logged above
            break;
            
        case 'status':
            // Status message already logged above
            break;
            
        case 'j7_tweet':
            // Real-time tweet from J7Tracker (via server)
            console.log('[GUI] New j7 tweet:', data.tweet?.author);
            addTweetToFeed(data.tweet);
            addLog('success', `🐦 J7 Tweet: @${data.tweet?.handle || data.tweet?.author}`);
            break;
            
        case 'tweet':
            // Fallback for old message type
            addTweetToFeed(data.tweet);
            break;
            
        case 'token_create_success':
            handleTokenCreateSuccess(data);
            break;
            
        case 'token_create_error':
            handleTokenCreateError(data);
            break;
            
        case 'pre_upload_success':
            window.cachedIpfsUri = data.uri;
            console.log('[PRE-UPLOAD] Success! URI cached:', data.uri?.slice(0, 50) + '...');
            addLog('success', `✅ Pre-upload complete (${data.cached ? 'cached' : 'uploaded'})`);
            // Now trigger pre-build since we have the URI
            triggerPreBuild();
            break;
            
        case 'pre_upload_error':
            console.error('[PRE-UPLOAD] Error:', data.message);
            addLog('error', `❌ Pre-upload failed: ${data.message}`);
            break;
            
        case 'image_uploaded':
            // Filebase fast upload complete!
            window.uploadedImageUrl = data.url;
            window.cachedIpfsUri = data.url; // Also set this for compatibility
            console.log(`[FILEBASE] ✅ Image uploaded in ${data.time}ms: ${data.url?.slice(0, 50)}...`);
            addLog('success', `✅ Filebase upload: ${data.time}ms (CID: ${data.cid?.slice(0, 12)}...)`);
            updateReadyState();
            // Now trigger pre-build since we have the image URL
            triggerPreBuild();
            break;
            
        case 'image_upload_error':
            console.error('[FILEBASE] Upload failed:', data.message);
            addLog('error', `❌ Filebase upload failed: ${data.message}`);
            break;
            
        case 'pre_build_success':
            window.prebuiltTx = true; // Server has it cached
            window.readyTxId = data.txId; // Store txId for instant blast
            console.log('[PRE-BUILD] Success! txId:', data.txId, 'mint:', data.mint);
            addLog('success', `✅ Pre-build complete: ${data.mint?.slice(0, 8)}... (${data.time}ms) - READY TO BLAST!`);
            updateReadyState(); // Show READY status
            break;
            
        case 'pre_build_error':
            console.error('[PRE-BUILD] Error:', data.message);
            addLog('error', `❌ Pre-build failed: ${data.message}`);
            break;
            
        default:
            // Unknown message already logged above
            break;
    }
    
    updateLastActivity('Received WebSocket message');
}

function handleTokenCreateSuccess(data) {
    hideLoading();
    
    let message = `Token created successfully!`;
    if (data.multi_deploy > 1) {
        message = `${data.total_created}/${data.multi_deploy} tokens created successfully!`;
    }
    
    showToast('Success', message, 'success');
    addLog('success', `✅ ${data.message}`);
    
    if (data.signature) {
        addLog('info', `📝 Signature: ${data.signature}`);
    }
    if (data.address) {
        addLog('info', `📍 Address: ${data.address}`);
    }
    
    if (data.successful_tokens && data.successful_tokens.length > 0) {
        data.successful_tokens.forEach(token => {
            addLog('success', `✅ Token ${token.index}: ${token.address}`);
        });
    }
    
    if (data.failed_tokens && data.failed_tokens.length > 0) {
        data.failed_tokens.forEach(token => {
            addLog('error', `❌ Token ${token.index}: ${token.error}`);
        });
    }
}

function handleTokenCreateError(data) {
    hideLoading();
    showToast('Error', data.message, 'error');
    addLog('error', `❌ ${data.message}`);
    
    if (data.failed_tokens && data.failed_tokens.length > 0) {
        data.failed_tokens.forEach(token => {
            addLog('error', `❌ Token ${token.index}: ${token.error}`);
        });
    }
}

// Deploy button handling
function initializeDeployButtons() {
    // Combined platform deploy buttons - handle clicks on individual sections
    document.addEventListener('click', (e) => {
        // Don't interfere with input fields, textareas, or buttons
        if (e.target.matches('input, textarea, button, select')) {
            return;
        }
        
        const btnSection = e.target.closest('.btn-section');
        if (!btnSection) return;
        
        const mode = btnSection.dataset.mode;
        const imageType = btnSection.dataset.imageType;
        
        if (!mode) return;
        
        // Prevent event bubbling only for deploy button clicks
        e.stopPropagation();
        
        if (mode === 'bnb') {
            deployTokenBNB(mode, imageType === 'normal' ? '' : imageType);
        } else {
            deployToken(mode, imageType === 'normal' ? '' : imageType);
        }
    });
    elements.imageEditorBtn.addEventListener('click', () => {
        openImageEditor();
    });

    // Clear all fields button
    elements.clearAllBtn.addEventListener('click', () => {
        clearAllFields();
    });

    // Translation button (EN to ZH using DeepL API via IPC)
    elements.translateBtn.addEventListener('click', async () => {
        const name = elements.tokenName.value.trim();
        const ticker = elements.tokenSymbol.value.trim();
        
        if (!name && !ticker) {
            showToast('Please enter a name or ticker to translate', 'warning');
            return;
        }
        
        // Disable button during translation
        elements.translateBtn.disabled = true;
        elements.translateBtn.textContent = 'Translating...';
        
        try {
            // Electron ipcRenderer removed for web - using fetch API instead
            
            // Translate both name and ticker in parallel using IPC
            const translations = await Promise.all([
                // Translate name
                (async () => {
                    if (name) {
                        const result = await translateTextWeb(, {
                            text: name,
                            sourceLang: 'EN',
                            targetLang: 'ZH'
                        });
                        
                        if (result.success && result.translatedText) {
                            return { field: 'name', value: result.translatedText };
                        }
                    }
                    return null;
                })(),
                // Translate ticker
                (async () => {
                    if (ticker) {
                        const result = await translateTextWeb(, {
                            text: ticker,
                            sourceLang: 'EN',
                            targetLang: 'ZH'
                        });
                        
                        if (result.success && result.translatedText) {
                            return { field: 'ticker', value: result.translatedText };
                        }
                    }
                    return null;
                })()
            ]);
            
            // Apply translations
            let translatedCount = 0;
            translations.forEach(translation => {
                if (translation) {
                    if (translation.field === 'name') {
                        elements.tokenName.value = translation.value;
                        // Update character counter
                        const nameLength = translation.value.length;
                        elements.nameCharCounter.textContent = `${nameLength}/32`;
                        translatedCount++;
                    } else if (translation.field === 'ticker') {
                        elements.tokenSymbol.value = translation.value;
                        // Update character counter
                        const tickerLength = translation.value.length;
                        elements.tickerCharCounter.textContent = `${tickerLength}/13`;
                        translatedCount++;
                    }
                }
            });
            
            if (translatedCount > 0) {
                showToast(`Successfully translated ${translatedCount} field(s) to Chinese!`, 'success');
            } else {
                showToast('Translation failed. Please try again.', 'error');
            }
            
        } catch (error) {
            console.error('Translation error:', error);
            showToast('Translation service unavailable. Please try again.', 'error');
        } finally {
            // Re-enable button
            elements.translateBtn.disabled = false;
            elements.translateBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; margin-right: 8px;">
                    <path d="m5 8 6 6"></path>
                    <path d="m4 14 6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="m22 22-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>
                Translate to Chinese (EN → ZH)
            `;
        }
    });

    // Translate and Deploy button (Translate to Chinese then immediately deploy on BNB)
    elements.translateDeployBtn.addEventListener('click', async () => {
        const name = elements.tokenName.value.trim();
        const ticker = elements.tokenSymbol.value.trim();
        
        if (!name && !ticker) {
            showToast('Please enter a name or ticker to translate', 'warning');
            return;
        }
        
        // Disable button during translation
        elements.translateDeployBtn.disabled = true;
        elements.translateDeployBtn.textContent = 'Translating...';
        
        try {
            // Electron ipcRenderer removed for web - using fetch API instead
            
            // Translate both name and ticker in parallel using IPC
            const translations = await Promise.all([
                // Translate name
                (async () => {
                    if (name) {
                        const result = await translateTextWeb(, {
                            text: name,
                            sourceLang: 'EN',
                            targetLang: 'ZH'
                        });
                        
                        if (result.success && result.translatedText) {
                            return { field: 'name', value: result.translatedText };
                        }
                    }
                    return null;
                })(),
                // Translate ticker
                (async () => {
                    if (ticker) {
                        const result = await translateTextWeb(, {
                            text: ticker,
                            sourceLang: 'EN',
                            targetLang: 'ZH'
                        });
                        
                        if (result.success && result.translatedText) {
                            return { field: 'ticker', value: result.translatedText };
                        }
                    }
                    return null;
                })()
            ]);
            
            // Apply translations
            let translatedCount = 0;
            translations.forEach(translation => {
                if (translation) {
                    if (translation.field === 'name') {
                        elements.tokenName.value = translation.value;
                        // Update character counter
                        const nameLength = translation.value.length;
                        elements.nameCharCounter.textContent = `${nameLength}/32`;
                        translatedCount++;
                    } else if (translation.field === 'ticker') {
                        elements.tokenSymbol.value = translation.value;
                        // Update character counter
                        const tickerLength = translation.value.length;
                        elements.tickerCharCounter.textContent = `${tickerLength}/13`;
                        translatedCount++;
                    }
                }
            });
            
            if (translatedCount > 0) {
                showToast(`Translated ${translatedCount} field(s) to Chinese! Deploying on BNB...`, 'success');
                
                // Immediately deploy on BNB after successful translation
                setTimeout(() => {
                    deployTokenBNB('bnb', '');
                }, 100);
            } else {
                showToast('Translation failed. Cannot deploy.', 'error');
            }
            
        } catch (error) {
            console.error('Translation error:', error);
            showToast('Translation service unavailable. Cannot deploy.', 'error');
        } finally {
            // Re-enable button
            elements.translateDeployBtn.disabled = false;
            elements.translateDeployBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; margin-right: 8px;">
                    <path d="m5 8 6 6"></path>
                    <path d="m4 14 6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="m22 22-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>
                Translate and Deploy (BNB)
            `;
        }
    });

}

function deployToken(platform, imageType) {
    // ========== INSTANT BLAST ONLY - NO SLOW PATH ==========
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        showToast('Error', 'Not connected', 'error');
        return;
    }
    
    // BLOCK: Must have pre-built transaction ready!
    if (platform === 'pump' && !window.readyTxId) {
        showToast('Wait', 'Transaction building... wait for green button', 'warning');
        console.log('[DEPLOY] BLOCKED - No readyTxId!');
        return;
    }
    
    // INSTANT BLAST - just send the txId
    if (platform === 'pump' && window.readyTxId) {
        const txId = window.readyTxId;
        window.readyTxId = null; // Clear immediately
        window.prebuiltTx = null;
        updateReadyState();
        
        // Send immediately - no logging!
        websocket.send(JSON.stringify({ type: 'blast_now', txId }));
        return;
    }
    
    // ========== FALLBACK: SLOW PATH ==========
    console.log(`[DEPLOY] T+${Date.now()-T0}ms SLOW PATH - No pre-signed tx`);
    
    // Validate required fields
    const tokenName = elements.tokenName.value.trim() || ' ';
    const tokenSymbol = elements.tokenSymbol.value.trim().replace(/\s/g, '') || ' ';
    
    // USE CACHED IMAGE DATA - NO FILE I/O!
    let imageDataUrl = window.currentImageData;
    if (!imageDataUrl) {
        const currentImage = getCurrentImagePath();
        if (!currentImage) {
            showToast('Error', 'No image detected.', 'error');
            return;
        }
        console.log(`[DEPLOY] T+${Date.now()-T0}ms Reading image from disk...`);
        try {
            // const fs = require("fs"); // Removed for web
            const imageBuffer = // fs.readFileSync(currentImage);
            const mimeType = currentImage.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        } catch (error) {
            showToast('Error', `Failed to read image: ${error.message}`, 'error');
            return;
        }
    }

    const multiDeployCount = (platform === 'bags') ? 1 : (elements.multiDeployCheck.checked ? parseInt(elements.multiDeploy.value) || 1 : 1);
    
    // Get the appropriate active wallet based on platform
    const requiredWalletType = (platform === 'bnb') ? 'bnb' : 'solana';
    const activeWalletId = (platform === 'bnb') ? activeBnbWalletId : activeSolanaWalletId;
    const activeWallet = wallets.find(w => w.id === activeWalletId);
    
    if (!activeWallet) {
        const walletTypeName = requiredWalletType === 'bnb' ? 'BNB' : 'Solana';
        const platformName = platform === 'bnb' ? 'BNB Chain' : 'Solana';
        showToast('Error', `No ${walletTypeName} wallet selected! Please go to Wallet tab and add/select a ${walletTypeName} wallet for ${platformName} deployment.`, 'error');
        addLog('error', `❌ No ${walletTypeName} wallet selected for ${platformName} deployment`);
        return;
    }

    const deployData = {
        api_key: activeWallet.apiKey,
        type: platform,
        name: tokenName,
        ticker: tokenSymbol,
        website: elements.website.value.trim(),
        twitter: elements.twitter.value.trim(),
        buy_amount: platform === 'bnb' ? (parseFloat(elements.bnbAmount.value) || 3) : 
                   platform === 'usd1' ? (parseFloat(elements.usd1Amount.value) || 2) : 
                   (parseFloat(elements.buyAmount.value) || 7),
        multi_deploy: multiDeployCount,
        image_type: imageType,
        image_data: imageDataUrl,
        ref: elements.bagsFeeClaimer.value.trim() || undefined
    };
    
    const deployTypeText = imageType ? imageType.toUpperCase() : platform.toUpperCase();
    const multiText = deployData.multi_deploy > 1 ? ` (${deployData.multi_deploy}x)` : '';
    

    
    try {

        
        websocket.send(JSON.stringify(deployData));
        addLog('info', `📤 WebSocket Send: ${JSON.stringify(deployData)}`);

    } catch (error) {

        hideLoading();
        showToast('Error', `Failed to send deploy request: ${error.message}`, 'error');
    }
}

function deployTokenBNB(platform, imageType) {
    // Show launching message
    showLaunchingMessage(platform.toUpperCase());
    
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        showToast('Error', 'Not connected to Local Server. Please check your connection.', 'error');
        return;
    }
    
    // Validate required fields - only API key is required, name/ticker can be empty
    const tokenName = elements.tokenName.value.trim() || ' '; // Use space if empty
    const tokenSymbol = elements.tokenSymbol.value.trim().replace(/\s/g, '') || ' '; // Use space if empty
    
    // Prepare deploy data
    const currentImage = getCurrentImagePath();
    if (!currentImage) {
        hideLoading();
        showToast('Error', 'No image detected. Please set an image folder in Settings.', 'error');
        return;
    }

    // Convert image file to base64 data URL
    let imageDataUrl = '';
    try {
        // const fs = require("fs"); // Removed for web
        const imageBuffer = // fs.readFileSync(currentImage);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = currentImage.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        imageDataUrl = `data:${mimeType};base64,${base64Image}`;
    } catch (error) {
        hideLoading();
        showToast('Error', `Failed to read image: ${error.message}`, 'error');
        return;
    }

    const bnbAmount = parseFloat(elements.bnbAmount.value) || 3; // Use BNB amount input
    const multiDeployEnabled = elements.multiDeployCheck.checked;
    const multiDeployCount = multiDeployEnabled ? parseInt(elements.multiDeployValue.value) || 1 : 1;
    
    // Get the active BNB wallet
    const activeWallet = wallets.find(w => w.id === activeBnbWalletId);
    if (!activeWallet) {
        showToast('Error', 'No BNB wallet selected! Please go to Wallet tab and add/select a BNB wallet for BNB Chain deployment.', 'error');
        addLog('error', '❌ No BNB wallet selected for BNB Chain deployment');
        return;
    }

    const deployData = {
        api_key: activeWallet.apiKey,
        type: platform,
        name: tokenName,
        ticker: tokenSymbol,
        website: elements.website.value.trim(),
        twitter: elements.twitter.value.trim(),
        buy_amount: bnbAmount, // Use BNB amount instead of SOL amount
        multi_deploy: multiDeployCount,
        image_type: imageType,
        image_data: imageDataUrl,
        ref: elements.bagsFeeClaimer.value.trim() || undefined
    };
    
    const deployTypeText = imageType ? imageType.toUpperCase() : platform.toUpperCase();
    const multiText = deployData.multi_deploy > 1 ? ` (${deployData.multi_deploy}x)` : '';
    
    try {
        websocket.send(JSON.stringify(deployData));
        addLog('info', `📤 WebSocket Send: ${JSON.stringify(deployData)}`);
    } catch (error) {
        hideLoading();
        showToast('Error', `Failed to send deploy request: ${error.message}`, 'error');
    }
}

function deployWithImageType(imageType) {
    // Log the exact moment image type button is clicked
    addLog('info', `🖼️ ${imageType.toUpperCase()} button clicked`);
    
    // Check if Twitter username is in any whitelist
    const twitterUrl = elements.twitter.value.trim();
    const twitterUsername = extractUsernameFromTwitter(twitterUrl);
    if (twitterUsername) {
        const whitelistPlatform = getWhitelistPlatform(twitterUsername);
        if (whitelistPlatform) {
            deployToken(whitelistPlatform, imageType);
            return;
        }
    }
    
    // Use the default platform selected in the header
    const defaultPlatform = getDefaultPlatform();
    deployToken(defaultPlatform, imageType);
}

// Wallet import handling
let wallets = [];
let activeSolanaWalletId = null;
let activeBnbWalletId = null;

function initializeWalletImport() {
    elements.importSolanaBtn.addEventListener('click', () => handleWalletImport('solana'));
    elements.importBnbBtn.addEventListener('click', () => handleWalletImport('bnb'));
    loadWallets();
    renderWalletList();
}

// API Key validation function
function validateApiKey(apiKey, walletType) {
    if (!apiKey || apiKey.trim().length === 0) {
        return { valid: false, error: 'API key cannot be empty' };
    }
    
    const trimmedKey = apiKey.trim();
    
    // Reject common private key formats
    if (isPrivateKey(trimmedKey)) {
        return { valid: false, error: 'Private keys are not accepted! Please use API keys from j7tracker.com only.' };
    }
    
    // Check if it's Base64 encoded (basic validation)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(trimmedKey)) {
        return { valid: false, error: 'Invalid API key format. Please use API keys from j7tracker.com only.' };
    }
    
    // Check minimum length (should be substantial)
    if (trimmedKey.length < 100) {
        return { valid: false, error: 'API key appears too short. Please use valid API keys from j7tracker.com.' };
    }
    
    // Try to decode to verify it's valid Base64
    let decoded;
    try {
        decoded = atob(trimmedKey);
        if (decoded.length < 50) {
            return { valid: false, error: 'Invalid API key format. Please use API keys from j7tracker.com only.' };
        }
    } catch (e) {
        return { valid: false, error: 'Invalid API key format. Please use API keys from j7tracker.com only.' };
    }
    
    // Validate specific wallet type patterns
    if (walletType === 'solana') {
        return validateSolanaApiKey(trimmedKey, decoded);
    } else if (walletType === 'bnb') {
        return validateBnbApiKey(trimmedKey, decoded);
    }
    
    return { valid: true };
}

// Check if input looks like a private key (which we should reject)
function isPrivateKey(input) {
    const trimmed = input.trim();
    
    // Solana private key patterns (base58, hex, array format)
    if (trimmed.length === 88 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
        return true; // Base58 private key
    }
    
    if (trimmed.length === 128 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        return true; // Hex private key
    }
    
    if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.includes(',')) {
        return true; // Array format private key
    }
    
    // Ethereum private key patterns
    if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        return true; // Hex private key without 0x
    }
    
    if (trimmed.length === 66 && trimmed.startsWith('0x') && /^0x[0-9a-fA-F]+$/.test(trimmed)) {
        return true; // Hex private key with 0x
    }
    
    return false;
}

// Validate Solana API key format
function validateSolanaApiKey(key, decoded) {
    // Solana encrypted API keys typically have certain patterns
    // Check for Solana-specific encrypted format indicators
    if (decoded.includes('solana') || decoded.includes('SOL') || key.includes('Qm') || key.includes('Tk')) {
        return { valid: true };
    }
    
    // Additional Solana validation - check length and format
    if (key.length > 150 && key.length < 300) {
        return { valid: true };
    }
    
    return { valid: false, error: 'This does not appear to be a valid Solana API key from j7tracker.com' };
}

// Validate BNB API key format  
function validateBnbApiKey(key, decoded) {
    // BNB encrypted API keys typically have different patterns
    // Check for BNB-specific encrypted format indicators
    if (decoded.includes('bnb') || decoded.includes('BNB') || decoded.includes('bsc') || decoded.includes('BSC')) {
        return { valid: true };
    }
    
    // Additional BNB validation - different length patterns than Solana
    if (key.length > 120 && key.length < 250) {
        return { valid: true };
    }
    
    return { valid: false, error: 'This does not appear to be a valid BNB Chain API key from j7tracker.com' };
}

async function handleWalletImport(walletType) {
    const isSolana = walletType === 'solana';
    
    // Get elements based on wallet type
    const nameElement = isSolana ? elements.solanaWalletName : elements.bnbWalletName;
    const apiKeyElement = isSolana ? elements.solanaApiKey : elements.bnbApiKey;
    const importBtn = isSolana ? elements.importSolanaBtn : elements.importBnbBtn;
    const resultElement = isSolana ? elements.solanaImportResult : elements.bnbImportResult;
    const resultNameElement = isSolana ? elements.solanaResultName : elements.bnbResultName;
    
    const walletName = nameElement.value.trim();
    const apiKey = apiKeyElement.value.trim();
    
    if (!walletName) {
        showToast('Error', 'Please enter a wallet name', 'error');
        return;
    }
    
    // Validate API key
    const validation = validateApiKey(apiKey, walletType);
    if (!validation.valid) {
        showToast('Error', validation.error, 'error');
        return;
    }
    
    // Check if wallet name already exists for this type
    if (wallets.some(w => w.name === walletName && w.type === walletType)) {
        showToast('Error', `A ${walletType.toUpperCase()} wallet with this name already exists`, 'error');
        return;
    }
    
    try {
        // Show loading
        importBtn.textContent = 'Adding...';
        importBtn.disabled = true;
        
        // Create wallet object (no server request needed)
        const newWallet = {
            id: Date.now().toString(),
            name: walletName,
            type: walletType,
            apiKey: apiKey,
            keyPreview: apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 10),
            dateAdded: new Date().toISOString()
        };
        
        // Add to local storage
        wallets.push(newWallet);
        saveWallets();
        
        // Set as active wallet if it's the first of its type
        const sameTypeWallets = wallets.filter(w => w.type === walletType);
        if (sameTypeWallets.length === 1) {
            if (walletType === 'solana') {
                activeSolanaWalletId = newWallet.id;
            } else if (walletType === 'bnb') {
                activeBnbWalletId = newWallet.id;
            }
            saveActiveWallets();
        }
        
        // Update UI
        renderWalletList();
        
        // Show success message
        resultElement.style.display = 'block';
        resultNameElement.textContent = walletName;
        
        // Clear form
        nameElement.value = '';
        apiKeyElement.value = '';
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            resultElement.style.display = 'none';
        }, 5000);
        
        updateLastActivity(`${walletType.toUpperCase()} wallet added: ${walletName}`);
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('Error', 'Failed to add wallet', 'error');
    } finally {
        // Reset button
        importBtn.textContent = isSolana ? 'Add Solana Wallet' : 'Add BNB Wallet';
        importBtn.disabled = false;
    }
}

function selectWallet(walletId) {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;
    
    // Set the appropriate active wallet based on type
    if (wallet.type === 'solana') {
        activeSolanaWalletId = walletId;
    } else if (wallet.type === 'bnb') {
        activeBnbWalletId = walletId;
    }
    
    saveActiveWallets();
    renderWalletList();
    
    updateLastActivity(`Selected ${wallet.type.toUpperCase()} wallet: ${wallet.name}`);
    showToast('Success', `Activated ${wallet.type.toUpperCase()} wallet: ${wallet.name}`, 'success');
}

function deleteWallet(walletId) {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;
    
    if (confirm(`Delete wallet "${wallet.name}"?`)) {
        wallets = wallets.filter(w => w.id !== walletId);
        
        // If this was an active wallet, clear it
        if (wallet.type === 'solana' && activeSolanaWalletId === walletId) {
            activeSolanaWalletId = null;
        } else if (wallet.type === 'bnb' && activeBnbWalletId === walletId) {
            activeBnbWalletId = null;
        }
        
        saveWallets();
        renderWalletList();
        
        showToast('Success', `Deleted ${wallet.type.toUpperCase()} wallet: ${wallet.name}`, 'success');
    }
}

function renderWalletList() {
    // Render Solana wallets
    renderWalletListByType('solana', elements.solanaWalletList);
    
    // Render BNB wallets
    renderWalletListByType('bnb', elements.bnbWalletList);
}

function renderWalletListByType(walletType, listElement) {
    if (!listElement) return;
    
    const typeWallets = wallets.filter(w => w.type === walletType);
    
    if (typeWallets.length === 0) {
        const noWalletsText = walletType === 'solana' ? 'No Solana wallets added yet' : 'No BNB wallets added yet';
        listElement.innerHTML = `<div class="no-wallets">${noWalletsText}</div>`;
        return;
    }
    
    // Clear existing content
    listElement.innerHTML = '';
    
    // Create wallet items
    typeWallets.forEach(wallet => {
        const currentActiveId = walletType === 'solana' ? activeSolanaWalletId : activeBnbWalletId;
        const walletItem = document.createElement('div');
        walletItem.className = `wallet-item ${walletType} ${wallet.id === currentActiveId ? 'active' : ''}`;
        walletItem.setAttribute('data-wallet-id', wallet.id);
        
        const walletInfo = document.createElement('div');
        walletInfo.className = 'wallet-info';
        
        const walletTypeDiv = document.createElement('div');
        walletTypeDiv.className = 'wallet-type';
        const isActive = wallet.id === currentActiveId;
        walletTypeDiv.textContent = `${walletType.toUpperCase()}${isActive ? ' (Active)' : ''}`;
        
        const walletName = document.createElement('div');
        walletName.className = 'wallet-name';
        walletName.textContent = wallet.name;
        
        const walletKeyPreview = document.createElement('div');
        walletKeyPreview.className = 'wallet-key-preview';
        walletKeyPreview.textContent = `API Key: ${wallet.keyPreview}`;
        walletKeyPreview.style.cursor = 'pointer';
        walletKeyPreview.title = 'Click to copy full API key';
        walletKeyPreview.addEventListener('click', () => {
            navigator.clipboard.writeText(wallet.apiKey).then(() => {
                showToast('Copied', 'API key copied to clipboard', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = wallet.apiKey;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast('Copied', 'API key copied to clipboard', 'success');
            });
        });
        
        walletInfo.appendChild(walletTypeDiv);
        walletInfo.appendChild(walletName);
        walletInfo.appendChild(walletKeyPreview);
        
        const walletActions = document.createElement('div');
        walletActions.className = 'wallet-actions';
        
        // Create select button (only for inactive wallets)
        if (wallet.id !== currentActiveId) {
            const selectBtn = document.createElement('button');
            selectBtn.className = 'wallet-btn select-btn';
            selectBtn.textContent = 'Select';
            selectBtn.addEventListener('click', () => {
                selectWallet(wallet.id);
            });
            walletActions.appendChild(selectBtn);
        }
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'wallet-btn delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            deleteWallet(wallet.id);
        });
        
        walletActions.appendChild(deleteBtn);
        
        walletItem.appendChild(walletInfo);
        walletItem.appendChild(walletActions);
        
        listElement.appendChild(walletItem);
    });
}

function saveWallets() {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        const walletsData = {
            activeSolanaWalletId: activeSolanaWalletId,
            activeBnbWalletId: activeBnbWalletId,
            wallets: wallets
        };
        
        const configDir = path.join(__dirname, 'config');
        const walletsFile = path.join(configDir, 'wallets.json');
        
        // Ensure config directory exists
        if (!// fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // fs.writeFileSync(walletsFile, JSON.stringify(walletsData, null, 2));
    } catch (error) {
        console.error('Failed to save wallets:', error);
    }
}

function saveActiveWallets() {
    saveWallets(); // Active wallet IDs are saved as part of wallets data
}

function loadWallets() {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        const configDir = path.join(__dirname, 'config');
        const walletsFile = path.join(configDir, 'wallets.json');
        
        // Ensure config directory exists
        if (!// fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        if (// fs.existsSync(walletsFile)) {
            const data = // fs.readFileSync(walletsFile, 'utf8');
            const walletsData = JSON.parse(data);
            
            // Handle both old format (array) and new format (object)
            if (Array.isArray(walletsData)) {
                // Old format - just wallets array
                wallets = walletsData;
                activeSolanaWalletId = null;
                activeBnbWalletId = null;
            } else {
                // New format - object with separate active wallet IDs
                wallets = walletsData.wallets || [];
                activeSolanaWalletId = walletsData.activeSolanaWalletId || null;
                activeBnbWalletId = walletsData.activeBnbWalletId || null;
                
                // Handle migration from old single activeWalletId
                if (walletsData.activeWalletId && !activeSolanaWalletId && !activeBnbWalletId) {
                    const oldActiveWallet = wallets.find(w => w.id === walletsData.activeWalletId);
                    if (oldActiveWallet) {
                        if (oldActiveWallet.type === 'solana') {
                            activeSolanaWalletId = oldActiveWallet.id;
                        } else if (oldActiveWallet.type === 'bnb') {
                            activeBnbWalletId = oldActiveWallet.id;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading wallets:', error);
        wallets = [];
        activeSolanaWalletId = null;
        activeBnbWalletId = null;
    }
}

// Logs handling
function initializeLogs() {
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    elements.scrollBottomBtn.addEventListener('click', scrollLogsToBottom);
}

function addLog(type, message) {
    // Create exact millisecond timestamp (HH:MM:SS.mmm)
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    const timestamp = `${hours}:${minutes}:${seconds}.${milliseconds}`;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-msg">${message}</span>
    `;
    
    elements.logsOutput.appendChild(logEntry);
    
    // Auto-scroll to bottom
    elements.logsOutput.scrollTop = elements.logsOutput.scrollHeight;
    
    // Limit log entries
    const logEntries = elements.logsOutput.querySelectorAll('.log-entry');
    if (logEntries.length > 200) {
        logEntries[0].remove();
    }
}

function clearLogs() {
    elements.logsOutput.innerHTML = `
        <div class="log-entry">
            <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-msg">Logs cleared</span>
        </div>
    `;
}

function scrollLogsToBottom() {
    elements.logsOutput.scrollTop = elements.logsOutput.scrollHeight;
}

// Config file management
let config = {
    imageFolder: '',
    autoRefreshImages: true,
    defaultPlatform: 'pump', // Default platform selection
    windowPosition: {
        x: null,
        y: null,
        width: null,
        height: null,
        savePosition: false
    },
    whitelists: {
        pump: [],
        bonk: [],
        bags: [],
        ray: [],
        bnb: [],
        usd1: []
    },
    presetButtons: [],
    keybinds: {
        translateAndDeploy: 'F1' // Default keybind for Translate and Deploy
    }
};

function saveConfig() {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        const configDir = path.join(__dirname, 'config');
        const configFile = path.join(configDir, 'config.json');
        
        // Ensure config directory exists
        if (!// fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

function loadConfig() {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        const configDir = path.join(__dirname, 'config');
        const configFile = path.join(configDir, 'config.json');
        
        // Ensure config directory exists
        if (!// fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Migrate old config files if they exist
        migrateOldConfigFiles();
        
        if (// fs.existsSync(configFile)) {
            const data = // fs.readFileSync(configFile, 'utf8');
            config = { ...config, ...JSON.parse(data) }; // Merge with defaults
        }
    } catch (error) {
        console.error('Error loading config:', error);
        config = {
            imageFolder: '',
            autoRefreshImages: true,
            activeWalletId: null,
            whitelists: {
                pump: [],
                bonk: [],
                bags: [],
                ray: [],
                bnb: [],
                usd1: []
            }
        };
    }
}

function migrateOldConfigFiles() {
    try {
        // const fs = require("fs"); // Removed for web
        // const path = require("path"); // Removed for web
        
        const configDir = path.join(__dirname, 'config');
        const oldConfigFile = path.join(__dirname, 'config.json');
        const oldWalletsFile = path.join(__dirname, 'wallets.json');
        const newConfigFile = path.join(configDir, 'config.json');
        const newWalletsFile = path.join(configDir, 'wallets.json');
        
        // Migrate config.json
        if (// fs.existsSync(oldConfigFile) && !// fs.existsSync(newConfigFile)) {
            fs.copyFileSync(oldConfigFile, newConfigFile);
            fs.unlinkSync(oldConfigFile);
            console.log('Migrated config.json to config folder');
        }
        
        // Migrate wallets.json
        if (// fs.existsSync(oldWalletsFile) && !// fs.existsSync(newWalletsFile)) {
            fs.copyFileSync(oldWalletsFile, newWalletsFile);
            fs.unlinkSync(oldWalletsFile);
            console.log('Migrated wallets.json to config folder');
        }
    } catch (error) {
        console.error('Error migrating config files:', error);
    }
}

function loadConfigToUI() {
    // Load config from file
    loadConfig();
    
    // Restore default platform selection
    const savedPlatform = config.defaultPlatform || 'pump';
    setDefaultPlatform(savedPlatform);
    
    // Apply config to UI elements
    if (config.imageFolder) {
        elements.imageFolder.value = config.imageFolder;
    }
    
    if (config.autoRefreshImages !== undefined) {
        elements.autoRefreshImages.checked = config.autoRefreshImages;
    }
    
    // Load window position settings
    if (config.windowPosition && config.windowPosition.savePosition !== undefined) {
        elements.saveWindowPosition.checked = config.windowPosition.savePosition;
        
        // Restore window position if enabled
        restoreWindowPosition();
    }
    
    // Load keybinds
    if (config.keybinds && config.keybinds.translateAndDeploy) {
        elements.translateDeployKeybind.value = config.keybinds.translateAndDeploy;
    }
    
    // Load whitelists
    renderWhitelists();
    
    // Load preset buttons
    renderPresetButtons();
    renderDeployPresetButtons();
    
    // Start image monitoring if enabled and do initial scan
    if (elements.autoRefreshImages.checked && elements.imageFolder.value) {
        startImageMonitoring();
        // Do an immediate scan for existing images
        findLatestImage(elements.imageFolder.value).then(latestImage => {
            if (latestImage) {
                currentImagePath = latestImage;
                updateImagePreview(latestImage);
            }
        });
    }
}

// Whitelist management
function initializeWhitelists() {
    const whitelistInputs = [
        { input: elements.pumpWhitelist, platform: 'pump' },
        { input: elements.bonkWhitelist, platform: 'bonk' },
        { input: elements.bagsWhitelist, platform: 'bags' },
        { input: elements.rayWhitelist, platform: 'ray' },
        { input: elements.bnbWhitelist, platform: 'bnb' },
        { input: elements.usd1Whitelist, platform: 'usd1' }
    ];
    
    whitelistInputs.forEach(({ input, platform }) => {
        if (!input) {
            console.error(`Whitelist input element not found for platform: ${platform}`);
            return;
        }
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const username = input.value.trim();
                console.log(`Adding to ${platform} whitelist: "${username}"`);
                if (username) {
                    addToWhitelist(platform, username);
                    input.value = '';
                }
            }
        });
    });
}

function addToWhitelist(platform, username) {
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '');
    
    console.log(`addToWhitelist called: platform="${platform}", username="${username}", cleanUsername="${cleanUsername}"`);
    console.log(`config.whitelists[${platform}]:`, config.whitelists[platform]);
    
    if (!config.whitelists[platform]) {
        console.error(`Whitelist array not found for platform: ${platform}`);
        config.whitelists[platform] = [];
    }
    
    if (!config.whitelists[platform].includes(cleanUsername)) {
        config.whitelists[platform].push(cleanUsername);
        saveConfig();
        renderWhitelists();
        showToast('Success', `Added ${cleanUsername} to ${platform.toUpperCase()} whitelist`, 'success');
    } else {
        showToast('Info', `${cleanUsername} already in ${platform.toUpperCase()} whitelist`, 'info');
    }
}

function removeFromWhitelist(platform, username) {
    config.whitelists[platform] = config.whitelists[platform].filter(u => u !== username);
    saveConfig();
    renderWhitelists();
    showToast('Success', `Removed ${username} from ${platform.toUpperCase()} whitelist`, 'success');
}

function renderWhitelists() {
    const platforms = ['pump', 'bonk', 'bags', 'ray', 'bnb', 'usd1'];
    
    platforms.forEach(platform => {
        const tagsContainer = elements[`${platform}WhitelistTags`];
        if (!tagsContainer) return;
        
        const usernames = config.whitelists[platform] || [];
        
        if (usernames.length === 0) {
            tagsContainer.innerHTML = '';
            return;
        }
        
        tagsContainer.innerHTML = usernames.map(username => `
            <div class="whitelist-tag">
                @${username}
                <span class="remove-tag" onclick="removeFromWhitelist('${platform}', '${username}')">&times;</span>
            </div>
        `).join('');
    });
}

function extractUsernameFromTwitter(twitterUrl) {
    if (!twitterUrl) return null;
    
    // Handle both twitter.com and x.com URLs
    const twitterMatch = twitterUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    if (twitterMatch && twitterMatch[1]) {
        return twitterMatch[1].replace(/^@/, ''); // Remove @ if present
    }
    
    // If it's just a username (no URL), clean it
    if (!twitterUrl.includes('/') && !twitterUrl.includes('.')) {
        return twitterUrl.replace(/^@/, '');
    }
    
    return null;
}

function getWhitelistPlatform(username) {
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    
    // Check each platform's whitelist using partial matching
    for (const [platform, usernames] of Object.entries(config.whitelists)) {
        for (const whitelistedUser of usernames) {
            // Check if the username contains the whitelisted term (case insensitive)
            if (cleanUsername.includes(whitelistedUser.toLowerCase())) {
                return platform;
            }
        }
    }
    
    return null; // Not found in any whitelist
}

// No auto-save for form data - only save persistent settings when needed

// Cleanup on window close
window.addEventListener('beforeunload', () => {
    stopImageMonitoring();
    stopClipboardMonitoring();
});

// Key bindings for Enter key deployment
function initializeKeyBindings() {
    const deployFields = [
        elements.tokenName,
        elements.tokenSymbol,
        elements.twitter,
        elements.website,
        elements.bagsFeeClaimer,
        elements.buyAmount
    ];
    
    deployFields.forEach(field => {
        if (field) {
            field.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleEnterKeyDeploy();
                }
            });
        }
    });
    
    // Add ticker generation on token name changes
    if (elements.tokenName) {
        elements.tokenName.addEventListener('input', updateTickerFromName);
        elements.tokenName.addEventListener('paste', () => {
            // Use setTimeout to ensure paste content is processed
            setTimeout(updateTickerFromName, 10);
        });
    }
}

function handleEnterKeyDeploy() {
    // Log the exact moment Enter key deploy is triggered
    addLog('info', '⌨️ Enter key deploy triggered');
    
    // Check if Twitter username is in any whitelist
    const twitterUrl = elements.twitter.value.trim();
    const twitterUsername = extractUsernameFromTwitter(twitterUrl);
    if (twitterUsername) {
        const whitelistPlatform = getWhitelistPlatform(twitterUsername);
        if (whitelistPlatform) {
            deployToken(whitelistPlatform, '');
            updateLastActivity(`Whitelist deploy: ${whitelistPlatform.toUpperCase()} (@${twitterUsername})`);
            return;
        }
    }
    
    // Get the default platform
    const defaultPlatform = getDefaultPlatform();
    
    // Deploy with default platform and no specific image type
    deployToken(defaultPlatform, '');
    
    updateLastActivity(`Quick deploy: ${defaultPlatform.toUpperCase()} (Enter key)`);
}

// Ticker generation from token name
function updateTickerFromName() {
    const name = elements.tokenName.value.trim();
    
    // Handle empty input
    if (!name) {
        elements.tokenSymbol.value = '';
        return;
    }
    
    // Clean the name - remove extra spaces
    const cleanedName = name.replace(/\s+/g, ' ');
    const words = cleanedName.split(' ');
    
    if (!words.length) {
        elements.tokenSymbol.value = '';
        return;
    }
    
    // Color detection logic
    const colorWords = [
        'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray', 'grey',
        'brown', 'violet', 'indigo', 'turquoise', 'cyan', 'magenta', 'lime', 'navy', 'maroon',
        'olive', 'teal', 'silver', 'gold', 'beige', 'tan', 'crimson', 'scarlet', 'azure',
        'emerald', 'jade', 'ruby', 'sapphire', 'amber', 'coral', 'salmon', 'peach', 'mint',
        'lavender', 'rose', 'ivory', 'pearl', 'bronze', 'copper', 'platinum', 'charcoal'
    ];
    
    // Check each word for colors
    for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:()\[\]{}"'\-]/g, '');
        if (colorWords.includes(cleanWord)) {
            elements.tokenSymbol.value = cleanWord.toUpperCase();
            return;
        }
    }
    
    // Process words and separate text from numbers
    const cleanWords = [];
    for (const word of words) {
        if (/\d/.test(word)) {
            // Word contains numbers - split text and numbers
            const parts = word.match(/[a-zA-Z]+|[\d.\-+]+/g) || [];
            for (const part of parts) {
                if (/\d/.test(part)) {
                    cleanWords.push({ type: 'number', value: part.toUpperCase() });
                } else {
                    if (part) cleanWords.push({ type: 'text', value: part });
                }
            }
        } else {
            // Regular text word
            if (word) cleanWords.push({ type: 'text', value: word });
        }
    }
    
    if (!cleanWords.length) {
        elements.tokenSymbol.value = 'TOKEN';
        return;
    }
    
    // Count text words and calculate number words length
    const textWords = cleanWords.filter(w => w.type === 'text').map(w => w.value);
    const numberWordsLength = cleanWords.filter(w => w.type === 'number').reduce((sum, w) => sum + w.value.length, 0);
    
    // Determine text processing rule
    let textRule = 'none';
    
    if (textWords.length >= 3) {
        textRule = 'first_letter';
    } else if (textWords.length === 1) {
        const fullWordLength = textWords[0].length + numberWordsLength;
        textRule = fullWordLength <= 10 ? 'full_word' : 'trim_word';
    } else if (textWords.length === 2) {
        const [word1, word2] = textWords;
        
        // Special case: if second word is 'token' or 'coin', use only first word
        if (word2.toLowerCase() === 'token' || word2.toLowerCase() === 'coin') {
            const firstWordLength = word1.length + numberWordsLength;
            if (firstWordLength <= 10) {
                textRule = 'first_word_only';
            }
        } else {
            const combinedLength = word1.length + word2.length + numberWordsLength;
            const combinedWithSpaceLength = word1.length + 1 + word2.length;
            
            if (combinedWithSpaceLength <= 11 && combinedLength <= 10) {
                textRule = 'combine_words';
            } else {
                textRule = 'first_letter';
            }
        }
    }
    
    // Process words according to the determined rule
    const resultParts = [];
    let textWordIndex = 0;
    
    for (const wordObj of cleanWords) {
        if (wordObj.type === 'number') {
            resultParts.push(wordObj.value);
        } else { // text
            const word = wordObj.value;
            switch (textRule) {
                case 'first_letter':
                    resultParts.push(word[0].toUpperCase());
                    break;
                case 'full_word':
                    resultParts.push(word.toUpperCase());
                    break;
                case 'trim_word':
                    const availableChars = 10 - numberWordsLength;
                    const trimmedWord = word.substring(0, availableChars);
                    resultParts.push(trimmedWord.toUpperCase());
                    break;
                case 'first_word_only':
                    if (textWordIndex === 0) {
                        resultParts.push(word.toUpperCase());
                    }
                    break;
                case 'combine_words':
                    if (textWordIndex === 0) {
                        resultParts.push(word.toUpperCase());
                    } else if (textWordIndex === 1) {
                        // Combine with previous word
                        if (resultParts.length > 0) {
                            const lastIndex = resultParts.length - 1;
                            resultParts[lastIndex] = resultParts[lastIndex] + word.toUpperCase();
                        }
                    }
                    break;
            }
            textWordIndex++;
        }
    }
    
    let result = resultParts.join('').substring(0, 10);
    
    // Ensure we have something
    if (!result) {
        result = 'TOKEN';
    }
    
    elements.tokenSymbol.value = result;
    
    // UPDATE TICKER CHARACTER COUNTER after auto-generation
    updateTickerCharCounter();
}

// UI utilities
function showLoading(text = 'Loading...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showLaunchingMessage(platform) {
    // Show launching message for 1 second
    const toast = document.createElement('div');
    toast.className = 'toast info';
    
    toast.innerHTML = `
        <div class="toast-title">Launching</div>
        <div class="toast-message">${platform} Token!</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto-remove after 1 second
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 1000);
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

function updateLastActivity(activity) {
    elements.lastActivity.textContent = activity;
}

// IPC event listeners for server output
ipcRenderer.on('server-output', (event, output) => {
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
        if (line.includes('✅') || line.includes('Success')) {
            addLog('success', line);
        } else if (line.includes('❌') || line.includes('Error') || line.includes('Failed')) {
            addLog('error', line);
        } else if (line.includes('⚠️') || line.includes('Warning')) {
            addLog('warning', line);
        } else {
            addLog('info', line);
        }
    });
});

ipcRenderer.on('server-error', (event, error) => {
    addLog('error', `Server Error: ${error}`);
});



// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Check for custom Translate and Deploy keybind
    if (config.keybinds && config.keybinds.translateAndDeploy) {
        const keybind = config.keybinds.translateAndDeploy;
        const parts = keybind.split('+');
        let matches = true;
        
        // Check modifiers
        const hasCtrl = parts.includes('Ctrl');
        const hasAlt = parts.includes('Alt');
        const hasShift = parts.includes('Shift');
        
        if (hasCtrl && !event.ctrlKey) matches = false;
        if (!hasCtrl && event.ctrlKey) matches = false;
        if (hasAlt && !event.altKey) matches = false;
        if (!hasAlt && event.altKey) matches = false;
        if (hasShift && !event.shiftKey) matches = false;
        if (!hasShift && event.shiftKey) matches = false;
        
        // Get the actual key (last part)
        const actualKey = parts[parts.length - 1];
        let eventKey = event.key;
        if (eventKey === ' ') eventKey = 'Space';
        if (eventKey.length === 1) eventKey = eventKey.toUpperCase();
        
        if (eventKey !== actualKey) matches = false;
        
        if (matches) {
            event.preventDefault();
            // Trigger the translate and deploy button
            elements.translateDeployBtn.click();
            return;
        }
    }
    
    // Ctrl/Cmd + Enter to deploy
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        deployToken('');
    }
    
    // Tab switching with Ctrl/Cmd + 1/2/3
    if (event.ctrlKey || event.metaKey) {
        if (event.key === '1') {
            event.preventDefault();
            switchTab('deploy');
        } else if (event.key === '2') {
            event.preventDefault();
            switchTab('wallet');
        } else if (event.key === '3') {
            event.preventDefault();
            switchTab('logs');
                    }
    }
});

// ==================== PRESET BUTTONS FUNCTIONALITY ====================

function initializePresetButtons() {
    // Add preset button event listener
    elements.addPresetButton.addEventListener('click', addPresetButton);
    
    // Load and render existing preset buttons
    renderPresetButtons();
    renderDeployPresetButtons();
}

function addPresetButton() {
    const name = elements.presetButtonName.value.trim(); // Only trim the button name
    const namePrefix = elements.presetNamePrefix.value; // DON'T trim - preserve spaces
    const nameSuffix = elements.presetNameSuffix.value; // DON'T trim - preserve spaces
    const tickerPrefix = elements.presetTickerPrefix.value; // DON'T trim - preserve spaces
    const tickerSuffix = elements.presetTickerSuffix.value; // DON'T trim - preserve spaces
    
    // Get selected ticker option
    const tickerOption = document.querySelector('input[name="tickerOption"]:checked').value;
    
    if (!name) {
        showToast('Error', 'Please enter a button name', 'error');
        return;
    }
    
    // Create preset button object
    const presetButton = {
        id: Date.now().toString(),
        name,
        namePrefix,
        nameSuffix,
        tickerPrefix,
        tickerSuffix,
        tickerOption
    };
    
    // Add to config
    if (!config.presetButtons) {
        config.presetButtons = [];
    }
    config.presetButtons.push(presetButton);
    
    // Save config
    saveConfig();
    
    // Clear form
    elements.presetButtonName.value = '';
    elements.presetNamePrefix.value = '';
    elements.presetNameSuffix.value = '';
    elements.presetTickerPrefix.value = '';
    elements.presetTickerSuffix.value = '';
    document.querySelector('input[name="tickerOption"][value="original"]').checked = true;
    
    // Re-render buttons
    renderPresetButtons();
    renderDeployPresetButtons();
    
    addLog('info', `✅ Added preset button: ${name}`);
}

function removePresetButton(buttonId) {
    if (!config.presetButtons) return;
    
    config.presetButtons = config.presetButtons.filter(btn => btn.id !== buttonId);
    saveConfig();
    
    renderPresetButtons();
    renderDeployPresetButtons();
    
    addLog('info', '🗑️ Removed preset button');
}

function editPresetButton(buttonId) {
    if (!config.presetButtons) return;
    
    const button = config.presetButtons.find(btn => btn.id === buttonId);
    if (!button) return;
    
    // Fill form with button data
    elements.presetButtonName.value = button.name;
    elements.presetNamePrefix.value = button.namePrefix || '';
    elements.presetNameSuffix.value = button.nameSuffix || '';
    elements.presetTickerPrefix.value = button.tickerPrefix || '';
    elements.presetTickerSuffix.value = button.tickerSuffix || '';
    
    // Set ticker option
    const tickerOption = button.tickerOption || 'original';
    document.querySelector(`input[name="tickerOption"][value="${tickerOption}"]`).checked = true;
    
    // Remove the button (will be re-added when form is submitted)
    removePresetButton(buttonId);
    
    addLog('info', `✏️ Editing preset button: ${button.name}`);
}

function renderPresetButtons() {
    if (!elements.presetButtonsList) return;
    
    elements.presetButtonsList.innerHTML = '';
    
    if (!config.presetButtons || config.presetButtons.length === 0) {
        elements.presetButtonsList.innerHTML = '<div class="no-presets">No preset buttons created yet</div>';
        return;
    }
    
    config.presetButtons.forEach(button => {
        const buttonElement = document.createElement('div');
        buttonElement.className = 'preset-button-item';
        
        // Build details text
        const details = [];
        if (button.namePrefix) details.push(`Name: "${button.namePrefix}" + text`);
        if (button.nameSuffix) details.push(`Name: text + "${button.nameSuffix}"`);
        if (button.tickerPrefix) details.push(`Ticker: "${button.tickerPrefix}" + text`);
        if (button.tickerSuffix) details.push(`Ticker: text + "${button.tickerSuffix}"`);
        
        const tickerOptionText = {
            'original': 'Use current ticker field',
            'firstWord': 'First word from name',
            'abbreviation': 'Abbreviation (first letters)'
        };
        details.push(`Ticker Mode: ${tickerOptionText[button.tickerOption] || 'Use current ticker field'}`);
        
        buttonElement.innerHTML = `
            <div class="preset-button-info">
                <span class="preset-name">${button.name}</span>
                <div class="preset-button-details">
                    ${details.map(detail => `<div>${detail}</div>`).join('')}
                </div>
            </div>
            <div class="preset-button-actions">
                <button class="edit-btn">Edit</button>
                <button class="remove-btn">Remove</button>
            </div>
        `;
        
        // Add event listeners using proper DOM methods
        const editBtn = buttonElement.querySelector('.edit-btn');
        const removeBtn = buttonElement.querySelector('.remove-btn');
        
        editBtn.addEventListener('click', () => editPresetButton(button.id));
        removeBtn.addEventListener('click', () => removePresetButton(button.id));
        
        elements.presetButtonsList.appendChild(buttonElement);
    });
}

function renderDeployPresetButtons() {
    if (!elements.deployPresetButtons) return;
    
    elements.deployPresetButtons.innerHTML = '';
    
    if (!config.presetButtons || config.presetButtons.length === 0) {
        elements.deployPresetButtons.style.display = 'none';
        return;
    }
    
    elements.deployPresetButtons.style.display = 'flex';
    
    config.presetButtons.forEach(button => {
        const btnElement = document.createElement('button');
        btnElement.className = 'deploy-preset-btn';
        btnElement.textContent = button.name;
        btnElement.addEventListener('click', () => applyPresetButton(button));
        
        elements.deployPresetButtons.appendChild(btnElement);
    });
}

function applyPresetButton(button) {
    addLog('info', `🎯 Applied preset: ${button.name}`);
    
    const currentName = elements.tokenName.value.trim();
    const currentTicker = elements.tokenSymbol.value.trim();
    
    // Apply name transformations
    let newName = currentName;
    if (button.namePrefix) {
        // Only add prefix if it's not already there exactly
        if (!newName.toLowerCase().startsWith(button.namePrefix.toLowerCase())) {
            newName = button.namePrefix + newName; // NO automatic space
        }
    }
    if (button.nameSuffix) {
        // Only add suffix if it's not already there exactly
        if (!newName.toLowerCase().endsWith(button.nameSuffix.toLowerCase())) {
            newName = newName + button.nameSuffix; // NO automatic space
        }
    }
    
    // Apply ticker transformations based on ticker option
    let newTicker = '';
    
    if (button.tickerOption === 'firstWord') {
        // Use first word from the final name
        const firstWord = newName.split(' ')[0] || '';
        newTicker = firstWord.toUpperCase();
    } else if (button.tickerOption === 'abbreviation') {
        // Use first letters of each word from final name
        newTicker = newName.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase();
                    } else {
        // Use current ticker field
        newTicker = currentTicker;
    }
    
    // Apply ticker prefix/suffix
    if (button.tickerPrefix) {
        // Only add prefix if it's not already there exactly
        const upperPrefix = button.tickerPrefix.toUpperCase();
        if (!newTicker.toUpperCase().startsWith(upperPrefix)) {
            newTicker = upperPrefix + newTicker;
        }
    }
    if (button.tickerSuffix) {
        // Only add suffix if it's not already there exactly
        const upperSuffix = button.tickerSuffix.toUpperCase();
        if (!newTicker.toUpperCase().endsWith(upperSuffix)) {
            newTicker = newTicker + upperSuffix;
        }
    }
    
    // Update form fields
    elements.tokenName.value = newName;
    elements.tokenSymbol.value = newTicker.replace(/\s/g, ''); // Remove spaces from ticker [[memory:7555804]]
    
    addLog('info', `📝 Name: "${newName}" | Ticker: "${newTicker}"`);
}

// HTTP API for external field setting
function initializeHttpApi() {
    // Electron ipcRenderer removed for web - using fetch API instead
    
    // Listen for field updates from main process
    ipcRenderer.on('set-gui-fields', (event, data) => {
        console.log('🌐 HTTP API: Received field update request:', data);
        
        // Clear all fields first, then set only the provided ones
        elements.tokenName.value = data.name !== undefined ? data.name : '';
        
        elements.tokenSymbol.value = data.ticker !== undefined ? data.ticker : '';
        elements.twitter.value = data.twitter !== undefined ? data.twitter : '';
        elements.website.value = data.website !== undefined ? data.website : '';
        
        console.log(`🌐 HTTP API: Set name to "${elements.tokenName.value}"`);
        console.log(`🌐 HTTP API: Set ticker to "${elements.tokenSymbol.value}"`);
        console.log(`🌐 HTTP API: Set twitter to "${elements.twitter.value}"`);
        console.log(`🌐 HTTP API: Set website to "${elements.website.value}"`);
        
        // Update activity log
        const providedFields = Object.keys(data).join(', ');
        updateLastActivity(`HTTP API: Updated fields (${providedFields}) - ALL FIELDS RESET`);
        
        // Auto-generate ticker if name was updated but no ticker provided
        if (data.name !== undefined && data.ticker === undefined) {
            updateTickerFromName();
        }
    });
    
    console.log('🌐 HTTP API initialized - listening for field updates');
}

// ==================== CHARACTER COUNTERS ====================

// Track when ticker was last manually changed
let lastTickerChangeTime = 0;

function initializeCharacterCounters() {
    // Add event listeners for real-time character counting AND pre-build triggering
    elements.tokenName.addEventListener('input', (event) => {
        updateNameCharCounter();
        // Trigger pre-build when name changes
        triggerPreBuild();
    });
    elements.tokenSymbol.addEventListener('input', (event) => {
        updateTickerCharCounter();
        // Trigger pre-build when ticker changes
        triggerPreBuild();
        
        // Track manual ticker changes (not from updateTickerFromName)
        if (event.isTrusted) {
            lastTickerChangeTime = Date.now();
            console.log('🎯 Ticker manually changed at:', new Date(lastTickerChangeTime).toLocaleTimeString());
        }
    });
    
    // Initialize counters
    updateNameCharCounter();
    updateTickerCharCounter();
}

function updateNameCharCounter() {
    const current = elements.tokenName.value.length;
    const max = elements.tokenName.maxLength || 32;
    
    elements.nameCharCounter.textContent = `${current}/${max}`;
    
    // Update color based on usage
    elements.nameCharCounter.className = 'char-counter';
    if (current >= max * 0.9) {
        elements.nameCharCounter.classList.add('danger');
    } else if (current >= max * 0.75) {
        elements.nameCharCounter.classList.add('warning');
    }
}

function updateTickerCharCounter() {
    const current = elements.tokenSymbol.value.length;
    const max = elements.tokenSymbol.maxLength || 10;
    
    elements.tickerCharCounter.textContent = `${current}/${max}`;
    
    // Update color based on usage
    elements.tickerCharCounter.className = 'char-counter';
    if (current >= max * 0.9) {
        elements.tickerCharCounter.classList.add('danger');
    } else if (current >= max * 0.75) {
        elements.tickerCharCounter.classList.add('warning');
    }
}

function clearAllFields() {
    // Clear main form fields
    elements.tokenName.value = '';
    elements.tokenSymbol.value = '';
    elements.twitter.value = '';
    elements.website.value = '';
    elements.bagsFeeClaimer.value = '';
    
    // Update character counters
    updateNameCharCounter();
    updateTickerCharCounter();
    
    // Show confirmation toast
    showToast('All fields cleared', 'success');
}


// ==================== IMAGE EDITOR FUNCTIONALITY ====================

let imageEditor = {
    canvas: null,
    ctx: null,
    baseImage: null,
    overlays: [],
    currentOverlay: null,
    isDragging: false,
    isRotating: false,
    isResizing: false,
    resizeHandle: null, // 'top', 'bottom', 'left', 'right'
    dragOffset: { x: 0, y: 0 },
    hoveredOverlay: null,
    rotationHandleSize: 12,
    resizeHandleSize: 8,
    hueShift: 0 // Hue shift in degrees (-180 to 180)
};

function openImageEditor() {
    // Check if we have a current image to edit - use the Deploy section preview
    const deployPreview = document.getElementById('imagePreviewDeploy');
    const currentImagePath = deployPreview.querySelector('img')?.src;
    
    if (!currentImagePath || currentImagePath.includes('placeholder')) {
        showToast('Error', 'No image to edit. The preview shows no image currently.', 'error');
        return;
    }
    
    // Initialize canvas
    imageEditor.canvas = elements.imageEditorCanvas;
    imageEditor.ctx = imageEditor.canvas.getContext('2d');
    
    // Reset hue shift
    imageEditor.hueShift = 0;
    elements.hueShift.value = 0;
    elements.hueValue.textContent = '0°';
    
    // Load the current image
    loadBaseImage(currentImagePath);
    
    // Show modal
    elements.imageEditorModal.style.display = 'flex';
    
    // Initialize event listeners
    initializeImageEditorEvents();
    
    addLog('info', '🎨 Image editor opened');
}

function loadBaseImage(imagePath) {
    const img = new Image();
    img.onload = function() {
        // Set canvas size to match image
        imageEditor.canvas.width = img.width;
        imageEditor.canvas.height = img.height;
        
        // Store base image
        imageEditor.baseImage = img;
        
        // Clear overlays
        imageEditor.overlays = [];
        
        // Force immediate redraw
        redrawCanvas();
        
        // Double-check with animation frame
        requestAnimationFrame(() => {
            redrawCanvas();
        });
    };
    img.src = imagePath;
}

function initializeImageEditorEvents() {
    // Close modal events
    elements.closeImageEditor.addEventListener('click', closeImageEditor);
    elements.cancelImageEdit.addEventListener('click', closeImageEditor);
    
    // Apply changes
    elements.applyImageEdit.addEventListener('click', applyImageChanges);
    
    // File upload
    elements.uploadOverlayBtn.addEventListener('click', () => {
        elements.overlayFileInput.click();
    });
    
    elements.overlayFileInput.addEventListener('change', handleOverlayUpload);
    
    // Drag and drop
    const canvasContainer = elements.imageEditorCanvas.parentElement;
    canvasContainer.addEventListener('dragover', handleDragOver);
    canvasContainer.addEventListener('drop', handleDrop);
    canvasContainer.addEventListener('dragenter', showDropZone);
    canvasContainer.addEventListener('dragleave', hideDropZone);
    
    // Canvas mouse events for moving overlays
    elements.imageEditorCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    elements.imageEditorCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    elements.imageEditorCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    elements.imageEditorCanvas.addEventListener('contextmenu', handleCanvasRightClick);
    
    // Mouse move for hover detection (separate from drag move)
    elements.imageEditorCanvas.addEventListener('mousemove', handleCanvasHover);
    
    // Control sliders
    elements.overlayOpacity.addEventListener('input', updateOverlayOpacity);
    elements.hueShift.addEventListener('input', updateHueShift);
    
    // Scroll wheel scaling
    elements.imageEditorCanvas.addEventListener('wheel', handleCanvasScroll);
    
    // Rotation knob
    initializeRotationKnob();
    
    // Control buttons
    elements.resetOverlay.addEventListener('click', resetCurrentOverlay);
    elements.clearOverlays.addEventListener('click', clearAllOverlays);
    
    // Close modal when clicking outside
    elements.imageEditorModal.addEventListener('click', (e) => {
        if (e.target === elements.imageEditorModal) {
            closeImageEditor();
        }
    });
}

function handleOverlayUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Error', 'Please select an image file (PNG, JPG, etc.)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        addOverlayImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    hideDropZone();
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (!imageFile) {
        showToast('Error', 'Please drop an image file (PNG, JPG, etc.)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        addOverlayImage(e.target.result);
    };
    reader.readAsDataURL(imageFile);
}

function showDropZone() {
    elements.dropZone.classList.add('active');
}

function hideDropZone() {
    elements.dropZone.classList.remove('active');
}

function addOverlayImage(imageSrc) {
    const img = new Image();
    img.onload = function() {
        // Smart auto-scaling based on base image size
        const baseWidth = imageEditor.canvas.width;
        const baseHeight = imageEditor.canvas.height;
        const overlayWidth = img.width;
        const overlayHeight = img.height;
        
        // Calculate ideal scale to make overlay 1/4 the size of base image
        const targetSize = Math.min(baseWidth, baseHeight) / 4;
        const overlaySize = Math.max(overlayWidth, overlayHeight);
        
        // Default scale - aim for 1/4 of base image size
        let defaultScale = targetSize / overlaySize;
        
        // Handle edge cases
        if (overlaySize < 50) {
            // Very small images (< 50px) - scale up significantly
            defaultScale = Math.max(defaultScale, 2.0);
            addLog('info', '🔍 Very small overlay detected - scaling up');
        } else if (overlaySize > baseWidth || overlaySize > baseHeight) {
            // Overlay larger than base - scale down to fit nicely
            defaultScale = Math.min(defaultScale, 0.3);
            addLog('info', '📏 Large overlay detected - scaling down');
        } else if (overlaySize < baseWidth / 8) {
            // Small overlay compared to base - scale up to be more visible
            defaultScale = Math.max(defaultScale, 1.0);
            addLog('info', '🔎 Small overlay detected - scaling up for visibility');
        }
        
        // Ensure scale is within reasonable bounds
        defaultScale = Math.max(0.1, Math.min(defaultScale, 3.0));
        
        const scaledWidth = overlayWidth * defaultScale;
        const scaledHeight = overlayHeight * defaultScale;
        
        const overlay = {
            id: Date.now(),
            image: img,
            x: imageEditor.canvas.width / 2 - scaledWidth / 2, // Center horizontally
            y: imageEditor.canvas.height / 2 - scaledHeight / 2, // Center vertically
            width: scaledWidth,
            height: scaledHeight,
            opacity: 1.0,
            scale: defaultScale,
            widthScale: defaultScale,
            heightScale: defaultScale,
            rotation: 0, // Rotation in degrees
            originalWidth: img.width,
            originalHeight: img.height
        };
        
        imageEditor.overlays.push(overlay);
        imageEditor.currentOverlay = overlay;
        
        // Update controls to reflect the smart scaling
        elements.overlayOpacity.value = 100;
        elements.opacityValue.textContent = '100%';
        elements.hueShift.value = 0;
        elements.hueValue.textContent = '0°';
        
        const scalePercent = Math.round(defaultScale * 100);
        elements.overlaySize.value = scalePercent;
        elements.sizeValue.textContent = scalePercent + '%';
        
        // Force immediate redraw
        redrawCanvas();
        
        // Force canvas update by requesting animation frame
        requestAnimationFrame(() => {
            redrawCanvas();
        });
        
        addLog('info', `🖼️ Overlay added: ${overlayWidth}x${overlayHeight}px → ${Math.round(scaledWidth)}x${Math.round(scaledHeight)}px (${scalePercent}%)`);
        
        // Show helpful message for extreme scaling
        if (defaultScale >= 2.0) {
            showToast('Info', `Tiny overlay scaled up to ${scalePercent}% for visibility`, 'info');
        } else if (defaultScale <= 0.3) {
            showToast('Info', `Large overlay scaled down to ${scalePercent}% to fit`, 'info');
        }
    };
    img.src = imageSrc;
}

function handleCanvasMouseDown(e) {
    const rect = imageEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check for rotation handle clicks first
    for (let i = imageEditor.overlays.length - 1; i >= 0; i--) {
        const overlay = imageEditor.overlays[i];
        const rotationHandles = getRotationHandles(overlay);
        
        for (const handle of rotationHandles) {
            const distance = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
            if (distance <= imageEditor.rotationHandleSize) {
                imageEditor.currentOverlay = overlay;
                imageEditor.isRotating = true;
                imageEditor.canvas.style.cursor = 'crosshair';
                updateOverlayControls(overlay);
                return; // Exit early for rotation
            }
        }
        
        // Check for resize handle clicks
        const resizeHandles = getResizeHandles(overlay);
        for (const handle of resizeHandles) {
            const distance = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
            if (distance <= imageEditor.resizeHandleSize) {
                imageEditor.currentOverlay = overlay;
                imageEditor.isResizing = true;
                imageEditor.resizeHandle = handle.type;
                imageEditor.canvas.style.cursor = getResizeCursor(handle.type);
                updateOverlayControls(overlay);
                return; // Exit early for resize
            }
        }
    }
    
    // Find overlay at this position (check from top to bottom)
    let overlayFound = false;
    for (let i = imageEditor.overlays.length - 1; i >= 0; i--) {
        const overlay = imageEditor.overlays[i];
        
        // More flexible hit detection - use a larger hit area and handle edge cases
        const hitMargin = 5; // 5px margin for easier clicking
        const minX = Math.min(overlay.x - hitMargin, overlay.x);
        const maxX = Math.max(overlay.x + overlay.width + hitMargin, overlay.x + Math.abs(overlay.width));
        const minY = Math.min(overlay.y - hitMargin, overlay.y);
        const maxY = Math.max(overlay.y + overlay.height + hitMargin, overlay.y + Math.abs(overlay.height));
        
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            imageEditor.currentOverlay = overlay;
            imageEditor.isDragging = true;
            imageEditor.dragOffset = {
                x: x - overlay.x,
                y: y - overlay.y
            };
            
            updateOverlayControls(overlay);
            
            imageEditor.canvas.style.cursor = 'grabbing';
            overlayFound = true;
            break;
        }
    }
    
    // If no overlay was found but we have overlays, select the most recent one for dragging
    if (!overlayFound && imageEditor.overlays.length > 0) {
        const lastOverlay = imageEditor.overlays[imageEditor.overlays.length - 1];
        imageEditor.currentOverlay = lastOverlay;
        imageEditor.isDragging = true;
        imageEditor.dragOffset = {
            x: x - lastOverlay.x,
            y: y - lastOverlay.y
        };
        
        updateOverlayControls(lastOverlay);
        
        imageEditor.canvas.style.cursor = 'grabbing';
        
        addLog('info', '🎯 Auto-selected most recent overlay for dragging');
    }
}

function handleCanvasMouseMove(e) {
    const rect = imageEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (imageEditor.isRotating && imageEditor.currentOverlay) {
        // Handle rotation - rotate around center without moving position
        const overlay = imageEditor.currentOverlay;
        const centerX = overlay.x + overlay.width / 2;
        const centerY = overlay.y + overlay.height / 2;
        
        // Calculate angle from center to mouse
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        overlay.rotation = angle;
        
        redrawCanvas();
    } else if (imageEditor.isResizing && imageEditor.currentOverlay) {
        // Handle resizing
        const overlay = imageEditor.currentOverlay;
        const handleType = imageEditor.resizeHandle;
        
        switch (handleType) {
            case 'top':
                const newHeight = overlay.height + (overlay.y - y);
                if (newHeight > 10) {
                    overlay.y = y;
                    overlay.height = newHeight;
                }
                break;
            case 'bottom':
                const bottomNewHeight = y - overlay.y;
                if (bottomNewHeight > 10) {
                    overlay.height = bottomNewHeight;
                }
                break;
            case 'left':
                const newWidth = overlay.width + (overlay.x - x);
                if (newWidth > 10) {
                    overlay.x = x;
                    overlay.width = newWidth;
                }
                break;
            case 'right':
                const rightNewWidth = x - overlay.x;
                if (rightNewWidth > 10) {
                    overlay.width = rightNewWidth;
                }
                break;
        }
        
        redrawCanvas();
    } else if (imageEditor.isDragging && imageEditor.currentOverlay) {
        // Handle dragging
        const newX = x - imageEditor.dragOffset.x;
        const newY = y - imageEditor.dragOffset.y;
        
        imageEditor.currentOverlay.x = newX;
        imageEditor.currentOverlay.y = newY;
        
        redrawCanvas();
    }
}

function handleCanvasMouseUp() {
    imageEditor.isDragging = false;
    imageEditor.isRotating = false;
    imageEditor.isResizing = false;
    imageEditor.resizeHandle = null;
    imageEditor.canvas.style.cursor = 'default';
}

function handleCanvasRightClick(e) {
    e.preventDefault(); // Prevent context menu
    
    // Force-select the most recent overlay for dragging if we have any
    if (imageEditor.overlays.length > 0) {
        const lastOverlay = imageEditor.overlays[imageEditor.overlays.length - 1];
        imageEditor.currentOverlay = lastOverlay;
        
        // Update controls for this overlay
        elements.overlayOpacity.value = Math.round(lastOverlay.opacity * 100);
        elements.opacityValue.textContent = Math.round(lastOverlay.opacity * 100) + '%';
        elements.sizeValue.textContent = Math.round(lastOverlay.scale * 100) + '%';
        
        addLog('info', '🖱️ Right-click: Force-selected overlay for editing');
        showToast('Info', 'Overlay selected! Now you can drag it or use sliders.', 'info');
    } else {
        showToast('Info', 'No overlays to select. Add an overlay first.', 'info');
    }
}

function handleCanvasScroll(e) {
    e.preventDefault(); // Prevent page scrolling
    
    const rect = imageEditor.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Find overlay under mouse cursor
    let targetOverlay = null;
    for (let i = imageEditor.overlays.length - 1; i >= 0; i--) {
        const overlay = imageEditor.overlays[i];
        
        // Check if mouse is over this overlay
        if (mouseX >= overlay.x && mouseX <= overlay.x + overlay.width &&
            mouseY >= overlay.y && mouseY <= overlay.y + overlay.height) {
            targetOverlay = overlay;
            break;
        }
    }
    
    // If no overlay under cursor, use current selected overlay
    if (!targetOverlay && imageEditor.currentOverlay) {
        targetOverlay = imageEditor.currentOverlay;
    }
    
    // If still no overlay, use the most recent one
    if (!targetOverlay && imageEditor.overlays.length > 0) {
        targetOverlay = imageEditor.overlays[imageEditor.overlays.length - 1];
    }
    
    if (!targetOverlay) return;
    
    // Set as current overlay
    imageEditor.currentOverlay = targetOverlay;
    
    // Calculate scale change
    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1; // Scroll down = smaller, scroll up = bigger
    const newScale = Math.max(0.05, Math.min(targetOverlay.scale * scaleChange, 10.0)); // Limit between 5% and 1000%
    
    // Update overlay properties
    targetOverlay.scale = newScale;
    targetOverlay.widthScale = newScale;
    targetOverlay.heightScale = newScale;
    targetOverlay.width = targetOverlay.originalWidth * newScale;
    targetOverlay.height = targetOverlay.originalHeight * newScale;
    
    // Update controls to reflect the change
    elements.sizeValue.textContent = Math.round(newScale * 100) + '%';
    elements.overlayOpacity.value = Math.round(targetOverlay.opacity * 100);
    elements.opacityValue.textContent = Math.round(targetOverlay.opacity * 100) + '%';
    
    // Redraw canvas
    redrawCanvas();
}

function updateOverlayOpacity() {
    if (!imageEditor.currentOverlay) return;
    
    const opacity = parseInt(elements.overlayOpacity.value) / 100;
    imageEditor.currentOverlay.opacity = opacity;
    elements.opacityValue.textContent = elements.overlayOpacity.value + '%';
    
    redrawCanvas();
}

function updateHueShift() {
    const hueValue = parseInt(elements.hueShift.value);
    imageEditor.hueShift = hueValue;
    elements.hueValue.textContent = hueValue + '°';
    
    redrawCanvas();
}



// Rotation knob functionality
let rotationKnobState = {
    isDragging: false,
    startAngle: 0,
    currentAngle: 0
};

function initializeRotationKnob() {
    const knob = elements.rotationKnob;
    
    knob.addEventListener('mousedown', startRotationDrag);
    document.addEventListener('mousemove', handleRotationDrag);
    document.addEventListener('mouseup', endRotationDrag);
}

function startRotationDrag(e) {
    if (!imageEditor.currentOverlay) {
        showToast('Info', 'No overlay selected', 'info');
        return;
    }
    
    rotationKnobState.isDragging = true;
    elements.rotationKnob.classList.add('dragging');
    
    const rect = elements.rotationKnob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotationKnobState.startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    
    e.preventDefault();
}

function handleRotationDrag(e) {
    if (!rotationKnobState.isDragging || !imageEditor.currentOverlay) return;
    
    const rect = elements.rotationKnob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate current angle from center of knob
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    
    // Convert to degrees and normalize to 0-360
    let degrees = (currentAngle * 180 / Math.PI) + 90; // Add 90 to align with handle at top
    if (degrees < 0) degrees += 360;
    if (degrees >= 360) degrees -= 360;
    
    // Convert back to radians for overlay rotation
    const radians = degrees * Math.PI / 180;
    
    // Update overlay rotation directly
    const overlay = imageEditor.currentOverlay;
    overlay.rotation = radians;
    
    // Update knob visual rotation
    const handle = elements.rotationKnob.querySelector('.rotation-handle');
    handle.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
    
    // Update rotation value display
    elements.rotationValue.textContent = Math.round(degrees) + '°';
    
    // Redraw canvas
    redrawCanvas();
}

function endRotationDrag() {
    if (rotationKnobState.isDragging) {
        rotationKnobState.isDragging = false;
        elements.rotationKnob.classList.remove('dragging');
    }
}

function updateRotationKnobDisplay() {
    if (!imageEditor.currentOverlay) {
        elements.rotationValue.textContent = '0°';
        const handle = elements.rotationKnob.querySelector('.rotation-handle');
        handle.style.transform = 'translateX(-50%) rotate(0deg)';
        return;
    }
    
    const overlay = imageEditor.currentOverlay;
    let degrees = (overlay.rotation * 180 / Math.PI);
    
    // Normalize to 0-360 range
    while (degrees < 0) degrees += 360;
    while (degrees >= 360) degrees -= 360;
    
    elements.rotationValue.textContent = Math.round(degrees) + '°';
    
    const handle = elements.rotationKnob.querySelector('.rotation-handle');
    handle.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
}

function resetCurrentOverlay() {
    if (!imageEditor.currentOverlay) {
        showToast('Info', 'No overlay selected', 'info');
        return;
    }
    
    const overlay = imageEditor.currentOverlay;
    overlay.x = imageEditor.canvas.width / 2 - overlay.originalWidth / 4;
    overlay.y = imageEditor.canvas.height / 2 - overlay.originalHeight / 4;
    overlay.width = overlay.originalWidth / 2;
    overlay.height = overlay.originalHeight / 2;
    overlay.opacity = 1.0;
    overlay.scale = 0.5;
    overlay.widthScale = 0.5;
    overlay.heightScale = 0.5;
    overlay.rotation = 0;
    
    // Update controls
    elements.overlayOpacity.value = 100;
    elements.opacityValue.textContent = '100%';
    elements.sizeValue.textContent = '50%';
    updateRotationKnobDisplay();
    
    redrawCanvas();
    
    addLog('info', '🔄 Overlay reset to default position and size');
}

function clearAllOverlays() {
    imageEditor.overlays = [];
    imageEditor.currentOverlay = null;
    
    // Reset controls
    elements.overlayOpacity.value = 100;
    elements.opacityValue.textContent = '100%';
    elements.hueShift.value = 0;
    elements.hueValue.textContent = '0°';
    imageEditor.hueShift = 0;
    elements.sizeValue.textContent = '100%';
    
    redrawCanvas();
    
    addLog('info', '🗑️ All overlays cleared');
}

function redrawCanvas() {
    if (!imageEditor.ctx || !imageEditor.baseImage) return;
    
    // Clear canvas
    imageEditor.ctx.clearRect(0, 0, imageEditor.canvas.width, imageEditor.canvas.height);
    
    // Draw base image with hue shift if needed
    if (imageEditor.hueShift !== 0) {
        // Apply hue shift using CSS filter
        imageEditor.ctx.save();
        imageEditor.ctx.filter = `hue-rotate(${imageEditor.hueShift}deg)`;
        imageEditor.ctx.drawImage(imageEditor.baseImage, 0, 0);
        imageEditor.ctx.restore();
    } else {
        // Draw base image normally
        imageEditor.ctx.drawImage(imageEditor.baseImage, 0, 0);
    }
    
    // Draw overlays
    imageEditor.overlays.forEach(overlay => {
        imageEditor.ctx.save();
        imageEditor.ctx.globalAlpha = overlay.opacity;
        
        // Apply rotation if needed
        if (overlay.rotation !== 0) {
            const centerX = overlay.x + overlay.width / 2;
            const centerY = overlay.y + overlay.height / 2;
            
            imageEditor.ctx.translate(centerX, centerY);
            imageEditor.ctx.rotate(overlay.rotation);
            imageEditor.ctx.translate(-centerX, -centerY);
        }
        
        imageEditor.ctx.drawImage(
            overlay.image,
            overlay.x,
            overlay.y,
            overlay.width,
            overlay.height
        );
        imageEditor.ctx.restore();
    });
    
    // Draw handles for hovered overlay or currently active overlay
    const overlayToShowHandles = imageEditor.hoveredOverlay || imageEditor.currentOverlay;
    if (overlayToShowHandles) {
        drawRotationHandles(overlayToShowHandles);
        drawResizeHandles(overlayToShowHandles);
    }
}

function drawRotationHandles(overlay) {
    const handles = getRotationHandles(overlay);
    const ctx = imageEditor.ctx;
    
    ctx.save();
    
    handles.forEach(handle => {
        // Draw rotation handle circle - EXACT SAME SIZE as click detection
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, imageEditor.rotationHandleSize, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 107, 53, 0.9)'; // Orange for rotation
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw rotation icon (curved arrow) - bigger and clearer
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 7, 0, Math.PI * 1.5);
        ctx.stroke();
        
        // Draw arrow head - bigger
        ctx.beginPath();
        ctx.moveTo(handle.x - 5, handle.y - 7);
        ctx.lineTo(handle.x - 1, handle.y - 9);
        ctx.lineTo(handle.x - 1, handle.y - 5);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    });
    
    ctx.restore();
}

function drawResizeHandles(overlay) {
    const handles = getResizeHandles(overlay);
    const ctx = imageEditor.ctx;
    
    ctx.save();
    
    handles.forEach(handle => {
        // Draw resize handle square - EXACT SAME SIZE as click detection
        ctx.beginPath();
        ctx.rect(
            handle.x - imageEditor.resizeHandleSize, 
            handle.y - imageEditor.resizeHandleSize, 
            imageEditor.resizeHandleSize * 2, 
            imageEditor.resizeHandleSize * 2
        );
        ctx.fillStyle = 'rgba(139, 92, 246, 0.9)'; // Purple for resize
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw resize icon (arrows) - bigger and clearer
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        if (handle.type === 'top' || handle.type === 'bottom') {
            // Vertical arrows
            ctx.beginPath();
            ctx.moveTo(handle.x, handle.y - 5);
            ctx.lineTo(handle.x, handle.y + 5);
            ctx.moveTo(handle.x - 2, handle.y - 3);
            ctx.lineTo(handle.x, handle.y - 5);
            ctx.lineTo(handle.x + 2, handle.y - 3);
            ctx.moveTo(handle.x - 2, handle.y + 3);
            ctx.lineTo(handle.x, handle.y + 5);
            ctx.lineTo(handle.x + 2, handle.y + 3);
            ctx.stroke();
        } else {
            // Horizontal arrows
            ctx.beginPath();
            ctx.moveTo(handle.x - 5, handle.y);
            ctx.lineTo(handle.x + 5, handle.y);
            ctx.moveTo(handle.x - 3, handle.y - 2);
            ctx.lineTo(handle.x - 5, handle.y);
            ctx.lineTo(handle.x - 3, handle.y + 2);
            ctx.moveTo(handle.x + 3, handle.y - 2);
            ctx.lineTo(handle.x + 5, handle.y);
            ctx.lineTo(handle.x + 3, handle.y + 2);
            ctx.stroke();
        }
    });
    
    ctx.restore();
}

function applyImageChanges() {
    if (!imageEditor.canvas) return;
    
    // Temporarily hide rotation handles for clean save
    const originalHoveredOverlay = imageEditor.hoveredOverlay;
    imageEditor.hoveredOverlay = null;
    
    // Redraw canvas without handles
    redrawCanvas();
    
    // Convert canvas to data URL (clean image without handles)
    const dataURL = imageEditor.canvas.toDataURL('image/png');
    
    // Restore hover state for continued editing
    imageEditor.hoveredOverlay = originalHoveredOverlay;
    redrawCanvas(); // Redraw with handles if needed
    
    // Save the edited image to the same folder as the original
    saveEditedImageToFolder(dataURL);
    
    // Update both image previews (Deploy and Settings)
    const deployPreview = document.getElementById('imagePreviewDeploy');
    const settingsPreview = elements.imagePreview;
    
    // Update Deploy section preview
    let deployImg = deployPreview.querySelector('img');
    if (!deployImg) {
        deployImg = document.createElement('img');
        deployPreview.innerHTML = '';
        deployPreview.appendChild(deployImg);
    }
    deployImg.src = dataURL;
    
    // Update Settings section preview
    if (settingsPreview) {
        let settingsImg = settingsPreview.querySelector('img');
        if (!settingsImg) {
            settingsImg = document.createElement('img');
            settingsPreview.innerHTML = '';
            settingsPreview.appendChild(settingsImg);
        }
        settingsImg.src = dataURL;
    }
    
    // Close editor
    closeImageEditor();
    
    addLog('success', '✅ Image changes applied and saved to folder');
    showToast('Success', 'Image saved with overlays to image folder!', 'success');
}

function saveEditedImageToFolder(dataURL) {
    try {
        // Electron ipcRenderer removed for web - using fetch API instead
        
        // Get the current image folder from config
        const imageFolder = config.imageFolder || '';
        if (!imageFolder) {
            showToast('Error', 'No image folder set. Please set image folder in Settings.', 'error');
            return;
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `edited_image_${timestamp}.png`;
        
        // Convert data URL to buffer
        const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
        
        // Send to main process to save file
        saveEditedImageWeb(, {
            imageFolder: imageFolder,
            filename: filename,
            base64Data: base64Data
        }).then((result) => {
            if (result.success) {
                addLog('success', `💾 Edited image saved: ${filename}`);
                showToast('Success', `Saved as: ${filename}`, 'success');
            } else {
                addLog('error', `❌ Failed to save image: ${result.error}`);
                showToast('Error', `Failed to save: ${result.error}`, 'error');
            }
        }).catch((error) => {
            addLog('error', `❌ Error saving image: ${error.message}`);
            showToast('Error', `Save error: ${error.message}`, 'error');
        });
        
    } catch (error) {
        addLog('error', `❌ Error in saveEditedImageToFolder: ${error.message}`);
        showToast('Error', `Save error: ${error.message}`, 'error');
    }
}

function closeImageEditor() {
    elements.imageEditorModal.style.display = 'none';
    
    // Clean up
    imageEditor.overlays = [];
    imageEditor.currentOverlay = null;
    imageEditor.isDragging = false;
    imageEditor.isRotating = false;
    imageEditor.hoveredOverlay = null;
    
    addLog('info', '🎨 Image editor closed');
}

// Helper function to update overlay controls
function updateOverlayControls(overlay) {
    elements.overlayOpacity.value = Math.round(overlay.opacity * 100);
    elements.opacityValue.textContent = Math.round(overlay.opacity * 100) + '%';
    elements.sizeValue.textContent = Math.round(overlay.scale * 100) + '%';
    updateRotationKnobDisplay();
}

// Helper function to get rotation handle position (single handle at top-right)
function getRotationHandles(overlay) {
    // DISABLED: Return empty array to remove rotation handles
    return [];
}

// Helper function to get resize handle positions (on sides/top/bottom)
function getResizeHandles(overlay) {
    // DISABLED: Return empty array to remove resize handles
    return [];
}

// Helper function to get appropriate cursor for resize handle
function getResizeCursor(handleType) {
    switch (handleType) {
        case 'top':
        case 'bottom':
            return 'ns-resize';
        case 'left':
        case 'right':
            return 'ew-resize';
        default:
            return 'default';
    }
}

// Handle hover detection for rotation and resize handles
function handleCanvasHover(e) {
    if (imageEditor.isDragging || imageEditor.isRotating || imageEditor.isResizing) return;
    
    const rect = imageEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let foundHoveredOverlay = null;
    let overRotationHandle = false;
    let overResizeHandle = false;
    let resizeHandleType = null;
    
    // Check all overlays for handle proximity first (even if not over the overlay itself)
    for (let i = imageEditor.overlays.length - 1; i >= 0; i--) {
        const overlay = imageEditor.overlays[i];
        
        // Check if over rotation handle (anywhere on canvas)
        const rotationHandles = getRotationHandles(overlay);
        for (const handle of rotationHandles) {
            const distance = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
            if (distance <= imageEditor.rotationHandleSize) {
                foundHoveredOverlay = overlay;
                overRotationHandle = true;
                break;
            }
        }
        
        // Check if over resize handle (anywhere on canvas)
        if (!overRotationHandle) {
            const resizeHandles = getResizeHandles(overlay);
            for (const handle of resizeHandles) {
                const distance = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
                if (distance <= imageEditor.resizeHandleSize) {
                    foundHoveredOverlay = overlay;
                    overResizeHandle = true;
                    resizeHandleType = handle.type;
                    break;
                }
            }
        }
        
        // If we found a handle, we're done
        if (foundHoveredOverlay) break;
    }
    
    // If no handles found, check if hovering over overlay body
    if (!foundHoveredOverlay) {
        for (let i = imageEditor.overlays.length - 1; i >= 0; i--) {
            const overlay = imageEditor.overlays[i];
            
            if (x >= overlay.x && x <= overlay.x + overlay.width &&
                y >= overlay.y && y <= overlay.y + overlay.height) {
                foundHoveredOverlay = overlay;
                break;
            }
        }
    }
    
    // Update hovered overlay and cursor
    if (foundHoveredOverlay !== imageEditor.hoveredOverlay) {
        imageEditor.hoveredOverlay = foundHoveredOverlay;
        redrawCanvas(); // Redraw to show/hide handles
    }
    
    // Update cursor
    if (overRotationHandle) {
        imageEditor.canvas.style.cursor = 'crosshair';
    } else if (overResizeHandle) {
        imageEditor.canvas.style.cursor = getResizeCursor(resizeHandleType);
    } else if (foundHoveredOverlay) {
        imageEditor.canvas.style.cursor = 'move';
    } else {
        imageEditor.canvas.style.cursor = 'default';
    }
}

// Get current selected platform
function getCurrentPlatform() {
    const activeIndicator = document.querySelector('.platform-indicator.active');
    return activeIndicator ? activeIndicator.dataset.platform : 'bonk';
}

// =====================================================
// NOTIFICATION SOUND PLAYER (fallback for renderer.js)
// =====================================================
function playNotificationSound(soundType) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Unlock audio context if suspended
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.5; // 50% volume
        gainNode.connect(audioCtx.destination);
        
        const osc = audioCtx.createOscillator();
        const now = audioCtx.currentTime;
        
        switch(soundType) {
            case 'beep':
                osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.15);
                break;
            case 'ding':
                osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.3);
                break;
            case 'chime':
                osc.type = 'sine'; osc.frequency.setValueAtTime(1000, now);
                osc.frequency.setValueAtTime(1200, now + 0.1);
                osc.frequency.setValueAtTime(1500, now + 0.2);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.35);
                break;
            case 'coin':
                osc.type = 'square'; osc.frequency.setValueAtTime(988, now);
                osc.frequency.setValueAtTime(1319, now + 0.08);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.2);
                break;
            case 'buzz':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.2);
                break;
            case 'harsh-buzz':
                osc.type = 'square'; osc.frequency.setValueAtTime(100, now);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.3);
                break;
            case 'electric-shock':
                osc.type = 'sawtooth';
                for(let i = 0; i < 5; i++) {
                    osc.frequency.setValueAtTime(2000 + Math.random()*1000, now + i*0.05);
                }
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.25);
                break;
            case 'destroyer':
                osc.type = 'square'; osc.frequency.setValueAtTime(60, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.5);
                break;
            default:
                // Default beep
                osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
                osc.connect(gainNode); osc.start(now); osc.stop(now + 0.15);
        }
        
        console.log('[SOUND] Playing:', soundType);
    } catch (error) {
        console.error('[SOUND] Failed to play:', error);
    }
}

// ==================== TWEET PASTE FUNCTIONALITY ====================

function initializeTweetPaste() {
    const siteChatInput = document.querySelector('.site-chat');
    if (!siteChatInput) {
        console.log('[TWEET] Site chat input not found');
        return;
    }
    
    console.log('[TWEET] Tweet paste handler initialized');
    
    // Add click handlers to existing/placeholder tweet DEPLOY buttons
    initializeExistingTweetDeployButtons();
    
    // Handle paste events
    siteChatInput.addEventListener('paste', async (e) => {
        // Get pasted text - handle both clipboard data and setTimeout fallback
        setTimeout(() => {
            const pastedText = siteChatInput.value.trim();
            
            // Check if it's a Twitter/X URL
            const twitterRegex = /https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
            const match = pastedText.match(twitterRegex);
            
            if (match) {
                const username = match[2];
                const tweetId = match[3];
                
                console.log('[TWEET] Detected tweet from @' + username + ', ID: ' + tweetId);
                addLog('info', `🐦 Tweet detected: @${username} (${tweetId})`);
                
                // Clear the input
                siteChatInput.value = '';
                
                // Show tweet preview card
                showTweetPreview(pastedText, username, tweetId);
            }
        }, 0);
    });
    
    // Also handle Enter key to submit URL
    siteChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const text = siteChatInput.value.trim();
            const twitterRegex = /https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
            const match = text.match(twitterRegex);
            
            if (match) {
                e.preventDefault();
                const username = match[2];
                const tweetId = match[3];
                
                console.log('[TWEET] Enter pressed - tweet from @' + username);
                addLog('info', `🐦 Tweet loaded: @${username}`);
                
                siteChatInput.value = '';
                showTweetPreview(text, username, tweetId);
            }
        }
    });
}

function showTweetPreview(url, username, tweetId) {
    // Create preview card with unique ID
    const cardId = `tweet-card-${Date.now()}`;
    const previewCard = document.createElement('div');
    previewCard.className = 'tweet-preview-card loading';
    previewCard.id = cardId;
    previewCard.dataset.tweetUrl = url;
    previewCard.dataset.username = username;
    previewCard.innerHTML = `
        <div class="tweet-preview-header">
            <div class="preview-author">
                <div class="author-avatar">🐦</div>
                <div class="author-info">
                    <span class="author-name">${username}</span>
                    <span class="author-handle">@${username}</span>
                </div>
            </div>
            <button class="tweet-deploy-btn" onclick="deployFromTweetCard('${cardId}')">⚡ DEPLOY</button>
        </div>
        <div class="tweet-preview-action">@${username} posted</div>
        <div class="tweet-preview-content loading">Loading tweet content...</div>
        <div class="tweet-preview-url">${url}</div>
    `;
    
    // Add to feed area
    const feedArea = document.querySelector('.twitter-feed');
    if (feedArea) {
        feedArea.insertBefore(previewCard, feedArea.firstChild);
        feedArea.scrollTop = 0;
    }
    
    // Auto-fill twitter field with URL
    if (elements.twitter) {
        elements.twitter.value = url;
    }
    
    // Fetch actual tweet content via oEmbed API
    fetchTweetData(url, tweetId, previewCard);
}

// Fetch tweet data via local server (avoids CORS)
async function fetchTweetData(tweetUrl, tweetId, card) {
    try {
        // Use VPS server to proxy the oEmbed API (avoids CORS)
        const serverUrl = `http://149.28.53.76:47291/tweet?url=${encodeURIComponent(tweetUrl)}`;
        const response = await fetch(serverUrl);
        
        if (!response.ok) throw new Error('Server request failed');
        
        const data = await response.json();
        console.log('[TWEET] Server response:', data);
        
        // Extract text from response
        const tweetText = data.text || '';
        
        // Update the preview card
        card.classList.remove('loading');
        const contentEl = card.querySelector('.tweet-preview-content');
        if (contentEl) {
            contentEl.classList.remove('loading');
            contentEl.textContent = tweetText || 'No text content';
        }
        
        // Update author name
        const nameEl = card.querySelector('.author-name');
        if (nameEl && data.author_name) {
            nameEl.textContent = data.author_name;
        }
        
        // Store data for DEPLOY - including images!
        card.dataset.tweetText = tweetText;
        card.dataset.authorName = data.author_name || card.dataset.username;
        card.dataset.tweetUrl = tweetUrl;
        card.dataset.images = JSON.stringify(data.images || []);
        
        // Show images in tweet card preview
        if (data.images && data.images.length > 0) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'tweet-card-images';
            imgContainer.style.cssText = 'display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap;';
            
            data.images.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 4px;';
                imgContainer.appendChild(img);
            });
            
            card.appendChild(imgContainer);
            addLog('info', `🖼️ Found ${data.images.length} images in tweet`);
        }
        
        addLog('success', `✅ Tweet loaded: ${tweetText.slice(0, 50)}...`);
        showToast('Tweet Loaded', `@${card.dataset.username} - Ready to deploy!`, 'success');
        
    } catch (error) {
        console.error('[TWEET] Failed to fetch:', error);
        card.classList.remove('loading');
        const contentEl = card.querySelector('.tweet-preview-content');
        if (contentEl) {
            contentEl.classList.remove('loading');
            contentEl.textContent = `Tweet from @${card.dataset.username} - Click DEPLOY`;
        }
        addLog('warning', `⚠️ Could not fetch tweet (server not running?)`);
    }
}

// Deploy from tweet card - use stored data including images
window.deployFromTweetCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const tweetUrl = card.dataset.tweetUrl || '';
    const tweetText = card.dataset.tweetText || '';
    const authorName = card.dataset.authorName || card.dataset.username || '';
    const images = JSON.parse(card.dataset.images || '[]');
    
    console.log('[DEPLOY] From tweet:', { tweetUrl, authorName, imageCount: images.length });
    addLog('info', `⚡ Deploy from tweet: @${authorName} (${images.length} images)`);
    
    // Use fillFormFromTweet to handle everything
    fillFormFromTweet({
        url: tweetUrl,
        authorName: authorName,
        username: card.dataset.username,
        images: images
    });
};

// Deploy from tweet - auto-fill left panel
window.deployFromTweet = function(tweetUrl) {
    console.log('[DEPLOY] Auto-filling from tweet:', tweetUrl);
    addLog('info', `⚡ Deploy from tweet: ${tweetUrl}`);
    
    // Extract username from URL
    const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/(\w+)/);
    const username = match ? match[1] : 'unknown';
    
    // Fill the Twitter field
    if (elements.twitter) {
        elements.twitter.value = tweetUrl;
    }
    
    // Show notification
    showToast('Tweet Loaded', `Fill in Name and Symbol to deploy @${username}'s tweet!`, 'info');
    
    // Focus on token name field
    if (elements.tokenName) {
        elements.tokenName.focus();
    }
    
    updateLastActivity(`Tweet loaded from @${username}`);
};

// Initialize click handlers for existing/placeholder tweet DEPLOY buttons
function initializeExistingTweetDeployButtons() {
    const deployButtons = document.querySelectorAll('.tweet-card .tweet-deploy-btn');
    
    console.log(`[TWEET] Found ${deployButtons.length} existing tweet DEPLOY buttons`);
    
    deployButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = e.target.closest('.tweet-card');
            if (!card) return;
            
            // Extract data from card
            const authorName = card.querySelector('.author-name')?.textContent || '';
            const tweetText = card.querySelector('.tweet-content')?.textContent?.trim() || '';
            const authorHandle = card.querySelector('.author-handle')?.textContent?.replace('@', '') || '';
            
            console.log('[DEPLOY] Existing tweet clicked:', { authorName, tweetText: tweetText.slice(0, 50) });
            addLog('info', `⚡ Deploy from existing tweet: @${authorHandle || authorName}`);
            
            // Fill form from tweet
            fillFormFromTweet({
                authorName: authorName,
                text: tweetText,
                username: authorHandle
            });
        });
    });
}

// Fill form from tweet data - ONLY fills Twitter URL and loads images
// NAME and SYMBOL are LEFT EMPTY for user to fill
function fillFormFromTweet(tweet) {
    console.log('[DEPLOY] Filling from tweet:', tweet);
    
    // 1. ONLY put URL in TWITTER field - leave name/symbol empty
    if (elements.twitter && tweet.url) {
        elements.twitter.value = tweet.url;
    }
    
    // 2. LOAD ALL IMAGES from tweet into SELECT IMAGE area
    if (tweet.images && tweet.images.length > 0) {
        loadTweetImages(tweet.images);
    }
    
    // 3. Scroll to top of deploy panel
    const deployPanel = document.querySelector('.token-deploy-panel');
    if (deployPanel) deployPanel.scrollTop = 0;
    
    // 4. Focus name field for user to type
    if (elements.tokenName) {
        elements.tokenName.focus();
    }
    
    // 5. Show notification
    const imageCount = tweet.images ? tweet.images.length : 0;
    const imageText = imageCount > 0 ? ` (${imageCount} images loaded)` : '';
    showToast('Tweet Loaded', `Fill in Name and Symbol to deploy!${imageText}`, 'info');
    updateLastActivity(`Tweet loaded from @${tweet.username || tweet.authorName}`);
}

// Load multiple images from tweet into Select Image area
function loadTweetImages(imageUrls) {
    console.log('[IMAGES] Loading', imageUrls.length, 'images from tweet');
    
    const imageContainer = elements.imagePreviewDeploy;
    
    if (!imageContainer) {
        console.error('[IMAGES] No image container found');
        return;
    }
    
    // Clear existing images first
    imageContainer.innerHTML = '';
    
    // Create a container for tweet images
    const tweetImagesContainer = document.createElement('div');
    tweetImagesContainer.className = 'tweet-images-container';
    tweetImagesContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 5px;
    `;
    
    // Add each image as a selectable option
    imageUrls.forEach((url, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'tweet-image-option';
        imgWrapper.style.cssText = `
            display: inline-block;
            cursor: pointer;
            border: 3px solid transparent;
            border-radius: 8px;
            overflow: hidden;
            transition: border-color 0.2s ease;
        `;
        
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = `
            width: 70px;
            height: 70px;
            object-fit: cover;
        `;
        img.alt = `Tweet image ${index + 1}`;
        
        // Click to select this image
        imgWrapper.addEventListener('click', () => {
            // Deselect others
            document.querySelectorAll('.tweet-image-option').forEach(opt => {
                opt.style.borderColor = 'transparent';
            });
            
            // Select this one
            imgWrapper.style.borderColor = '#10b981';
            
            // Set as selected image
            selectTweetImage(url);
        });
        
        imgWrapper.appendChild(img);
        tweetImagesContainer.appendChild(imgWrapper);
        
        // Auto-select first image
        if (index === 0) {
            setTimeout(() => imgWrapper.click(), 100);
        }
    });
    
    imageContainer.appendChild(tweetImagesContainer);
    addLog('info', `🖼️ Loaded ${imageUrls.length} tweet images`);
}

// Add real-time tweet to feed (from J7Tracker WebSocket)
function addTweetToFeed(tweet) {
    console.log('[FEED] New tweet from J7:', tweet.author || tweet.handle);
    
    const feed = document.querySelector('.twitter-feed');
    if (!feed) {
        console.error('[FEED] Twitter feed container not found');
        return;
    }
    
    // Generate unique card ID
    const cardId = `j7-tweet-${tweet.id || Date.now()}`;
    
    // Create tweet card
    const card = document.createElement('div');
    card.className = 'tweet-card j7-tweet';
    card.id = cardId;
    card.dataset.tweetId = tweet.id;
    card.dataset.tweetUrl = tweet.url;
    card.dataset.images = JSON.stringify(tweet.images || []);
    card.dataset.authorName = tweet.author;
    card.dataset.username = tweet.handle;
    
    // Format timestamp
    const timeStr = new Date(tweet.timestamp).toLocaleTimeString();
    
    // Build images HTML if available
    let imagesHtml = '';
    if (tweet.images && tweet.images.length > 0) {
        imagesHtml = `
            <div class="tweet-images" style="display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap;">
                ${tweet.images.map(img => `<img src="${img}" class="tweet-img" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" />`).join('')}
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="tweet-header">
            <div class="tweet-author">
                <div class="author-avatar" style="background: #1da1f2; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; width: 40px; height: 40px; border-radius: 50%;">
                    ${tweet.profileImage ? `<img src="${tweet.profileImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'"/>` : tweet.author?.slice(0, 2)?.toUpperCase() || '🐦'}
                </div>
                <div class="author-info">
                    <span class="author-name">${tweet.author || 'Unknown'}</span>
                    <span class="author-handle">@${tweet.handle || ''}</span>
                    <span class="tweet-date">${timeStr}</span>
                </div>
            </div>
            <button class="tweet-deploy-btn">⚡ DEPLOY</button>
        </div>
        <div class="tweet-action">@${tweet.handle || ''} posted</div>
        <div class="tweet-content">${tweet.text || ''}</div>
        ${imagesHtml}
    `;
    
    // Add deploy click handler
    const deployBtn = card.querySelector('.tweet-deploy-btn');
    deployBtn.addEventListener('click', () => {
        const images = JSON.parse(card.dataset.images || '[]');
        
        fillFormFromTweet({
            url: tweet.url,
            authorName: tweet.author,
            username: tweet.handle,
            images: images
        });
    });
    
    // =====================================================
    // CUSTOM NOTIFICATION HIGHLIGHTING - Check against custom accounts
    // =====================================================
    const customAccounts = JSON.parse(localStorage.getItem('customNotificationAccounts') || '[]');
    const tweetHandle = `@${tweet.handle}`.toLowerCase();
    
    const matchedAccount = customAccounts.find(acc => 
        acc.username.toLowerCase() === tweetHandle
    );
    
    if (matchedAccount) {
        console.log('[HIGHLIGHT] Match found:', tweetHandle, '→', matchedAccount.color, 'Sound:', matchedAccount.soundKey || matchedAccount.sound);
        
        // Apply FULL BORDER highlighting - j7tracker style
        card.style.border = `3px solid ${matchedAccount.color}`;
        card.style.boxShadow = `0 0 25px ${matchedAccount.color}80, inset 0 0 40px ${matchedAccount.color}20`;
        card.style.background = `linear-gradient(135deg, rgba(0,0,0,0.95) 0%, ${matchedAccount.color}25 100%)`;
        card.dataset.customHighlighted = 'true';
        
        // Play notification sound - try multiple keys
        const soundToPlay = matchedAccount.soundKey || matchedAccount.sound || 'ding';
        console.log('[SOUND] Attempting to play:', soundToPlay);
        playNotificationSound(soundToPlay.toLowerCase());
        
        addLog('success', `🔔 CUSTOM ALERT: @${tweet.handle} matched! Sound: ${soundToPlay}`);
    }
    
    // Add to TOP of feed (newest first)
    feed.insertBefore(card, feed.firstChild);
    
    // Limit feed to 50 tweets to prevent memory issues
    while (feed.children.length > 50) {
        feed.removeChild(feed.lastChild);
    }
    
    // Update last activity
    updateLastActivity(`New tweet from @${tweet.handle}`);
}

// Select and load a tweet image
async function selectTweetImage(imageUrl) {
    console.log('[IMAGE] Selected:', imageUrl);
    addLog('info', `🖼️ Loading image: ${imageUrl.slice(0, 50)}...`);
    
    try {
        // Fetch image through VPS server proxy to avoid CORS
        const serverUrl = 'http://149.28.53.76:47291';
        const response = await fetch(`${serverUrl}/fetch-image?url=${encodeURIComponent(imageUrl)}`);
        
        if (!response.ok) throw new Error('Failed to fetch image');
        
        const blob = await response.blob();
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = function() {
            const base64 = reader.result;
            
            // Store for deploy - this is what will be uploaded
            window.currentImageData = base64;
            window.cachedIpfsUri = null; // Clear cached URI since image changed
            window.prebuiltTx = null;
            window.selectedImageUrl = imageUrl;
            
            console.log('[IMAGE] Loaded and cached:', Math.round(base64.length / 1024) + 'KB');
            addLog('success', `✅ Image loaded: ${Math.round(base64.length / 1024)}KB`);
            
            // Pre-upload the new image
            preUploadImage(base64);
        };
        reader.readAsDataURL(blob);
        
    } catch (error) {
        console.error('[IMAGE] Load error:', error);
        addLog('error', `❌ Failed to load image: ${error.message}`);
        showToast('Error', 'Failed to load tweet image', 'error');
    }
}
