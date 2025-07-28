// Background service worker for Chrome element screenshot extension

import { MessageRouter, sendMessageToTab } from '../utils/messageHandler';
import { MessageType, UserSettings, CaptureScreenshotPayload, ElementSelectedPayload, ScreenshotSession, ScreenshotError } from '../types';
import { ScreenshotProcessor } from '../utils/screenshotProcessor';
import { ErrorHandler, ErrorInfo } from '../utils/errorHandler';

// Initialize message router
const messageRouter = new MessageRouter();

// Active screenshot sessions
const activeSessions = new Map<string, ScreenshotSession>();

// Extension lifecycle management
chrome.runtime.onInstalled.addListener(() => {
  console.log('Chrome元素截圖工具已安裝');

  // Initialize default settings
  initializeDefaultSettings();
});

// Setup message handlers
setupMessageHandlers();

// Setup message listener
messageRouter.setupListener();

/**
 * Initialize default user settings
 */
async function initializeDefaultSettings(): Promise<void> {
  const defaultSettings: UserSettings = {
    defaultFormat: 'png',
    defaultQuality: 0.9,
    filenameTemplate: 'screenshot_{timestamp}',
    autoDownload: true,
    showProgress: true,
    highlightColor: '#ff0000'
  };

  try {
    const result = await chrome.storage.sync.get('userSettings');
    if (!result.userSettings) {
      await chrome.storage.sync.set({ userSettings: defaultSettings });
    }
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
}

/**
 * Setup message handlers for different message types
 */
function setupMessageHandlers(): void {
  // Ping handler for connectivity testing
  messageRouter.register(MessageType.PING, async () => {
    return 'pong';
  });

  // Get user settings
  messageRouter.register(MessageType.GET_SETTINGS, async () => {
    try {
      const result = await chrome.storage.sync.get('userSettings');
      return result.userSettings;
    } catch (error) {
      throw new Error(`Failed to get settings: ${error}`);
    }
  });

  // Update user settings
  messageRouter.register(MessageType.UPDATE_SETTINGS, async (settings: Partial<UserSettings>) => {
    try {
      const result = await chrome.storage.sync.get('userSettings');
      const currentSettings = result.userSettings || {};
      const updatedSettings = { ...currentSettings, ...settings };

      await chrome.storage.sync.set({ userSettings: updatedSettings });
      return updatedSettings;
    } catch (error) {
      throw new Error(`Failed to update settings: ${error}`);
    }
  });

  // Start screenshot mode
  messageRouter.register(MessageType.START_SCREENSHOT, async (_payload, sender) => {
    console.log('Starting screenshot mode for tab:', sender.tab?.id);

    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    try {
      // Send message to content script to start screenshot mode
      await sendMessageToTab(sender.tab.id, MessageType.START_SCREENSHOT_MODE, {});
      return { success: true, status: 'screenshot_mode_started' };
    } catch (error) {
      console.error('Failed to start screenshot mode:', error);
      throw new Error(`Failed to start screenshot mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Exit screenshot mode
  messageRouter.register(MessageType.STOP_SCREENSHOT, async (_payload, sender) => {
    console.log('Exiting screenshot mode for tab:', sender.tab?.id);

    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    try {
      // Send message to content script to exit screenshot mode
      await sendMessageToTab(sender.tab.id, MessageType.EXIT_SCREENSHOT_MODE, {});
      return { success: true, status: 'screenshot_mode_exited' };
    } catch (error) {
      console.error('Failed to exit screenshot mode:', error);
      throw new Error(`Failed to exit screenshot mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Handle element selection and trigger screenshot
  messageRouter.register(MessageType.ELEMENT_SELECTED, async (payload: ElementSelectedPayload, sender) => {
    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    try {
      // Get user settings for screenshot options
      const settings = await getUserSettings();

      // Create screenshot options
      const options = {
        format: settings.defaultFormat,
        quality: settings.defaultQuality,
        filename: ScreenshotProcessor.generateFilename(settings.filenameTemplate, settings.defaultFormat)
      };

      // Determine if this should be a long screenshot
      const isLongScreenshot = payload.elementInfo.isScrollable &&
        payload.elementInfo.totalHeight > payload.elementInfo.visibleHeight * 1.5;

      // Create capture payload
      const capturePayload: CaptureScreenshotPayload = {
        elementInfo: payload.elementInfo,
        options
      };

      // Trigger appropriate screenshot capture
      const result = isLongScreenshot
        ? await captureLongScreenshot(sender.tab.id, capturePayload)
        : await captureElementScreenshot(sender.tab.id, capturePayload);

      return {
        status: 'screenshot_captured',
        filename: result.filename,
        sessionId: result.sessionId,
        isLongScreenshot
      };
    } catch (error) {
      console.error('Failed to handle element selection:', error);
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Handle direct screenshot capture requests
  messageRouter.register(MessageType.CAPTURE_SCREENSHOT, async (payload: CaptureScreenshotPayload, sender) => {
    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    try {
      const result = await captureElementScreenshot(sender.tab.id, payload);
      return {
        status: 'screenshot_captured',
        filename: result.filename,
        sessionId: result.sessionId
      };
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Handle manual save requests
  messageRouter.register('MANUAL_SAVE_REQUEST' as MessageType, async (payload: { sessionId: string }) => {
    try {
      await handleManualSave(payload.sessionId);
      return { status: 'manual_save_completed' };
    } catch (error) {
      console.error('Manual save failed:', error);
      throw new Error(`Manual save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
/*
*
 * Get user settings with fallback to defaults
 */
async function getUserSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.sync.get('userSettings');
    return result.userSettings || {
      defaultFormat: 'png',
      defaultQuality: 0.9,
      filenameTemplate: 'screenshot_{timestamp}',
      autoDownload: true,
      showProgress: true,
      highlightColor: '#ff0000'
    };
  } catch (error) {
    console.error('Failed to get user settings:', error);
    // Return default settings
    return {
      defaultFormat: 'png',
      defaultQuality: 0.9,
      filenameTemplate: 'screenshot_{timestamp}',
      autoDownload: true,
      showProgress: true,
      highlightColor: '#ff0000'
    };
  }
}

/**
 * Capture screenshot of specific element with comprehensive error handling
 */
async function captureElementScreenshot(
  tabId: number,
  payload: CaptureScreenshotPayload
): Promise<{ sessionId: string; filename: string }> {
  const sessionId = generateSessionId();

  return await ErrorHandler.handleError(
    async () => {
      // Create screenshot session
      const session: ScreenshotSession = {
        id: sessionId,
        tabId,
        element: payload.elementInfo,
        options: payload.options,
        status: 'processing',
        progress: 0
      };

      activeSessions.set(sessionId, session);

      try {
        // Notify progress start
        await notifyProgress(sessionId, 10, '開始截圖捕獲...');

        // Capture full page screenshot with retry
        const fullScreenshot = await ErrorHandler.handleError(
          () => ScreenshotProcessor.captureFullPage(tabId),
          'Full page capture',
          { maxAttempts: 2, delayMs: 500 }
        );

        await notifyProgress(sessionId, 30, '頁面截圖完成，正在處理元素...');

        // Get device pixel ratio
        const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(tabId);
        await notifyProgress(sessionId, 40, '正在裁剪到元素區域...');

        // Crop to element area with retry
        const croppedScreenshot = await ErrorHandler.handleError(
          () => ScreenshotProcessor.cropToElement(
            fullScreenshot,
            payload.elementInfo,
            devicePixelRatio
          ),
          'Element cropping',
          { maxAttempts: 2, delayMs: 300 }
        );

        await notifyProgress(sessionId, 60, '正在轉換格式...');

        // Convert to desired format with retry
        const finalScreenshot = await ErrorHandler.handleError(
          () => ScreenshotProcessor.convertFormat(croppedScreenshot, payload.options),
          'Format conversion',
          { maxAttempts: 2, delayMs: 200 }
        );

        await notifyProgress(sessionId, 80, '準備下載...');

        // Generate filename
        const filename = ScreenshotProcessor.generateFilename(
          payload.options.filename,
          payload.options.format
        );

        // Download screenshot with retry and manual save fallback
        try {
          await ErrorHandler.handleError(
            () => ScreenshotProcessor.downloadScreenshot(finalScreenshot, filename),
            'Screenshot download',
            { maxAttempts: 3, delayMs: 1000 }
          );
        } catch (downloadError) {
          // Offer manual save option
          await offerManualSave(sessionId, finalScreenshot, filename);
        }

        await notifyProgress(sessionId, 100, '截圖完成！');

        // Update session
        session.status = 'completed';
        session.progress = 100;
        session.result = finalScreenshot;

        // Notify completion
        await notifyCompletion(sessionId, finalScreenshot, filename);

        return { sessionId, filename };

      } finally {
        // Clean up session after delay
        setTimeout(() => {
          activeSessions.delete(sessionId);
        }, 5000);
      }
    },
    'Element screenshot capture',
    {
      maxAttempts: 2,
      delayMs: 1000,
      retryableErrors: [ScreenshotError.CAPTURE_FAILED, ScreenshotError.PROCESSING_ERROR]
    },
    {
      enableSimpleScreenshot: true,
      enableManualSave: true,
      enableQualityReduction: true
    }
  ).catch(async (error) => {
    // Handle final error
    const session = activeSessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.progress = 0;
    }

    // Create comprehensive error info
    const screenshotError = ErrorHandler.classifyError(error);
    const errorInfo = ErrorHandler.createErrorInfo(screenshotError, error);

    // Log error
    ErrorHandler.logError(errorInfo, 'Element Screenshot');

    // Notify user with friendly message
    await notifyEnhancedError(sessionId, errorInfo);

    // Clean up session
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 1000);

    throw ErrorHandler.createUserMessage(errorInfo);
  });
}

/**
 * Notify screenshot progress
 */
async function notifyProgress(sessionId: string, progress: number, status: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.progress = progress;

  try {
    await sendMessageToTab(session.tabId, MessageType.SCREENSHOT_PROGRESS, {
      sessionId,
      progress,
      status
    });
  } catch (error) {
    console.warn('Failed to notify progress:', error);
  }
}

/**
 * Notify screenshot completion
 */
async function notifyCompletion(sessionId: string, result: string, filename: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await sendMessageToTab(session.tabId, MessageType.SCREENSHOT_COMPLETE, {
      sessionId,
      result,
      filename
    });
  } catch (error) {
    console.warn('Failed to notify completion:', error);
  }
}

/**
 * Notify screenshot error
 */
async function notifyError(sessionId: string, error: ScreenshotError, message: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await sendMessageToTab(session.tabId, MessageType.ERROR_OCCURRED, {
      error,
      message,
      details: { sessionId }
    });
  } catch (err) {
    console.warn('Failed to notify error:', err);
  }
}

/**
 * Capture long screenshot with scrolling and stitching with enhanced error handling
 */
async function captureLongScreenshot(
  tabId: number,
  payload: CaptureScreenshotPayload
): Promise<{ sessionId: string; filename: string }> {
  const sessionId = generateSessionId();

  return await ErrorHandler.handleError(
    async () => {
      // Create screenshot session
      const session: ScreenshotSession = {
        id: sessionId,
        tabId,
        element: payload.elementInfo,
        options: payload.options,
        status: 'processing',
        progress: 0,
        isLongScreenshot: true,
        segments: [],
        totalSegments: 0
      };

      activeSessions.set(sessionId, session);

      try {
        // Notify progress start
        await notifyProgress(sessionId, 5, '開始長截圖捕獲...');

        // Get device pixel ratio
        const devicePixelRatio = await ScreenshotProcessor.getDevicePixelRatio(tabId);
        await notifyProgress(sessionId, 10, '檢測滾動區域...');

        // Capture multiple segments with retry
        const { segments } = await ErrorHandler.handleError(
          () => ScreenshotProcessor.captureLongScreenshot(
            tabId,
            payload.elementInfo,
            devicePixelRatio
          ),
          'Long screenshot segments capture',
          { maxAttempts: 2, delayMs: 1000 }
        );

        session.segments = segments;
        session.totalSegments = segments.length;

        await notifyProgress(sessionId, 50, `已捕獲 ${segments.length} 個片段，正在拼接...`);

        // Stitch segments together with retry
        const stitchedScreenshot = await ErrorHandler.handleError(
          () => ScreenshotProcessor.stitchScreenshotSegments(
            segments,
            payload.elementInfo,
            devicePixelRatio
          ),
          'Screenshot stitching',
          { maxAttempts: 2, delayMs: 500 }
        );

        await notifyProgress(sessionId, 80, '轉換格式中...');

        // Convert to desired format with retry
        const finalScreenshot = await ErrorHandler.handleError(
          () => ScreenshotProcessor.convertFormat(stitchedScreenshot, payload.options),
          'Format conversion',
          { maxAttempts: 2, delayMs: 200 }
        );

        await notifyProgress(sessionId, 90, '準備下載...');

        // Generate filename
        const filename = ScreenshotProcessor.generateFilename(
          payload.options.filename,
          payload.options.format
        );

        // Download screenshot with retry and manual save fallback
        try {
          await ErrorHandler.handleError(
            () => ScreenshotProcessor.downloadScreenshot(finalScreenshot, filename),
            'Long screenshot download',
            { maxAttempts: 3, delayMs: 1000 }
          );
        } catch (downloadError) {
          // Offer manual save option
          await offerManualSave(sessionId, finalScreenshot, filename);
        }

        await notifyProgress(sessionId, 100, '長截圖完成！');

        // Update session
        session.status = 'completed';
        session.progress = 100;
        session.result = finalScreenshot;

        // Notify completion
        await notifyCompletion(sessionId, finalScreenshot, filename);

        return { sessionId, filename };

      } finally {
        // Clean up session after delay
        setTimeout(() => {
          activeSessions.delete(sessionId);
        }, 5000);
      }
    },
    'Long screenshot capture',
    {
      maxAttempts: 2,
      delayMs: 2000,
      retryableErrors: [ScreenshotError.CAPTURE_FAILED, ScreenshotError.PROCESSING_ERROR]
    },
    {
      enableSimpleScreenshot: true,
      enableManualSave: true,
      enableQualityReduction: true
    }
  ).catch(async (error) => {
    // Handle final error
    const session = activeSessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.progress = 0;
    }

    // Create comprehensive error info
    const screenshotError = ErrorHandler.classifyError(error);
    const errorInfo = ErrorHandler.createErrorInfo(screenshotError, error);

    // Log error
    ErrorHandler.logError(errorInfo, 'Long Screenshot');

    // Notify user with friendly message
    await notifyEnhancedError(sessionId, errorInfo);

    // Clean up session
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 1000);

    throw ErrorHandler.createUserMessage(errorInfo);
  });
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Notify enhanced error with comprehensive information
 */
async function notifyEnhancedError(sessionId: string, errorInfo: ErrorInfo): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await sendMessageToTab(session.tabId, MessageType.ERROR_OCCURRED, {
      error: errorInfo.code,
      message: errorInfo.chineseMessage,
      details: {
        sessionId,
        severity: errorInfo.severity,
        userAction: errorInfo.userAction,
        retryable: errorInfo.retryable,
        fallbackAvailable: errorInfo.fallbackAvailable,
        shouldOfferManualSave: ErrorHandler.shouldOfferManualSave(errorInfo)
      }
    });
  } catch (error) {
    console.warn('Failed to notify enhanced error:', error);
  }
}

/**
 * Offer manual save option when download fails
 */
async function offerManualSave(sessionId: string, screenshotData: string, filename: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    // Store screenshot data for manual save
    await chrome.storage.local.set({
      [`manual_save_${sessionId}`]: {
        data: screenshotData,
        filename: filename,
        timestamp: Date.now()
      }
    });

    // Notify content script about manual save option
    await sendMessageToTab(session.tabId, MessageType.ERROR_OCCURRED, {
      error: ScreenshotError.DOWNLOAD_FAILED,
      message: '自動下載失敗，已準備手動保存選項',
      details: {
        sessionId,
        manualSaveAvailable: true,
        filename
      }
    });

    console.log(`Manual save option prepared for session ${sessionId}`);
  } catch (error) {
    console.error('Failed to prepare manual save option:', error);
  }
}

/**
 * Handle manual save request
 */
async function handleManualSave(sessionId: string): Promise<void> {
  try {
    const result = await chrome.storage.local.get(`manual_save_${sessionId}`);
    const saveData = result[`manual_save_${sessionId}`];

    if (!saveData) {
      throw new Error('Manual save data not found');
    }

    // Create blob URL for manual download
    const response = await fetch(saveData.data);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download with saveAs dialog
    await chrome.downloads.download({
      url: url,
      filename: saveData.filename,
      saveAs: true
    });

    // Clean up
    await chrome.storage.local.remove(`manual_save_${sessionId}`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log(`Manual save completed for session ${sessionId}`);
  } catch (error) {
    console.error('Manual save failed:', error);
    throw new Error(`手動保存失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
}