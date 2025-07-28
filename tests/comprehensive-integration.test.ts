// Comprehensive Integration Test Suite for Task 10
// 創建完整的端到端測試套件

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageType, ElementInfo, ScreenshotOptions, UserSettings } from '../src/types';
import { PerformanceOptimizer } from '../src/utils/performanceOptimizer';

// Mock DOM APIs with comprehensive coverage
global.DOMMatrix = class MockDOMMatrix {
  a: number; b: number; c: number; d: number; e: number; f: number;
  
  constructor(init?: string | number[]) {
    if (typeof init === 'string') {
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
} as any;global.
DOMPoint = class MockDOMPoint {
  x: number; y: number; z: number; w: number;
  
  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }
} as any;

// Mock Chrome APIs with enhanced functionality
const mockChrome = {
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(),
    lastError: null,
    onInstalled: { addListener: vi.fn() },
    getManifest: vi.fn(() => ({ version: '1.0.0', manifest_version: 3 }))
  },
  storage: {
    sync: { get: vi.fn(), set: vi.fn(), clear: vi.fn() },
    local: { get: vi.fn(), set: vi.fn(), clear: vi.fn() }
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
    onChanged: { addListener: vi.fn() }
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
global.chrome = mockChrome;/
/ Mock DOM and Canvas APIs
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
  setTransform: vi.fn(),
  imageSmoothingEnabled: true,
  globalCompositeOperation: 'source-over'
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
) as any;/
/ Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024
  }
};
global.performance = mockPerformance as any;

// Import modules after setting up globals
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';

describe('Comprehensive Integration Test Suite', () => {
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
 describe('1. 創建完整的端到端測試套件', () => {
    it('should execute complete screenshot workflow end-to-end', async () => {
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
        visibleHeight: 150,
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
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      // Start performance monitoring
      const sessionId = 'e2e-test-' + Date.now();
      PerformanceOptimizer.startMonitoring(sessionId);

      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 10));

      // Step 1: Capture full page screenshot
      const fullScreenshot = await ScreenshotProcessor.captureFullPage(tabId);
      expect(fullScreenshot).toBe('data:image/png;base64,mock-screenshot');

      // Step 2: Get device pixel ratio
      const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(tabId);
      expect(devicePixelRatio).toBe(2);

      // Step 3: Crop to element
      const croppedScreenshot = await ScreenshotProcessor.cropToElement(
        fullScreenshot,
        elementInfo,
        devicePixelRatio
      );
      expect(croppedScreenshot).toBe('data:image/png;base64,mock-image-data');

      // Step 4: Apply settings and convert format
      const options: ScreenshotOptions = {
        format: mockUserSettings.defaultFormat,
        quality: mockUserSettings.defaultQuality,
        filename: 'test-screenshot.png'
      };
      
      const finalScreenshot = await ScreenshotProcessor.convertFormat(croppedScreenshot, options);
      expect(finalScreenshot).toBe('data:image/png;base64,mock-image-data');

      // Step 5: Generate filename
      const filename = ScreenshotProcessor.generateFilename(
        mockUserSettings.filenameTemplate,
        mockUserSettings.defaultFormat
      );
      expect(filename).toMatch(/screenshot_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png/);

      // Step 6: Download screenshot
      await ScreenshotProcessor.downloadScreenshot(finalScreenshot, filename);
      expect(mockChrome.downloads.download).toHaveBeenCalled();

      // Step 7: End monitoring and verify performance
      const metrics = PerformanceOptimizer.endMonitoring(sessionId);
      expect(metrics?.duration).toBeGreaterThan(0);
      expect(metrics?.memoryUsage).toBeDefined();

      // Verify all Chrome APIs were called correctly
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, { format: 'png', quality: 100 });
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
      expect(mockChrome.downloads.download).toHaveBeenCalled();
    });
  });  d
escribe('2. 實現不同網站和元素類型的兼容性測試', () => {
    it('should handle social media layouts (Twitter-like)', async () => {
      const twitterPostElement: ElementInfo = {
        selector: '.tweet-container',
        boundingRect: {
          left: 50, top: 100, width: 600, height: 200,
          x: 50, y: 100, right: 650, bottom: 300,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 200,
        visibleHeight: 200,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textShadow: 'none',
          shadowBounds: {
            left: 48, top: 98, width: 604, height: 210,
            x: 48, y: 98, right: 652, bottom: 308,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 1,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textShadow: 'none',
          border: '1px solid #e1e8ed',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: '1'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        twitterPostElement,
        2
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
      expect(mockCanvas.getContext).toHaveBeenCalled();
    });

    it('should handle e-commerce layouts (Amazon-like)', async () => {
      const productCardElement: ElementInfo = {
        selector: '.product-card',
        boundingRect: {
          left: 20, top: 50, width: 300, height: 400,
          x: 20, y: 50, right: 320, bottom: 450,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 600,
        visibleHeight: 400,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          textShadow: 'none',
          shadowBounds: {
            left: 16, top: 46, width: 308, height: 416,
            x: 16, y: 46, right: 324, bottom: 462,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'relative',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          textShadow: 'none',
          border: '1px solid #ddd',
          borderRadius: '8px',
          overflow: 'auto',
          zIndex: 'auto'
        }
      };

      // Test long screenshot for scrollable product details
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
          scrollPosition: { x: 0, y: 200, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 20, y: 50, width: 300, height: 400,
          top: 50, right: 320, bottom: 450, left: 20
        }
      }]);

      const longResult = await ScreenshotProcessor.captureLongScreenshot(123, productCardElement, 2);
      expect(longResult.segments.length).toBeGreaterThan(1);
      expect(longResult.totalHeight).toBe(600);
    });
  });  d
escribe('3. 優化長截圖的性能和內存使用', () => {
    it('should optimize segment size based on memory constraints', () => {
      const testCases = [
        { height: 5000, width: 1920, dpr: 2, memory: 50 * 1024 * 1024, expected: { min: 100, max: 2048 } },
        { height: 10000, width: 1920, dpr: 3, memory: 100 * 1024 * 1024, expected: { min: 100, max: 2048 } },
        { height: 2000, width: 800, dpr: 1, memory: 20 * 1024 * 1024, expected: { min: 100, max: 2048 } }
      ];

      testCases.forEach(testCase => {
        const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
          testCase.height,
          testCase.width,
          testCase.dpr,
          { memoryThreshold: testCase.memory }
        );

        expect(optimalSize).toBeGreaterThanOrEqual(testCase.expected.min);
        expect(optimalSize).toBeLessThanOrEqual(testCase.expected.max);
      });
    });

    it('should process segments progressively to manage memory', async () => {
      const segments = Array.from({ length: 20 }, (_, i) => ({ 
        id: i, 
        data: `segment-${i}`,
        size: 1024 * 100 // 100KB each
      }));

      const sessionId = 'progressive-test';
      PerformanceOptimizer.startMonitoring(sessionId);

      const processor = vi.fn().mockImplementation(async (segment) => {
        // Simulate processing time and memory usage
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${segment.id}`;
      });

      const results = await PerformanceOptimizer.processSegmentsProgressively(
        segments,
        processor,
        {
          enableProgressiveLoading: true,
          enableMemoryCleanup: true,
          memoryThreshold: 50 * 1024 * 1024 // 50MB
        }
      );

      expect(results).toHaveLength(20);
      expect(processor).toHaveBeenCalledTimes(20);

      const metrics = PerformanceOptimizer.endMonitoring(sessionId);
      expect(metrics?.duration).toBeGreaterThan(0);
    });

    it('should monitor and manage memory usage during long screenshots', async () => {
      const sessionId = 'memory-test';
      PerformanceOptimizer.startMonitoring(sessionId);

      // Simulate high memory usage
      mockPerformance.memory.usedJSHeapSize = 80 * 1024 * 1024; // 80MB

      PerformanceOptimizer.monitorMemoryUsage(sessionId);

      const isAcceptable = PerformanceOptimizer.isMemoryUsageAcceptable(
        sessionId,
        { memoryThreshold: 100 * 1024 * 1024 } // 100MB threshold
      );

      expect(isAcceptable).toBe(true); // 80MB < 100MB

      const metrics = PerformanceOptimizer.getMetrics(sessionId);
      expect(metrics?.memoryUsage?.used).toBe(80 * 1024 * 1024);
    });
  });  d
escribe('4. 添加截圖質量和文件大小的平衡調整', () => {
    it('should optimize image quality to target file size', async () => {
      const originalDataUrl = 'data:image/png;base64,original-large-image';
      const targetFileSizeKB = 100;

      // Mock different quality results
      mockCanvas.toDataURL
        .mockReturnValueOnce('data:image/jpeg;base64,' + 'x'.repeat(150 * 1024)) // Too large
        .mockReturnValueOnce('data:image/jpeg;base64,' + 'x'.repeat(80 * 1024))  // Good size
        .mockReturnValueOnce('data:image/jpeg;base64,' + 'x'.repeat(90 * 1024)); // Final result

      const result = await PerformanceOptimizer.optimizeImageQuality(
        originalDataUrl,
        targetFileSizeKB,
        'jpeg'
      );

      expect(result.dataUrl).toBeDefined();
      expect(result.quality).toBeGreaterThan(0);
      expect(result.quality).toBeLessThanOrEqual(1);
      expect(result.fileSizeKB).toBeGreaterThan(0);
    });

    it('should balance quality vs file size for different formats', async () => {
      const formats: ('png' | 'jpeg')[] = ['png', 'jpeg'];
      const targetSizes = [50, 100, 200]; // KB

      for (const format of formats) {
        for (const targetSize of targetSizes) {
          mockCanvas.toDataURL.mockReturnValue(
            `data:image/${format};base64,` + 'x'.repeat(targetSize * 1024)
          );

          const result = await PerformanceOptimizer.optimizeImageQuality(
            'data:image/png;base64,original',
            targetSize,
            format
          );

          expect(result.dataUrl).toContain(`image/${format}`);
          expect(result.fileSizeKB).toBeGreaterThan(0);
        }
      }
    });

    it('should calculate compression ratios correctly', () => {
      const testCases = [
        { original: 1000, compressed: 300, expected: 0.7 },
        { original: 500, compressed: 100, expected: 0.8 },
        { original: 200, compressed: 200, expected: 0 },
        { original: 0, compressed: 100, expected: 0 }
      ];

      testCases.forEach(testCase => {
        const ratio = PerformanceOptimizer.calculateCompressionRatio(
          testCase.original,
          testCase.compressed
        );
        expect(ratio).toBe(testCase.expected);
      });
    });
  });