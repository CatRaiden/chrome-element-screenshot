// Message handling utilities for Chrome extension communication

import { MessageRequest, MessageResponse, MessageType } from '../types';

export type MessageHandler<T = any, R = any> = (
  payload: T,
  sender: chrome.runtime.MessageSender
) => Promise<R> | R;

export class MessageRouter {
  private handlers = new Map<MessageType, MessageHandler>();

  /**
   * Register a message handler for a specific message type
   */
  register<T = any, R = any>(type: MessageType, handler: MessageHandler<T, R>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Handle incoming message and route to appropriate handler
   */
  async handle(
    request: MessageRequest,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      const handler = this.handlers.get(request.type);
      
      if (!handler) {
        const response: MessageResponse = {
          success: false,
          error: `No handler registered for message type: ${request.type}`
        };
        if (request.requestId !== undefined) {
          response.requestId = request.requestId;
        }
        return response;
      }

      const result = await handler(request.payload, sender);
      
      const response: MessageResponse = {
        success: true,
        data: result
      };
      if (request.requestId !== undefined) {
        response.requestId = request.requestId;
      }
      return response;
    } catch (error) {
      const response: MessageResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      if (request.requestId !== undefined) {
        response.requestId = request.requestId;
      }
      return response;
    }
  }

  /**
   * Setup Chrome runtime message listener
   */
  setupListener(): void {
    chrome.runtime.onMessage.addListener(
      (request: MessageRequest, sender, sendResponse: (response: MessageResponse) => void) => {
        this.handle(request, sender)
          .then(response => sendResponse(response))
          .catch(error => {
            const errorResponse: MessageResponse = {
              success: false,
              error: error.message
            };
            if (request.requestId !== undefined) {
              errorResponse.requestId = request.requestId;
            }
            sendResponse(errorResponse);
          });
        
        return true; // Keep message channel open for async response
      }
    );
  }
}

/**
 * Send message to background script from content script
 */
export function sendMessageToBackground<T = any, R = any>(
  type: MessageType,
  payload?: T
): Promise<MessageResponse<R>> {
  return new Promise((resolve) => {
    const request: MessageRequest<T> = {
      type,
      requestId: generateRequestId()
    };
    
    if (payload !== undefined) {
      request.payload = payload;
    }

    chrome.runtime.sendMessage(request, (response: MessageResponse<R>) => {
      if (chrome.runtime.lastError) {
        const errorResponse: MessageResponse<R> = {
          success: false,
          error: chrome.runtime.lastError.message || 'Unknown error'
        };
        if (request.requestId !== undefined) {
          errorResponse.requestId = request.requestId;
        }
        resolve(errorResponse);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to content script from background script
 */
export function sendMessageToTab<T = any, R = any>(
  tabId: number,
  type: MessageType,
  payload?: T
): Promise<MessageResponse<R>> {
  return new Promise((resolve) => {
    const request: MessageRequest<T> = {
      type,
      requestId: generateRequestId()
    };
    
    if (payload !== undefined) {
      request.payload = payload;
    }

    chrome.tabs.sendMessage(tabId, request, (response: MessageResponse<R>) => {
      if (chrome.runtime.lastError) {
        const errorResponse: MessageResponse<R> = {
          success: false,
          error: chrome.runtime.lastError.message || 'Unknown error'
        };
        if (request.requestId !== undefined) {
          errorResponse.requestId = request.requestId;
        }
        resolve(errorResponse);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Generate unique request ID for message tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}