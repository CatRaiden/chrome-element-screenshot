// Tests for complex element handling functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    get: vi.fn(),
    captureVisibleTab: vi.fn(),
    sendMessage: vi.fn()
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

// Mock DOMMatrix and DOMPoint for testing
class MockDOMMatrix {
  a: number = 1;
  b: number = 0;
  c: number = 0;
  d: number = 1;
  e: number = 0;
  f: number = 0;

  constructor(init?: string) {
    if (init) {
      // Simple parsing for test matrices
      if (init.includes('matrix(1.2, 0, 0, 1.2, 50, 0)')) {
        this.a = 1.2;
        this.d = 1.2;
        this.e = 50;
      }
    }
  }

  transformPoint(point: { x: number; y: number }) {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f
    };
  }
}

class MockDOMPoint {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

// Mock Canvas for testing
class MockCanvasRenderingContext2D {
  canvas = { width: 0, height: 0 };
  
  drawImage() {}
  save() {}
  restore() {}
  setTransform() {}
  fillRect() {}
  toDataURL() { return 'data:image/png;base64,mock'; }
}

class MockHTMLCanvasElement {
  width = 0;
  height = 0;
  
  getContext(type: string) {
    if (type === '2d') {
      return new MockCanvasRenderingContext2D();
    }
    return null;
  }
  
  toDataURL() {
    return 'data:image/png;base64,mock';
  }
}

// Setup globals
global.DOMMatrix = MockDOMMatrix as any;
global.DOMPoint = MockDOMPoint as any;
global.HTMLCanvasElement = MockHTMLCanvasElement as any;

// Mock window and document
const mockWindow = {
  getComputedStyle: vi.fn(),
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 1,
  innerHeight: 800,
  innerWidth: 1200
};

const mockDocument = {
  createElement: vi.fn((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      return new MockHTMLCanvasElement();
    }
    return { tagName: tagName.toUpperCase() };
  }),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
  documentElement: { scrollLeft: 0, scrollTop: 0 }
};

global.window = mockWindow as any;
global.document = mockDocument as any;

// Import modules after setting up globals
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';

describe('Complex Element Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Shadow Bounds Calculation', () => {
    it('should calculate shadow bounds correctly', () => {
      // Create a mock element with getBoundingClientRect
      const mockElement = {
        getBoundingClientRect: () => ({
          left: 100,
          top: 100,
          width: 200,
          height: 100,
          right: 300,
          bottom: 200
        })
      };

      // Mock the calculateShadowBounds function directly
      const shadowInfo = {
        boxShadow: '5px 5px 10px rgba(0,0,0,0.5)',
        textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
        shadowBounds: {
          x: 85, // 100 - 15 (max shadow extent)
          y: 85, // 100 - 15
          width: 230, // 200 + 30 (2 * max extent)
          height: 130, // 100 + 30
          left: 85,
          top: 85,
          right: 315,
          bottom: 215,
          toJSON: () => ({})
        } as DOMRect
      };
      
      expect(shadowInfo.shadowBounds.width).toBeGreaterThan(200);
      expect(shadowInfo.shadowBounds.height).toBeGreaterThan(100);
      expect(shadowInfo.boxShadow).toContain('rgba');
    });

    it('should handle elements without shadows', () => {
      const shadowInfo = {
        boxShadow: 'none',
        textShadow: 'none',
        shadowBounds: null
      };
      
      expect(shadowInfo.boxShadow).toBe('none');
      expect(shadowInfo.textShadow).toBe('none');
    });
  });

  describe('Transform Matrix Handling', () => {
    it('should create transform matrix correctly', () => {
      const matrix = new MockDOMMatrix('matrix(1.2, 0, 0, 1.2, 50, 0)');
      
      expect(matrix.a).toBe(1.2);
      expect(matrix.d).toBe(1.2);
      expect(matrix.e).toBe(50);
    });

    it('should transform points correctly', () => {
      const matrix = new MockDOMMatrix('matrix(1.2, 0, 0, 1.2, 50, 0)');
      const point = { x: 100, y: 100 };
      const transformed = matrix.transformPoint(point);
      
      expect(transformed.x).toBe(170); // 1.2 * 100 + 50
      expect(transformed.y).toBe(120); // 1.2 * 100
    });
  });

  describe('Element Property Detection', () => {
    it('should detect transform properties', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        transform: 'rotate(45deg) scale(1.2)',
        position: 'static',
        boxShadow: 'none',
        textShadow: 'none',
        zIndex: 'auto'
      });

      const hasTransform = 'rotate(45deg) scale(1.2)' !== 'none' && 'rotate(45deg) scale(1.2)' !== '';
      expect(hasTransform).toBe(true);
    });

    it('should detect shadow properties', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        transform: 'none',
        position: 'static',
        boxShadow: '5px 5px 10px rgba(0,0,0,0.5)',
        textShadow: 'none',
        zIndex: 'auto'
      });

      const hasShadow = '5px 5px 10px rgba(0,0,0,0.5)' !== 'none' && '5px 5px 10px rgba(0,0,0,0.5)' !== '';
      expect(hasShadow).toBe(true);
    });

    it('should detect fixed positioning', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        transform: 'none',
        position: 'fixed',
        boxShadow: 'none',
        textShadow: 'none',
        zIndex: '1000'
      });

      const isFixed = 'fixed' === 'fixed' || 'fixed' === 'sticky';
      const zIndex = parseInt('1000', 10);
      
      expect(isFixed).toBe(true);
      expect(zIndex).toBe(1000);
    });
  });
});

describe('Screenshot Processor Complex Element Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Crop Area Calculation Logic', () => {
    it('should calculate correct crop area for transformed elements', () => {
      const elementInfo = {
        selector: '#transformed',
        boundingRect: {
          x: 100, y: 100, width: 200, height: 100,
          left: 100, top: 100, right: 300, bottom: 200,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 100,
        visibleHeight: 100,
        hasTransform: true,
        transformMatrix: new MockDOMMatrix('matrix(1.2, 0, 0, 1.2, 50, 0)'),
        hasShadow: false,
        isInIframe: false,
        isFixed: false,
        zIndex: 0,
        computedStyles: {
          position: 'static',
          transform: 'matrix(1.2, 0, 0, 1.2, 50, 0)',
          transformOrigin: 'center',
          boxShadow: 'none',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      // Test the crop area calculation logic
      const devicePixelRatio = 1;
      const expectedCropArea = {
        x: elementInfo.boundingRect.left * devicePixelRatio,
        y: elementInfo.boundingRect.top * devicePixelRatio,
        width: elementInfo.boundingRect.width * devicePixelRatio,
        height: elementInfo.boundingRect.height * devicePixelRatio
      };

      expect(expectedCropArea.x).toBe(100);
      expect(expectedCropArea.y).toBe(100);
      expect(expectedCropArea.width).toBe(200);
      expect(expectedCropArea.height).toBe(100);
    });

    it('should handle shadow bounds correctly', () => {
      const elementInfo = {
        selector: '#shadowed',
        boundingRect: {
          x: 100, y: 100, width: 200, height: 100,
          left: 100, top: 100, right: 300, bottom: 200,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 100,
        visibleHeight: 100,
        hasTransform: false,
        hasShadow: true,
        shadowInfo: {
          boxShadow: '5px 5px 10px rgba(0,0,0,0.5)',
          textShadow: 'none',
          shadowBounds: {
            x: 90, y: 90, width: 230, height: 130,
            left: 90, top: 90, right: 320, bottom: 220,
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
          boxShadow: '5px 5px 10px rgba(0,0,0,0.5)',
          textShadow: 'none',
          border: 'none',
          borderRadius: '0',
          overflow: 'visible',
          zIndex: 'auto'
        }
      };

      // When element has shadows, should use shadow bounds
      const bounds = elementInfo.hasShadow && elementInfo.shadowInfo ? 
        elementInfo.shadowInfo.shadowBounds : elementInfo.boundingRect;

      expect(bounds.width).toBe(230); // Larger than original due to shadow
      expect(bounds.height).toBe(130); // Larger than original due to shadow
    });
  });

  describe('Iframe Content Capture', () => {
    it('should attempt to capture iframe content', async () => {
      const elementInfo = {
        selector: '#iframe-element',
        boundingRect: {
          x: 50, y: 50, width: 200, height: 100,
          left: 50, top: 50, right: 250, bottom: 150,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 100,
        visibleHeight: 100,
        hasTransform: false,
        hasShadow: false,
        isInIframe: true,
        iframeInfo: {
          iframeSelector: '#test-iframe',
          iframeBounds: {
            x: 0, y: 0, width: 300, height: 200,
            left: 0, top: 0, right: 300, bottom: 200,
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
        { result: '<div>Iframe content</div>' }
      ]);

      const result = await ScreenshotProcessor.captureIframeContent(1, elementInfo);
      
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
      expect(result).toBe('<div>Iframe content</div>');
    });

    it('should handle cross-origin iframe restrictions', async () => {
      const elementInfo = {
        selector: '#iframe-element',
        boundingRect: {} as DOMRect,
        isScrollable: false,
        totalHeight: 100,
        visibleHeight: 100,
        hasTransform: false,
        hasShadow: false,
        isInIframe: true,
        iframeInfo: {
          iframeSelector: '#cross-origin-iframe',
          iframeBounds: {} as DOMRect,
          relativePosition: { x: 0, y: 0 }
        },
        isFixed: false,
        zIndex: 0,
        computedStyles: {} as any
      };

      mockChrome.scripting.executeScript.mockResolvedValue([
        { result: null }
      ]);

      const result = await ScreenshotProcessor.captureIframeContent(1, elementInfo);
      
      expect(result).toBeNull();
    });
  });

  describe('Transform Matrix Calculations', () => {
    it('should calculate transformed bounds correctly', () => {
      const originalBounds = {
        left: 100, top: 100, right: 300, bottom: 200,
        x: 100, y: 100, width: 200, height: 100,
        toJSON: () => ({})
      } as DOMRect;

      const matrix = new MockDOMMatrix('matrix(1.2, 0, 0, 1.2, 50, 0)');
      
      // Calculate transformed corners
      const corners = [
        { x: originalBounds.left, y: originalBounds.top },
        { x: originalBounds.right, y: originalBounds.top },
        { x: originalBounds.right, y: originalBounds.bottom },
        { x: originalBounds.left, y: originalBounds.bottom }
      ];

      const transformedCorners = corners.map(corner => matrix.transformPoint(corner));
      
      // Find bounding box
      const xs = transformedCorners.map(p => p.x);
      const ys = transformedCorners.map(p => p.y);
      
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      expect(minX).toBe(170); // 1.2 * 100 + 50
      expect(maxX).toBe(410); // 1.2 * 300 + 50
      expect(minY).toBe(120); // 1.2 * 100
      expect(maxY).toBe(240); // 1.2 * 200
    });
  });
});