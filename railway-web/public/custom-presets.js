// =====================================================
// CUSTOM PRESETS SYSTEM
// =====================================================

(function() {
    console.log('🎯 Custom Presets System Loading...');
    
    // Storage for presets
    let customPresets = JSON.parse(localStorage.getItem('customPresets') || '[]');
    let activePresetKeybinds = {};
    
    // Text selection storage
    let lastSelectedText = '';
    
    // Chinese translation API (using a free service)
    async function translateToChinese(text) {
        try {
            // Using MyMemory Translation API (free)
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`);
            const data = await response.json();
            return data.responseData.translatedText || text;
        } catch (error) {
            console.error('Translation failed:', error);
            return text; // Return original if translation fails
        }
    }
    
    // Generate ASCII art from text
    function generateASCIIArt(text) {
        // Simple ASCII art generation - just the text in a box
        const lines = [
            '╔' + '═'.repeat(text.length + 2) + '╗',
            '║ ' + text + ' ║',
            '╚' + '═'.repeat(text.length + 2) + '╝'
        ];
        return lines.join('\n');
    }
    
    // Generate Letter Image (colored letter based on platform)
    function generateLetterImage(letter, platform) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Colors based on platform
        const colors = {
            pump: { bg: '#22c55e', text: '#fff' },
            bonk: { bg: '#f97316', text: '#fff' },
            usd1: { bg: '#f97316', text: '#fff' },
            bnb: { bg: '#f0b90b', text: '#000' },
            bags: { bg: '#8b5cf6', text: '#fff' },
            jupiter: { bg: '#3b82f6', text: '#fff' }
        };
        
        const color = colors[platform] || colors.pump;
        
        // Draw background
        ctx.fillStyle = color.bg;
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw letter
        ctx.fillStyle = color.text;
        ctx.font = 'bold 300px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter.toUpperCase()[0], 256, 256);
        
        return canvas.toDataURL('image/png');
    }
    
    // Generate SOLTEXT gradient image
    function generateSOLTEXTImage(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Solana gradient background
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#14F195');
        gradient.addColorStop(0.5, '#9945FF');
        gradient.addColorStop(1, '#00D4FF');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Word wrap
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > 450) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        const lineHeight = 70;
        const startY = 256 - ((lines.length - 1) * lineHeight / 2);
        
        lines.forEach((line, i) => {
            ctx.fillText(line, 256, startY + (i * lineHeight));
        });
        
        return canvas.toDataURL('image/png');
    }
    
    // Apply ticker mode logic
    function applyTickerMode(text, mode, customTicker = '') {
        if (mode === 'custom') return customTicker;
        if (mode === 'selected') return text.toUpperCase().slice(0, 13);
        if (mode === 'first-word') {
            const firstWord = text.split(/\s+/)[0];
            return firstWord.toUpperCase().slice(0, 13);
        }
        if (mode === 'abbreviation') {
            // Generate abbreviation
            const words = text.split(/\s+/).filter(w => w.length > 0);
            if (words.length === 1) {
                return words[0].toUpperCase().slice(0, 5);
            } else {
                return words.slice(0, 5).map(w => w[0]).join('').toUpperCase();
            }
        }
        return text.toUpperCase().slice(0, 13);
    }
    
    // Apply preset to deploy form
    async function applyPreset(preset, selectedText) {
        console.log('🎯 Applying preset:', preset.name, 'to text:', selectedText);
        
        const nameInput = document.getElementById('tokenName');
        const symbolInput = document.getElementById('tokenSymbol');
        const imagePreview = document.getElementById('imagePreviewDeploy');
        
        if (!nameInput || !symbolInput) {
            console.error('Form elements not found!');
            return;
        }
        
        // Build token name
        let tokenName = (preset.namePrefix || '') + (preset.namePrefix ? ' ' : '') + selectedText + (preset.nameSuffix ? ' ' : '') + (preset.nameSuffix || '');
        tokenName = tokenName.trim();
        
        // Translate if enabled
        if (preset.translateChinese) {
            window.showToast('Translating...', 'Translating to Chinese...', 'info');
            tokenName = await translateToChinese(tokenName);
        }
        
        // Apply ticker mode
        const ticker = applyTickerMode(selectedText, preset.tickerMode, preset.customTicker);
        let finalTicker = ticker;
        
        if (preset.translateChinese) {
            finalTicker = await translateToChinese(ticker);
        }
        
        // Set form values
        nameInput.value = tokenName;
        symbolInput.value = finalTicker;
        
        // Trigger character counters
        document.getElementById('nameCharCounter').textContent = `${tokenName.length}/32`;
        document.getElementById('tickerCharCounter').textContent = `${finalTicker.length}/13`;
        
        // Select platform
        if (preset.platform && preset.platform !== 'default') {
            const platformBtn = document.querySelector(`.platform-indicator[data-platform="${preset.platform}"]`);
            if (platformBtn) {
                document.querySelectorAll('.platform-indicator').forEach(b => b.classList.remove('active'));
                platformBtn.classList.add('active');
            }
        }
        
        // Handle image type
        if (preset.imageType) {
            let imageData = null;
            
            switch (preset.imageType) {
                case 'post':
                    // Use image from tweet (already implemented in tweet handler)
                    window.showToast('Image', 'Using image from post', 'info');
                    break;
                    
                case 'ascii':
                    // Generate ASCII art
                    const asciiArt = generateASCIIArt(ticker);
                    // Convert ASCII to image
                    imageData = generateSOLTEXTImage(asciiArt);
                    break;
                    
                case 'soltext':
                    // Generate SOLTEXT gradient
                    imageData = generateSOLTEXTImage(ticker);
                    break;
                    
                case 'letter':
                    // Generate letter image
                    const platform = preset.platform || 'pump';
                    imageData = generateLetterImage(ticker, platform);
                    break;
                    
                case 'custom':
                    // Use custom image URL
                    if (preset.customImageUrl) {
                        imageData = preset.customImageUrl;
                    }
                    break;
            }
            
            if (imageData) {
                window.currentImageData = imageData;
                imagePreview.innerHTML = `<img src="${imageData}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
            }
        }
        
        window.showToast('✅ Preset Applied!', `${preset.name} → ${selectedText}`, 'success');
    }
    
    // Text selection handler on tweets
    document.addEventListener('mouseup', function(e) {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text && text.length > 0) {
            // Check if selection is within a tweet
            let element = selection.anchorNode;
            while (element && element !== document) {
                if (element.classList && element.classList.contains('tweet-card')) {
                    lastSelectedText = text;
                    console.log('📝 Text selected in tweet:', text);
                    break;
                }
                element = element.parentElement;
            }
        }
    });
    
    // Keybind listener - WITH INSTANT DEPLOY
    document.addEventListener('keydown', function(e) {
        if (!lastSelectedText) return;
        
        // Build keybind string
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        
        const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        const keybind = modifiers.length > 0 ? modifiers.join('+') + '+' + key : key;
        
        // Check if any preset matches this keybind
        const preset = customPresets.find(p => p.keybind === keybind);
        
        if (preset) {
            e.preventDefault();
            console.log('🎯 Keybind triggered:', keybind, 'for preset:', preset.name);
            
            // Apply preset first
            applyPreset(preset, lastSelectedText).then(() => {
                // INSTANT DEPLOY - trigger the deploy button after preset applied
                setTimeout(() => {
                    const deployBtn = document.getElementById('mainBtn');
                    if (deployBtn) {
                        console.log('⚡ AUTO-DEPLOYING with preset:', preset.name);
                        deployBtn.click();
                        window.showToast('⚡ DEPLOYED!', `${preset.name} → ${lastSelectedText}`, 'success');
                    }
                }, 100); // Small delay to ensure form is filled
            });
        }
    });
    
    // Render presets list
    function renderPresetsList(container) {
        if (!container) return;
        
        if (customPresets.length === 0) {
            container.innerHTML = '<p class="no-presets-text">No custom presets yet. Click "Add New Preset" to create one.</p>';
            return;
        }
        
        container.innerHTML = customPresets.map((preset, idx) => `
            <div class="preset-item" data-idx="${idx}">
                <div class="preset-item-header">
                    <span class="preset-name">${preset.name}</span>
                    <span class="preset-keybind">${preset.keybind || 'No keybind'}</span>
                </div>
                <div class="preset-item-details">
                    <span class="preset-detail">Platform: ${preset.platform || 'Default'}</span>
                    <span class="preset-detail">Ticker: ${preset.tickerMode || 'Selected'}</span>
                    <span class="preset-detail">Image: ${preset.imageType || 'Post'}</span>
                </div>
                <div class="preset-item-actions">
                    <button class="preset-edit-btn" data-idx="${idx}">Edit</button>
                    <button class="preset-delete-btn" data-idx="${idx}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Attach event listeners
        container.querySelectorAll('.preset-edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.dataset.idx);
                editPreset(idx);
            });
        });
        
        container.querySelectorAll('.preset-delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.dataset.idx);
                deletePreset(idx);
            });
        });
    }
    
    // Save preset
    function savePreset(presetData, editIdx = null) {
        if (editIdx !== null) {
            customPresets[editIdx] = presetData;
        } else {
            customPresets.push(presetData);
        }
        
        localStorage.setItem('customPresets', JSON.stringify(customPresets));
        console.log('💾 Preset saved:', presetData.name);
    }
    
    // Delete preset
    function deletePreset(idx) {
        if (confirm(`Delete preset "${customPresets[idx].name}"?`)) {
            customPresets.splice(idx, 1);
            localStorage.setItem('customPresets', JSON.stringify(customPresets));
            renderPresetsList(document.getElementById('presetsList'));
            window.showToast('Deleted', 'Preset deleted', 'info');
        }
    }
    
    // Edit preset
    function editPreset(idx) {
        const preset = customPresets[idx];
        const modal = document.getElementById('customPresetsModal');
        const addForm = document.getElementById('addPresetForm');
        
        if (!modal || !addForm) return;
        
        // Switch to add form view
        document.getElementById('presetsListView').style.display = 'none';
        addForm.style.display = 'block';
        
        // Fill form with preset data
        document.getElementById('presetNameInput').value = preset.name || '';
        document.getElementById('namePrefix').value = preset.namePrefix || '';
        document.getElementById('nameSuffix').value = preset.nameSuffix || '';
        document.getElementById('platformSelect').value = preset.platform || 'default';
        document.getElementById('tickerModeSelect').value = preset.tickerMode || 'selected';
        document.getElementById('imageTypeSelect').value = preset.imageType || 'post';
        document.getElementById('customTickerInput').value = preset.customTicker || '';
        document.getElementById('customImageUrlInput').value = preset.customImageUrl || '';
        document.getElementById('translateChineseCheck').checked = preset.translateChinese || false;
        
        // Store edit index
        addForm.dataset.editIdx = idx;
        
        // Update keybind display
        if (preset.keybind) {
            document.getElementById('keybindDisplay').textContent = preset.keybind;
            document.getElementById('keybindDisplay').classList.add('set');
        }
    }
    
    // Export functions for global access
    window.customPresetsSystem = {
        presets: customPresets,
        applyPreset: applyPreset,
        renderPresetsList: renderPresetsList,
        savePreset: savePreset,
        deletePreset: deletePreset,
        editPreset: editPreset
    };
    
    // =====================================================
    // UI EVENT HANDLERS
    // =====================================================
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        const modal = document.getElementById('customPresetsModal');
        const closeBtn = document.getElementById('closeCustomPresetsModal');
        const addPresetBtn = document.getElementById('addPresetBtn');
        const cancelBtn = document.getElementById('cancelPresetForm');
        const saveBtn = document.getElementById('savePresetBtn');
        const addForm = document.getElementById('addPresetForm');
        const listView = document.getElementById('presetsListView');
        const presetsList = document.getElementById('presetsList');
        
        // Modal close handlers
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                // Reset to list view
                listView.style.display = 'block';
                addForm.style.display = 'none';
            });
        }
        
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                listView.style.display = 'block';
                addForm.style.display = 'none';
            }
        });
        
        // Add Preset Button
        if (addPresetBtn) {
            addPresetBtn.addEventListener('click', () => {
                console.log('➕ Add Preset clicked');
                listView.style.display = 'none';
                addForm.style.display = 'block';
                
                // Clear form
                document.getElementById('presetNameInput').value = '';
                document.getElementById('namePrefix').value = '';
                document.getElementById('nameSuffix').value = '';
                document.getElementById('platformSelect').value = 'default';
                document.getElementById('tickerModeSelect').value = 'selected';
                document.getElementById('imageTypeSelect').value = 'post';
                document.getElementById('customTickerInput').value = '';
                document.getElementById('customImageUrlInput').value = '';
                document.getElementById('translateChineseCheck').checked = false;
                document.getElementById('keybindDisplay').textContent = 'Not Set';
                document.getElementById('keybindDisplay').classList.remove('set');
                delete addForm.dataset.editIdx;
                delete addForm.dataset.keybind;
            });
        }
        
        // Cancel Button
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                listView.style.display = 'block';
                addForm.style.display = 'none';
            });
        }
        
        // Save Button
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const name = document.getElementById('presetNameInput').value.trim();
                const namePrefix = document.getElementById('namePrefix').value.trim();
                const nameSuffix = document.getElementById('nameSuffix').value.trim();
                const platform = document.getElementById('platformSelect').value;
                const tickerMode = document.getElementById('tickerModeSelect').value;
                const imageType = document.getElementById('imageTypeSelect').value;
                const customTicker = document.getElementById('customTickerInput').value.trim();
                const customImageUrl = document.getElementById('customImageUrlInput').value.trim();
                const translateChinese = document.getElementById('translateChineseCheck').checked;
                const keybind = addForm.dataset.keybind || '';
                
                if (!name) {
                    alert('Please enter a preset name');
                    return;
                }
                
                const presetData = {
                    name,
                    namePrefix,
                    nameSuffix,
                    platform,
                    tickerMode,
                    imageType,
                    customTicker,
                    customImageUrl,
                    translateChinese,
                    keybind
                };
                
                const editIdx = addForm.dataset.editIdx;
                savePreset(presetData, editIdx ? parseInt(editIdx) : null);
                
                // Return to list view
                listView.style.display = 'block';
                addForm.style.display = 'none';
                
                // Re-render list
                renderPresetsList(presetsList);
                
                window.showToast('✅ Saved!', `Preset "${name}" saved!`, 'success');
            });
        }
        
        // Ticker mode change handler
        const tickerModeSelect = document.getElementById('tickerModeSelect');
        const customTickerInput = document.getElementById('customTickerInput');
        
        if (tickerModeSelect && customTickerInput) {
            tickerModeSelect.addEventListener('change', () => {
                if (tickerModeSelect.value === 'custom') {
                    customTickerInput.style.display = 'block';
                } else {
                    customTickerInput.style.display = 'none';
                }
            });
        }
        
        // Image type change handler
        const imageTypeSelect = document.getElementById('imageTypeSelect');
        const customImageUrlInput = document.getElementById('customImageUrlInput');
        
        if (imageTypeSelect && customImageUrlInput) {
            imageTypeSelect.addEventListener('change', () => {
                if (imageTypeSelect.value === 'custom') {
                    customImageUrlInput.style.display = 'block';
                } else {
                    customImageUrlInput.style.display = 'none';
                }
            });
        }
        
        // Keybind capture - IMPROVED FOR SIMULTANEOUS KEY PRESSES
        const setKeybindBtn = document.getElementById('setKeybindBtn');
        const clearKeybindBtn = document.getElementById('clearKeybindBtn');
        const keybindDisplay = document.getElementById('keybindDisplay');
        
        if (setKeybindBtn && keybindDisplay) {
            setKeybindBtn.addEventListener('click', () => {
                keybindDisplay.textContent = 'Press any key combo now...';
                keybindDisplay.classList.add('capturing');
                keybindDisplay.style.background = 'rgba(34, 197, 94, 0.2)';
                keybindDisplay.style.color = '#22c55e';
                
                // Track pressed keys for simultaneous detection
                let pressedKeys = new Set();
                let captureTimeout = null;
                
                const captureHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Don't capture modifier-only keys
                    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                        // Show preview while holding modifiers
                        const modifiers = [];
                        if (e.ctrlKey) modifiers.push('Ctrl');
                        if (e.altKey) modifiers.push('Alt');
                        if (e.shiftKey) modifiers.push('Shift');
                        if (modifiers.length > 0) {
                            keybindDisplay.textContent = modifiers.join('+') + '+...';
                        }
                        return;
                    }
                    
                    // Build keybind string with ALL modifiers
                    const modifiers = [];
                    if (e.ctrlKey) modifiers.push('Ctrl');
                    if (e.altKey) modifiers.push('Alt');
                    if (e.shiftKey) modifiers.push('Shift');
                    
                    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                    const keybind = modifiers.length > 0 ? modifiers.join('+') + '+' + key : key;
                    
                    // Show captured keybind immediately
                    keybindDisplay.textContent = keybind + ' ✓';
                    keybindDisplay.classList.remove('capturing');
                    keybindDisplay.classList.add('set');
                    keybindDisplay.style.background = '';
                    keybindDisplay.style.color = '';
                    
                    // Store keybind
                    addForm.dataset.keybind = keybind;
                    
                    // Show clear button
                    if (clearKeybindBtn) {
                        clearKeybindBtn.style.display = 'inline-block';
                    }
                    
                    // Remove listeners
                    document.removeEventListener('keydown', captureHandler, true);
                    document.removeEventListener('keyup', keyupHandler, true);
                    
                    console.log('✅ Keybind captured:', keybind);
                };
                
                const keyupHandler = (e) => {
                    // Cancel if user releases all keys without pressing a main key
                    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
                        clearTimeout(captureTimeout);
                        captureTimeout = setTimeout(() => {
                            if (keybindDisplay.classList.contains('capturing')) {
                                keybindDisplay.textContent = 'Cancelled - try again';
                                keybindDisplay.classList.remove('capturing');
                                keybindDisplay.style.background = '';
                                keybindDisplay.style.color = '';
                                document.removeEventListener('keydown', captureHandler, true);
                                document.removeEventListener('keyup', keyupHandler, true);
                            }
                        }, 500);
                    }
                };
                
                document.addEventListener('keydown', captureHandler, true);
                document.addEventListener('keyup', keyupHandler, true);
            });
        }
        
        if (clearKeybindBtn && keybindDisplay) {
            clearKeybindBtn.addEventListener('click', () => {
                keybindDisplay.textContent = 'Not Set';
                keybindDisplay.classList.remove('set');
                clearKeybindBtn.style.display = 'none';
                delete addForm.dataset.keybind;
            });
        }
        
        console.log('✅ Custom Presets UI handlers attached!');
    });
    
    console.log('✅ Custom Presets System Loaded!');
})();
