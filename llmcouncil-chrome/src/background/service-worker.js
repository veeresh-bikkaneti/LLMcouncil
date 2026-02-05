"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const storage_1 = require("../utils/storage");
const llmClient_1 = require("./llmClient");
const councilOrchestrator_1 = require("./councilOrchestrator");
const constants_1 = require("../utils/constants");
// Background service worker for Chrome extension
console.log('LLM Council background service worker loaded');
// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_TEXT') {
        handleAnalyzeText(message.text, message.url)
            .then(sendResponse)
            .catch(error => send, Response({ error: error.message }));
        return true; // Keep channel open for async response
    }
    if (message.type === 'CHECK_CONSENT') {
        storage_1.storage.hasPrivacyConsent()
            .then(hasConsent => sendResponse({ hasConsent }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
    if (message.type === 'GET_API_CONFIG') {
        storage_1.storage.getAPIConfig()
            .then(config => sendResponse({ config }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});
// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'analyze-selection' && info.selectionText) {
        // Open side panel
        if (tab?.id) {
            await chrome.sidePanel.open({ tabId: tab.id });
            // Send analysis request
            const result = await handleAnalyzeText(info.selectionText, tab.url || '');
            // Send result to side panel
            chrome.runtime.sendMessage({
                type: 'ANALYSIS_RESULT',
                ...result,
            });
        }
    }
});
// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'analyze-selection',
        title: 'Analyze with LLM Council',
        contexts: ['selection'],
    });
});
async function handleAnalyzeText(text, url) {
    try {
        // Check privacy consent
        const hasConsent = await storage_1.storage.hasPrivacyConsent();
        if (!hasConsent) {
            return { error: constants_1.MESSAGES.PRIVACY_CONSENT_REQUIRED };
        }
        // Get API config
        const apiConfig = await storage_1.storage.getAPIConfig();
        if (!apiConfig) {
            return { error: constants_1.MESSAGES.NO_API_KEY };
        }
        // Create LLM client and orchestrator
        const llmClient = new llmClient_1.LLMClient(apiConfig);
        const orchestrator = new councilOrchestrator_1.CouncilOrchestrator(llmClient);
        // Run council analysis
        const analysis = await orchestrator.runCouncil(text, (agentId, status) => {
            // Send progress updates
            chrome.runtime.sendMessage({
                type: 'ANALYSIS_PROGRESS',
                agentId,
                status,
            });
        });
        // Add URL to analysis
        analysis.url = url;
        // Save to history (if enabled)
        const settings = await storage_1.storage.getSettings();
        if (settings.enableHistory) {
            await storage_1.storage.addToHistory(analysis);
        }
        return { analysis };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
//# sourceMappingURL=service-worker.js.map