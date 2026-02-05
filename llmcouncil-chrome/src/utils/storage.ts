import type { StorageSchema, APIConfig, Analysis } from '../types/agents';

const STORAGE_KEYS = {
    API_CONFIG: 'apiConfig',
    HISTORY: 'analysisHistory',
    SETTINGS: 'settings',
    PRIVACY_CONSENT: 'privacyConsent'
} as const;

export const storage = {
    // Privacy consent
    async hasPrivacyConsent(): Promise<boolean> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.PRIVACY_CONSENT);
        return result[STORAGE_KEYS.PRIVACY_CONSENT] === true;
    },

    async setPrivacyConsent(consented: boolean): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.PRIVACY_CONSENT]: consented });
    },

    // API Config
    async getAPIConfig(): Promise<APIConfig | null> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.API_CONFIG);
        return result[STORAGE_KEYS.API_CONFIG] || null;
    },

    async setAPIConfig(config: APIConfig): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIG]: config });
    },

    // History
    async getHistory(): Promise<Analysis[]> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        return result[STORAGE_KEYS.HISTORY] || [];
    },

    async addToHistory(analysis: Analysis): Promise<void> {
        const history = await this.getHistory();
        const updated = [analysis, ...history].slice(0, 50); // Keep last 50
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    },

    // Settings
    async getSettings(): Promise<StorageSchema['settings']> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return result[STORAGE_KEYS.SETTINGS] || {
            theme: 'light',
            autoOpen: true,
            enableHistory: true
        };
    },

    async setSettings(settings: Partial<StorageSchema['settings']>): Promise<void> {
        const current = await this.getSettings();
        await chrome.storage.local.set({
            [STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
        });
    },

    async clearHistory(): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
    },

    async clearAll(): Promise<void> {
        await chrome.storage.local.clear();
    }
};
