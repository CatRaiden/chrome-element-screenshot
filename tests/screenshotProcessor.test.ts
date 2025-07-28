// Tests for screenshot processing functionality

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';
import { ElementInfo, ScreenshotOptions } from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    captureVisibleTab: vi.fn(),
    get: vi.fn()
  },
  downloads: {
    download: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock Canvas and Image APIs
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(),
  toDataURL: vi.fn()
};

const mockContext = {
  drawImage: vi.fn(),
  fillStyle: '',
  fillRect: vi.fn()
};

const mockImage = {
  width: 800,
  height: 600,
  onload: null as any,
  onerror: null as any,
  src: ''
};

// Mock DOM APIs
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return {};
    })
  }
});

Object.defineProperty(global, 'Image', {
  value: vi.fn(() => mockImage)
});

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  }
});

Object.defineProperty(global, 'fetch', {
  value: vi.fn(() => Promise.resolve({
    blob: () => Promise.resolve(new Blob())
  }))
});

describe('ScreenshotProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,mock-data');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('captureFullPage', () => {
    it('should capture full page screenshot successfully', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      const mockTab = { windowId: 1 };
      
      mockChrome.tabs.get.mockResolvedValue(mockTab);
      mockChrome.tabs.captureVisibleTab.mockResolvedValue(mockDataUrl);

      const result = await ScreenshotProcessor.captureFullPage(123);

      expect(result).toBe(mockDataUrl);
      expect(mockChrome.tabs.get).toHaveBeenCalledWith(123);
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'png',
        quality: 100
      });
    });

    it('should throw error when capture fails', async () => {
      const mockTab = { windowId: 1 };
      mockChrome.tabs.get.mockResolvedValue(mockTab);
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Capture failed'));

      await expect(ScreenshotProcessor.captureFullPage(123))
        .rejects.toThrow('Screenshot capture failed: Capture failed');
    });

    it('should throw error when no data URL returned', async () => {
      const mockTab = { windowId: 1 };
      mockChrome.tabs.get.mockResolvedValue(mockTab);
      mockChrome.tabs.captureVisibleTab.mockResolvedValue(null);

      await expect(ScreenshotProcessor.captureFullPage(123))
        .rejects.toThrow('Screenshot capture failed: Failed to capture screenshot');
    });
  });

  describe('cropToElement', () => {
    const mockElementInfo: ElementInfo = {
      selector: '#test',
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

    it('should crop screenshot to element area', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      
      // Mock image loading
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      const result = await ScreenshotProcessor.cropToElement(mockDataUrl, mockElementInfo, 1);

      expect(result).toBe('data:image/png;base64,mock-data');
      expect(mockCanvas.width).toBe(200);
      expect(mockCanvas.height).toBe(150);
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('should handle device pixel ratio scaling', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      const devicePixelRatio = 2;
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      await ScreenshotProcessor.cropToElement(mockDataUrl, mockElementInfo, devicePixelRatio);

      expect(mockCanvas.width).toBe(400); // 200 * 2
      expect(mockCanvas.height).toBe(300); // 150 * 2
    });

    it('should throw error when canvas context is not available', async () => {
      mockCanvas.getContext.mockReturnValue(null);

      await expect(ScreenshotProcessor.cropToElement('data:image/png;base64,test', mockElementInfo))
        .rejects.toThrow('Screenshot cropping failed: Failed to get canvas context');
    });
  });

  describe('convertFormat', () => {
    const mockOptions: ScreenshotOptions = {
      format: 'jpeg',
      quality: 0.8,
      filename: 'test.jpg'
    };

    it('should convert PNG to JPEG with white background', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      const result = await ScreenshotProcessor.convertFormat(mockDataUrl, mockOptions);

      expect(result).toBe('data:image/png;base64,mock-data');
      expect(mockContext.fillStyle).toBe('#FFFFFF');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    });

    it('should convert to PNG without background fill', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      const pngOptions = { ...mockOptions, format: 'png' as const };
      
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      await ScreenshotProcessor.convertFormat(mockDataUrl, pngOptions);

      expect(mockContext.fillRect).not.toHaveBeenCalled();
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png', 0.8);
    });

    it('should handle image loading errors', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror();
        }
      }, 0);

      await expect(ScreenshotProcessor.convertFormat(mockDataUrl, mockOptions))
        .rejects.toThrow('Format conversion failed: Failed to load image for format conversion');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      const template = 'screenshot_{timestamp}';
      const result = ScreenshotProcessor.generateFilename(template, 'png');

      expect(result).toMatch(/^screenshot_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
    });

    it('should generate filename with date and time', () => {
      const template = 'img_{date}_{time}';
      const result = ScreenshotProcessor.generateFilename(template, 'jpeg');

      expect(result).toMatch(/^img_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpg$/);
    });

    it('should add extension if not present', () => {
      const template = 'screenshot';
      const result = ScreenshotProcessor.generateFilename(template, 'png');

      expect(result).toBe('screenshot.png');
    });

    it('should use jpg extension for jpeg format', () => {
      const template = 'screenshot_{timestamp}';
      const result = ScreenshotProcessor.generateFilename(template, 'jpeg');

      expect(result).toMatch(/\.jpg$/);
    });
  });

  describe('downloadScreenshot', () => {
    it('should download screenshot successfully', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      const filename = 'test-screenshot.png';
      
      mockChrome.downloads.download.mockResolvedValue(undefined);

      await ScreenshotProcessor.downloadScreenshot(mockDataUrl, filename);

      expect(global.fetch).toHaveBeenCalledWith(mockDataUrl);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: 'blob:mock-url',
        filename: filename,
        saveAs: false
      });
    });

    it('should handle download errors', async () => {
      const mockDataUrl = 'data:image/png;base64,test-data';
      const filename = 'test-screenshot.png';
      
      mockChrome.downloads.download.mockRejectedValue(new Error('Download failed'));

      await expect(ScreenshotProcessor.downloadScreenshot(mockDataUrl, filename))
        .rejects.toThrow('Download failed: Download failed');
    });
  });

  describe('getDevicePixelRatio', () => {
    it('should get device pixel ratio from tab', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([{ result: 2 }]);

      const result = await ScreenshotProcessor.getDevicePixelRatio(123);

      expect(result).toBe(2);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function)
      });
    });

    it('should return default ratio when script execution fails', async () => {
      mockChrome.scripting.executeScript.mockRejectedValue(new Error('Script failed'));

      const result = await ScreenshotProcessor.getDevicePixelRatio(123);

      expect(result).toBe(1);
    });

    it('should return default ratio when no result', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([]);

      const result = await ScreenshotProcessor.getDevicePixelRatio(123);

      expect(result).toBe(1);
    });
  });
});