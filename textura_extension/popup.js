// Modern Chrome Extension - Main Popup Logic
class ModernAIExtension {
    constructor() {
        this.API_BASE = 'http://localhost:8080/api';
        this.authToken = null;
        this.currentUser = null;
        this.history = [];
        this.currentResult = null;
        this.sidebarOpen = false;
        
        // Initialize the extension
        this.init();
    }

    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Load stored data
            await this.loadStoredData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Test connection
            await this.testConnection();
            
            // Show appropriate UI
            if (this.authToken && this.currentUser) {
                this.showMainContent();
                this.loadHistory();
            } else {
                this.showAuthSection();
            }
            
            // Hide loading screen
            this.hideLoading();
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showToast('Initialization failed', 'error');
            this.hideLoading();
        }
    }

    async loadStoredData() {
        const data = await chrome.storage.local.get([
            'authToken', 
            'currentUser', 
            'allResults'
        ]);
        
        this.authToken = data.authToken;
        this.currentUser = data.currentUser;
        this.history = data.allResults || [];
    }

    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchAuthTab(e.target.dataset.tab);
            });
        });

        // Auth forms
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Content selection
        document.getElementById('get-selected-btn').addEventListener('click', () => this.getSelectedText());
        document.getElementById('get-page-btn').addEventListener('click', () => this.getPageContent());
        document.getElementById('get-visible-btn').addEventListener('click', () => this.getVisibleContent());
        document.getElementById('clear-content-btn').addEventListener('click', () => this.clearContent());

        // Processing
        document.getElementById('operation-select').addEventListener('change', (e) => {
            this.toggleOperationOptions(e.target.value);
        });
        document.getElementById('process-btn').addEventListener('click', () => this.processContent());

        // Results
        document.getElementById('copy-result-btn').addEventListener('click', () => this.copyResult());
        document.getElementById('download-result-btn').addEventListener('click', () => this.downloadResult());

        // Sidebar
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebar-close').addEventListener('click', () => this.closeSidebar());
        document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Form submissions
        document.getElementById('login-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('register-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
    }

    // UI Management
    showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('main-container').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-container').classList.remove('hidden');
    }

    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
    }

    showMainContent() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        if (this.currentUser) {
            document.getElementById('user-name').textContent = this.currentUser.username;
        }
    }

    switchAuthTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}-form`);
        });
    }

    toggleOperationOptions(operation) {
        const translateOptions = document.getElementById('translate-options');
        const rephraseOptions = document.getElementById('rephrase-options');
        
        translateOptions.classList.toggle('hidden', operation !== 'translate');
        rephraseOptions.classList.toggle('hidden', operation !== 'rephrase');
    }

    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('sidebar');
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            this.createSidebarOverlay();
        } else {
            sidebar.classList.remove('open');
            this.removeSidebarOverlay();
        }
    }

    closeSidebar() {
        this.sidebarOpen = false;
        document.getElementById('sidebar').classList.remove('open');
        this.removeSidebarOverlay();
    }

    createSidebarOverlay() {
        if (document.querySelector('.sidebar-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', () => this.closeSidebar());
        document.body.appendChild(overlay);
        
        // Trigger animation
        setTimeout(() => overlay.classList.add('active'), 10);
    }

    removeSidebarOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        }
    }

    // API Methods
    async makeRequest(endpoint, options = {}) {
        const url = this.API_BASE + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            }
        };
        
        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        try {
            const response = await fetch(url, requestOptions);
            const contentType = response.headers.get('content-type');
            
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned ${response.status}. Expected JSON response.`);
            }

            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.handleAuthError();
                }
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return { response, data };
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to server. Make sure your API is running.');
            }
            throw error;
        }
    }

    handleAuthError() {
        this.authToken = null;
        this.currentUser = null;
        chrome.storage.local.remove(['authToken', 'currentUser']);
        this.showAuthSection();
        this.showToast('Session expired. Please login again.', 'error');
    }

    async testConnection() {
        try {
            const { data } = await this.makeRequest('/test/connections');
            const statusIndicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');

            if (data.overall) {
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = 'Connected';
            } else {
                statusIndicator.className = 'status-indicator issues';
                statusText.textContent = 'Issues';
            }
        } catch (error) {
            const statusIndicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            statusIndicator.className = 'status-indicator';
            statusText.textContent = 'Offline';
            console.error('Connection test failed:', error);
        }
    }

    // Authentication
    async login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            this.showToast('Please enter both username and password', 'error');
            return;
        }

        const btn = document.getElementById('login-btn');
        this.setButtonLoading(btn, true);

        try {
            const { data } = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            this.authToken = data.token;
            this.currentUser = {
                id: data.userId,
                username: data.username,
                email: data.email
            };

            await chrome.storage.local.set({
                authToken: this.authToken,
                currentUser: this.currentUser
            });

            this.showToast('Login successful!', 'success');
            setTimeout(() => {
                this.showMainContent();
                this.loadHistory();
            }, 1000);

        } catch (error) {
            this.showToast(`Login failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async register() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (!username || !email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (username.length < 3) {
            this.showToast('Username must be at least 3 characters', 'error');
            return;
        }

        if (password.length < 8) {
            this.showToast('Password must be at least 8 characters', 'error');
            return;
        }

        const btn = document.getElementById('register-btn');
        this.setButtonLoading(btn, true);

        try {
            const { data } = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });

            this.showToast(data.message || 'Registration successful!', 'success');
            
            // Auto-switch to login tab
            setTimeout(() => {
                this.switchAuthTab('login');
                document.getElementById('login-username').value = username;
                document.getElementById('login-password').value = password;
            }, 1000);

        } catch (error) {
            this.showToast(`Registration failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async logout() {
        this.authToken = null;
        this.currentUser = null;
        this.history = [];
        
        await chrome.storage.local.remove(['authToken', 'currentUser']);
        
        this.showAuthSection();
        this.clearContent();
        this.hideResults();
        this.closeSidebar();
        
        this.showToast('Logged out successfully', 'info');
    }

    // Content Management
    async getSelectedText() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString()
            });

            const selectedText = results[0].result;
            if (selectedText) {
                document.getElementById('content-input').value = selectedText;
                this.showToast('Selected text captured!', 'success');
            } else {
                this.showToast('No text selected. Please select text on the page first.', 'info');
            }
        } catch (error) {
            this.showToast('Failed to get selected text', 'error');
        }
    }

    async getPageContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const main = document.querySelector('main') ||
                                 document.querySelector('article') ||
                                 document.querySelector('.content') ||
                                 document.querySelector('#content') ||
                                 document.body;
                    return main.innerText.substring(0, 5000);
                }
            });

            const content = results[0].result;
            if (content) {
                document.getElementById('content-input').value = content;
                this.showToast('Page content captured!', 'success');
            } else {
                this.showToast('No content found on page', 'error');
            }
        } catch (error) {
            this.showToast('Failed to get page content', 'error');
        }
    }

    async getVisibleContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: function(node) {
                                const parent = node.parentElement;
                                const style = window.getComputedStyle(parent);
                                
                                if (style.display === 'none' ||
                                    style.visibility === 'hidden' ||
                                    style.opacity === '0') {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                
                                const tagName = parent.tagName.toLowerCase();
                                if (['script', 'style', 'nav', 'header', 'footer'].includes(tagName)) {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                
                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }
                    );
                    
                    let text = '';
                    let node;
                    while (node = walker.nextNode()) {
                        const nodeText = node.textContent.trim();
                        if (nodeText.length > 10) {
                            text += nodeText + ' ';
                        }
                    }
                    return text.substring(0, 5000).trim();
                }
            });

            const content = results[0].result;
            if (content) {
                document.getElementById('content-input').value = content;
                this.showToast('Visible content captured!', 'success');
            } else {
                this.showToast('No visible content found', 'error');
            }
        } catch (error) {
            this.showToast('Failed to get visible content', 'error');
        }
    }

    clearContent() {
        document.getElementById('content-input').value = '';
        this.hideResults();
        this.showToast('Content cleared', 'info');
    }

    // Processing
    async processContent() {
        const content = document.getElementById('content-input').value.trim();
        const operation = document.getElementById('operation-select').value;

        if (!content) {
            this.showToast('Please enter content to process', 'error');
            return;
        }

        const requestBody = {
            content,
            operation,
            sourceUrl: await this.getCurrentUrl(),
            sessionId: `ext-${Date.now()}`,
            userAgent: navigator.userAgent
        };

        // Add operation-specific parameters
        if (operation === 'translate') {
            requestBody.targetLanguage = document.getElementById('target-language').value;
        } else if (operation === 'rephrase') {
            requestBody.rephraseTone = document.getElementById('rephrase-tone').value;
        }

        const btn = document.getElementById('process-btn');
        this.setButtonLoading(btn, true);

        try {
            const { data } = await this.makeRequest('/assistant/process', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            if (data.success) {
                this.showResult(data.data.processedContent, operation);
                await this.addToHistory(data.data.processedContent, operation);
                this.showToast('Content processed successfully!', 'success');
            } else {
                throw new Error(data.message || 'Processing failed');
            }

        } catch (error) {
            this.showToast(`Processing failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    showResult(content, operation) {
        const resultsSection = document.getElementById('results-section');
        const resultContent = document.getElementById('result-content');

        resultContent.textContent = content;
        resultsSection.classList.remove('hidden');

        this.currentResult = { content, operation };
        
        // Smooth scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideResults() {
        document.getElementById('results-section').classList.add('hidden');
        this.currentResult = null;
    }

    async copyResult() {
        if (!this.currentResult) return;

        try {
            await navigator.clipboard.writeText(this.currentResult.content);
            this.showToast('Result copied to clipboard!', 'success');
        } catch (error) {
            this.showToast('Failed to copy result', 'error');
        }
    }

    downloadResult() {
        if (!this.currentResult) return;

        const blob = new Blob([this.currentResult.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-${this.currentResult.operation}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Result downloaded!', 'success');
    }

    // History Management
    async addToHistory(content, operation) {
        const historyItem = {
            id: Date.now(),
            content,
            operation,
            timestamp: new Date().toISOString(),
            preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
        };

        this.history.unshift(historyItem);
        
        // Keep only last 50 results
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        await chrome.storage.local.set({ allResults: this.history });
        this.loadHistory();
    }

    loadHistory() {
        const historyList = document.getElementById('history-list');
        const noHistory = document.getElementById('no-history');

        if (this.history.length === 0) {
            noHistory.style.display = 'flex';
            return;
        }

        noHistory.style.display = 'none';
        
        // Clear existing items (except no-history message)
        const existingItems = historyList.querySelectorAll('.history-item');
        existingItems.forEach(item => item.remove());

        this.history.forEach(item => {
            const historyItem = this.createHistoryItem(item);
            historyList.appendChild(historyItem);
        });
    }

    createHistoryItem(item) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-header">
                <span class="history-operation">${item.operation.replace('-', ' ')}</span>
                <span class="history-date">${new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
            <div class="history-preview">${item.preview}</div>
        `;
        
        div.addEventListener('click', () => {
            this.showHistoryResult(item);
            this.closeSidebar();
        });
        
        return div;
    }

    showHistoryResult(item) {
        this.showResult(item.content, item.operation);
        this.showToast('Historical result loaded', 'info');
    }

    async clearHistory() {
        if (!confirm('Are you sure you want to clear all history?')) return;

        this.history = [];
        await chrome.storage.local.remove('allResults');
        this.loadHistory();
        this.showToast('History cleared', 'info');
    }

    // Utility Methods
    async getCurrentUrl() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab.url;
        } catch (error) {
            return null;
        }
    }

    setButtonLoading(button, loading) {
        const spinner = button.querySelector('.btn-spinner');
        const text = button.querySelector('.btn-text');
        
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            spinner.classList.remove('hidden');
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            spinner.classList.add('hidden');
        }
    }

    handleKeyboard(e) {
        // Escape key closes sidebar
        if (e.key === 'Escape' && this.sidebarOpen) {
            this.closeSidebar();
        }
        
        // Ctrl/Cmd + Enter processes content
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const contentInput = document.getElementById('content-input');
            if (contentInput === document.activeElement) {
                this.processContent();
            }
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>`,
            error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m12,16v-4"/><path d="m12,8h.01"/></svg>`,
            warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73,18-8-14a2,2,0,0,0-3.48,0l-8,14A2,2,0,0,0,4,21H20a2,2,0,0,0,1.73-3Z"/><path d="m12,9v4"/><path d="m12,17h.01"/></svg>`
        };
        
        toast.innerHTML = `
            <div class="toast-icon" style="color: var(--accent-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'secondary' : 'primary'})">
                ${icons[type] || icons.info}
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        // Close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto-remove after duration
        const autoRemove = setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        // Store timeout ID for manual removal
        toast.autoRemoveTimeout = autoRemove;

        container.appendChild(toast);

        // Limit number of toasts
        const toasts = container.querySelectorAll('.toast');
        if (toasts.length > 3) {
            this.removeToast(toasts[0]);
        }
    }

    removeToast(toast) {
        if (toast.autoRemoveTimeout) {
            clearTimeout(toast.autoRemoveTimeout);
        }
        
        toast.style.animation = 'slideOutRight 0.3s ease-in-out forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Format operation name for display
    formatOperationName(operation) {
        return operation
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Get operation icon
    getOperationIcon(operation) {
        const icons = {
            'summarize-short': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
            'summarize-detailed': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
            'extract-takeaways': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            'rephrase': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            'translate': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
            'to-json': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`
        };
        
        return icons[operation] || icons['summarize-short'];
    }

    // Enhanced error handling with retry mechanism
    async makeRequestWithRetry(endpoint, options = {}, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.makeRequest(endpoint, options);
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries && this.isRetryableError(error)) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await this.sleep(delay);
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    }

    isRetryableError(error) {
        const retryableMessages = [
            'fetch',
            'network',
            'timeout',
            'connection',
            'temporary'
        ];
        
        const message = error.message.toLowerCase();
        return retryableMessages.some(keyword => message.includes(keyword));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Improved content validation
    validateContent(content) {
        if (!content || content.trim().length === 0) {
            throw new Error('Content cannot be empty');
        }
        
        if (content.length < 10) {
            throw new Error('Content must be at least 10 characters long');
        }
        
        if (content.length > 10000) {
            throw new Error('Content is too long. Maximum 10,000 characters allowed.');
        }
        
        return true;
    }

    // Enhanced history search functionality
    searchHistory(query) {
        if (!query) return this.history;
        
        const lowerQuery = query.toLowerCase();
        return this.history.filter(item => 
            item.content.toLowerCase().includes(lowerQuery) ||
            item.operation.toLowerCase().includes(lowerQuery) ||
            item.preview.toLowerCase().includes(lowerQuery)
        );
    }

    // Export history functionality
    async exportHistory() {
        if (this.history.length === 0) {
            this.showToast('No history to export', 'info');
            return;
        }

        const exportData = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            results: this.history
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-assistant-history-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('History exported successfully', 'success');
    }

    // Performance monitoring
    startPerformanceTimer(label) {
        return {
            label,
            start: performance.now(),
            end: () => {
                const duration = performance.now() - this.start;
                console.log(`${label}: ${duration.toFixed(2)}ms`);
                return duration;
            }
        };
    }

    // Cleanup method
    cleanup() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyboard);
        
        // Clear any pending timeouts
        const container = document.getElementById('toast-container');
        if (container) {
            container.querySelectorAll('.toast').forEach(toast => {
                if (toast.autoRemoveTimeout) {
                    clearTimeout(toast.autoRemoveTimeout);
                }
            });
        }
        
        // Close sidebar
        this.closeSidebar();
    }
}

// Add custom CSS animations for toast removal
const customStyles = `
@keyframes slideOutRight {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}
`;

// Inject custom styles
if (!document.querySelector('#custom-animations')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'custom-animations';
    styleSheet.textContent = customStyles;
    document.head.appendChild(styleSheet);
}

// Initialize the extension when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.aiExtension = new ModernAIExtension();
    });
} else {
    window.aiExtension = new ModernAIExtension();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.aiExtension) {
        window.aiExtension.cleanup();
    }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernAIExtension;
}