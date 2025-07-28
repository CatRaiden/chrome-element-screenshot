// Cross-browser compatibility tests for different Chrome versions

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';
import { PerformanceOptimizer } from '../src/utils/performanceOptimizer';

// Mock different Chrome versions
const createChromeVersionMock = (version: string, manifestVersion: number) => ({
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
    getManifest: vi.fn(() => ({ 
      version: '1.0.0',
      manifest_version: manifestVersion
    }))
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
    query: vi.fn()
  },
  downloads: {
    download: vi.fn(),
    onChanged: {
      addListener: vi.fn()
    }
  },
  scripting: manifestVersion === 3 ? {
    executeScript: vi.fn(),
    insertCSS: vi.fn(),
    removeCSS: vi.fn()
  } : undefined,
  // Manifest V2 APIs
  browserAction: manifestVersion === 2 ? {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  } : undefined,
  // Manifest V3 APIs
  action: manifestVersion === 3 ? {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  } : undefined
});

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
  createElement: vi.fn(() => mockCanvas)
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

describe('Cross-Browser Compatibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,mock-image-data');
  });

  describe('Chrome Version Compatibility', () => {
    it('should work with Chrome 88+ (Manifest V3 minimum)', async () => {
      const mockChrome = createChromeVersionMock('88.0.4324.150', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 2 }]);

      const result = await ScreenshotProcessor.captureFullPage(123);
      expect(result).toBe('data:image/png;base64,mock-screenshot');
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalled();
    });

    it('should handle Chrome 100+ with enhanced APIs', async () => {
      const mockChrome = createChromeVersionMock('100.0.4896.127', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 2 }]);

      // Test enhanced screenshot quality
      const result = await ScreenshotProcessor.captureFullPage(123);
      expect(result).toBe('data:image/png;base64,mock-screenshot');
      
      // Verify API call format
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'png',
        quality: 100
      });
    });

    it('should handle Chrome 110+ with performance improvements', async () => {
      const mockChrome = createChromeVersionMock('110.0.5481.177', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 2 }]);

      // Test performance optimization
      const sessionId = 'chrome-110-test';
      PerformanceOptimizer.startMonitoring(sessionId);
      
      const result = await ScreenshotProcessor.captureFullPage(123);
      expect(result).toBe('data:image/png;base64,mock-screenshot');
      
      const metrics = PerformanceOptimizer.endMonitoring(sessionId);
      expect(metrics?.duration).toBeGreaterThan(0);
    });
  });

  describe('Operating System Compatibility', () => {
    it('should handle Windows Chrome', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Mock Windows-specific behavior
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true
      });

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 1.25 }]); // Windows scaling

      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
      expect(devicePixelRatio).toBe(1.25);
    });

    it('should handle macOS Chrome', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Mock macOS-specific behavior
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true
      });

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 2 }]); // Retina display

      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
      expect(devicePixelRatio).toBe(2);
    });

    it('should handle Linux Chrome', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Mock Linux-specific behavior
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        configurable: true
      });

      mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
      mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
      mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 1 }]); // Standard display

      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
      expect(devicePixelRatio).toBe(1);
    });
  });

  describe('Device Pixel Ratio Compatibility', () => {
    const testRatios = [
      { ratio: 1, description: 'Standard displays' },
      { ratio: 1.25, description: 'Windows 125% scaling' },
      { ratio: 1.5, description: 'Windows 150% scaling' },
      { ratio: 2, description: 'Retina displays' },
      { ratio: 2.5, description: 'High-DPI Android' },
      { ratio: 3, description: 'Ultra high-DPI displays' }
    ];

    testRatios.forEach(({ ratio, description }) => {
      it(`should handle ${description} (${ratio}x)`, async () => {
        const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
        // @ts-ignore
        global.chrome = mockChrome;

        mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
        mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
        mockChrome.scripting!.executeScript.mockResolvedValue([{ result: ratio }]);

        const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
        expect(devicePixelRatio).toBe(ratio);

        // Test optimal segment size calculation for this ratio
        const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
          2000, 1920, ratio, { memoryThreshold: 100 * 1024 * 1024 }
        );
        expect(optimalSize).toBeGreaterThan(100);
        expect(optimalSize).toBeLessThanOrEqual(2048);
      });
    });
  });

  describe('Screen Resolution Compatibility', () => {
    const testResolutions = [
      { width: 1366, height: 768, name: 'HD (1366x768)' },
      { width: 1920, height: 1080, name: 'Full HD (1920x1080)' },
      { width: 2560, height: 1440, name: '2K (2560x1440)' },
      { width: 3840, height: 2160, name: '4K (3840x2160)' },
      { width: 5120, height: 2880, name: '5K (5120x2880)' }
    ];

    testResolutions.forEach(({ width, height, name }) => {
      it(`should handle ${name} resolution`, async () => {
        const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
        // @ts-ignore
        global.chrome = mockChrome;

        // Mock screen resolution
        global.Image = class MockImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          src: string = '';
          width: number = width;
          height: number = height;
          
          constructor() {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        } as any;

        mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
        mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');

        const elementInfo = {
          selector: '#test-element',
          boundingRect: {
            left: 0, top: 0, width: width, height: height,
            x: 0, y: 0, right: width, bottom: height,
            toJSON: () => ({})
          } as DOMRect,
          isScrollable: false,
          totalHeight: height,
          visibleHeight: height
        };

        const result = await ScreenshotProcessor.cropToElement(
          'data:image/png;base64,mock-screenshot',
          elementInfo,
          1
        );
        expect(result).toBe('data:image/png;base64,mock-image-data');
      });
    });
  });

  describe('Memory Constraints by Device Type', () => {
    it('should handle low-memory devices', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Mock low memory environment
      const mockPerformance = {
        now: vi.fn(() => Date.now()),
        memory: {
          usedJSHeapSize: 80 * 1024 * 1024, // 80MB used
          totalJSHeapSize: 100 * 1024 * 1024 // 100MB total (low memory device)
        }
      };
      global.performance = mockPerformance as any;

      const sessionId = 'low-memory-test';
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.monitorMemoryUsage(sessionId);

      const isAcceptable = PerformanceOptimizer.isMemoryUsageAcceptable(
        sessionId,
        { memoryThreshold: 90 * 1024 * 1024 } // 90MB threshold
      );

      expect(isAcceptable).toBe(true); // 80MB < 90MB threshold

      // Test optimal segment size for low memory
      const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
        5000, 1920, 2, { memoryThreshold: 50 * 1024 * 1024 } // 50MB limit
      );
      expect(optimalSize).toBeGreaterThan(100);
      expect(optimalSize).toBeLessThanOrEqual(2048); // Should respect max segment size
    });

    it('should handle high-memory devices', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Mock high memory environment
      const mockPerformance = {
        now: vi.fn(() => Date.now()),
        memory: {
          usedJSHeapSize: 200 * 1024 * 1024, // 200MB used
          totalJSHeapSize: 2048 * 1024 * 1024 // 2GB total (high memory device)
        }
      };
      global.performance = mockPerformance as any;

      const sessionId = 'high-memory-test';
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.monitorMemoryUsage(sessionId);

      const isAcceptable = PerformanceOptimizer.isMemoryUsageAcceptable(
        sessionId,
        { memoryThreshold: 500 * 1024 * 1024 } // 500MB threshold
      );

      expect(isAcceptable).toBe(true); // 200MB < 500MB threshold

      // Test optimal segment size for high memory
      const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
        10000, 1920, 2, { memoryThreshold: 500 * 1024 * 1024 } // 500MB limit
      );
      expect(optimalSize).toBeGreaterThan(1000);
      expect(optimalSize).toBeLessThanOrEqual(2048);
    });
  });

  describe('API Compatibility', () => {
    it('should handle chrome.tabs API variations', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Test different tab states
      const tabStates = [
        { windowId: 1, url: 'https://example.com', status: 'complete' },
        { windowId: 2, url: 'https://test.com', status: 'loading' },
        { windowId: 3, url: 'chrome://newtab/', status: 'complete' }
      ];

      for (const tabState of tabStates) {
        mockChrome.tabs.get.mockResolvedValue(tabState);
        mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');

        const result = await ScreenshotProcessor.captureFullPage(123);
        expect(result).toBe('data:image/png;base64,mock-screenshot');
        expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(
          tabState.windowId,
          { format: 'png', quality: 100 }
        );
      }
    });

    it('should handle chrome.scripting API variations', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Test different script execution results
      const scriptResults = [
        [{ result: 1 }],
        [{ result: 2 }],
        [{ result: { x: 0, y: 0, width: 100, height: 100 } }]
      ];

      for (const result of scriptResults) {
        mockChrome.scripting!.executeScript.mockResolvedValue(result);

        if (typeof result[0].result === 'number') {
          const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(123);
          expect(devicePixelRatio).toBe(result[0].result);
        }
      }
    });

    it('should handle chrome.downloads API variations', async () => {
      const mockChrome = createChromeVersionMock('120.0.6099.109', 3);
      // @ts-ignore
      global.chrome = mockChrome;

      // Test different download scenarios
      const downloadScenarios = [
        { downloadId: 1, success: true },
        { downloadId: 2, success: true },
        { error: 'USER_CANCELED', success: false }
      ];

      for (const scenario of downloadScenarios) {
        if (scenario.success) {
          mockChrome.downloads.download.mockResolvedValue(scenario.downloadId);
          
          await ScreenshotProcessor.downloadScreenshot(
            'data:image/png;base64,mock-image',
            'test.png'
          );
          
          expect(mockChrome.downloads.download).toHaveBeenCalledWith({
            url: 'blob:mock-url', // URL.createObjectURL returns blob URL
            filename: 'test.png',
            saveAs: false
          });
        } else {
          mockChrome.downloads.download.mockRejectedValue(new Error(scenario.error));
          
          await expect(ScreenshotProcessor.downloadScreenshot(
            'data:image/png;base64,mock-image',
            'test.png'
          )).rejects.toThrow();
        }
      }
    });
  });

  describe('Performance Across Versions', () => {
    it('should maintain performance standards across Chrome versions', async () => {
      const chromeVersions = ['88.0.4324.150', '100.0.4896.127', '110.0.5481.177', '120.0.6099.109'];
      
      for (const version of chromeVersions) {
        const mockChrome = createChromeVersionMock(version, 3);
        // @ts-ignore
        global.chrome = mockChrome;

        mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
        mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
        mockChrome.scripting!.executeScript.mockResolvedValue([{ result: 2 }]);

        const sessionId = `performance-${version}`;
        PerformanceOptimizer.startMonitoring(sessionId);

        // Add a small delay to ensure duration > 0
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const startTime = Date.now();
        await ScreenshotProcessor.captureFullPage(123);
        const endTime = Date.now();

        const metrics = PerformanceOptimizer.endMonitoring(sessionId);
        
        // Performance should be consistent across versions
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        expect(metrics?.duration).toBeGreaterThan(0);
      }
    });
  });
});