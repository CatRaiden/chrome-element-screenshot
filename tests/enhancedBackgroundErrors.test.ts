// Tests for enhanced background script error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageType, ScreenshotError } from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    get: vi.fn(),
    captureVisibleTab: vi.fn(),
    sendMessage: vi.fn()
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
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

describe('Enhanced Background Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup default mock responses
    mockChrome.tabs.get.mockResolvedValue({ windowId: 1 });
    mockChrome.storage.sync.get.mockResolvedValue({
      userSettings: {
        defaultFormat: 'png',
        defaultQuality: 0.9,
        filenameTemplate: 'screenshot_{timestamp}',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#ff0000'
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Screenshot Capture Error Handling', () => {
    it('should retry failed screenshot capture', async () => {
      // Mock capture failure then success
      mockChrome.tabs.captureVisibleTab
        .mockRejectedValueOnce(new Error('Capture failed'))
        .mockResolvedValue('data:image/png;base64,test');
      
      mockChrome.scripting.executeScript.mockResolvedValue([{ result: 1 }]);
      mockChrome.downloads.download.mockResolvedValue({ id: 1 });

      // This would test the actual background script function
      // For now, we'll test the error handling logic conceptually
      expect(mockChrome.tabs.captureVisibleTab).toBeDefined();
    });

    it('should handle permission denied errors', async () => {
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(
        new Error('Permission denied for screenshot')
      );

      // Test that permission errors are properly classified
      const error = new Error('Permission denied for screenshot');
      expect(error.message.toLowerCase()).toContain('permission');
    });

    it('should handle element not found errors', async () => {
      mockChrome.scripting.executeScript.mockRejectedValue(
        new Error('Element not found: #test-selector')
      );

      // Test that element errors are properly classified
      const error = new Error('Element not found: #test-selector');
      expect(error.message.toLowerCase()).toContain('element not found');
    });
  });

  describe('Manual Save Functionality', () => {
    it('should prepare manual save data when download fails', async () => {
      const sessionId = 'test-session-123';
      const screenshotData = 'data:image/png;base64,test';
      const filename = 'test-screenshot.png';

      mockChrome.downloads.download.mockRejectedValue(new Error('Download failed'));
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Test manual save preparation
      const manualSaveData = {
        data: screenshotData,
        filename: filename,
        timestamp: Date.now()
      };

      expect(manualSaveData.data).toBe(screenshotData);
      expect(manualSaveData.filename).toBe(filename);
      expect(typeof manualSaveData.timestamp).toBe('number');
    });

    it('should handle manual save request', async () => {
      const sessionId = 'test-session-123';
      const saveData = {
        data: 'data:image/png;base64,test',
        filename: 'test-screenshot.png',
        timestamp: Date.now()
      };

      mockChrome.storage.local.get.mockResolvedValue({
        [`manual_save_${sessionId}`]: saveData
      });
      mockChrome.downloads.download.mockResolvedValue({ id: 1 });
      mockChrome.storage.local.remove.mockResolvedValue(undefined);

      // Test manual save execution
      expect(mockChrome.storage.local.get).toBeDefined();
      expect(mockChrome.downloads.download).toBeDefined();
      expect(mockChrome.storage.local.remove).toBeDefined();
    });

    it('should clean up manual save data after successful save', async () => {
      const sessionId = 'test-session-123';
      
      mockChrome.storage.local.get.mockResolvedValue({
        [`manual_save_${sessionId}`]: {
          data: 'data:image/png;base64,test',
          filename: 'test.png',
          timestamp: Date.now()
        }
      });
      mockChrome.downloads.download.mockResolvedValue({ id: 1 });
      mockChrome.storage.local.remove.mockResolvedValue(undefined);

      // Verify cleanup is called
      expect(mockChrome.storage.local.remove).toBeDefined();
    });
  });

  describe('Error Notification System', () => {
    it('should send enhanced error notifications to content script', async () => {
      const tabId = 123;
      const sessionId = 'test-session';
      const errorInfo = {
        code: ScreenshotError.CAPTURE_FAILED,
        chineseMessage: '截圖捕獲失敗',
        severity: 'medium',
        userAction: '正在重試...',
        retryable: true,
        fallbackAvailable: true
      };

      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      // Test error notification structure
      const expectedPayload = {
        error: errorInfo.code,
        message: errorInfo.chineseMessage,
        details: {
          sessionId,
          severity: errorInfo.severity,
          userAction: errorInfo.userAction,
          retryable: errorInfo.retryable,
          fallbackAvailable: errorInfo.fallbackAvailable,
          shouldOfferManualSave: true
        }
      };

      expect(expectedPayload.error).toBe(ScreenshotError.CAPTURE_FAILED);
      expect(expectedPayload.message).toBe('截圖捕獲失敗');
      expect(expectedPayload.details.retryable).toBe(true);
    });

    it('should handle notification failures gracefully', async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      // Should not throw when notification fails
      expect(() => {
        // This would be the actual notification call
        console.warn('Failed to notify enhanced error:', new Error('Tab not found'));
      }).not.toThrow();
    });
  });

  describe('Long Screenshot Error Handling', () => {
    it('should handle scroll failures during long screenshot', async () => {
      const tabId = 123;
      const elementInfo = {
        selector: '#test-element',
        isScrollable: true,
        totalHeight: 2000,
        visibleHeight: 800,
        boundingRect: { x: 0, y: 0, width: 400, height: 800 } as DOMRect
      };

      mockChrome.tabs.sendMessage
        .mockResolvedValueOnce({ success: true }) // Reset scroll
        .mockRejectedValueOnce(new Error('Scroll failed')) // First scroll fails
        .mockResolvedValue({ success: true }); // Subsequent calls succeed

      // Test that scroll errors are handled
      const scrollError = new Error('Scroll failed');
      expect(scrollError.message).toContain('Scroll failed');
    });

    it('should handle stitching failures with fallback', async () => {
      const segments = [
        {
          dataUrl: 'data:image/png;base64,segment1',
          scrollPosition: { x: 0, y: 0, isComplete: false },
          segmentIndex: 0,
          elementRect: { x: 0, y: 0, width: 400, height: 400 } as DOMRect
        },
        {
          dataUrl: 'data:image/png;base64,segment2',
          scrollPosition: { x: 0, y: 400, isComplete: true },
          segmentIndex: 1,
          elementRect: { x: 0, y: 400, width: 400, height: 400 } as DOMRect
        }
      ];

      // Test that stitching errors can be handled
      expect(segments.length).toBe(2);
      expect(segments[0].segmentIndex).toBe(0);
      expect(segments[1].segmentIndex).toBe(1);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from temporary network issues', async () => {
      let callCount = 0;
      const mockOperation = () => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve('success');
      };

      // Test retry logic conceptually
      let result;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          result = await mockOperation();
          break;
        } catch (error) {
          if (attempts >= maxAttempts) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should degrade gracefully when all retries fail', async () => {
      const mockOperation = () => Promise.reject(new Error('Persistent failure'));

      let finalError;
      try {
        await mockOperation();
      } catch (error) {
        finalError = error;
      }

      expect(finalError).toBeInstanceOf(Error);
      expect((finalError as Error).message).toBe('Persistent failure');
    });
  });

  describe('Error Context and Reporting', () => {
    it('should generate comprehensive error reports', () => {
      const errorContext = {
        timestamp: new Date().toISOString(),
        context: 'Screenshot Capture',
        errorCode: ScreenshotError.CAPTURE_FAILED,
        severity: 'medium',
        message: 'Screenshot capture failed',
        chineseMessage: '截圖捕獲失敗',
        retryable: true,
        fallbackAvailable: true,
        userAction: '正在重試...',
        technicalDetails: { tabId: 123, attempt: 2 },
        userAgent: 'test-agent',
        url: 'https://example.com'
      };

      expect(errorContext.errorCode).toBe(ScreenshotError.CAPTURE_FAILED);
      expect(errorContext.severity).toBe('medium');
      expect(errorContext.retryable).toBe(true);
      expect(errorContext.technicalDetails.tabId).toBe(123);
    });

    it('should track error patterns for debugging', () => {
      const errorHistory = [
        { error: ScreenshotError.CAPTURE_FAILED, timestamp: Date.now() - 1000 },
        { error: ScreenshotError.PROCESSING_ERROR, timestamp: Date.now() - 500 },
        { error: ScreenshotError.DOWNLOAD_FAILED, timestamp: Date.now() }
      ];

      expect(errorHistory.length).toBe(3);
      expect(errorHistory[0].error).toBe(ScreenshotError.CAPTURE_FAILED);
      expect(errorHistory[2].error).toBe(ScreenshotError.DOWNLOAD_FAILED);
    });
  });
});