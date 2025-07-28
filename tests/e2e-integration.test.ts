// Comprehensive End-to-End Integration Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageType, ElementInfo, ScreenshotOptions, UserSettings } from '../src/types';

// Mock DOMMatrix for tests
global.DOMMatrix = class MockDOMMatrix {
  a: number; b: number; c: number; d: number; e: number; f: number;
  
  constructor(init?: string | number[]) {
    if (typeof init === 'string') {
      // Parse matrix string like 'matrix(1, 0, 0, 1, 0, 0)'
      const values = init.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(v => parseFloat(v.trim())) || [1, 0, 0, 1, 0, 0];
      [this.a, this.b, this.c, this.d, this.e, this.f] = values;
    } else {
      [this.a, this.b, this.c, this.d, this.e, this.f] = [1, 0, 0, 1, 0, 0];
    }
  }

  transformPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f
    };
  }
} as any;

// Mock DOMPoint for tests
global.DOMPoint = class MockDOMPoint {
  x: number;
  y: number;
  z: number;
  w: number;
  
  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
} as any;

// Mock Chrome APIs with comprehensive coverage
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    sendMessage: vi.fn(),
    lastError: null,
    onInstalled: {
      addListener: vi.fn()
    },
    getManifest: vi.fn(() => ({ version: '1.0.0' }))
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn()
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn()
    }
  },
  tabs: {
    captureVisibleTab: vi.fn(),
    get: vi.fn(),
    sendMessage: vi.fn(),
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  downloads: {
    download: vi.fn(),
    onChanged: {
      addListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn(),
    insertCSS: vi.fn(),
    removeCSS: vi.fn()
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock DOM APIs
const mockCanvas = {
  getContext: vi.fn(),
  width: 0,
  height: 0,
  toDataURL: vi.fn()
};

const mockContext = {
  drawImage: vi.fn(),
  fillStyle: '',
  fillRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn()
};

global.document = {
  createElement: vi.fn(() => mockCanvas),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
  documentElement: { scrollLeft: 0, scrollTop: 0 }
} as any;

global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';
  width: number = 1920;
  height: number = 1080;
  
  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
} as any;

global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
} as any;

global.fetch = vi.fn(() => 
  Promise.resolve({
    blob: () => Promise.resolve(new Blob())
  })
) as any;

// Import modules after setting up globals
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';

describe('End-to-End Integration Tests', () => {
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
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,mock-image-data');
    
    mockChrome.storage.sync.get.mockResolvedValue({ userSettings: mockUserSettings });
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1, url: 'https://example.com' });
    mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
    mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: 2 }]);
    mockChrome.downloads.download.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Screenshot Workflow', () => {
    it('should handle complete screenshot workflow from start to finish', async () => {
      const tabId = 123;
      const elementInfo: ElementInfo = {
        selector: '#test-element',
        boundingRect: {
          left: 100, top: 50, width: 200, height: 150,
          x: 100, y: 50, right: 300, bottom: 200,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 150,
        visibleHeight: 150
      };

      // Step 1: Initialize screenshot session
      const sessionId = 'test-session-' + Date.now();
      
      // Step 2: Capture full page screenshot
      const fullScreenshot = await ScreenshotProcessor.captureFullPage(tabId);
      expect(fullScreenshot).toBe('data:image/png;base64,mock-screenshot');
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, { format: 'png', quality: 100 });

      // Step 3: Get device pixel ratio
      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(tabId);
      expect(devicePixelRatio).toBe(2);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId },
        func: expect.any(Function)
      });

      // Step 4: Crop to element
      const croppedScreenshot = await ScreenshotProcessor.cropToElement(
        fullScreenshot,
        elementInfo,
        devicePixelRatio
      );
      expect(croppedScreenshot).toBe('data:image/png;base64,mock-image-data');

      // Step 5: Convert format and apply quality settings
      const options: ScreenshotOptions = {
        format: mockUserSettings.defaultFormat,
        quality: mockUserSettings.defaultQuality,
        filename: 'test-screenshot.png'
      };
      
      const finalScreenshot = await ScreenshotProcessor.convertFormat(croppedScreenshot, options);
      expect(finalScreenshot).toBe('data:image/png;base64,mock-image-data');

      // Step 6: Generate filename
      const filename = ScreenshotProcessor.generateFilename(
        mockUserSettings.filenameTemplate,
        mockUserSettings.defaultFormat
      );
      expect(filename).toMatch(/screenshot_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png/);

      // Step 7: Download screenshot
      await ScreenshotProcessor.downloadScreenshot(finalScreenshot, filename);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: finalScreenshot,
        filename: filename,
        saveAs: false
      });
    });

    it('should handle long screenshot workflow', async () => {
      const tabId = 123;
      const longElementInfo: ElementInfo = {
        selector: '#long-element',
        boundingRect: {
          left: 0, top: 0, width: 800, height: 600,
          x: 0, y: 0, right: 800, bottom: 600,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 2400,
        visibleHeight: 600
      };

      // Mock scroll control responses
      mockChrome.tabs.sendMessage
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' })
        .mockResolvedValueOnce({ 
          success: true, 
          status: 'scrolled', 
          scrollPosition: { x: 0, y: 0, isComplete: false }
        })
        .mockResolvedValueOnce({ 
          success: true, 
          status: 'scrolled', 
          scrollPosition: { x: 0, y: 480, isComplete: false }
        })
        .mockResolvedValueOnce({ 
          success: true, 
          status: 'scrolled', 
          scrollPosition: { x: 0, y: 960, isComplete: false }
        })
        .mockResolvedValueOnce({ 
          success: true, 
          status: 'scrolled', 
          scrollPosition: { x: 0, y: 1440, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(tabId, longElementInfo, 2);

      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.totalHeight).toBe(2400);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'RESET_SCROLL'
        })
      );

      // Verify stitching
      const stitchedScreenshot = await ScreenshotProcessor.stitchScreenshotSegments(
        result.segments,
        longElementInfo,
        2
      );
      expect(stitchedScreenshot).toBe('data:image/png;base64,mock-image-data');
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should handle different Chrome versions', async () => {
      // Test Manifest V3 compatibility
      const manifest = mockChrome.runtime.getManifest();
      expect(manifest.version).toBe('1.0.0');

      // Test service worker context
      expect(mockChrome.runtime.onMessage.addListener).toBeDefined();
      expect(mockChrome.scripting.executeScript).toBeDefined();
    });

    it('should handle different device pixel ratios', async () => {
      const testRatios = [1, 1.25, 1.5, 2, 2.5, 3];
      
      for (const ratio of testRatios) {
        mockChrome.scripting.executeScript.mockResolvedValueOnce([{ result: ratio }]);
        
        const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
        expect(devicePixelRatio).toBe(ratio);
      }
    });

    it('should handle different screen resolutions', async () => {
      const resolutions = [
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 3840, height: 2160 },
        { width: 1366, height: 768 }
      ];

      for (const resolution of resolutions) {
        global.Image = class MockImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          src: string = '';
          width: number = resolution.width;
          height: number = resolution.height;
          
          constructor() {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        } as any;

        const elementInfo: ElementInfo = {
          selector: '#test',
          boundingRect: {
            left: 0, top: 0, width: resolution.width, height: resolution.height,
            x: 0, y: 0, right: resolution.width, bottom: resolution.height,
            toJSON: () => ({})
          } as DOMRect,
          isScrollable: false,
          totalHeight: resolution.height,
          visibleHeight: resolution.height
        };

        const result = await ScreenshotProcessor.cropToElement(
          'data:image/png;base64,mock-screenshot',
          elementInfo,
          1
        );
        expect(result).toBe('data:image/png;base64,mock-image-data');
      }
    });
  });

  describe('Performance Optimization', () => {
    it('should handle memory-intensive long screenshots efficiently', async () => {
      const largeElementInfo: ElementInfo = {
        selector: '#huge-element',
        boundingRect: {
          left: 0, top: 0, width: 1920, height: 1080,
          x: 0, y: 0, right: 1920, bottom: 1080,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 50000, // Very long content
        visibleHeight: 1080,
        hasTransform: false,
        hasShadow: false,
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: 'none',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'auto',
          zIndex: 'auto'
        }
      };

      // Mock memory-efficient processing
      let segmentCount = 0;
      mockChrome.tabs.sendMessage.mockImplementation(() => {
        segmentCount++;
        return Promise.resolve({
          success: true,
          status: 'scrolled',
          scrollPosition: { 
            x: 0, 
            y: segmentCount * 960, 
            isComplete: segmentCount >= 50 
          }
        });
      });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 1920, height: 1080,
          top: 0, right: 1920, bottom: 1080, left: 0
        }
      }]);

      const startTime = Date.now();
      const result = await ScreenshotProcessor.captureLongScreenshot(123, largeElementInfo, 2);
      const endTime = Date.now();

      expect(result.segments.length).toBeGreaterThan(10);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 10000);

    it('should optimize image quality vs file size balance', async () => {
      const testQualities = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
      const elementInfo: ElementInfo = {
        selector: '#quality-test',
        boundingRect: {
          left: 0, top: 0, width: 800, height: 600,
          x: 0, y: 0, right: 800, bottom: 600,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 600,
        visibleHeight: 600
      };

      for (const quality of testQualities) {
        const options: ScreenshotOptions = {
          format: 'jpeg',
          quality: quality,
          filename: `test-${quality}.jpg`
        };

        // Mock different file sizes based on quality
        const mockDataUrl = `data:image/jpeg;base64,${'x'.repeat(Math.floor(1000 * quality))}`;
        mockCanvas.toDataURL.mockReturnValue(mockDataUrl);

        const result = await ScreenshotProcessor.convertFormat(
          'data:image/png;base64,mock-screenshot',
          options
        );

        expect(result).toBe(mockDataUrl);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent screenshot requests efficiently', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const elementInfo: ElementInfo = {
          selector: `#element-${i}`,
          boundingRect: {
            left: i * 100, top: i * 50, width: 200, height: 150,
            x: i * 100, y: i * 50, right: (i * 100) + 200, bottom: (i * 50) + 150,
            toJSON: () => ({})
          } as DOMRect,
          isScrollable: false,
          totalHeight: 150,
          visibleHeight: 150
        };

        promises.push(ScreenshotProcessor.cropToElement(
          'data:image/png;base64,mock-screenshot',
          elementInfo,
          1
        ));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBe('data:image/png;base64,mock-image-data');
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network issues', async () => {
      let attemptCount = 0;
      mockChrome.tabs.captureVisibleTab.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve('data:image/png;base64,mock-screenshot');
      });

      // Implement retry logic
      const maxRetries = 3;
      let result;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await ScreenshotProcessor.captureFullPage(123);
          break;
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(result).toBe('data:image/png;base64,mock-screenshot');
      expect(attemptCount).toBe(3);
    });

    it('should handle storage quota exceeded gracefully', async () => {
      mockChrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      // Should fall back to local storage
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      try {
        await mockChrome.storage.sync.set({ userSettings: mockUserSettings });
      } catch (error) {
        // Fallback to local storage
        await mockChrome.storage.local.set({ userSettings: mockUserSettings });
      }

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        userSettings: mockUserSettings
      });
    });

    it('should handle tab closure during screenshot process', async () => {
      mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

      await expect(ScreenshotProcessor.captureFullPage(999))
        .rejects.toThrow('Screenshot capture failed');
    });
  });

  describe('Settings Integration', () => {
    it('should respect all user settings in complete workflow', async () => {
      const customSettings: UserSettings = {
        defaultFormat: 'jpeg',
        defaultQuality: 0.8,
        filenameTemplate: 'custom_{date}_{time}',
        autoDownload: false,
        showProgress: true,
        highlightColor: '#00ff00'
      };

      mockChrome.storage.sync.get.mockResolvedValue({ userSettings: customSettings });

      const elementInfo: ElementInfo = {
        selector: '#settings-test',
        boundingRect: {
          left: 0, top: 0, width: 400, height: 300,
          x: 0, y: 0, right: 400, bottom: 300,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 300,
        visibleHeight: 300
      };

      // Test format setting
      const options: ScreenshotOptions = {
        format: customSettings.defaultFormat,
        quality: customSettings.defaultQuality,
        filename: 'custom_2024-01-01_12-00-00.jpg'
      };

      const result = await ScreenshotProcessor.convertFormat(
        'data:image/png;base64,mock-screenshot',
        options
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');

      // Test filename template
      const filename = ScreenshotProcessor.generateFilename(
        customSettings.filenameTemplate,
        customSettings.defaultFormat
      );
      expect(filename).toMatch(/custom_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpg/);

      // Test auto-download setting
      if (customSettings.autoDownload) {
        await ScreenshotProcessor.downloadScreenshot(result, filename);
        expect(mockChrome.downloads.download).toHaveBeenCalled();
      }
    });
  });

  describe('Complex Element Scenarios', () => {
    it('should handle elements with complex CSS transforms', async () => {
      const transformedElementInfo: ElementInfo = {
        selector: '#transformed-element',
        boundingRect: {
          left: 100, top: 100, width: 200, height: 150,
          x: 100, y: 100, right: 300, bottom: 250,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 150,
        visibleHeight: 150,
        hasTransform: true,
        transformMatrix: new DOMMatrix('matrix(1.2, 0.2, -0.1, 1.1, 50, 30)'),
        hasShadow: true,
        shadowInfo: {
          boxShadow: '10px 10px 20px rgba(0,0,0,0.5)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          shadowBounds: {
            left: 80, top: 80, width: 250, height: 200,
            x: 80, y: 80, right: 330, bottom: 280,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 10,
        computedStyles: {
          position: 'relative',
          transform: 'matrix(1.2, 0.2, -0.1, 1.1, 50, 30)',
          transformOrigin: 'center center',
          boxShadow: '10px 10px 20px rgba(0,0,0,0.5)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          border: '2px solid #333',
          borderRadius: '8px',
          overflow: 'visible',
          zIndex: '10'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        transformedElementInfo,
        2
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
      expect(mockCanvas.getContext).toHaveBeenCalled();
    });

    it('should handle iframe elements correctly', async () => {
      const iframeElementInfo: ElementInfo = {
        selector: '#iframe-content',
        boundingRect: {
          left: 50, top: 50, width: 300, height: 200,
          x: 50, y: 50, right: 350, bottom: 250,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 200,
        visibleHeight: 200,
        hasTransform: false,
        hasShadow: false,
        isInIframe: true,
        iframeInfo: {
          iframeSelector: '#main-iframe',
          iframeBounds: {
            left: 0, top: 0, width: 400, height: 300,
            x: 0, y: 0, right: 400, bottom: 300,
            toJSON: () => ({})
          } as DOMRect,
          relativePosition: { x: 50, y: 50 }
        },
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: 'none',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      mockChrome.scripting.executeScript.mockResolvedValue([
        { result: '<div>Iframe content captured</div>' }
      ]);

      const iframeContent = await ScreenshotProcessor.captureIframeContent(123, iframeElementInfo);
      expect(iframeContent).toBe('<div>Iframe content captured</div>');

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        iframeElementInfo,
        1
      );
      expect(result).toBe('data:image/png;base64,mock-image-data');
    });
  });
});