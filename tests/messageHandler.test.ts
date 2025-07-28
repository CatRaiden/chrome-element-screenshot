// Unit tests for message handling system

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageRouter, sendMessageToBackground, sendMessageToTab } from '../src/utils/messageHandler';
import { MessageType, MessageRequest, MessageResponse } from '../src/types';

describe('MessageRouter', () => {
  let messageRouter: MessageRouter;
  let mockSender: chrome.runtime.MessageSender;

  beforeEach(() => {
    messageRouter = new MessageRouter();
    mockSender = {
      tab: { id: 1, url: 'https://example.com' },
      frameId: 0,
      id: 'test-extension-id'
    };
  });

  describe('register and handle', () => {
    it('should register and execute message handlers', async () => {
      const mockHandler = vi.fn().mockResolvedValue('test result');
      messageRouter.register(MessageType.PING, mockHandler);

      const request: MessageRequest = {
        type: MessageType.PING,
        payload: { test: 'data' },
        requestId: 'test-123'
      };

      const response = await messageRouter.handle(request, mockSender);

      expect(mockHandler).toHaveBeenCalledWith({ test: 'data' }, mockSender);
      expect(response).toEqual({
        success: true,
        data: 'test result',
        requestId: 'test-123'
      });
    });

    it('should handle synchronous handlers', async () => {
      const mockHandler = vi.fn().mockReturnValue('sync result');
      messageRouter.register(MessageType.PING, mockHandler);

      const request: MessageRequest = {
        type: MessageType.PING,
        payload: null
      };

      const response = await messageRouter.handle(request, mockSender);

      expect(response).toEqual({
        success: true,
        data: 'sync result',
        requestId: undefined
      });
    });

    it('should return error for unregistered message types', async () => {
      const request: MessageRequest = {
        type: MessageType.START_SCREENSHOT_MODE,
        requestId: 'test-456'
      };

      const response = await messageRouter.handle(request, mockSender);

      expect(response).toEqual({
        success: false,
        error: 'No handler registered for message type: START_SCREENSHOT_MODE',
        requestId: 'test-456'
      });
    });

    it('should handle handler errors gracefully', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      messageRouter.register(MessageType.PING, mockHandler);

      const request: MessageRequest = {
        type: MessageType.PING,
        requestId: 'test-789'
      };

      const response = await messageRouter.handle(request, mockSender);

      expect(response).toEqual({
        success: false,
        error: 'Handler error',
        requestId: 'test-789'
      });
    });

    it('should handle non-Error exceptions', async () => {
      const mockHandler = vi.fn().mockRejectedValue('String error');
      messageRouter.register(MessageType.PING, mockHandler);

      const request: MessageRequest = {
        type: MessageType.PING
      };

      const response = await messageRouter.handle(request, mockSender);

      expect(response).toEqual({
        success: false,
        error: 'String error',
        requestId: undefined
      });
    });
  });

  describe('setupListener', () => {
    it('should setup Chrome runtime message listener', () => {
      const mockAddListener = vi.fn();
      chrome.runtime.onMessage.addListener = mockAddListener;

      messageRouter.setupListener();

      expect(mockAddListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle messages through the listener', async () => {
      const mockHandler = vi.fn().mockResolvedValue('listener result');
      messageRouter.register(MessageType.PING, mockHandler);

      let messageListener: Function;
      chrome.runtime.onMessage.addListener = vi.fn((listener) => {
        messageListener = listener;
      });

      messageRouter.setupListener();

      const mockSendResponse = vi.fn();
      const request: MessageRequest = {
        type: MessageType.PING,
        payload: 'test'
      };

      const result = messageListener(request, mockSender, mockSendResponse);

      expect(result).toBe(true); // Should return true to keep channel open

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: 'listener result',
        requestId: undefined
      });
    });
  });
});

describe('sendMessageToBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  it('should send message to background script successfully', async () => {
    const mockResponse: MessageResponse = {
      success: true,
      data: 'background response'
    };

    chrome.runtime.sendMessage = vi.fn((request, callback) => {
      callback(mockResponse);
    });

    const response = await sendMessageToBackground(MessageType.PING, { test: 'data' });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.PING,
        payload: { test: 'data' },
        requestId: expect.any(String)
      }),
      expect.any(Function)
    );

    expect(response.success).toBe(true);
    expect(response.data).toBe('background response');
    expect(response.requestId).toBeUndefined(); // Mock doesn't preserve requestId
  });

  it('should handle Chrome runtime errors', async () => {
    chrome.runtime.lastError = { message: 'Extension context invalidated' };
    chrome.runtime.sendMessage = vi.fn((request, callback) => {
      callback(null);
    });

    const response = await sendMessageToBackground(MessageType.PING);

    expect(response).toEqual({
      success: false,
      error: 'Extension context invalidated',
      requestId: expect.any(String)
    });
  });

  it('should generate unique request IDs', async () => {
    let capturedRequests: any[] = [];
    chrome.runtime.sendMessage = vi.fn((request, callback) => {
      capturedRequests.push(request);
      callback({ success: true });
    });

    await sendMessageToBackground(MessageType.PING);
    await sendMessageToBackground(MessageType.PING);

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[0].requestId).toBeDefined();
    expect(capturedRequests[1].requestId).toBeDefined();
    expect(capturedRequests[0].requestId).not.toBe(capturedRequests[1].requestId);
  });
});

describe('sendMessageToTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  it('should send message to specific tab successfully', async () => {
    const mockResponse: MessageResponse = {
      success: true,
      data: 'tab response'
    };

    chrome.tabs.sendMessage = vi.fn((tabId, request, callback) => {
      callback(mockResponse);
    });

    const response = await sendMessageToTab(123, MessageType.START_SCREENSHOT_MODE, { option: 'test' });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        type: MessageType.START_SCREENSHOT_MODE,
        payload: { option: 'test' },
        requestId: expect.any(String)
      }),
      expect.any(Function)
    );

    expect(response.success).toBe(true);
    expect(response.data).toBe('tab response');
    expect(response.requestId).toBeUndefined(); // Mock doesn't preserve requestId
  });

  it('should handle tab communication errors', async () => {
    chrome.runtime.lastError = { message: 'Could not establish connection' };
    chrome.tabs.sendMessage = vi.fn((tabId, request, callback) => {
      callback(null);
    });

    const response = await sendMessageToTab(123, MessageType.PING);

    expect(response).toEqual({
      success: false,
      error: 'Could not establish connection',
      requestId: expect.any(String)
    });
  });
});