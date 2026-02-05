"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const storage_1 = require("../utils/storage");
(0, vitest_1.describe)('Storage Utils', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('Privacy Consent', () => {
        (0, vitest_1.it)('should return false when no consent is stored', async () => {
            // Arrange
            chrome.storage.local.get.mockResolvedValue({});
            // Act
            const hasConsent = await storage_1.storage.hasPrivacyConsent();
            // Assert
            (0, vitest_1.expect)(hasConsent).toBe(false);
        });
        (0, vitest_1.it)('should return true when consent is granted', async () => {
            // Arrange
            chrome.storage.local.get.mockResolvedValue({ privacyConsent: true });
            // Act
            const hasConsent = await storage_1.storage.hasPrivacyConsent();
            // Assert
            (0, vitest_1.expect)(hasConsent).toBe(true);
        });
        (0, vitest_1.it)('should save consent status', async () => {
            // Arrange
            chrome.storage.local.set.mockResolvedValue(undefined);
            // Act
            await storage_1.storage.setPrivacyConsent(true);
            // Assert
            (0, vitest_1.expect)(chrome.storage.local.set).toHaveBeenCalledWith({ privacyConsent: true });
        });
    });
    (0, vitest_1.describe)('API Config', () => {
        (0, vitest_1.it)('should return null when no API config exists', async () => {
            // Arrange
            chrome.storage.local.get.mockResolvedValue({});
            // Act
            const config = await storage_1.storage.getAPIConfig();
            // Assert
            (0, vitest_1.expect)(config).toBeNull();
        });
        (0, vitest_1.it)('should return stored API config', async () => {
            // Arrange
            const mockConfig = { provider: 'openai', apiKey: 'test-key', model: 'gpt-4' };
            chrome.storage.local.get.mockResolvedValue({ apiConfig: mockConfig });
            // Act
            const config = await storage_1.storage.getAPIConfig();
            // Assert
            (0, vitest_1.expect)(config).toEqual(mockConfig);
        });
        (0, vitest_1.it)('should save API config', async () => {
            // Arrange
            const mockConfig = { provider: 'openai', apiKey: 'test-key', model: 'gpt-4' };
            chrome.storage.local.set.mockResolvedValue(undefined);
            // Act
            await storage_1.storage.setAPIConfig(mockConfig);
            // Assert
            (0, vitest_1.expect)(chrome.storage.local.set).toHaveBeenCalledWith({ apiConfig: mockConfig });
        });
    });
    (0, vitest_1.describe)('Analysis History', () => {
        (0, vitest_1.it)('should return empty array when no history exists', async () => {
            // Arrange
            chrome.storage.local.get.mockResolvedValue({});
            // Act
            const history = await storage_1.storage.getHistory();
            // Assert
            (0, vitest_1.expect)(history).toEqual([]);
        });
        (0, vitest_1.it)('should limit history to 50 items', async () => {
            // Arrange
            const mockHistory = Array(45).fill({}).map((_, i) => ({ id: `analysis-${i}` }));
            chrome.storage.local.get.mockResolvedValue({ analysisHistory: mockHistory });
            chrome.storage.local.set.mockResolvedValue(undefined);
            const newAnalysis = { id: 'new-analysis' };
            // Act
            await storage_1.storage.addToHistory(newAnalysis);
            // Assert
            const savedHistory = chrome.storage.local.set.mock.calls[0][0].analysisHistory;
            (0, vitest_1.expect)(savedHistory).toHaveLength(46); // 45 + 1
            (0, vitest_1.expect)(savedHistory[0]).toEqual(newAnalysis); // New one at start
        });
        (0, vitest_1.it)('should keep only last 50 when exceeding limit', async () => {
            // Arrange
            const mockHistory = Array(50).fill({}).map((_, i) => ({ id: `analysis-${i}` }));
            chrome.storage.local.get.mockResolvedValue({ analysisHistory: mockHistory });
            chrome.storage.local.set.mockResolvedValue(undefined);
            const newAnalysis = { id: 'new-analysis' };
            // Act
            await storage_1.storage.addToHistory(newAnalysis);
            // Assert
            const savedHistory = chrome.storage.local.set.mock.calls[0][0].analysisHistory;
            (0, vitest_1.expect)(savedHistory).toHaveLength(50); // Still 50
            (0, vitest_1.expect)(savedHistory[0]).toEqual(newAnalysis); // New one at start
            (0, vitest_1.expect)(savedHistory[49].id).toBe('analysis-0'); // Oldest kept
        });
    });
    (0, vitest_1.describe)('Settings', () => {
        (0, vitest_1.it)('should return default settings when none exist', async () => {
            // Arrange
            chrome.storage.local.get.mockResolvedValue({});
            // Act
            const settings = await storage_1.storage.getSettings();
            // Assert
            (0, vitest_1.expect)(settings).toEqual({
                theme: 'light',
                autoOpen: true,
                enableHistory: true,
            });
        });
        (0, vitest_1.it)('should merge partial settings update', async () => {
            // Arrange
            const currentSettings = { theme: 'light', autoOpen: true, enableHistory: true };
            chrome.storage.local.get.mockResolvedValue({ settings: currentSettings });
            chrome.storage.local.set.mockResolvedValue(undefined);
            // Act
            await storage_1.storage.setSettings({ theme: 'dark' });
            // Assert
            (0, vitest_1.expect)(chrome.storage.local.set).toHaveBeenCalledWith({
                settings: { theme: 'dark', autoOpen: true, enableHistory: true },
            });
        });
    });
    (0, vitest_1.describe)('Clear Operations', () => {
        (0, vitest_1.it)('should clear history', async () => {
            // Arrange
            chrome.storage.local.set.mockResolvedValue(undefined);
            // Act
            await storage_1.storage.clearHistory();
            // Assert
            (0, vitest_1.expect)(chrome.storage.local.set).toHaveBeenCalledWith({ analysisHistory: [] });
        });
        (0, vitest_1.it)('should clear all data', async () => {
            // Arrange
            chrome.storage.local.clear.mockResolvedValue(undefined);
            // Act
            await storage_1.storage.clearAll();
            // Assert
            (0, vitest_1.expect)(chrome.storage.local.clear).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=storage.test.js.map