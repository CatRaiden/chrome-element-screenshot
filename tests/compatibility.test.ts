// Website and Element Type Compatibility Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementInfo, ScreenshotOptions } from '../src/types';

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
} as any;

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    captureVisibleTab: vi.fn(),
    get: vi.fn(),
    sendMessage: vi.fn(),
    query: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  },
  downloads: {
    download: vi.fn()
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

import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';

describe('Website Compatibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,mock-image-data');
    
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
    mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
    mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: 2 }]);
    mockChrome.downloads.download.mockResolvedValue(1);
  });

  describe('Popular Website Layouts', () => {
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

    it('should handle news website layouts (CNN-like)', async () => {
      const articleElement: ElementInfo = {
        selector: '.article-content',
        boundingRect: {
          left: 100, top: 200, width: 800, height: 1200,
          x: 100, y: 200, right: 900, bottom: 1400,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 3000,
        visibleHeight: 1200,
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

      // Mock long article scrolling
      let scrollY = 0;
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message) => {
        if (message.type === 'SCROLL_TO_POSITION') {
          scrollY += 960;
          return Promise.resolve({
            success: true,
            status: 'scrolled',
            scrollPosition: { x: 0, y: scrollY, isComplete: scrollY >= 2400 }
          });
        }
        return Promise.resolve({ success: true, status: 'scroll_reset' });
      });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 100, y: 200, width: 800, height: 1200,
          top: 200, right: 900, bottom: 1400, left: 100
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(123, articleElement, 1);
      expect(result.segments.length).toBeGreaterThan(2);
      expect(result.totalHeight).toBe(3000);
    });

    it('should handle dashboard layouts (admin panels)', async () => {
      const dashboardWidget: ElementInfo = {
        selector: '.dashboard-widget',
        boundingRect: {
          left: 50, top: 50, width: 400, height: 300,
          x: 50, y: 50, right: 450, bottom: 350,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 300,
        visibleHeight: 300,
        hasTransform: true,
        transformMatrix: new DOMMatrix('matrix(1, 0, 0, 1, 0, 0)'),
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          textShadow: 'none',
          shadowBounds: {
            left: 47, top: 47, width: 406, height: 306,
            x: 47, y: 47, right: 453, bottom: 353,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 2,
        computedStyles: {
          position: 'relative',
          transform: 'matrix(1, 0, 0, 1, 0, 0)',
          transformOrigin: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          textShadow: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          zIndex: '2'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        dashboardWidget,
        2
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });
  });

  describe('Complex Element Types', () => {
    it('should handle canvas elements', async () => {
      const canvasElement: ElementInfo = {
        selector: '#chart-canvas',
        boundingRect: {
          left: 0, top: 0, width: 600, height: 400,
          x: 0, y: 0, right: 600, bottom: 400,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 400,
        visibleHeight: 400,
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
          border: '1px solid #ccc',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      // Mock canvas content capture
      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: 'data:image/png;base64,canvas-content'
      }]);

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        canvasElement,
        1
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle SVG elements', async () => {
      const svgElement: ElementInfo = {
        selector: '#vector-graphic',
        boundingRect: {
          left: 100, top: 100, width: 300, height: 200,
          x: 100, y: 100, right: 400, bottom: 300,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 200,
        visibleHeight: 200,
        hasTransform: true,
        transformMatrix: new DOMMatrix('matrix(1.5, 0, 0, 1.5, 0, 0)'),
        hasShadow: false,
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'matrix(1.5, 0, 0, 1.5, 0, 0)',
          transformOrigin: 'center',
          boxShadow: 'none',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        svgElement,
        2
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle video elements', async () => {
      const videoElement: ElementInfo = {
        selector: '#video-player',
        boundingRect: {
          left: 50, top: 50, width: 800, height: 450,
          x: 50, y: 50, right: 850, bottom: 500,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 450,
        visibleHeight: 450,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          textShadow: 'none',
          shadowBounds: {
            left: 42, top: 42, width: 816, height: 474,
            x: 42, y: 42, right: 858, bottom: 516,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 1,
        computedStyles: {
          position: 'relative',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          textShadow: 'none',
          border: 'none',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: '1'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        videoElement,
        1
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle table elements with complex layouts', async () => {
      const tableElement: ElementInfo = {
        selector: '#data-table',
        boundingRect: {
          left: 0, top: 0, width: 1000, height: 600,
          x: 0, y: 0, right: 1000, bottom: 600,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 2000,
        visibleHeight: 600,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textShadow: 'none',
          shadowBounds: {
            left: -2, top: -2, width: 1004, height: 606,
            x: -2, y: -2, right: 1002, bottom: 604,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textShadow: 'none',
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'auto',
          zIndex: 'auto'
        }
      };

      // Mock table scrolling
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
          x: 0, y: 0, width: 1000, height: 600,
          top: 0, right: 1000, bottom: 600, left: 0
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(123, tableElement, 1);
      expect(result.segments.length).toBeGreaterThan(2);
      expect(result.totalHeight).toBe(2000);
    });

    it('should handle form elements', async () => {
      const formElement: ElementInfo = {
        selector: '#contact-form',
        boundingRect: {
          left: 100, top: 100, width: 500, height: 800,
          x: 100, y: 100, right: 600, bottom: 900,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1200,
        visibleHeight: 800,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textShadow: 'none',
          shadowBounds: {
            left: 96, top: 96, width: 508, height: 820,
            x: 96, y: 96, right: 604, bottom: 916,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 1,
        computedStyles: {
          position: 'relative',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textShadow: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          overflow: 'auto',
          zIndex: '1'
        }
      };

      // Mock form scrolling
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
          scrollPosition: { x: 0, y: 400, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 100, y: 100, width: 500, height: 800,
          top: 100, right: 600, bottom: 900, left: 100
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(123, formElement, 1);
      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.totalHeight).toBe(1200);
    });
  });

  describe('Mobile Responsive Elements', () => {
    it('should handle mobile viewport elements', async () => {
      // Mock mobile viewport
      global.Image = class MockMobileImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        width: number = 375; // iPhone width
        height: number = 667; // iPhone height
        
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;

      const mobileElement: ElementInfo = {
        selector: '.mobile-card',
        boundingRect: {
          left: 10, top: 50, width: 355, height: 200,
          x: 10, y: 50, right: 365, bottom: 250,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 200,
        visibleHeight: 200,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          textShadow: 'none',
          shadowBounds: {
            left: 8, top: 48, width: 359, height: 212,
            x: 8, y: 48, right: 367, bottom: 260,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          textShadow: 'none',
          border: '1px solid #ddd',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 'auto'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        mobileElement,
        3 // Higher DPR for mobile
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle tablet viewport elements', async () => {
      // Mock tablet viewport
      global.Image = class MockTabletImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        width: number = 768; // iPad width
        height: number = 1024; // iPad height
        
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;

      const tabletElement: ElementInfo = {
        selector: '.tablet-layout',
        boundingRect: {
          left: 50, top: 100, width: 668, height: 400,
          x: 50, y: 100, right: 718, bottom: 500,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 800,
        visibleHeight: 400,
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

      // Mock tablet scrolling
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
          scrollPosition: { x: 0, y: 400, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 50, y: 100, width: 668, height: 400,
          top: 100, right: 718, bottom: 500, left: 50
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(123, tabletElement, 2);
      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.totalHeight).toBe(800);
    });
  });

  describe('Framework-Specific Elements', () => {
    it('should handle React component elements', async () => {
      const reactElement: ElementInfo = {
        selector: '[data-reactroot] .component',
        boundingRect: {
          left: 0, top: 0, width: 400, height: 300,
          x: 0, y: 0, right: 400, bottom: 300,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 300,
        visibleHeight: 300,
        hasTransform: true,
        transformMatrix: new DOMMatrix('matrix(1, 0, 0, 1, 0, 0)'),
        hasShadow: false,
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'relative',
          transform: 'matrix(1, 0, 0, 1, 0, 0)',
          transformOrigin: 'center',
          boxShadow: 'none',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        reactElement,
        1
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle Vue component elements', async () => {
      const vueElement: ElementInfo = {
        selector: '[data-v-123abc] .vue-component',
        boundingRect: {
          left: 100, top: 50, width: 300, height: 250,
          x: 100, y: 50, right: 400, bottom: 300,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 250,
        visibleHeight: 250,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          textShadow: 'none',
          shadowBounds: {
            left: 99, top: 49, width: 302, height: 254,
            x: 99, y: 49, right: 401, bottom: 303,
            toJSON: () => ({})
          } as DOMRect
        },
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          textShadow: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          zIndex: 'auto'
        }
      };

      const result = await ScreenshotProcessor.cropToElement(
        'data:image/png;base64,mock-screenshot',
        vueElement,
        1
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
    });

    it('should handle Angular component elements', async () => {
      const angularElement: ElementInfo = {
        selector: 'app-component[_ngcontent-c0]',
        boundingRect: {
          left: 50, top: 100, width: 500, height: 400,
          x: 50, y: 100, right: 550, bottom: 500,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 800,
        visibleHeight: 400,
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

      // Mock Angular component scrolling
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
          scrollPosition: { x: 0, y: 400, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 50, y: 100, width: 500, height: 400,
          top: 100, right: 550, bottom: 500, left: 50
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(123, angularElement, 1);
      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.totalHeight).toBe(800);
    });
  });
});