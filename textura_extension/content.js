// Auto-Processing Content Script
class AutoProcessor {
    constructor() {
        this.isEnabled = true;
        this.defaultOperation = 'summarize-short';
        this.selectedText = '';
        this.isProcessing = false;
        this.debounceTimer = null;
        this.tooltip = null;
        this.resultPopup = null;
        this.authToken = null;
        this.API_BASE = 'http://localhost:8080/api';
        this.minTextLength = 10;
        this.maxTextLength = 5000;

        this.init();
    }

    async init() {
        // Load settings
        await this.loadSettings();
        // Set up event listeners
        this.setupEventListeners();
        // Create UI elements
        this.createTooltip();
        this.createResultPopup();
        this.createToggleButton();
        console.log('AI Auto-Processor initialized', {
            enabled: this.isEnabled,
            operation: this.defaultOperation
        });
    }

    async loadSettings() {
        const result = await chrome.storage.local.get([
            'autoProcessEnabled',
            'defaultOperation',
            'authToken',
            'minTextLength',
            'autoProcessDelay'
        ]);
        this.isEnabled = result.autoProcessEnabled !== false; // Default to true
        this.defaultOperation = result.defaultOperation || 'summarize-short';
        this.authToken = result.authToken;
        this.minTextLength = result.minTextLength || 10;
        this.autoProcessDelay = result.autoProcessDelay || 1000;
        // 1 second delay
    }

    setupEventListeners() {
        // Text selection events
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        document.addEventListener('keyup', (e) => this.handleKeySelection(e));

        // Double-click for quick processing
        document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        // Messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleAutoProcess') {
                this.toggleAutoProcess();
                sendResponse({ enabled: this.isEnabled });
            } else if (request.action === 'processSelection') {
                this.processCurrentSelection();
                sendResponse({ success: true });
            }
        });
        // Hide tooltip when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ai-tooltip') && !e.target.closest('.ai-result-popup')) {
                this.hideTooltip();
            }
        });
    }

    handleTextSelection(e) {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce text selection to avoid excessive processing
        this.debounceTimer = setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText && selectedText.length >= this.minTextLength) {
                this.selectedText = selectedText.substring(0, this.maxTextLength);
                this.showTooltip(e.clientX, e.clientY, selectedText);

                // Auto-process if enabled
                if (this.isEnabled && this.authToken) {
                    this.autoProcessText(selectedText);
                }
            } else {
                this.hideTooltip();
            }
        }, 300);
        // Wait 300ms after selection stops
    }

    handleKeySelection(e) {
        // Handle keyboard text selection (Ctrl+A, Shift+Arrow keys, etc.)
        if (e.ctrlKey || e.shiftKey) {
            this.handleTextSelection(e);
        }
    }

    handleDoubleClick(e) {
        // Get word or sentence around double-clicked position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            this.expandSelection(range);
            const text = selection.toString().trim();

            if (text && text.length >= this.minTextLength) {
                this.selectedText = text;
                this.showTooltip(e.clientX, e.clientY, text);

                if (this.isEnabled && this.authToken) {
                    this.autoProcessText(text);
                }
            }
        }
    }

    expandSelection(range) {
        // Expand selection to include full sentences
        const text = range.commonAncestorContainer.textContent;
        const start = range.startOffset;
        const end = range.endOffset;

        // Find sentence boundaries
        let sentenceStart = text.lastIndexOf('.', start - 1) + 1;
        let sentenceEnd = text.indexOf('.', end);

        if (sentenceStart < 0) sentenceStart = 0;
        if (sentenceEnd < 0) sentenceEnd = text.length;
        // Expand the range
        range.setStart(range.commonAncestorContainer, sentenceStart);
        range.setEnd(range.commonAncestorContainer, sentenceEnd);

        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    }

    async autoProcessText(text) {
        if (this.isProcessing || !this.authToken) {
            return;
        }

        this.isProcessing = true;
        this.showProcessingState();
        try {
            const result = await this.processWithAPI(text, this.defaultOperation);
            this.showResult(result);
            this.showNotification('✅ Text processed successfully!');
        } catch (error) {
            console.error('Auto-processing failed:', error);
            this.showError(error.message);
            this.showNotification('❌ Processing failed: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.hideProcessingState();
        }
    }

    async processWithAPI(text, operation) {
        const requestBody = {
            content: text,
            operation: operation,
            sourceUrl: window.location.href,
            sessionId: `auto-${Date.now()}`,
            userAgent: navigator.userAgent
        };
        // Add operation-specific parameters
        if (operation === 'translate') {
            requestBody.targetLanguage = 'Spanish';
        } else if (operation === 'rephrase') {
            requestBody.rephraseTone = 'professional';
        }

        const response = await fetch(`${this.API_BASE}/assistant/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Please login to use auto-processing');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Processing failed');
        }
        return data.data.processedContent;
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'ai-tooltip hidden';
        this.tooltip.innerHTML = `
            <div class="tooltip-content">
                <div class="tooltip-header">
                    <span class="tooltip-icon">🤖</span>
                    <span class="tooltip-title">AI Auto-Processor</span>
                    <button class="tooltip-close">×</button>
                </div>
                <div class="tooltip-body">
                    <div class="selected-preview" id="selectedPreview"></div>
                    <div class="operation-selector">
                        <select id="operationSelect">
                            <option value="summarize-short">📋 Quick Summary</option>
                            <option value="summarize-detailed">📄 Detailed Summary</option>
                            <option value="extract-takeaways">💡 Key Takeaways</option>
                            <option value="rephrase">✏️ Rephrase</option>
                            <option value="translate">🌍 Translate</option>
                            <option value="to-json">📊 To JSON</option>
                        </select>
                    </div>
                    <div class="tooltip-actions">
                        <button class="btn-process">
                            <span class="process-spinner hidden">⏳</span>
                            Process Now
                        </button>
                        <button class="btn-toggle">
                            <span id="toggleText">${this.isEnabled ?
                            '🔴 Disable Auto' : '🟢 Enable Auto'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.tooltip);

        // Add event listeners after element is in the DOM
        this.tooltip.querySelector('.tooltip-close').addEventListener('click', () => this.hideTooltip());
        this.tooltip.querySelector('#operationSelect').addEventListener('change', (e) => this.changeOperation(e.target.value));
        this.tooltip.querySelector('.btn-process').addEventListener('click', () => this.processCurrentSelection());
        this.tooltip.querySelector('.btn-toggle').addEventListener('click', () => this.toggleAutoProcess());
    }

    createResultPopup() {
        this.resultPopup = document.createElement('div');
        this.resultPopup.className = 'ai-result-popup hidden';
        this.resultPopup.innerHTML = `
            <div class="result-content">
                <div class="result-header">
                    <span class="result-icon">✨</span>
                    <span class="result-title">AI Result</span>
                    <div class="result-actions">
                        <button class="btn-copy" title="Copy">📋</button>
                        <button class="btn-save" title="Save">💾</button>
                        <button class="btn-close">×</button>
                    </div>
                </div>
                <div class="result-body" id="resultBody"></div>
                <div class="result-footer">
                    <span class="result-operation" id="resultOperation"></span>
                    <span class="result-timestamp" id="resultTimestamp"></span>
                </div>
            </div>
        `;
        document.body.appendChild(this.resultPopup);

        // Add event listeners after element is in the DOM
        this.resultPopup.querySelector('.btn-copy').addEventListener('click', () => this.copyResult());
        this.resultPopup.querySelector('.btn-save').addEventListener('click', () => this.saveResult());
        this.resultPopup.querySelector('.btn-close').addEventListener('click', () => this.hideResult());
    }

    createToggleButton() {
        this.toggleButton = document.createElement('div');
        this.toggleButton.className = 'ai-toggle-button';
        this.toggleButton.innerHTML = `
            <div class="toggle-content">
                <span class="toggle-icon">${this.isEnabled ?
                    '🔴' : '🟢'}</span>
                <span class="toggle-text">${this.isEnabled ?
                    'Auto ON' : 'Auto OFF'}</span>
            </div>
        `;
        document.body.appendChild(this.toggleButton);

        // Add event listener after element is in the DOM
        this.toggleButton.querySelector('.toggle-content').addEventListener('click', () => this.toggleAutoProcess());
    }

    showTooltip(x, y, text) {
        if (!this.tooltip) return;
        const preview = this.tooltip.querySelector('#selectedPreview');
        const operationSelect = this.tooltip.querySelector('#operationSelect');

        preview.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
        operationSelect.value = this.defaultOperation;

        // Position tooltip
        this.tooltip.style.left = Math.min(x, window.innerWidth - 320) + 'px';
        this.tooltip.style.top = Math.min(y + 20, window.innerHeight - 200) + 'px';

        this.tooltip.classList.remove('hidden');
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.add('hidden');
        }
    }

    showResult(content) {
        if (!this.resultPopup) return;
        const resultBody = this.resultPopup.querySelector('#resultBody');
        const resultOperation = this.resultPopup.querySelector('#resultOperation');
        const resultTimestamp = this.resultPopup.querySelector('#resultTimestamp');

        resultBody.textContent = content;
        resultOperation.textContent = this.defaultOperation.replace('-', ' ').toUpperCase();
        resultTimestamp.textContent = new Date().toLocaleTimeString();

        // Position result popup
        const tooltip = this.tooltip;
        if (tooltip && !tooltip.classList.contains('hidden')) {
            const tooltipRect = tooltip.getBoundingClientRect();
            this.resultPopup.style.left = (tooltipRect.right + 10) + 'px';
            this.resultPopup.style.top = tooltipRect.top + 'px';
        } else {
            this.resultPopup.style.left = '50%';
            this.resultPopup.style.top = '20px';
            this.resultPopup.style.transform = 'translateX(-50%)';
        }
        this.resultPopup.classList.remove('hidden');
        this.currentResult = content;
    }

    hideResult() {
        if (this.resultPopup) {
            this.resultPopup.classList.add('hidden');
        }
    }

    showError(message) {
        this.showNotification('❌ Error: ' + message, 'error');
    }

    showProcessingState() {
        const spinner = this.tooltip?.querySelector('.process-spinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }
    }

    hideProcessingState() {
        const spinner = this.tooltip?.querySelector('.process-spinner');
        if (spinner) {
            spinner.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = `ai-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // User Actions
    toggleAutoProcess() {
        this.isEnabled = !this.isEnabled;
        // Update storage
        chrome.storage.local.set({ autoProcessEnabled: this.isEnabled });
        // Update UI
        const toggleText = this.tooltip?.querySelector('#toggleText');
        if (toggleText) {
            toggleText.textContent = this.isEnabled ?
                '🔴 Disable Auto' : '🟢 Enable Auto';
        }

        const toggleButton = this.toggleButton?.querySelector('.toggle-icon');
        const toggleButtonText = this.toggleButton?.querySelector('.toggle-text');
        if (toggleButton && toggleButtonText) {
            toggleButton.textContent = this.isEnabled ? '🔴' : '🟢';
            toggleButtonText.textContent = this.isEnabled ? 'Auto ON' : 'Auto OFF';
        }

        this.showNotification(this.isEnabled ? '🟢 Auto-processing enabled' : '🔴 Auto-processing disabled');
    }

    changeOperation(operation) {
        this.defaultOperation = operation;
        chrome.storage.local.set({ defaultOperation: operation });
        this.showNotification(`Operation changed to: ${operation.replace('-', ' ')}`);
    }

    async processCurrentSelection() {
        if (this.selectedText && this.authToken) {
            await this.autoProcessText(this.selectedText);
        } else if (!this.authToken) {
            this.showNotification('Please login first to use processing features');
        } else {
            this.showNotification('No text selected');
        }
    }

    copyResult() {
        if (this.currentResult) {
            navigator.clipboard.writeText(this.currentResult).then(() => {
                this.showNotification('📋 Result copied to clipboard!');
            }).catch(() => {
                this.showNotification('Failed to copy result');
            });
        }
    }

    saveResult() {
        if (this.currentResult) {
            const blob = new Blob([this.currentResult], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-result-${this.defaultOperation}-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('💾 Result saved!');
        }
    }
}

// Initialize auto-processor
new AutoProcessor();