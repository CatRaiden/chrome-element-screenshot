import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserSettings } from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  runtime: {
    lastError: null
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Import the functions we want to test
import { 
  loadSettings, 
  saveSettings, 
  validateSettings, 
  generateFilename, 
  DEFAULT_SETTINGS,
  resetSettings,
  updateSettings,
  getSetting
} from '../src/utils/settingsManager';

describe('Settings Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSettings', () => {
    it('should load settings from chrome storage', async () => {
      const mockSettings = {
        defaultFormat: 'jpeg' as const,
        defaultQuality: 80,
        filenameTemplate: 'custom-{timestamp}',
        autoDownload: false,
        showProgress: true,
        highlightColor: '#ff0000'
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockSettings);
      });

      const settings = await loadSettings();
      expect(settings).toEqual(mockSettings);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(null, expect.any(Function));
    });

    it('should return default settings when storage is empty', async () => {
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should merge stored settings with defaults', async () => {
      const partialSettings = {
        defaultFormat: 'jpeg' as const,
        defaultQuality: 75
      };

      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(partialSettings);
      });

      const settings = await loadSettings();
      expect(settings).toEqual({
        ...DEFAULT_SETTINGS,
        ...partialSettings
      });
    });

    it('should reject when chrome storage fails', async () => {
      mockChrome.runtime.lastError = { message: 'Storage error' };
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(loadSettings()).rejects.toThrow('Storage error');
    });
  });

  describe('saveSettingsToStorage', () => {
    it('should save settings to chrome storage', async () => {
      const settings: UserSettings = {
        defaultFormat: 'png',
        defaultQuality: 95,
        filenameTemplate: 'test-{timestamp}',
        autoDownload: true,
        showProgress: false,
        highlightColor: '#00ff00'
      };

      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      await saveSettings(settings);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(settings, expect.any(Function));
    });

    it('should reject when chrome storage fails', async () => {
      const settings: UserSettings = DEFAULT_SETTINGS;
      
      mockChrome.runtime.lastError = { message: 'Save error' };
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      await expect(saveSettings(settings)).rejects.toThrow('Save error');
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const validSettings: UserSettings = {
        defaultFormat: 'png',
        defaultQuality: 85,
        filenameTemplate: 'screenshot-{timestamp}',
        autoDownload: true,
        showProgress: false,
        highlightColor: '#007bff'
      };

      const result = validateSettings(validSettings);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid format', () => {
      const invalidSettings = {
        defaultFormat: 'gif' as any
      };

      const result = validateSettings(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid format: must be png or jpeg');
    });

    it('should reject invalid quality', () => {
      const invalidSettings = {
        defaultQuality: 150
      };

      const result = validateSettings(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid quality: must be a number between 10 and 100');
    });

    it('should reject invalid filename template', () => {
      const invalidSettings = {
        filenameTemplate: 'file/name'
      };

      const result = validateSettings(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid filename template: cannot be empty or contain path separators');
    });

    it('should reject invalid color', () => {
      const invalidSettings = {
        highlightColor: 'blue'
      };

      const result = validateSettings(invalidSettings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid highlight color: must be a valid hex color');
    });
  });

  describe('Default Settings', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SETTINGS).toEqual({
        defaultFormat: 'png',
        defaultQuality: 90,
        filenameTemplate: 'screenshot-{timestamp}',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#007bff'
      });
    });

    it('should have valid default format', () => {
      expect(['png', 'jpeg']).toContain(DEFAULT_SETTINGS.defaultFormat);
    });

    it('should have valid default quality range', () => {
      expect(DEFAULT_SETTINGS.defaultQuality).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_SETTINGS.defaultQuality).toBeLessThanOrEqual(100);
    });

    it('should have valid default filename template', () => {
      expect(DEFAULT_SETTINGS.filenameTemplate).toBeTruthy();
      expect(DEFAULT_SETTINGS.filenameTemplate).not.toContain('/');
      expect(DEFAULT_SETTINGS.filenameTemplate).not.toContain('\\');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      const template = 'screenshot-{timestamp}';
      const format = 'png';
      const filename = generateFilename(template, format);
      
      expect(filename).toMatch(/^screenshot-\d+\.png$/);
    });

    it('should generate filename with date and time', () => {
      const template = 'capture-{date}-{time}';
      const format = 'jpeg';
      const filename = generateFilename(template, format);
      
      expect(filename).toMatch(/^capture-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.jpg$/);
    });

    it('should add extension if missing', () => {
      const template = 'screenshot';
      const format = 'png';
      const filename = generateFilename(template, format);
      
      expect(filename).toBe('screenshot.png');
    });

    it('should use jpg extension for jpeg format', () => {
      const template = 'image-{timestamp}';
      const format = 'jpeg';
      const filename = generateFilename(template, format);
      
      expect(filename).toMatch(/\.jpg$/);
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', async () => {
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await resetSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(DEFAULT_SETTINGS, expect.any(Function));
    });
  });

  describe('updateSettings', () => {
    it('should update partial settings', async () => {
      const currentSettings = { ...DEFAULT_SETTINGS };
      const updates = { defaultFormat: 'jpeg' as const, defaultQuality: 75 };

      // Mock load current settings
      mockChrome.storage.sync.get.mockImplementationOnce((keys, callback) => {
        callback(currentSettings);
      });

      // Mock save updated settings
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await updateSettings(updates);
      expect(result).toEqual({ ...DEFAULT_SETTINGS, ...updates });
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ ...currentSettings, ...updates }, expect.any(Function));
    });
  });

  describe('getSetting', () => {
    it('should get specific setting value', async () => {
      const settings = { ...DEFAULT_SETTINGS, defaultFormat: 'jpeg' as const };
      
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(settings);
      });

      const format = await getSetting('defaultFormat');
      expect(format).toBe('jpeg');
    });

    it('should return fallback on error', async () => {
      mockChrome.runtime.lastError = { message: 'Storage error' };
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const format = await getSetting('defaultFormat', 'png');
      expect(format).toBe('png');
    });
  });
});

describe('Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should handle complete save and load cycle', async () => {
    const testSettings: UserSettings = {
      defaultFormat: 'jpeg',
      defaultQuality: 85,
      filenameTemplate: 'test-{timestamp}',
      autoDownload: false,
      showProgress: true,
      highlightColor: '#ff5722'
    };

    // Mock save operation
    mockChrome.storage.sync.set.mockImplementation((data, callback) => {
      callback();
    });

    // Mock load operation to return saved data
    mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback(testSettings);
    });

    // Save settings
    await saveSettings(testSettings);
    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(testSettings, expect.any(Function));

    // Load settings
    const loadedSettings = await loadSettings();
    expect(loadedSettings).toEqual(testSettings);
  });

  it('should handle partial settings update', async () => {
    const initialSettings = { ...DEFAULT_SETTINGS };
    const partialUpdate = {
      defaultFormat: 'jpeg' as const,
      defaultQuality: 75
    };

    // First load returns defaults
    mockChrome.storage.sync.get.mockImplementationOnce((keys, callback) => {
      callback(initialSettings);
    });

    const initialLoaded = await loadSettings();
    expect(initialLoaded).toEqual(DEFAULT_SETTINGS);

    // Save partial update
    mockChrome.storage.sync.set.mockImplementation((data, callback) => {
      callback();
    });

    await saveSettings({ ...initialSettings, ...partialUpdate });

    // Load should return merged settings
    mockChrome.storage.sync.get.mockImplementationOnce((keys, callback) => {
      callback({ ...initialSettings, ...partialUpdate });
    });

    const updatedSettings = await loadSettings();
    expect(updatedSettings).toEqual({ ...DEFAULT_SETTINGS, ...partialUpdate });
  });
});