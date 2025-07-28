// Verification test for Task 4: Basic Screenshot Functionality
// This test verifies that all components of the basic screenshot functionality work together

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';
import { ElementInfo, ScreenshotOptions, UserSettings } from '../src/types';

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
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
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

describe('Task 4: Basic Screenshot Functionality Verification', () => {
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

  const mockOptions: ScreenshotOptions = {
    format: 'png',
    quality: 0.9,
    filename: 'test-screenshot.png'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup successful mock responses
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
    mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,full-screenshot-data');
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: 1 }]);
    mockChrome.downloads.download.mockResolvedValue(undefined);
    
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,processed-screenshot-data');
    
    // Mock successful image loading
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload();
      }
    }, 0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Chrome tabs API Screenshot Capture', () => {
    it('should successfully capture full page screenshot using Chrome tabs API', async () => {
      const tabId = 123;
      
      const result = await ScreenshotProcessor.captureFullPage(tabId);
      
      expect(result).toBe('data:image/png;base64,full-screenshot-data');
      expect(mockChrome.tabs.get).toHaveBeenCalledWith(tabId);
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'png',
        quality: 100
      });
    });

    it('should handle capture failures gracefully', async () => {
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Permission denied'));
      
      await expect(ScreenshotProcessor.captureFullPage(123))
        .rejects.toThrow('Screenshot capture failed: Permission denied');
    });
  });

  describe('2. Element Area Cropping Logic', () => {
    it('should crop screenshot to specific element area', async () => {
      const fullScreenshot = 'data:image/png;base64,full-screenshot-data';
      
      const result = await ScreenshotProcessor.cropToElement(
        fullScreenshot,
        mockElementInfo,
        1
      );
      
      expect(result).toBe('data:image/png;base64,processed-screenshot-data');
      expect(mockCanvas.width).toBe(200); // Element width
      expect(mockCanvas.height).toBe(150); // Element height
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('should handle device pixel ratio scaling correctly', async () => {
      const devicePixelRatio = 2;
      
      await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,full-screenshot-data',
        mockElementInfo,
        devicePixelRatio
      );
      
      expect(mockCanvas.width).toBe(400); // 200 * 2
      expect(mockCanvas.height).toBe(300); // 150 * 2
    });

    it('should adjust crop area to stay within image bounds', async () => {
      const largeElementInfo: ElementInfo = {
        ...mockElementInfo,
        boundingRect: {
          ...mockElementInfo.boundingRect,
          left: 700, // Beyond image width
          top: 500,  // Beyond image height
          width: 200,
          height: 200
        } as DOMRect
      };
      
      // Should not throw error and should adjust bounds
      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,full-screenshot-data',
        largeElementInfo,
        1
      );
      
      expect(result).toBe('data:image/png;base64,processed-screenshot-data');
    });
  });

  describe('3. Screenshot Data Processing and Transformation', () => {
    it('should convert PNG to JPEG with white background', async () => {
      const jpegOptions: ScreenshotOptions = {
        format: 'jpeg',
        quality: 0.8,
        filename: 'test.jpg'
      };
      
      const result = await ScreenshotProcessor.convertFormat(
        'data:image/png;base64,source-data',
        jpegOptions
      );
      
      expect(result).toBe('data:image/png;base64,processed-screenshot-data');
      expect(mockContext.fillStyle).toBe('#FFFFFF');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    });

    it('should maintain PNG transparency without background fill', async () => {
      const pngOptions: ScreenshotOptions = {
        format: 'png',
        quality: 1.0,
        filename: 'test.png'
      };
      
      await ScreenshotProcessor.convertFormat(
        'data:image/png;base64,source-data',
        pngOptions
      );
      
      expect(mockContext.fillRect).not.toHaveBeenCalled();
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png', 1.0);
    });

    it('should handle different quality settings', async () => {
      const lowQualityOptions: ScreenshotOptions = {
        format: 'jpeg',
        quality: 0.5,
        filename: 'low-quality.jpg'
      };
      
      await ScreenshotProcessor.convertFormat(
        'data:image/png;base64,source-data',
        lowQualityOptions
      );
      
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.5);
    });
  });

  describe('4. Automatic File Download', () => {
    it('should download screenshot file automatically', async () => {
      const dataUrl = 'data:image/png;base64,screenshot-data';
      const filename = 'test-screenshot.png';
      
      await ScreenshotProcessor.downloadScreenshot(dataUrl, filename);
      
      expect(global.fetch).toHaveBeenCalledWith(dataUrl);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: 'blob:mock-url',
        filename: filename,
        saveAs: false
      });
    });

    it('should clean up object URLs after download', async () => {
      await ScreenshotProcessor.downloadScreenshot(
        'data:image/png;base64,screenshot-data',
        'test.png'
      );
      
      // Verify URL.revokeObjectURL is called after timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should handle download failures', async () => {
      mockChrome.downloads.download.mockRejectedValue(new Error('Download blocked'));
      
      await expect(ScreenshotProcessor.downloadScreenshot(
        'data:image/png;base64,screenshot-data',
        'test.png'
      )).rejects.toThrow('Download failed: Download blocked');
    });
  });

  describe('5. Complete Screenshot Workflow Integration', () => {
    it('should execute complete screenshot workflow successfully', async () => {
      const tabId = 123;
      
      // Step 1: Capture full page
      const fullScreenshot = await ScreenshotProcessor.captureFullPage(tabId);
      expect(fullScreenshot).toBe('data:image/png;base64,full-screenshot-data');
      
      // Step 2: Get device pixel ratio
      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(tabId);
      expect(devicePixelRatio).toBe(1);
      
      // Step 3: Crop to element
      const croppedScreenshot = await ScreenshotProcessor.cropToElement(
        fullScreenshot,
        mockElementInfo,
        devicePixelRatio
      );
      expect(croppedScreenshot).toBe('data:image/png;base64,processed-screenshot-data');
      
      // Step 4: Convert format
      const finalScreenshot = await ScreenshotProcessor.convertFormat(
        croppedScreenshot,
        mockOptions
      );
      expect(finalScreenshot).toBe('data:image/png;base64,processed-screenshot-data');
      
      // Step 5: Generate filename
      const filename = ScreenshotProcessor.generateFilename('screenshot_{timestamp}', 'png');
      expect(filename).toMatch(/^screenshot_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
      
      // Step 6: Download
      await ScreenshotProcessor.downloadScreenshot(finalScreenshot, filename);
      expect(mockChrome.downloads.download).toHaveBeenCalled();
    });

    it('should handle workflow errors at any step', async () => {
      // Test error in capture step
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Capture failed'));
      await expect(ScreenshotProcessor.captureFullPage(123))
        .rejects.toThrow('Screenshot capture failed: Capture failed');
      
      // Reset and test error in crop step
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,test');
      mockCanvas.getContext.mockReturnValue(null);
      await expect(ScreenshotProcessor.cropToElement('data:image/png;base64,test', mockElementInfo))
        .rejects.toThrow('Screenshot cropping failed: Failed to get canvas context');
    });
  });

  describe('6. Filename Generation', () => {
    it('should generate filenames with timestamp', () => {
      const filename = ScreenshotProcessor.generateFilename('screenshot_{timestamp}', 'png');
      expect(filename).toMatch(/^screenshot_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
    });

    it('should generate filenames with date and time separately', () => {
      const filename = ScreenshotProcessor.generateFilename('img_{date}_{time}', 'jpeg');
      expect(filename).toMatch(/^img_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpg$/);
    });

    it('should add correct file extensions', () => {
      const pngFile = ScreenshotProcessor.generateFilename('test', 'png');
      const jpegFile = ScreenshotProcessor.generateFilename('test', 'jpeg');
      
      expect(pngFile).toBe('test.png');
      expect(jpegFile).toBe('test.jpg');
    });
  });

  describe('7. Device Pixel Ratio Handling', () => {
    it('should get device pixel ratio from tab', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([{ result: 2 }]);
      
      const ratio = await ScreenshotProcessor.getDevicePixelRatio(123);
      
      expect(ratio).toBe(2);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function)
      });
    });

    it('should fallback to default ratio on error', async () => {
      mockChrome.scripting.executeScript.mockRejectedValue(new Error('Script failed'));
      
      const ratio = await ScreenshotProcessor.getDevicePixelRatio(123);
      
      expect(ratio).toBe(1);
    });
  });
});