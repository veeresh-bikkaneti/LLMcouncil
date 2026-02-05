"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
const STORAGE_KEYS = {
    API_CONFIG: 'apiConfig',
    HISTORY: 'analysisHistory',
    SETTINGS: 'settings',
    PRIVACY_CONSENT: 'privacyConsent'
};
exports.storage = {
    // Privacy consent
    async hasPrivacyConsent() {
        const result = await chrome.storage.local.get(STORAGE_KEYS.PRIVACY_CONSENT);
        return result[STORAGE_KEYS.PRIVACY_CONSENT] === true;
    },
    async setPrivacyConsent(consented) {
        await chrome.storage.local.set({ [STORAGE_KEYS.PRIVACY_CONSENT]: consented });
    },
    // API Config
    async getAPIConfig() {
        const result = await chrome.storage.local.get(STORAGE_KEYS.API_CONFIG);
        return result[STORAGE_KEYS.API_CONFIG] || null;
    },
    async setAPIConfig(config) {
        await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIG]: config });
    },
    // History
    async getHistory() {
        const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        return result[STORAGE_KEYS.HISTORY] || [];
    },
    async addToHistory(analysis) {
        const history = await this.getHistory();
        const updated = [analysis, ...history].slice(0, 50); // Keep last 50
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    },
    // Settings
    async getSettings() {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return result[STORAGE_KEYS.SETTINGS] || {
            theme: 'light',
            autoOpen: true,
            enableHistory: true
        };
    },
    async setSettings(settings) {
        const current = await this.getSettings();
        await chrome.storage.local.set({
            [STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
        });
    },
    async clearHistory() {
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
    },
    async clearAll() {
        await chrome.storage.local.clear();
    }
};
//# sourceMappingURL=storage.js.map