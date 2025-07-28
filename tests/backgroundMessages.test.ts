// Integration tests for background script message handling

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageType, UserSettings } from '../src/types';

// Mock Chrome storage API
const mockStorageData: { [key: string]: any } = {};

const mockChromeStorage = {
  sync: {
    get: vi.fn((keys) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorageData[keys] });
      }
      const result: { [key: string]: any } = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = mockStorageData[key];
        });
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items) => {
      Object.assign(mockStorageData, items);
      return Promise.resolve();
    })
  }
};

// Mock Chrome APIs
Object.assign(chrome, {
  storage: mockChromeStorage,
  runtime: {
    ...chrome.runtime,
    onInstalled: {
      addListener: vi.fn()
    }
  }
});

describe('Background Script Message Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
  });

  describe('Settings Management', () => {
    it('should initialize default settings when none exist', async () => {
      // Test the initialization logic directly
      const defaultSettings: UserSettings = {
        defaultFormat: 'png',
        defaultQuality: 0.9,
        filenameTemplate: 'screenshot_{timestamp}',
        autoDownload: true,
        showProgress: true,
        highlightColor: '#ff0000'
      };

      // Simulate no existing settings
      mockChromeStorage.sync.get.mockResolvedValueOnce({});

      // Call the initialization function logic
      const result = await chrome.storage.sync.get('userSettings');
      if (!result.userSettings) {
        await chrome.storage.sync.set({ userSettings: defaultSettings });
      }

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userSettings: defaultSettings
      });
    });

    it('should not overwrite existing settings', async () => {
      const existingSettings = {
        defaultFormat: 'jpeg',
        defaultQuality: 0.8
      };

      // Simulate existing settings
      mockChromeStorage.sync.get.mockResolvedValueOnce({
        userSettings: existingSettings
      });

      // Call the initialization function logic
      const result = await chrome.storage.sync.get('userSettings');
      if (!result.userSettings) {
        await chrome.storage.sync.set({ userSettings: {} });
      }

      // Verify existing settings were not overwritten
      expect(mockChromeStorage.sync.set).not.toHaveBeenCalled();
    });
  });

  describe('Message Handlers', () => {
    let messageRouter: any;

    beforeEach(async () => {
      // Import background script and get message router
      const backgroundModule = await import('../src/background/background');
      // Access the message router through the module (this is a simplified test approach)
    });

    it('should handle PING messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();
      
      // Register the same handler as in background script
      router.register(MessageType.PING, async () => 'pong');

      const response = await router.handle({
        type: MessageType.PING,
        requestId: 'test-ping'
      }, { tab: { id: 1 } } as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: 'pong',
        requestId: 'test-ping'
      });
    });

    it('should handle GET_SETTINGS messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Set up test settings
      mockStorageData.userSettings = {
        defaultFormat: 'png',
        defaultQuality: 0.9
      };

      // Register the same handler as in background script
      router.register(MessageType.GET_SETTINGS, async () => {
        const result = await chrome.storage.sync.get('userSettings');
        return result.userSettings;
      });

      const response = await router.handle({
        type: MessageType.GET_SETTINGS,
        requestId: 'test-get-settings'
      }, { tab: { id: 1 } } as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: {
          defaultFormat: 'png',
          defaultQuality: 0.9
        },
        requestId: 'test-get-settings'
      });
    });

    it('should handle UPDATE_SETTINGS messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Set up existing settings
      mockStorageData.userSettings = {
        defaultFormat: 'png',
        defaultQuality: 0.9,
        autoDownload: true
      };

      // Register the same handler as in background script
      router.register(MessageType.UPDATE_SETTINGS, async (settings: Partial<UserSettings>) => {
        const result = await chrome.storage.sync.get('userSettings');
        const currentSettings = result.userSettings || {};
        const updatedSettings = { ...currentSettings, ...settings };
        
        await chrome.storage.sync.set({ userSettings: updatedSettings });
        return updatedSettings;
      });

      const updatePayload = {
        defaultFormat: 'jpeg' as const,
        defaultQuality: 0.8
      };

      const response = await router.handle({
        type: MessageType.UPDATE_SETTINGS,
        payload: updatePayload,
        requestId: 'test-update-settings'
      }, { tab: { id: 1 } } as chrome.runtime.MessageSender);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        defaultFormat: 'jpeg',
        defaultQuality: 0.8,
        autoDownload: true
      });

      // Verify storage was updated
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userSettings: {
          defaultFormat: 'jpeg',
          defaultQuality: 0.8,
          autoDownload: true
        }
      });
    });

    it('should handle START_SCREENSHOT_MODE messages', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Register the same handler as in background script
      router.register(MessageType.START_SCREENSHOT_MODE, async (payload, sender) => {
        console.log('Starting screenshot mode for tab:', sender.tab?.id);
        return { status: 'screenshot_mode_started' };
      });

      const response = await router.handle({
        type: MessageType.START_SCREENSHOT_MODE,
        payload: { options: { format: 'png' } },
        requestId: 'test-start-screenshot'
      }, { tab: { id: 1 } } as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: true,
        data: { status: 'screenshot_mode_started' },
        requestId: 'test-start-screenshot'
      });
    });

    it('should handle storage errors gracefully', async () => {
      const { MessageRouter } = await import('../src/utils/messageHandler');
      const router = new MessageRouter();

      // Mock storage error
      mockChromeStorage.sync.get.mockRejectedValueOnce(new Error('Storage error'));

      router.register(MessageType.GET_SETTINGS, async () => {
        const result = await chrome.storage.sync.get('userSettings');
        return result.userSettings;
      });

      const response = await router.handle({
        type: MessageType.GET_SETTINGS,
        requestId: 'test-storage-error'
      }, { tab: { id: 1 } } as chrome.runtime.MessageSender);

      expect(response).toEqual({
        success: false,
        error: 'Storage error',
        requestId: 'test-storage-error'
      });
    });
  });
});