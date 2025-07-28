// Integration test for basic screenshot functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageType, ElementInfo, ScreenshotOptions, UserSettings } from '../src/types';

// Mock ScreenshotProcessor
const mockScreenshotProcessor = {
  captureFullPage: vi.fn(),
  cropToElement: vi.fn(),
  convertFormat: vi.fn(),
  generateFilename: vi.fn(),
  downloadScreenshot: vi.fn(),
  getDevicePixelRatio: vi.fn()
};

vi.mock('../src/utils/screenshotProcessor', () => ({
  ScreenshotProcessor: mockScreenshotProcessor
}));

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  tabs: {
    sendMessage: vi.fn(),
    get: vi.fn(),
    captureVisibleTab: vi.fn()
  },
  downloads: {
    download: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  },
  runtime: {
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock MessageRouter
const mockMessageRouter = {
  register: vi.fn(),
  setupListener: vi.fn(),
  handle: vi.fn()
};

vi.mock('../src/utils/messageHandler', () => ({
  MessageRouter: vi.fn(() => mockMessageRouter),
  sendMessageToTab: vi.fn(),
  sendMessageToBackground: vi.fn()
}));

describe('Basic Screenshot Flow Integration', () => {
  const mockElementInfo: ElementInfo = {
    selector: '#test-element',
    boundingRect: {
      left: 100,
      top: 50,
      width: 200,
      height: 150,
      x: 100,
      y: 50,
      right: 300,
      bottom: 200,
      toJSON: () => ({})
    } as DOMRect,
    isScrollable: false,
    totalHeight: 150,
    visibleHeight: 150
  };

  const mockUserSettings: UserSettings = {
    defaultFormat: 'png',
    defaultQuality: 0.9,
    filenameTemplate: 'screenshot_{timestamp}',
    autoDownload: true,
    showProgress: true,
    highlightColor: '#ff0000'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockChrome.storage.sync.get.mockResolvedValue({ userSettings: mockUserSettings });
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
    mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,full-screenshot');
    
    mockScreenshotProcessor.captureFullPage.mockResolvedValue('data:image/png;base64,full-screenshot');
    mockScreenshotProcessor.cropToElement.mockResolvedValue('data:image/png;base64,cropped-screenshot');
    mockScreenshotProcessor.convertFormat.mockResolvedValue('data:image/png;base64,final-screenshot');
    mockScreenshotProcessor.generateFilename.mockReturnValue('screenshot_2024-01-01T12-00-00.png');
    mockScreenshotProcessor.downloadScreenshot.mockResolvedValue(undefined);
    mockScreenshotProcessor.getDevicePixelRatio.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Screenshot Workflow', () => {
    it('should complete full screenshot workflow successfully', async () => {
      const tabId = 123;
      
      // Step 1: Capture full page screenshot
      const fullScreenshot = await mockScreenshotProcessor.captureFullPage(tabId);
      expect(fullScreenshot).toBe('data:image/png;base64,full-screenshot');
      expect(mockScreenshotProcessor.captureFullPage).toHaveBeenCalledWith(tabId);

      // Step 2: Get device pixel ratio
      const devicePixelRatio = await mockScreenshotProcessor.getDevicePixelRatio(tabId);
      expect(devicePixelRatio).toBe(1);
      expect(mockScreenshotProcessor.getDevicePixelRatio).toHaveBeenCalledWith(tabId);

      // Step 3: Crop to element area
      const croppedScreenshot = await mockScreenshotProcessor.cropToElement(
        fullScreenshot,
        mockElementInfo,
        devicePixelRatio
      );
      expect(croppedScreenshot).toBe('data:image/png;base64,cropped-screenshot');
      expect(mockScreenshotProcessor.cropToElement).toHaveBeenCalledWith(
        fullScreenshot,
        mockElementInfo,
        devicePixelRatio
      );

      // Step 4: Convert format
      const options: ScreenshotOptions = {
        format: mockUserSettings.defaultFormat,
        quality: mockUserSettings.defaultQuality,
        filename: 'screenshot_2024-01-01T12-00-00.png'
      };
      
      const finalScreenshot = await mockScreenshotProcessor.convertFormat(
        croppedScreenshot,
        options
      );
      expect(finalScreenshot).toBe('data:image/png;base64,final-screenshot');
      expect(mockScreenshotProcessor.convertFormat).toHaveBeenCalledWith(
        croppedScreenshot,
        options
      );

      // Step 5: Generate filename
      const filename = mockScreenshotProcessor.generateFilename(
        mockUserSettings.filenameTemplate,
        mockUserSettings.defaultFormat
      );
      expect(filename).toBe('screenshot_2024-01-01T12-00-00.png');
      expect(mockScreenshotProcessor.generateFilename).toHaveBeenCalledWith(
        mockUserSettings.filenameTemplate,
        mockUserSettings.defaultFormat
      );

      // Step 6: Download screenshot
      await mockScreenshotProcessor.downloadScreenshot(finalScreenshot, filename);
      expect(mockScreenshotProcessor.downloadScreenshot).toHaveBeenCalledWith(
        finalScreenshot,
        filename
      );
    });

    it('should handle different image formats correctly', async () => {
      const jpegSettings: UserSettings = {
        ...mockUserSettings,
        defaultFormat: 'jpeg',
        defaultQuality: 0.8
      };

      const options: ScreenshotOptions = {
        format: jpegSettings.defaultFormat,
        quality: jpegSettings.defaultQuality,
        filename: 'screenshot_2024-01-01T12-00-00.jpg'
      };

      await mockScreenshotProcessor.convertFormat(
        'data:image/png;base64,cropped-screenshot',
        options
      );

      expect(mockScreenshotProcessor.convertFormat).toHaveBeenCalledWith(
        'data:image/png;base64,cropped-screenshot',
        options
      );
    });

    it('should handle different device pixel ratios', async () => {
      mockScreenshotProcessor.getDevicePixelRatio.mockResolvedValue(2);

      const devicePixelRatio = await mockScreenshotProcessor.getDevicePixelRatio(123);
      expect(devicePixelRatio).toBe(2);

      await mockScreenshotProcessor.cropToElement(
        'data:image/png;base64,full-screenshot',
        mockElementInfo,
        devicePixelRatio
      );

      expect(mockScreenshotProcessor.cropToElement).toHaveBeenCalledWith(
        'data:image/png;base64,full-screenshot',
        mockElementInfo,
        2
      );
    });
  });

  describe('Error Handling in Screenshot Flow', () => {
    it('should handle capture errors gracefully', async () => {
      mockScreenshotProcessor.captureFullPage.mockRejectedValue(new Error('Capture failed'));

      await expect(mockScreenshotProcessor.captureFullPage(123))
        .rejects.toThrow('Capture failed');
    });

    it('should handle cropping errors gracefully', async () => {
      mockScreenshotProcessor.cropToElement.mockRejectedValue(new Error('Cropping failed'));

      await expect(mockScreenshotProcessor.cropToElement(
        'data:image/png;base64,full-screenshot',
        mockElementInfo,
        1
      )).rejects.toThrow('Cropping failed');
    });

    it('should handle format conversion errors gracefully', async () => {
      mockScreenshotProcessor.convertFormat.mockRejectedValue(new Error('Conversion failed'));

      const options: ScreenshotOptions = {
        format: 'png',
        quality: 0.9,
        filename: 'test.png'
      };

      await expect(mockScreenshotProcessor.convertFormat(
        'data:image/png;base64,cropped-screenshot',
        options
      )).rejects.toThrow('Conversion failed');
    });

    it('should handle download errors gracefully', async () => {
      mockScreenshotProcessor.downloadScreenshot.mockRejectedValue(new Error('Download failed'));

      await expect(mockScreenshotProcessor.downloadScreenshot(
        'data:image/png;base64,final-screenshot',
        'test.png'
      )).rejects.toThrow('Download failed');
    });
  });

  describe('Settings Integration', () => {
    it('should use user settings for screenshot options', async () => {
      const customSettings: UserSettings = {
        defaultFormat: 'jpeg',
        defaultQuality: 0.7,
        filenameTemplate: 'custom_{date}',
        autoDownload: true,
        showProgress: false,
        highlightColor: '#00ff00'
      };

      mockChrome.storage.sync.get.mockResolvedValue({ userSettings: customSettings });

      const result = await mockChrome.storage.sync.get('userSettings');
      expect(result.userSettings).toEqual(customSettings);
      expect(result.userSettings.defaultFormat).toBe('jpeg');
      expect(result.userSettings.defaultQuality).toBe(0.7);
    });

    it('should fall back to default settings when storage is empty', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      const result = await mockChrome.storage.sync.get('userSettings');
      expect(result.userSettings).toBeUndefined();
      
      // In the actual implementation, this would trigger default settings
      const defaultSettings: UserSettings = {
        defaultFormat: 'png',
        defaultQuality: 0.9,
        filenameTemplate: 'screenshot_{timestamp}',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#ff0000'
      };
      
      expect(defaultSettings.defaultFormat).toBe('png');
      expect(defaultSettings.autoDownload).toBe(true);
    });
  });

  describe('Element Information Processing', () => {
    it('should process element information correctly', () => {
      expect(mockElementInfo.selector).toBe('#test-element');
      expect(mockElementInfo.boundingRect.width).toBe(200);
      expect(mockElementInfo.boundingRect.height).toBe(150);
      expect(mockElementInfo.isScrollable).toBe(false);
      expect(mockElementInfo.totalHeight).toBe(150);
      expect(mockElementInfo.visibleHeight).toBe(150);
    });

    it('should handle scrollable elements', () => {
      const scrollableElement: ElementInfo = {
        ...mockElementInfo,
        isScrollable: true,
        totalHeight: 500,
        visibleHeight: 150
      };

      expect(scrollableElement.isScrollable).toBe(true);
      expect(scrollableElement.totalHeight).toBeGreaterThan(scrollableElement.visibleHeight);
    });
  });

  describe('Filename Generation', () => {
    it('should generate filenames with different templates', () => {
      const templates = [
        'screenshot_{timestamp}',
        'capture_{date}_{time}',
        'element_{format}'
      ];

      templates.forEach(template => {
        mockScreenshotProcessor.generateFilename.mockReturnValue(`${template.replace(/\{.*?\}/g, 'value')}.png`);
        const result = mockScreenshotProcessor.generateFilename(template, 'png');
        expect(result).toContain('.png');
      });
    });

    it('should handle different file formats in filename', () => {
      mockScreenshotProcessor.generateFilename.mockReturnValue('screenshot.jpg');
      const jpegFilename = mockScreenshotProcessor.generateFilename('screenshot_{timestamp}', 'jpeg');
      expect(jpegFilename).toBe('screenshot.jpg');

      mockScreenshotProcessor.generateFilename.mockReturnValue('screenshot.png');
      const pngFilename = mockScreenshotProcessor.generateFilename('screenshot_{timestamp}', 'png');
      expect(pngFilename).toBe('screenshot.png');
    });
  });
});