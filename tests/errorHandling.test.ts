// Comprehensive error handling tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, ErrorInfo } from '../src/utils/errorHandler';
import { ScreenshotError } from '../src/types';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createErrorInfo', () => {
    it('should create comprehensive error info for element not found', () => {
      const errorInfo = ErrorHandler.createErrorInfo(
        ScreenshotError.ELEMENT_NOT_FOUND,
        { selector: '#test-element' }
      );

      expect(errorInfo.code).toBe(ScreenshotError.ELEMENT_NOT_FOUND);
      expect(errorInfo.chineseMessage).toBe('頁面上找不到指定的元素');
      expect(errorInfo.severity).toBe('medium');
      expect(errorInfo.retryable).toBe(false);
      expect(errorInfo.fallbackAvailable).toBe(false);
      expect(errorInfo.userAction).toBe('請重新選擇要截圖的元素');
      expect(errorInfo.technicalDetails).toEqual({ selector: '#test-element' });
    });

    it('should create error info for permission denied', () => {
      const errorInfo = ErrorHandler.createErrorInfo(ScreenshotError.PERMISSION_DENIED);

      expect(errorInfo.code).toBe(ScreenshotError.PERMISSION_DENIED);
      expect(errorInfo.chineseMessage).toBe('截圖權限被拒絕');
      expect(errorInfo.severity).toBe('high');
      expect(errorInfo.retryable).toBe(false);
      expect(errorInfo.userAction).toBe('請檢查瀏覽器權限設置並重新載入頁面');
    });

    it('should create error info for capture failed', () => {
      const errorInfo = ErrorHandler.createErrorInfo(ScreenshotError.CAPTURE_FAILED);

      expect(errorInfo.code).toBe(ScreenshotError.CAPTURE_FAILED);
      expect(errorInfo.chineseMessage).toBe('截圖捕獲失敗');
      expect(errorInfo.severity).toBe('medium');
      expect(errorInfo.retryable).toBe(true);
      expect(errorInfo.fallbackAvailable).toBe(true);
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      const errorInfo = ErrorHandler.createErrorInfo(
        ScreenshotError.PROCESSING_ERROR,
        null,
        customMessage
      );

      expect(errorInfo.message).toBe(customMessage);
      expect(errorInfo.chineseMessage).toBe('截圖處理過程中發生錯誤');
    });
  });

  describe('classifyError', () => {
    it('should classify element not found errors', () => {
      const error = new Error('Element not found: #test-selector');
      const classification = ErrorHandler.classifyError(error);
      expect(classification).toBe(ScreenshotError.ELEMENT_NOT_FOUND);
    });

    it('should classify permission errors', () => {
      const error = new Error('Permission denied for screenshot');
      const classification = ErrorHandler.classifyError(error);
      expect(classification).toBe(ScreenshotError.PERMISSION_DENIED);
    });

    it('should classify download errors', () => {
      const error = new Error('Failed to download screenshot file');
      const classification = ErrorHandler.classifyError(error);
      expect(classification).toBe(ScreenshotError.DOWNLOAD_FAILED);
    });

    it('should classify capture errors', () => {
      const error = new Error('Screenshot capture failed');
      const classification = ErrorHandler.classifyError(error);
      expect(classification).toBe(ScreenshotError.CAPTURE_FAILED);
    });

    it('should default to processing error for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const classification = ErrorHandler.classifyError(error);
      expect(classification).toBe(ScreenshotError.PROCESSING_ERROR);
    });
  });

  describe('handleError with retry logic', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await ErrorHandler.handleError(
        mockOperation,
        'Test operation'
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Screenshot capture failed'))
        .mockResolvedValue('success');
      
      const result = await ErrorHandler.handleError(
        mockOperation,
        'Test operation',
        { maxAttempts: 2, delayMs: 10 }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue(new Error('Screenshot capture failed'));
      
      await expect(
        ErrorHandler.handleError(
          mockOperation,
          'Test operation',
          { maxAttempts: 2, delayMs: 10 }
        )
      ).rejects.toThrow();

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue(new Error('Element not found'));
      
      await expect(
        ErrorHandler.handleError(
          mockOperation,
          'Test operation',
          { maxAttempts: 3, delayMs: 10 }
        )
      ).rejects.toThrow();

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Screenshot capture failed'))
        .mockRejectedValueOnce(new Error('Screenshot capture failed'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      await ErrorHandler.handleError(
        mockOperation,
        'Test operation',
        { maxAttempts: 3, delayMs: 100, backoffMultiplier: 2 }
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should have waited at least 100ms + 200ms = 300ms
      expect(totalTime).toBeGreaterThan(250);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('logError', () => {
    it('should log critical errors with console.error', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.PERMISSION_DENIED,
        message: 'Test error',
        chineseMessage: '測試錯誤',
        severity: 'critical',
        retryable: false,
        fallbackAvailable: false
      };

      ErrorHandler.logError(errorInfo, 'Test Context');

      expect(console.error).toHaveBeenCalledWith(
        '[Test Context] 測試錯誤',
        undefined
      );
    });

    it('should log high severity errors with console.error', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.PERMISSION_DENIED,
        message: 'Test error',
        chineseMessage: '測試錯誤',
        severity: 'high',
        retryable: false,
        fallbackAvailable: false
      };

      ErrorHandler.logError(errorInfo);

      expect(console.error).toHaveBeenCalledWith('測試錯誤', undefined);
    });

    it('should log medium severity errors with console.warn', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.CAPTURE_FAILED,
        message: 'Test error',
        chineseMessage: '測試錯誤',
        severity: 'medium',
        retryable: true,
        fallbackAvailable: true
      };

      ErrorHandler.logError(errorInfo);

      expect(console.warn).toHaveBeenCalledWith('測試錯誤', undefined);
    });

    it('should log low severity errors with console.info', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.DOWNLOAD_FAILED,
        message: 'Test error',
        chineseMessage: '測試錯誤',
        severity: 'low',
        retryable: true,
        fallbackAvailable: true
      };

      ErrorHandler.logError(errorInfo);

      expect(console.info).toHaveBeenCalledWith('測試錯誤', undefined);
    });
  });

  describe('createUserMessage', () => {
    it('should create user message with action and retry info', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.CAPTURE_FAILED,
        message: 'Test error',
        chineseMessage: '截圖捕獲失敗',
        severity: 'medium',
        retryable: true,
        fallbackAvailable: true,
        userAction: '正在嘗試重新截圖...'
      };

      const userMessage = ErrorHandler.createUserMessage(errorInfo);

      expect(userMessage).toBe('截圖捕獲失敗\n正在嘗試重新截圖...\n系統將自動重試...');
    });

    it('should create user message without action for non-retryable errors', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.ELEMENT_NOT_FOUND,
        message: 'Test error',
        chineseMessage: '頁面上找不到指定的元素',
        severity: 'medium',
        retryable: false,
        fallbackAvailable: false,
        userAction: '請重新選擇要截圖的元素'
      };

      const userMessage = ErrorHandler.createUserMessage(errorInfo);

      expect(userMessage).toBe('頁面上找不到指定的元素\n請重新選擇要截圖的元素');
    });
  });

  describe('shouldOfferManualSave', () => {
    it('should offer manual save for download failures', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.DOWNLOAD_FAILED,
        message: 'Download failed',
        chineseMessage: '下載失敗',
        severity: 'low',
        retryable: true,
        fallbackAvailable: true
      };

      expect(ErrorHandler.shouldOfferManualSave(errorInfo)).toBe(true);
    });

    it('should offer manual save for fallback-available errors', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.PROCESSING_ERROR,
        message: 'Processing failed',
        chineseMessage: '處理失敗',
        severity: 'medium',
        retryable: true,
        fallbackAvailable: true
      };

      expect(ErrorHandler.shouldOfferManualSave(errorInfo)).toBe(true);
    });

    it('should not offer manual save for critical errors', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.PERMISSION_DENIED,
        message: 'Permission denied',
        chineseMessage: '權限被拒絕',
        severity: 'critical',
        retryable: false,
        fallbackAvailable: true
      };

      expect(ErrorHandler.shouldOfferManualSave(errorInfo)).toBe(false);
    });
  });

  describe('generateErrorReport', () => {
    it('should generate comprehensive error report', () => {
      const errorInfo: ErrorInfo = {
        code: ScreenshotError.CAPTURE_FAILED,
        message: 'Capture failed',
        chineseMessage: '截圖失敗',
        severity: 'medium',
        retryable: true,
        fallbackAvailable: true,
        userAction: '重試中...',
        technicalDetails: { tabId: 123 }
      };

      const report = ErrorHandler.generateErrorReport(errorInfo, 'Test Context');

      expect(report).toMatchObject({
        context: 'Test Context',
        errorCode: ScreenshotError.CAPTURE_FAILED,
        severity: 'medium',
        message: 'Capture failed',
        chineseMessage: '截圖失敗',
        retryable: true,
        fallbackAvailable: true,
        userAction: '重試中...',
        technicalDetails: { tabId: 123 }
      });

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('userAgent');
    });
  });
});

describe('Error Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle complete error flow with retry and fallback', async () => {
    let attemptCount = 0;
    const mockOperation = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Screenshot capture failed');
      }
      return Promise.resolve('success');
    });

    const result = await ErrorHandler.handleError(
      mockOperation,
      'Integration test',
      { maxAttempts: 3, delayMs: 10 }
    );

    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledTimes(2); // Two failed attempts
  });

  it('should enhance error with comprehensive information', async () => {
    const originalError = new Error('Original error message');
    const mockOperation = vi.fn().mockRejectedValue(originalError);

    try {
      await ErrorHandler.handleError(
        mockOperation,
        'Integration test',
        { maxAttempts: 1, delayMs: 10 }
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (enhancedError) {
      expect(enhancedError).toBeInstanceOf(Error);
      // The current implementation throws the enhanced error message, not the enhanced error object
      expect(enhancedError.message).toContain('截圖處理過程中發生錯誤');
    }
  });
});