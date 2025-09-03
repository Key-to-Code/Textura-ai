// Background Service Worker for AI Auto-Processor
class BackgroundService {
    constructor() {
        this.init();
    }

    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleInstall();
            } else if (details.reason === 'update') {
                this.handleUpdate(details.previousVersion);
            }
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Set up context menus for right-click processing
        this.setupContextMenus();

        // Handle keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Handle notifications
        chrome.notifications.onClicked.addListener((notificationId) => {
            if (notificationId.startsWith('ai-result-')) {
                chrome.action.openPopup();
            }
        });
    }

    handleInstall() {
        console.log('AI Auto-Processor installed');
        
        // Set default settings
        chrome.storage.local.set({
            autoProcessEnabled: true,
            defaultOperation: 'summarize-short',
            minTextLength: 10,
            autoProcessDelay: 1000,
            defaultTargetLanguage: 'Spanish',
            defaultRephraseTone: 'professional',
            apiUrl: 'http://localhost:8080/api',
            showNotifications: true
        });

        // Show welcome notification
        this.showNotification('welcome', '🎉 AI Auto-Processor installed! Select text on any page to get started.');
    }

    handleUpdate(previousVersion) {
        console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
        this.showNotification('updated', '✨ AI Auto-Processor updated! New features available.');
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'processText':
                    await this.processTextInBackground(request.text, request.operation, sender.tab);
                    sendResponse({ success: true });
                    break;

                case 'getAuthStatus':
                    const authData = await chrome.storage.local.get(['authToken', 'currentUser']);
                    sendResponse({ 
                        isAuthenticated: !!(authData.authToken && authData.currentUser),
                        user: authData.currentUser 
                    });
                    break;

                case 'updateSettings':
                    await chrome.storage.local.set(request.settings);
                    // Notify all content scripts about settings update
                    this.broadcastToContentScripts({ action: 'updateSettings' });
                    sendResponse({ success: true });
                    break;

                case 'testConnection':
                    const isConnected = await this.testAPIConnection();
                    sendResponse({ connected: isConnected });
                    break;

                case 'openPopup':
                    chrome.action.openPopup();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background message handler error:', error);
            sendResponse({ error: error.message });
        }
    }

    async storeNewResult(operation, processedContent) {
        const storedData = await chrome.storage.local.get('allResults');
        const allResults = storedData.allResults || [];

        const newResult = {
            id: `result-${Date.now()}`,
            operation: operation,
            content: processedContent,
            timestamp: new Date().toISOString(),
            sourceUrl: 'N/A' // You can add the URL here if needed
        };

        allResults.push(newResult);
        await chrome.storage.local.set({ allResults });
        console.log('New result stored:', newResult);
    }

    setupContextMenus() {
        // Remove existing menus first
        chrome.contextMenus.removeAll(() => {
            // Add context menu items
            chrome.contextMenus.create({
                id: 'ai-summarize',
                title: '📋 Summarize with AI',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                id: 'ai-translate',
                title: '🌍 Translate with AI',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                id: 'ai-rephrase',
                title: '✏️ Rephrase with AI',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                id: 'ai-takeaways',
                title: '💡 Extract Takeaways',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                type: 'separator',
                id: 'separator',
                contexts: ['selection']
            });

            chrome.contextMenus.create({
                id: 'ai-settings',
                title: '⚙️ AI Assistant Settings',
                contexts: ['selection']
            });
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async handleContextMenuClick(info, tab) {
        const selectedText = info.selectionText;
        if (!selectedText && info.menuItemId !== 'ai-settings') return;

        switch (info.menuItemId) {
            case 'ai-summarize':
                await this.processFromContextMenu(selectedText, 'summarize-short', tab);
                break;
            case 'ai-translate':
                await this.processFromContextMenu(selectedText, 'translate', tab);
                break;
            case 'ai-rephrase':
                await this.processFromContextMenu(selectedText, 'rephrase', tab);
                break;
            case 'ai-takeaways':
                await this.processFromContextMenu(selectedText, 'extract-takeaways', tab);
                break;
            case 'ai-settings':
                chrome.action.openPopup();
                break;
        }
    }

    async processFromContextMenu(text, operation, tab) {
        // Check authentication
        const authData = await chrome.storage.local.get(['authToken']);
        if (!authData.authToken) {
            this.showNotification('auth-required', '🔐 Please login first to use AI processing');
            chrome.action.openPopup();
            return;
        }

        // Send message to content script to process
        chrome.tabs.sendMessage(tab.id, {
            action: 'processWithOperation',
            text: text,
            operation: operation
        });
    }

    handleCommand(command) {
        switch (command) {
            case 'toggle-auto-process':
                this.toggleAutoProcessGlobally();
                break;
            case 'quick-summarize':
                this.sendToActiveTab({ action: 'quickSummarize' });
                break;
        }
    }

    async toggleAutoProcessGlobally() {
        const settings = await chrome.storage.local.get(['autoProcessEnabled']);
        const newState = !settings.autoProcessEnabled;
        
        await chrome.storage.local.set({ autoProcessEnabled: newState });
        
        // Notify all content scripts
        this.broadcastToContentScripts({ action: 'toggleAutoProcess' });
        
        this.showNotification('toggle', 
            newState ? '🟢 Auto-processing enabled globally' : '🔴 Auto-processing disabled globally'
        );
    }

    async sendToActiveTab(message) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
            console.error('Failed to send message to active tab:', error);
        }
    }

    async broadcastToContentScripts(message) {
        try {
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // Ignore errors for tabs that don't have content script
                });
            });
        } catch (error) {
            console.error('Failed to broadcast to content scripts:', error);
        }
    }

    async testAPIConnection() {
        try {
            const settings = await chrome.storage.local.get(['apiUrl']);
            const apiUrl = settings.apiUrl || 'http://localhost:8080/api';
            
            const response = await fetch(`${apiUrl}/test/connections`);
            const data = await response.json();
            
            return data.overall === true;
        } catch (error) {
            console.error('API connection test failed:', error);
            return false;
        }
    }

    showNotification(id, message) {
        chrome.notifications.create(id, {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Auto-Processor',
            message: message
        });
    }

    async processTextInBackground(text, operation, tab) {
        try {
            const authData = await chrome.storage.local.get(['authToken']);
            const settings = await chrome.storage.local.get(['apiUrl']);
            
            if (!authData.authToken) {
                throw new Error('Authentication required');
            }

            const apiUrl = settings.apiUrl || 'http://localhost:8080/api';
            
            const requestBody = {
                content: text,
                operation: operation,
                sourceUrl: tab.url,
                sessionId: `bg-${Date.now()}`,
                userAgent: navigator.userAgent
            };

            const response = await fetch(`${apiUrl}/assistant/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.authToken}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`result-${Date.now()}`,
                    `✅ ${operation.replace('-', ' ')} complete! Click to view result.`);
                
                // Store the new result instead of just the last one.
                this.storeNewResult(operation, data.data.processedContent);
            } else {
                throw new Error(data.message || 'Processing failed');
            }
        
        } catch (error) {
            console.error('Background processing failed:', error);
            this.showNotification('error', `❌ Processing failed: ${error.message}`);
        }
    }
}

// Initialize background service
new BackgroundService();