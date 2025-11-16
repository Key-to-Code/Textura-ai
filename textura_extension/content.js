// Auto-Processing Content Script - FIXED VERSION
class AutoProcessor {
    constructor() {
        this.isEnabled = false; // Changed to false by default
        this.defaultOperation = 'summarize-short';
        this.selectedText = '';
        this.isProcessing = false;
        this.debounceTimer = null;
        this.tooltip = null;
        this.resultPopup = null;
        this.toggleButton = null;
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
        // Only create UI elements if explicitly enabled
        if (this.isEnabled) {
            this.createTooltip();
            this.createResultPopup();
        }
        // Remove the toggle button creation - no longer needed
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
        this.isEnabled = result.autoProcessEnabled === true; // Only enable if explicitly set
        this.defaultOperation = result.defaultOperation || 'summarize-short';
        this.authToken = result.authToken;
        this.minTextLength = result.minTextLength || 10;
        this.autoProcessDelay = result.autoProcessDelay || 1000;
    }

    setupEventListeners() {
        // REMOVED automatic text selection listeners to prevent unwanted popups
        // Users must now use context menu or popup to process text
        
        // Messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleAutoProcess') {
                this.toggleAutoProcess();
                sendResponse({ enabled: this.isEnabled });
            } else if (request.action === 'processSelection') {
                this.processCurrentSelection();
                sendResponse({ success: true });
            } else if (request.action === 'processWithOperation') {
                // Handle context menu processing
                this.selectedText = request.text;
                this.defaultOperation = request.operation;
                this.autoProcessText(request.text);
                sendResponse({ success: true });
            }
            return true;
        });
    }

    async autoProcessText(text) {
        if (this.isProcessing || !this.authToken) {
            return;
        }

        this.isProcessing = true;
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
        // Only create if doesn't exist and auto-process is enabled
        if (this.tooltip || !this.isEnabled) return;
        
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
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.tooltip);

        this.tooltip.querySelector('.tooltip-close').addEventListener('click', () => this.hideTooltip());
        this.tooltip.querySelector('#operationSelect').addEventListener('change', (e) => this.changeOperation(e.target.value));
        this.tooltip.querySelector('.btn-process').addEventListener('click', () => this.processCurrentSelection());
    }

    createResultPopup() {
        // Only create if doesn't exist
        if (this.resultPopup) return;
        
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

        this.resultPopup.querySelector('.btn-copy').addEventListener('click', () => this.copyResult());
        this.resultPopup.querySelector('.btn-save').addEventListener('click', () => this.saveResult());
        this.resultPopup.querySelector('.btn-close').addEventListener('click', () => this.hideResult());
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.add('hidden');
        }
    }

    showResult(content) {
        if (!this.resultPopup) {
            this.createResultPopup();
        }
        
        const resultBody = this.resultPopup.querySelector('#resultBody');
        const resultOperation = this.resultPopup.querySelector('#resultOperation');
        const resultTimestamp = this.resultPopup.querySelector('#resultTimestamp');

        resultBody.textContent = content;
        resultOperation.textContent = this.defaultOperation.replace('-', ' ').toUpperCase();
        resultTimestamp.textContent = new Date().toLocaleTimeString();

        // Position result popup in center of screen
        this.resultPopup.style.left = '50%';
        this.resultPopup.style.top = '50%';
        this.resultPopup.style.transform = 'translate(-50%, -50%)';
        
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

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `ai-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    toggleAutoProcess() {
        this.isEnabled = !this.isEnabled;
        chrome.storage.local.set({ autoProcessEnabled: this.isEnabled });
        
        // Create or remove UI elements based on state
        if (this.isEnabled) {
            if (!this.tooltip) this.createTooltip();
            if (!this.resultPopup) this.createResultPopup();
        } else {
            // Clean up UI elements
            if (this.tooltip) {
                this.tooltip.remove();
                this.tooltip = null;
            }
        }

        this.showNotification(
            this.isEnabled ? 
            '🟢 Auto-processing enabled' : 
            '🔴 Auto-processing disabled'
        );
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