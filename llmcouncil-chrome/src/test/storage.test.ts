import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../utils/storage';

describe('Storage Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Privacy Consent', () => {
        it('should return false when no consent is stored', async () => {
            // Arrange
            (chrome.storage.local.get as any).mockResolvedValue({});

            // Act
            const hasConsent = await storage.hasPrivacyConsent();

            // Assert
            expect(hasConsent).toBe(false);
        });

        it('should return true when consent is granted', async () => {
            // Arrange
            (chrome.storage.local.get as any).mockResolvedValue({ privacyConsent: true });

            // Act
            const hasConsent = await storage.hasPrivacyConsent();

            // Assert
            expect(hasConsent).toBe(true);
        });

        it('should save consent status', async () => {
            // Arrange
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            // Act
            await storage.setPrivacyConsent(true);

            // Assert
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ privacyConsent: true });
        });
    });

    describe('API Config', () => {
        it('should return null when no API config exists', async () => {
            // Arrange
            (chrome.storage.local.get as any).mockResolvedValue({});

            // Act
            const config = await storage.getAPIConfig();

            // Assert
            expect(config).toBeNull();
        });

        it('should return stored API config', async () => {
            // Arrange
            const mockConfig = { provider: 'openai', apiKey: 'test-key', model: 'gpt-4' };
            (chrome.storage.local.get as any).mockResolvedValue({ apiConfig: mockConfig });

            // Act
            const config = await storage.getAPIConfig();

            // Assert
            expect(config).toEqual(mockConfig);
        });

        it('should save API config', async () => {
            // Arrange
            const mockConfig = { provider: 'openai', apiKey: 'test-key', model: 'gpt-4' };
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            // Act
            await storage.setAPIConfig(mockConfig as any);

            // Assert
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ apiConfig: mockConfig });
        });
    });

    describe('Analysis History', () => {
        it('should return empty array when no history exists', async () => {
            // Arrange
            (chrome.storage.local.get as any).mockResolvedValue({});

            // Act
            const history = await storage.getHistory();

            // Assert
            expect(history).toEqual([]);
        });

        it('should limit history to 50 items', async () => {
            // Arrange
            const mockHistory = Array(45).fill({}).map((_, i) => ({ id: `analysis-${i}` }));
            (chrome.storage.local.get as any).mockResolvedValue({ analysisHistory: mockHistory });
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            const newAnalysis = { id: 'new-analysis' };

            // Act
            await storage.addToHistory(newAnalysis as any);

            // Assert
            const savedHistory = (chrome.storage.local.set as any).mock.calls[0][0].analysisHistory;
            expect(savedHistory).toHaveLength(46); // 45 + 1
            expect(savedHistory[0]).toEqual(newAnalysis); // New one at start
        });

        it('should keep only last 50 when exceeding limit', async () => {
            // Arrange
            const mockHistory = Array(50).fill({}).map((_, i) => ({ id: `analysis-${i}` }));
            (chrome.storage.local.get as any).mockResolvedValue({ analysisHistory: mockHistory });
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            const newAnalysis = { id: 'new-analysis' };

            // Act
            await storage.addToHistory(newAnalysis as any);

            // Assert
            const savedHistory = (chrome.storage.local.set as any).mock.calls[0][0].analysisHistory;
            expect(savedHistory).toHaveLength(50); // Still 50
            expect(savedHistory[0]).toEqual(newAnalysis); // New one at start
            expect(savedHistory[49].id).toBe('analysis-0'); // Oldest kept
        });
    });

    describe('Settings', () => {
        it('should return default settings when none exist', async () => {
            // Arrange
            (chrome.storage.local.get as any).mockResolvedValue({});

            // Act
            const settings = await storage.getSettings();

            // Assert
            expect(settings).toEqual({
                theme: 'light',
                autoOpen: true,
                enableHistory: true,
            });
        });

        it('should merge partial settings update', async () => {
            // Arrange
            const currentSettings = { theme: 'light', autoOpen: true, enableHistory: true };
            (chrome.storage.local.get as any).mockResolvedValue({ settings: currentSettings });
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            // Act
            await storage.setSettings({ theme: 'dark' });

            // Assert
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                settings: { theme: 'dark', autoOpen: true, enableHistory: true },
            });
        });
    });

    describe('Clear Operations', () => {
        it('should clear history', async () => {
            // Arrange
            (chrome.storage.local.set as any).mockResolvedValue(undefined);

            // Act
            await storage.clearHistory();

            // Assert
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ analysisHistory: [] });
        });

        it('should clear all data', async () => {
            // Arrange
            (chrome.storage.local.clear as any).mockResolvedValue(undefined);

            // Act
            await storage.clearAll();

            // Assert
            expect(chrome.storage.local.clear).toHaveBeenCalled();
        });
    });
});
