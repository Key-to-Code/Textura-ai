// Chrome Extension Popup JavaScript
class AssistantAPI {
    constructor() {
        this.API_BASE = 'http://localhost:8080/api';
        this.authToken = null;
        this.currentUser = null;
        this.lastResult = null; // Store last result for copy/download
        this.allResults = []; // Store all results for sidebar

        this.init();
    }

    async init() {
        // Load stored authentication and results
        const result = await chrome.storage.local.get(['authToken', 'currentUser', 'allResults']);
        this.authToken = result.authToken;
        this.currentUser = result.currentUser;
        this.allResults = result.allResults || [];

        // Initialize UI and event listeners
        this.setupEventListeners();
        if (this.authToken && this.currentUser) {
            this.showMainContent();
            this.loadSummariesSidebar();
        }

        // Test connections
        this.testConnection();
    }

    setupEventListeners() {
        document.getElementById('loginTabBtn').addEventListener('click', () => this.showTab('login'));
        document.getElementById('registerTabBtn').addEventListener('click', () => this.showTab('register'));
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('getSelectedTextBtn').addEventListener('click', () => this.getSelectedText());
        document.getElementById('getPageContentBtn').addEventListener('click', () => this.getPageContent());
        document.getElementById('getVisibleContentBtn').addEventListener('click', () => this.getVisibleContent());
        document.getElementById('clearContentBtn').addEventListener('click', () => this.clearContent());
        document.getElementById('operation').addEventListener('change', () => this.toggleOperationFields());
        document.getElementById('processContentBtn').addEventListener('click', () => this.processContent());
        document.getElementById('copyResultBtn').addEventListener('click', () => this.copyResult());
        document.getElementById('downloadResultBtn').addEventListener('click', () => this.downloadResult());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        document.getElementById('openSettingsBtn').addEventListener('click', () => this.openSettings());
    }

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
        console.log('Making request:', url, requestOptions);

        try {
            const response = await fetch(url, requestOptions);
            console.log('Response received:', {
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type')
            });
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('Non-JSON response:', textResponse.substring(0, 500));

                if (response.status === 401 || response.status === 403) {
                    this.handleAuthError();
                    throw new Error('Authentication required. Please login again.');
                }
                throw new Error(`Server returned ${response.status} ${response.statusText}. Expected JSON but got ${contentType}.`);
            }
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            return { response, data };
        } catch (error) {
            console.error('Request failed:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to server. Make sure your API is running on localhost:8080');
            }
            throw error;
        }
    }

    handleAuthError() {
        this.authToken = null;
        this.currentUser = null;
        chrome.storage.local.remove(['authToken', 'currentUser']);
        this.showAuthSection();
        this.showMessage('Session expired. Please login again.', 'error');
    }

    // UI Management
    showAuthSection() {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');
    }

    showMainContent() {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        if (this.currentUser) {
            document.getElementById('userWelcome').textContent =
                `👋 ${this.currentUser.username}`;
        }
    }

    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('statusMessage');
        messageEl.className = `status-message message ${type} show`;
        messageEl.textContent = message;

        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }

    showLoading(show = true) {
        document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
    }

    // Authentication
    async testConnection() {
        try {
            const { data } = await this.makeRequest('/test/connections');
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');

            if (data.overall) {
                statusDot.classList.add('connected');
                statusText.textContent = 'Connected';
            } else {
                statusText.textContent = 'Issues';
            }
        } catch (error) {
            document.getElementById('statusText').textContent = 'Offline';
            console.error('Connection test failed:', error);
        }
    }

    async register() {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        if (!username || !email || !password) {
            this.showTabMessage('registerMessage', 'Please fill all fields', 'error');
            return;
        }

        try {
            this.showSpinner('registerSpinner', true);
            const { data } = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
            this.showTabMessage('registerMessage', data.message, 'success');

            // Auto-switch to login tab and fill credentials
            this.showTab('login');
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = password;

        } catch (error) {
            this.showTabMessage('registerMessage', error.message, 'error');
        } finally {
            this.showSpinner('registerSpinner', false);
        }
    }

    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showTabMessage('loginMessage', 'Please enter credentials', 'error');
            return;
        }

        try {
            this.showSpinner('loginSpinner', true);
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
            // Store in Chrome storage
            await chrome.storage.local.set({
                authToken: this.authToken,
                currentUser: this.currentUser
            });
            this.showTabMessage('loginMessage', 'Login successful!', 'success');
            setTimeout(() => {
                this.showMainContent();
                this.loadSummariesSidebar();
            }, 1000);

        } catch (error) {
            this.showTabMessage('loginMessage', error.message, 'error');
        } finally {
            this.showSpinner('loginSpinner', false);
        }
    }

    async logout() {
        this.authToken = null;
        this.currentUser = null;
        await chrome.storage.local.remove(['authToken', 'currentUser']);
        this.showAuthSection();
        this.showMessage('Logged out successfully', 'info');
    }

    // Content Processing
    async processContent() {
        const content = document.getElementById('contentInput').value.trim();
        const operation = document.getElementById('operation').value;

        if (!content) {
            this.showMessage('Please enter content to process', 'error');
            return;
        }

        const requestBody = {
            content,
            operation,
            sourceUrl: await this.getCurrentUrl(),
            sessionId: `ext-${Date.now()}`,
            userAgent: navigator.userAgent
        };
        // Add operation-specific fields
        if (operation === 'translate') {
            requestBody.targetLanguage = document.getElementById('targetLanguage').value;
        } else if (operation === 'rephrase') {
            requestBody.rephraseTone = document.getElementById('rephraseTone').value;
        }

        try {
            this.showSpinner('processSpinner', true);
            this.showLoading(true);

            const { data } = await this.makeRequest('/assistant/process', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            if (data.success) {
                this.showResult(data.data.processedContent, operation);
                this.addToHistory(data.data.processedContent, operation);
                this.showMessage('Content processed successfully!', 'success');
            } else {
                throw new Error(data.message || 'Processing failed');
            }

        } catch (error) {
            this.showMessage(`Processing failed: ${error.message}`, 'error');
        } finally {
            this.showSpinner('processSpinner', false);
            this.showLoading(false);
        }
    }

    // Content Selection
    async getSelectedText() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString()
            });
            const selectedText = results[0].result;
            if (selectedText) {
                document.getElementById('contentInput').value = selectedText;
                this.showMessage('Selected text captured!', 'success');
            } else {
                this.showMessage('No text selected. Please select text on the page first.', 'info');
            }
        } catch (error) {
            this.showMessage('Failed to get selected text', 'error');
        }
    }

    async getPageContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // Get main content, excluding navigation, ads, etc.
                    const main = document.querySelector('main') ||
                                 document.querySelector('article') ||
                                 document.querySelector('.content') ||
                                 document.querySelector('#content') ||
                                 document.body;

                    return main.innerText.substring(0, 5000); // Limit to 5000 chars
                }
            });

            const content = results[0].result;
            if (content) {
                document.getElementById('contentInput').value = content;
                this.showMessage('Page content captured!', 'success');
            } else {
                this.showMessage('No content found on page', 'error');
            }
        } catch (error) {
            this.showMessage('Failed to get page content', 'error');
        }
    }

    async getVisibleContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // Get only visible text content
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: function(node) {
                                const parent = node.parentElement;
                                const style = window.getComputedStyle(parent);
                                // Skip hidden elements
                                if (style.display === 'none' ||
                                    style.visibility === 'hidden' ||
                                    style.opacity === '0') {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                // Skip script, style, and navigation elements
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
                        if (nodeText.length > 10) { // Only meaningful text
                            text += nodeText + ' ';
                        }
                    }
                    return text.substring(0, 5000).trim();
                }
            });

            const content = results[0].result;
            if (content) {
                document.getElementById('contentInput').value = content;
                this.showMessage('Visible content captured!', 'success');
            } else {
                this.showMessage('No visible content found', 'error');
            }
        } catch (error) {
            this.showMessage('Failed to get visible content', 'error');
        }
    }

    clearContent() {
        document.getElementById('contentInput').value = '';
        this.hideResults();
        this.showMessage('Content cleared', 'info');
    }

    async getCurrentUrl() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab.url;
        } catch (error) {
            return null;
        }
    }

    // History Management
    async addToHistory(content, operation) {
        const historyItem = {
            id: Date.now(),
            content: content,
            operation: operation,
            timestamp: new Date().toISOString(),
            preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
        };

        this.allResults.unshift(historyItem); // Add to beginning
        
        // Keep only last 20 results
        if (this.allResults.length > 20) {
            this.allResults = this.allResults.slice(0, 20);
        }

        // Save to storage
        await chrome.storage.local.set({ allResults: this.allResults });
        
        // Update sidebar
        this.loadSummariesSidebar();
    }

    loadSummariesSidebar() {
        const summariesList = document.getElementById('summariesList');
        const noSummariesMessage = document.getElementById('noSummariesMessage');

        if (this.allResults.length === 0) {
            noSummariesMessage.style.display = 'block';
            summariesList.innerHTML = '';
            return;
        }

        noSummariesMessage.style.display = 'none';
        summariesList.innerHTML = '';

        this.allResults.forEach(item => {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'summary-item';
            summaryDiv.innerHTML = `
                <div class="summary-header">
                    <span class="summary-title">${item.operation.replace('-', ' ')}</span>
                    <span class="summary-date">${new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                <div class="summary-preview">${item.preview}</div>
            `;
            
            // Add click listener to show full result
            summaryDiv.addEventListener('click', () => {
                this.showHistoryResult(item);
            });
            
            summariesList.appendChild(summaryDiv);
        });
    }

    showHistoryResult(item) {
        // Show the result in the main result section
        this.showResult(item.content, item.operation);
        this.lastResult = { content: item.content, operation: item.operation };
        this.showMessage('Historical result loaded', 'info');
    }

    async clearHistory() {
        if (confirm('Are you sure you want to clear all history?')) {
            this.allResults = [];
            await chrome.storage.local.remove('allResults');
            this.loadSummariesSidebar();
            this.showMessage('History cleared', 'info');
        }
    }

    // UI Helper Methods
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Show selected tab
        document.getElementById(tabName + 'Tab').classList.add('active');
        document.getElementById(tabName + 'TabBtn').classList.add('active');
    }

    showTabMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.className = `message ${type}`;
        element.textContent = message;
    }

    showSpinner(spinnerId, show) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) {
            spinner.classList.toggle('hidden', !show);
        }
    }

    toggleOperationFields() {
        const operation = document.getElementById('operation').value;
        const translateOptions = document.getElementById('translateOptions');
        const rephraseOptions = document.getElementById('rephraseOptions');

        translateOptions.classList.toggle('hidden', operation !== 'translate');
        rephraseOptions.classList.toggle('hidden', operation !== 'rephrase');
    }

    showResult(content, operation) {
        const resultsSection = document.getElementById('resultsSection');
        const resultContent = document.getElementById('resultContent');

        resultContent.textContent = content;
        resultsSection.classList.remove('hidden');

        // Store result for copying/downloading
        this.lastResult = { content, operation };
    }

    hideResults() {
        document.getElementById('resultsSection').classList.add('hidden');
    }

    copyResult() {
        if (this.lastResult) {
            navigator.clipboard.writeText(this.lastResult.content).then(() => {
                this.showMessage('Result copied to clipboard!', 'success');
            }).catch(() => {
                this.showMessage('Failed to copy result', 'error');
            });
        }
    }

    downloadResult() {
        if (this.lastResult) {
            const blob = new Blob([this.lastResult.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-${this.lastResult.operation}-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            this.showMessage('Result downloaded!', 'success');
        }
    }

    openSettings() {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
}

// Initialize the API client
new AssistantAPI();