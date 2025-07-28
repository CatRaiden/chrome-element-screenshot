import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserSettings } from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    }
  },
  runtime: {
    lastError: null as any
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('Settings Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Settings Workflow', () => {
    it('should handle complete settings lifecycle', async () => {
      const { 
        loadSettings, 
        saveSettings, 
        updateSettings, 
        resetSettings, 
        validateSettings,
        generateFilename,
        DEFAULT_SETTINGS 
      } = await import('../src/utils/settingsManager');

      // 1. Initial load should return defaults
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback({});
      });

      const initialSettings = await loadSettings();
      expect(initialSettings).toEqual(DEFAULT_SETTINGS);

      // 2. Save custom settings
      const customSettings: UserSettings = {
        defaultFormat: 'jpeg',
        defaultQuality: 85,
        filenameTemplate: 'custom-{timestamp}',
        autoDownload: false,
        showProgress: true,
        highlightColor: '#ff5722'
      };

      mockChrome.storage.sync.set.mockImplementationOnce((_data, callback) => {
        callback();
      });

      await saveSettings(customSettings);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(customSettings, expect.any(Function));

      // 3. Load saved settings
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback(customSettings);
      });

      const loadedSettings = await loadSettings();
      expect(loadedSettings).toEqual(customSettings);

      // 4. Update partial settings
      const updates = { defaultQuality: 75, autoDownload: true };
      
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback(customSettings);
      });
      mockChrome.storage.sync.set.mockImplementationOnce((_data, callback) => {
        callback();
      });

      const updatedSettings = await updateSettings(updates);
      expect(updatedSettings).toEqual({ ...customSettings, ...updates });

      // 5. Validate settings
      const validation = validateSettings(updatedSettings);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // 6. Generate filename
      const filename = generateFilename(updatedSettings.filenameTemplate, updatedSettings.defaultFormat);
      expect(filename).toMatch(/^custom-\d+\.jpg$/);

      // 7. Reset to defaults
      mockChrome.storage.sync.set.mockImplementationOnce((_data, callback) => {
        callback();
      });

      const resetResult = await resetSettings();
      expect(resetResult).toEqual(DEFAULT_SETTINGS);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(DEFAULT_SETTINGS, expect.any(Function));
    });

    it('should handle settings validation edge cases', async () => {
      const { validateSettings } = await import('../src/utils/settingsManager');

      // Test multiple validation errors
      const invalidSettings = {
        defaultFormat: 'gif' as any,
        defaultQuality: 150,
        filenameTemplate: 'invalid/path\\name',
        autoDownload: 'yes' as any,
        highlightColor: 'invalid-color'
      };

      const validation = validateSettings(invalidSettings);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid format: must be png or jpeg');
      expect(validation.errors).toContain('Invalid quality: must be a number between 10 and 100');
      expect(validation.errors).toContain('Invalid filename template: cannot be empty or contain path separators');
      expect(validation.errors).toContain('Invalid autoDownload: must be boolean');
      expect(validation.errors).toContain('Invalid highlight color: must be a valid hex color');
    });

    it('should handle filename generation with all template variables', async () => {
      const { generateFilename } = await import('../src/utils/settingsManager');

      // Test all template variables
      const template = 'screenshot-{timestamp}-{date}-{time}';
      const filename = generateFilename(template, 'png');

      expect(filename).toMatch(/^screenshot-\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.png$/);
    });

    it('should handle import/export functionality', async () => {
      const { 
        exportSettings, 
        importSettings, 
        saveSettings,
        loadSettings 
      } = await import('../src/utils/settingsManager');

      const testSettings: UserSettings = {
        defaultFormat: 'jpeg',
        defaultQuality: 80,
        filenameTemplate: 'export-test-{timestamp}',
        autoDownload: true,
        showProgress: false,
        highlightColor: '#00ff00'
      };

      // Mock load for export
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback(testSettings);
      });

      // Export settings
      const exportedJson = await exportSettings();
      const exportedData = JSON.parse(exportedJson);
      expect(exportedData).toEqual(testSettings);

      // Import settings
      mockChrome.storage.sync.set.mockImplementationOnce((_data, callback) => {
        callback();
      });

      const importedSettings = await importSettings(exportedJson);
      expect(importedSettings).toEqual(testSettings);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(testSettings, expect.any(Function));
    });

    it('should handle import validation errors', async () => {
      const { importSettings } = await import('../src/utils/settingsManager');

      // Test invalid JSON
      await expect(importSettings('invalid json')).rejects.toThrow('Failed to import settings');

      // Test invalid settings data
      const invalidSettingsJson = JSON.stringify({
        defaultFormat: 'invalid',
        defaultQuality: 200
      });

      await expect(importSettings(invalidSettingsJson)).rejects.toThrow('Invalid settings');
    });

    it('should handle storage errors gracefully', async () => {
      const { loadSettings, saveSettings } = await import('../src/utils/settingsManager');

      // Test load error
      mockChrome.runtime.lastError = { message: 'Storage unavailable' };
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback({});
      });

      await expect(loadSettings()).rejects.toThrow('Storage unavailable');

      // Test save error
      mockChrome.runtime.lastError = { message: 'Storage full' };
      mockChrome.storage.sync.set.mockImplementationOnce((_data, callback) => {
        callback();
      });

      await expect(saveSettings({
        defaultFormat: 'png',
        defaultQuality: 90,
        filenameTemplate: 'test',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#007bff'
      })).rejects.toThrow('Storage full');
    });

    it('should handle settings change listeners', async () => {
      const { onSettingsChanged } = await import('../src/utils/settingsManager');

      const mockCallback = vi.fn();
      onSettingsChanged(mockCallback);

      expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalledWith(expect.any(Function));

      // Simulate settings change
      const addedListener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];
      const changes = {
        defaultFormat: { oldValue: 'png', newValue: 'jpeg' },
        defaultQuality: { oldValue: 90, newValue: 85 }
      };

      addedListener(changes, 'sync');
      expect(mockCallback).toHaveBeenCalledWith(changes);

      // Should not call callback for non-sync changes
      addedListener(changes, 'local');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle getSetting with various scenarios', async () => {
      const { getSetting, DEFAULT_SETTINGS } = await import('../src/utils/settingsManager');

      // Test successful get
      const testSettings = { ...DEFAULT_SETTINGS, defaultFormat: 'jpeg' as const };
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback(testSettings);
      });

      const format = await getSetting('defaultFormat');
      expect(format).toBe('jpeg');

      // Test with fallback
      mockChrome.runtime.lastError = { message: 'Storage error' };
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback({});
      });

      const formatWithFallback = await getSetting('defaultFormat', 'png');
      expect(formatWithFallback).toBe('png');

      // Test with default fallback
      mockChrome.runtime.lastError = null;
      mockChrome.storage.sync.get.mockImplementationOnce((_keys, callback) => {
        callback({});
      });

      const qualityDefault = await getSetting('defaultQuality');
      expect(qualityDefault).toBe(DEFAULT_SETTINGS.defaultQuality);
    });
  });

  describe('Settings Persistence', () => {
    it('should maintain settings consistency across operations', async () => {
      const { 
        saveSettings, 
        loadSettings, 
        updateSettings 
      } = await import('../src/utils/settingsManager');

      let storedData: any = {};

      // Mock storage to actually store data
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        storedData = { ...storedData, ...data };
        callback();
      });

      mockChrome.storage.sync.get.mockImplementation((_keys, callback) => {
        callback(storedData);
      });

      // Initial save
      const settings1: UserSettings = {
        defaultFormat: 'png',
        defaultQuality: 90,
        filenameTemplate: 'test1-{timestamp}',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#007bff'
      };

      await saveSettings(settings1);
      const loaded1 = await loadSettings();
      expect(loaded1).toEqual(settings1);

      // Update settings
      const updates = { defaultFormat: 'jpeg' as const, defaultQuality: 85 };
      const updated = await updateSettings(updates);
      expect(updated).toEqual({ ...settings1, ...updates });

      // Verify persistence
      const loaded2 = await loadSettings();
      expect(loaded2).toEqual({ ...settings1, ...updates });
    });
  });
});