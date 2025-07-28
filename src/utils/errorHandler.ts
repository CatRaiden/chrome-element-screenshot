// Comprehensive error handling system for Chrome element screenshot extension

import { ScreenshotError, MessageType } from '../types';

export interface ErrorInfo {
  code: ScreenshotError;
  message: string;
  chineseMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  fallbackAvailable: boolean;
  userAction?: string;
  technicalDetails?: any;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  retryableErrors: ScreenshotError[];
}

export interface FallbackOptions {
  enableSimpleScreenshot: boolean;
  enableManualSave: boolean;
  enableQualityReduction: boolean;
  enableFormatFallback: boolean;
}

export class ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: [
      ScreenshotError.CAPTURE_FAILED,
      ScreenshotError.PROCESSING_ERROR,
      ScreenshotError.DOWNLOAD_FAILED
    ]
  };

  private static readonly DEFAULT_FALLBACK_OPTIONS: FallbackOptions = {
    enableSimpleScreenshot: true,
    enableManualSave: true,
    enableQualityReduction: true,
    enableFormatFallback: true
  };

  private static readonly ERROR_DEFINITIONS: Record<ScreenshotError, Omit<ErrorInfo, 'technicalDetails'>> = {
    [ScreenshotError.ELEMENT_NOT_FOUND]: {
      code: ScreenshotError.ELEMENT_NOT_FOUND,
      message: 'Element not found on the page',
      chineseMessage: '頁面上找不到指定的元素',
      severity: 'medium',
      retryable: false,
      fallbackAvailable: false,
      userAction: '請重新選擇要截圖的元素'
    },
    [ScreenshotError.PERMISSION_DENIED]: {
      code: ScreenshotError.PERMISSION_DENIED,
      message: 'Permission denied for screenshot capture',
      chineseMessage: '截圖權限被拒絕',
      severity: 'high',
      retryable: false,
      fallbackAvailable: false,
      userAction: '請檢查瀏覽器權限設置並重新載入頁面'
    },
    [ScreenshotError.CAPTURE_FAILED]: {
      code: ScreenshotError.CAPTURE_FAILED,
      message: 'Failed to capture screenshot',
      chineseMessage: '截圖捕獲失敗',
      severity: 'medium',
      retryable: true,
      fallbackAvailable: true,
      userAction: '正在嘗試重新截圖...'
    },
    [ScreenshotError.PROCESSING_ERROR]: {
      code: ScreenshotError.PROCESSING_ERROR,
      message: 'Error processing screenshot',
      chineseMessage: '截圖處理過程中發生錯誤',
      severity: 'medium',
      retryable: true,
      fallbackAvailable: true,
      userAction: '正在嘗試使用簡化模式...'
    },
    [ScreenshotError.DOWNLOAD_FAILED]: {
      code: ScreenshotError.DOWNLOAD_FAILED,
      message: 'Failed to download screenshot',
      chineseMessage: '截圖下載失敗',
      severity: 'low',
      retryable: true,
      fallbackAvailable: true,
      userAction: '正在準備手動保存選項...'
    }
  };

  /**
   * Create comprehensive error information
   */
  static createErrorInfo(
    error: ScreenshotError,
    technicalDetails?: any,
    customMessage?: string
  ): ErrorInfo {
    const baseInfo = this.ERROR_DEFINITIONS[error];
    
    return {
      ...baseInfo,
      message: customMessage || baseInfo.message,
      technicalDetails
    };
  }

  /**
   * Handle error with retry and fallback logic
   */
  static async handleError<T>(
    operation: () => Promise<T>,
    errorContext: string,
    retryConfig: Partial<RetryConfig> = {},
    fallbackOptions: Partial<FallbackOptions> = {}
  ): Promise<T> {
    const config = { ...this.DEFAULT_RETRY_CONFIG, ...retryConfig };
    const fallbacks = { ...this.DEFAULT_FALLBACK_OPTIONS, ...fallbackOptions };
    
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < config.maxAttempts) {
      try {
        attempt++;
        console.log(`${errorContext} - Attempt ${attempt}/${config.maxAttempts}`);
        
        const result = await operation();
        
        // Success - log recovery if this wasn't the first attempt
        if (attempt > 1) {
          console.log(`${errorContext} - Recovered after ${attempt} attempts`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`${errorContext} - Attempt ${attempt} failed:`, lastError.message);
        
        // Check if error is retryable
        const screenshotError = this.classifyError(lastError);
        const errorInfo = this.createErrorInfo(screenshotError, lastError);
        
        if (!errorInfo.retryable || attempt >= config.maxAttempts) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);
        await this.delay(delay);
      }
    }

    // All retries failed, try fallback options
    if (lastError) {
      const screenshotError = this.classifyError(lastError);
      const errorInfo = this.createErrorInfo(screenshotError, lastError);
      
      if (errorInfo.fallbackAvailable) {
        console.log(`${errorContext} - Attempting fallback options`);
        return await this.attemptFallback(operation, errorInfo, fallbacks);
      }
      
      // No fallback available, throw the error
      throw this.enhanceError(lastError, errorInfo);
    }
    
    throw new Error(`${errorContext} - Unknown error occurred`);
  }

  /**
   * Classify error into screenshot error types
   */
  static classifyError(error: Error): ScreenshotError {
    const message = error.message.toLowerCase();
    
    if (message.includes('element not found') || message.includes('selector')) {
      return ScreenshotError.ELEMENT_NOT_FOUND;
    }
    
    if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
      return ScreenshotError.PERMISSION_DENIED;
    }
    
    if (message.includes('download') || message.includes('save')) {
      return ScreenshotError.DOWNLOAD_FAILED;
    }
    
    if (message.includes('capture') || message.includes('screenshot')) {
      return ScreenshotError.CAPTURE_FAILED;
    }
    
    // Default to processing error
    return ScreenshotError.PROCESSING_ERROR;
  }

  /**
   * Attempt fallback operations
   */
  private static async attemptFallback<T>(
    originalOperation: () => Promise<T>,
    errorInfo: ErrorInfo,
    fallbackOptions: FallbackOptions
  ): Promise<T> {
    const fallbackStrategies = this.getFallbackStrategies(errorInfo.code, fallbackOptions);
    
    for (const strategy of fallbackStrategies) {
      try {
        console.log(`Attempting fallback strategy: ${strategy.name}`);
        return await strategy.operation();
      } catch (fallbackError) {
        console.warn(`Fallback strategy ${strategy.name} failed:`, fallbackError);
        continue;
      }
    }
    
    // All fallbacks failed
    throw new Error(`All fallback strategies failed for error: ${errorInfo.chineseMessage}`);
  }

  /**
   * Get appropriate fallback strategies for error type
   */
  private static getFallbackStrategies<T>(
    errorCode: ScreenshotError,
    fallbackOptions: FallbackOptions
  ): Array<{ name: string; operation: () => Promise<T> }> {
    const strategies: Array<{ name: string; operation: () => Promise<T> }> = [];
    
    switch (errorCode) {
      case ScreenshotError.CAPTURE_FAILED:
        if (fallbackOptions.enableSimpleScreenshot) {
          strategies.push({
            name: 'Simple Screenshot Mode',
            operation: async () => {
              // This would be implemented to use basic screenshot without complex features
              throw new Error('Simple screenshot fallback not implemented yet');
            }
          });
        }
        break;
        
      case ScreenshotError.PROCESSING_ERROR:
        if (fallbackOptions.enableQualityReduction) {
          strategies.push({
            name: 'Reduced Quality Mode',
            operation: async () => {
              // This would be implemented to reduce quality/complexity
              throw new Error('Quality reduction fallback not implemented yet');
            }
          });
        }
        if (fallbackOptions.enableFormatFallback) {
          strategies.push({
            name: 'Format Fallback',
            operation: async () => {
              // This would be implemented to try different formats
              throw new Error('Format fallback not implemented yet');
            }
          });
        }
        break;
        
      case ScreenshotError.DOWNLOAD_FAILED:
        if (fallbackOptions.enableManualSave) {
          strategies.push({
            name: 'Manual Save Option',
            operation: async () => {
              // This would be implemented to provide manual save
              throw new Error('Manual save fallback not implemented yet');
            }
          });
        }
        break;
    }
    
    return strategies;
  }

  /**
   * Enhance error with additional context
   */
  private static enhanceError(originalError: Error, errorInfo: ErrorInfo): Error {
    const enhancedError = new Error(errorInfo.chineseMessage);
    enhancedError.name = `ScreenshotError_${errorInfo.code}`;
    enhancedError.stack = originalError.stack;
    
    // Add custom properties
    (enhancedError as any).originalError = originalError;
    (enhancedError as any).errorInfo = errorInfo;
    (enhancedError as any).severity = errorInfo.severity;
    (enhancedError as any).userAction = errorInfo.userAction;
    
    return enhancedError;
  }

  /**
   * Delay utility for retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with appropriate level based on severity
   */
  static logError(errorInfo: ErrorInfo, context?: string): void {
    const logMessage = `${context ? `[${context}] ` : ''}${errorInfo.chineseMessage}`;
    
    switch (errorInfo.severity) {
      case 'critical':
        console.error(logMessage, errorInfo.technicalDetails);
        break;
      case 'high':
        console.error(logMessage, errorInfo.technicalDetails);
        break;
      case 'medium':
        console.warn(logMessage, errorInfo.technicalDetails);
        break;
      case 'low':
        console.info(logMessage, errorInfo.technicalDetails);
        break;
    }
  }

  /**
   * Create user-friendly error message for display
   */
  static createUserMessage(errorInfo: ErrorInfo): string {
    let message = errorInfo.chineseMessage;
    
    if (errorInfo.userAction) {
      message += `\n${errorInfo.userAction}`;
    }
    
    if (errorInfo.retryable) {
      message += '\n系統將自動重試...';
    }
    
    return message;
  }

  /**
   * Check if error should trigger manual save option
   */
  static shouldOfferManualSave(errorInfo: ErrorInfo): boolean {
    return errorInfo.code === ScreenshotError.DOWNLOAD_FAILED || 
           (errorInfo.fallbackAvailable && errorInfo.severity !== 'critical');
  }

  /**
   * Generate error report for debugging
   */
  static generateErrorReport(errorInfo: ErrorInfo, context?: string): object {
    return {
      timestamp: new Date().toISOString(),
      context: context || 'unknown',
      errorCode: errorInfo.code,
      severity: errorInfo.severity,
      message: errorInfo.message,
      chineseMessage: errorInfo.chineseMessage,
      retryable: errorInfo.retryable,
      fallbackAvailable: errorInfo.fallbackAvailable,
      userAction: errorInfo.userAction,
      technicalDetails: errorInfo.technicalDetails,
      userAgent: navigator.userAgent,
      url: window.location?.href || 'unknown'
    };
  }
}

// Export error handling utilities
export { ScreenshotError };