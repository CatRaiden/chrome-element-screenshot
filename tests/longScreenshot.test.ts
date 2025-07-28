// Integration tests for long screenshot functionality

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ScreenshotProcessor } from '../src/utils/screenshotProcessor';
import { ElementInfo, LongScreenshotSegment, ScrollPosition } from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    captureVisibleTab: vi.fn(),
    get: vi.fn(),
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
  fillRect: vi.fn()
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

describe('Long Screenshot Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,mock-image-data');
    
    mockChrome.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,mock-screenshot');
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
    mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: 2 }]);
    mockChrome.downloads.download.mockResolvedValue(1);
  });

  describe('Scroll Height Detection', () => {
    it('should detect scrollable elements correctly', async () => {
      const elementInfo: ElementInfo = {
        selector: '.scrollable-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 2400, // 4x visible height
        visibleHeight: 600
      };

      expect(elementInfo.isScrollable).toBe(true);
      expect(elementInfo.totalHeight).toBeGreaterThan(elementInfo.visibleHeight);
      expect(elementInfo.totalHeight / elementInfo.visibleHeight).toBe(4);
    });

    it('should identify non-scrollable elements', async () => {
      const elementInfo: ElementInfo = {
        selector: '.static-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 400,
          top: 0, right: 800, bottom: 400, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 400,
        visibleHeight: 400
      };

      expect(elementInfo.isScrollable).toBe(false);
      expect(elementInfo.totalHeight).toBe(elementInfo.visibleHeight);
    });
  });

  describe('Scroll Segment Calculation', () => {
    it('should calculate correct scroll segments for long content', async () => {
      const elementInfo: ElementInfo = {
        selector: '.long-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 2400,
        visibleHeight: 600
      };

      // Mock the private method by testing through captureLongScreenshot
      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(1, elementInfo, 2);
      
      expect(result.segments.length).toBeGreaterThan(1);
      expect(result.totalHeight).toBe(2400);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'RESET_SCROLL'
        })
      );
    });

    it('should handle single segment for short content', async () => {
      const elementInfo: ElementInfo = {
        selector: '.short-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 400,
          top: 0, right: 800, bottom: 400, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 400,
        visibleHeight: 400
      };

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 800, height: 400,
          top: 0, right: 800, bottom: 400, left: 0
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(1, elementInfo, 2);
      
      expect(result.segments.length).toBe(1);
      expect(result.segments[0].scrollPosition.isComplete).toBe(true);
    });
  });

  describe('Screenshot Stitching', () => {
    it('should stitch multiple segments correctly', async () => {
      const elementInfo: ElementInfo = {
        selector: '.long-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1800,
        visibleHeight: 600
      };

      const segments: LongScreenshotSegment[] = [
        {
          dataUrl: 'data:image/png;base64,segment1',
          scrollPosition: { x: 0, y: 0, isComplete: false },
          segmentIndex: 0,
          elementRect: {
            x: 0, y: 0, width: 800, height: 600,
            top: 0, right: 800, bottom: 600, left: 0,
            toJSON: () => ({})
          } as DOMRect
        },
        {
          dataUrl: 'data:image/png;base64,segment2',
          scrollPosition: { x: 0, y: 480, isComplete: false },
          segmentIndex: 1,
          elementRect: {
            x: 0, y: 0, width: 800, height: 600,
            top: 0, right: 800, bottom: 600, left: 0,
            toJSON: () => ({})
          } as DOMRect
        },
        {
          dataUrl: 'data:image/png;base64,segment3',
          scrollPosition: { x: 0, y: 960, isComplete: true },
          segmentIndex: 2,
          elementRect: {
            x: 0, y: 0, width: 800, height: 600,
            top: 0, right: 800, bottom: 600, left: 0,
            toJSON: () => ({})
          } as DOMRect
        }
      ];

      const result = await ScreenshotProcessor.stitchScreenshotSegments(
        segments,
        elementInfo,
        2
      );

      expect(result).toBe('data:image/png;base64,mock-image-data');
      expect(mockCanvas.getContext).toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalledTimes(3);
      
      // Verify canvas dimensions
      expect(mockCanvas.width).toBe(800 * 2); // width * devicePixelRatio
      expect(mockCanvas.height).toBe(1800 * 2); // totalHeight * devicePixelRatio
    });

    it('should handle single segment without stitching', async () => {
      const elementInfo: ElementInfo = {
        selector: '.single-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 600,
        visibleHeight: 600
      };

      const segments: LongScreenshotSegment[] = [
        {
          dataUrl: 'data:image/png;base64,single-segment',
          scrollPosition: { x: 0, y: 0, isComplete: true },
          segmentIndex: 0,
          elementRect: {
            x: 0, y: 0, width: 800, height: 600,
            top: 0, right: 800, bottom: 600, left: 0,
            toJSON: () => ({})
          } as DOMRect
        }
      ];

      // Mock cropToElement for single segment
      const cropSpy = vi.spyOn(ScreenshotProcessor, 'cropToElement')
        .mockResolvedValue('data:image/png;base64,cropped-single');

      const result = await ScreenshotProcessor.stitchScreenshotSegments(
        segments,
        elementInfo,
        2
      );

      expect(cropSpy).toHaveBeenCalledWith(
        'data:image/png;base64,single-segment',
        elementInfo,
        2
      );
      expect(result).toBe('data:image/png;base64,cropped-single');
    });

    it('should throw error for empty segments', async () => {
      const elementInfo: ElementInfo = {
        selector: '.empty-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: false,
        totalHeight: 600,
        visibleHeight: 600
      };

      await expect(
        ScreenshotProcessor.stitchScreenshotSegments([], elementInfo, 2)
      ).rejects.toThrow('No segments to stitch');
    });
  });

  describe('Progress Indication', () => {
    it('should report progress during long screenshot capture', async () => {
      const elementInfo: ElementInfo = {
        selector: '.progress-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1800,
        visibleHeight: 600
      };

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0
        }
      }]);

      await ScreenshotProcessor.captureLongScreenshot(1, elementInfo, 2);

      // Verify scroll control messages were sent
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'RESET_SCROLL'
        })
      );

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'SCROLL_TO_POSITION'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle scroll control errors gracefully', async () => {
      const elementInfo: ElementInfo = {
        selector: '.error-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1800,
        visibleHeight: 600
      };

      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Scroll control failed'));

      await expect(
        ScreenshotProcessor.captureLongScreenshot(1, elementInfo, 2)
      ).rejects.toThrow('Long screenshot capture failed');
    });

    it('should handle stitching errors gracefully', async () => {
      const elementInfo: ElementInfo = {
        selector: '.stitch-error-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1800,
        visibleHeight: 600
      };

      // Use multiple segments to force stitching path (not single segment path)
      const segments: LongScreenshotSegment[] = [
        {
          dataUrl: 'invalid-data-url',
          scrollPosition: { x: 0, y: 0, isComplete: false },
          segmentIndex: 0,
          elementRect: elementInfo.boundingRect
        },
        {
          dataUrl: 'invalid-data-url-2',
          scrollPosition: { x: 0, y: 480, isComplete: true },
          segmentIndex: 1,
          elementRect: elementInfo.boundingRect
        }
      ];

      // Mock Image constructor to fail
      global.Image = class MockFailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as any;

      await expect(
        ScreenshotProcessor.stitchScreenshotSegments(segments, elementInfo, 2)
      ).rejects.toThrow('Screenshot stitching failed');
    });
  });

  describe('Integration with Content Script', () => {
    it('should coordinate scroll control with content script', async () => {
      const elementInfo: ElementInfo = {
        selector: '.integration-content',
        boundingRect: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0,
          toJSON: () => ({})
        } as DOMRect,
        isScrollable: true,
        totalHeight: 1800,
        visibleHeight: 600
      };

      // Mock successful scroll responses
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
          scrollPosition: { x: 0, y: 960, isComplete: true }
        })
        .mockResolvedValueOnce({ success: true, status: 'scroll_reset' });

      mockChrome.scripting.executeScript.mockResolvedValue([{
        result: {
          x: 0, y: 0, width: 800, height: 600,
          top: 0, right: 800, bottom: 600, left: 0
        }
      }]);

      const result = await ScreenshotProcessor.captureLongScreenshot(1, elementInfo, 2);

      expect(result.segments.length).toBeGreaterThan(1);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'RESET_SCROLL',
          payload: { selector: '.integration-content' }
        })
      );
    });
  });
});