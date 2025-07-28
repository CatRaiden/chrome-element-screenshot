// Integration tests for content script message handling

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageType } from '../src/types';

describe('Content Script Message Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset Chrome runtime mock
    chrome.runtime.sendMessage = vi.fn();
    chrome.runtime.lastError = null;
  });

  describe('Message Handlers', () => {
    it('should handle PING messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Register the same handler as in content script
      router.register(MessageType.PING, async () => 'content script ready');

      const response = await router.handle({
        type: MessageType.PING,
        requestId: 'test-ping'
      }, {} as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: 'content script ready',
        requestId: 'test-ping'
      });
    });

    it('should handle START_SCREENSHOT_MODE messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Register the same handler as in content script
      router.register(MessageType.START_SCREENSHOT_MODE, async (payload) => {
        console.log('Starting screenshot mode in content script');
        return { status: 'screenshot_mode_started_in_content' };
      });

      const response = await router.handle({
        type: MessageType.START_SCREENSHOT_MODE,
        payload: { options: { format: 'png' } },
        requestId: 'test-start-mode'
      }, {} as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: { status: 'screenshot_mode_started_in_content' },
        requestId: 'test-start-mode'
      });
    });

    it('should handle EXIT_SCREENSHOT_MODE messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Register the same handler as in content script
      router.register(MessageType.EXIT_SCREENSHOT_MODE, async (payload) => {
        console.log('Exiting screenshot mode in content script');
        return { status: 'screenshot_mode_exited_in_content' };
      });

      const response = await router.handle({
        type: MessageType.EXIT_SCREENSHOT_MODE,
        requestId: 'test-exit-mode'
      }, {} as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: { status: 'screenshot_mode_exited_in_content' },
        requestId: 'test-exit-mode'
      });
    });

    it('should handle ELEMENT_SELECTED messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Register the same handler as in content script
      router.register(MessageType.ELEMENT_SELECTED, async (payload) => {
        console.log('Element selected:', payload);
        return { status: 'element_selection_handled' };
      });

      const elementPayload = {
        elementInfo: {
          selector: 'div.test',
          boundingRect: { x: 0, y: 0, width: 100, height: 100 },
          isScrollable: false,
          totalHeight: 100,
          visibleHeight: 100
        }
      };

      const response = await router.handle({
        type: MessageType.ELEMENT_SELECTED,
        payload: elementPayload,
        requestId: 'test-element-selected'
      }, {} as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: { status: 'element_selection_handled' },
        requestId: 'test-element-selected'
      });
    });
  });

  describe('Background Communication', () => {
    it('should test background connection successfully', async () => {
      // Mock successful response from background
      chrome.runtime.sendMessage = vi.fn((request, callback) => {
        callback({
          success: true,
          data: 'pong',
          requestId: request.requestId
        });
      });

      const { testBackgroundConnection } = await import('../src/content/content');
      const result = await testBackgroundConnection();

      expect(result).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.PING,
          requestId: expect.any(String)
        }),
        expect.any(Function)
      );
    });

    it('should handle background connection failure', async () => {
      // Mock failed response from background
      chrome.runtime.sendMessage = vi.fn((request, callback) => {
        callback({
          success: false,
          error: 'Background script not available'
        });
      });

      const { testBackgroundConnection } = await import('../src/content/content');
      const result = await testBackgroundConnection();

      expect(result).toBe(false);
    });

    it('should handle Chrome runtime errors', async () => {
      // Mock Chrome runtime error
      chrome.runtime.lastError = { message: 'Extension context invalidated' };
      chrome.runtime.sendMessage = vi.fn((request, callback) => {
        callback(null);
      });

      const { testBackgroundConnection } = await import('../src/content/content');
      const result = await testBackgroundConnection();

      expect(result).toBe(false);
    });

    it('should get user settings from background', async () => {
      const mockSettings = {
        defaultFormat: 'png',
        defaultQuality: 0.9,
        autoDownload: true
      };

      chrome.runtime.sendMessage = vi.fn((request, callback) => {
        callback({
          success: true,
          data: mockSettings,
          requestId: request.requestId
        });
      });

      const { getUserSettings } = await import('../src/content/content');
      const settings = await getUserSettings();

      expect(settings).toEqual(mockSettings);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.GET_SETTINGS,
          requestId: expect.any(String)
        }),
        expect.any(Function)
      );
    });

    it('should handle settings retrieval errors', async () => {
      chrome.runtime.sendMessage = vi.fn((request, callback) => {
        callback({
          success: false,
          error: 'Settings not found'
        });
      });

      const { getUserSettings } = await import('../src/content/content');
      
      await expect(getUserSettings()).rejects.toThrow('Settings not found');
    });
  });
});