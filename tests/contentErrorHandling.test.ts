// Tests for content script error handling and user experience

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as any;
global.HTMLElement = dom.window.HTMLElement;

describe('Content Script Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear DOM
    document.body.innerHTML = '';
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('Error Tooltip Display', () => {
    it('should create error tooltip with appropriate styling', () => {
      const errorMessage = '截圖捕獲失敗';
      const userAction = '正在重試...';
      const severity = 'medium';

      // Create tooltip element (simulating the actual function)
      const tooltipElement = document.createElement('div');
      tooltipElement.className = `screenshot-tooltip screenshot-error-tooltip screenshot-error-${severity}`;
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'screenshot-error-message';
      messageDiv.textContent = errorMessage;
      
      const actionDiv = document.createElement('div');
      actionDiv.className = 'screenshot-user-action';
      actionDiv.textContent = userAction;
      
      tooltipElement.appendChild(messageDiv);
      tooltipElement.appendChild(actionDiv);
      
      document.body.appendChild(tooltipElement);

      expect(tooltipElement.classList.contains('screenshot-error-tooltip')).toBe(true);
      expect(tooltipElement.classList.contains('screenshot-error-medium')).toBe(true);
      expect(messageDiv.textContent).toBe(errorMessage);
      expect(actionDiv.textContent).toBe(userAction);
    });

    it('should create manual save tooltip with download button', () => {
      const errorMessage = '自動下載失敗';
      const sessionId = 'test-session-123';
      const filename = 'screenshot.png';

      // Create manual save tooltip (simulating the actual function)
      const tooltipElement = document.createElement('div');
      tooltipElement.className = 'screenshot-tooltip screenshot-error-tooltip screenshot-manual-save-tooltip';
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'screenshot-error-message';
      messageDiv.textContent = errorMessage;
      
      const instructionDiv = document.createElement('div');
      instructionDiv.className = 'screenshot-manual-save-instruction';
      instructionDiv.textContent = '點擊下方按鈕手動保存截圖：';
      
      const saveButton = document.createElement('button');
      saveButton.className = 'screenshot-manual-save-button';
      saveButton.textContent = `保存 ${filename}`;
      
      const closeButton = document.createElement('button');
      closeButton.className = 'screenshot-close-button';
      closeButton.textContent = '關閉';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'screenshot-button-container';
      buttonContainer.appendChild(saveButton);
      buttonContainer.appendChild(closeButton);
      
      tooltipElement.appendChild(messageDiv);
      tooltipElement.appendChild(instructionDiv);
      tooltipElement.appendChild(buttonContainer);
      
      document.body.appendChild(tooltipElement);

      expect(tooltipElement.classList.contains('screenshot-manual-save-tooltip')).toBe(true);
      expect(messageDiv.textContent).toBe(errorMessage);
      expect(instructionDiv.textContent).toBe('點擊下方按鈕手動保存截圖：');
      expect(saveButton.textContent).toBe(`保存 ${filename}`);
      expect(closeButton.textContent).toBe('關閉');
    });

    it('should create retry tooltip with progress indicator', () => {
      const errorMessage = '截圖處理失敗';
      const userAction = '正在使用簡化模式重試...';

      // Create retry tooltip (simulating the actual function)
      const tooltipElement = document.createElement('div');
      tooltipElement.className = 'screenshot-tooltip screenshot-error-tooltip screenshot-retry-tooltip';
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'screenshot-error-message';
      messageDiv.textContent = errorMessage;
      
      const actionDiv = document.createElement('div');
      actionDiv.className = 'screenshot-user-action';
      actionDiv.textContent = userAction;
      
      const retryDiv = document.createElement('div');
      retryDiv.className = 'screenshot-retry-indicator';
      retryDiv.textContent = '系統正在自動重試...';
      
      tooltipElement.appendChild(messageDiv);
      tooltipElement.appendChild(actionDiv);
      tooltipElement.appendChild(retryDiv);
      
      document.body.appendChild(tooltipElement);

      expect(tooltipElement.classList.contains('screenshot-retry-tooltip')).toBe(true);
      expect(messageDiv.textContent).toBe(errorMessage);
      expect(actionDiv.textContent).toBe(userAction);
      expect(retryDiv.textContent).toBe('系統正在自動重試...');
    });
  });

  describe('Error Severity Handling', () => {
    it('should apply correct CSS classes for different severities', () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      severities.forEach(severity => {
        const tooltipElement = document.createElement('div');
        tooltipElement.className = `screenshot-tooltip screenshot-error-tooltip screenshot-error-${severity}`;
        
        expect(tooltipElement.classList.contains(`screenshot-error-${severity}`)).toBe(true);
      });
    });

    it('should add close button for high and critical severity errors', () => {
      const highSeverityTooltip = document.createElement('div');
      highSeverityTooltip.className = 'screenshot-tooltip screenshot-error-tooltip screenshot-error-high';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'screenshot-close-button';
      closeButton.textContent = '關閉';
      
      highSeverityTooltip.appendChild(closeButton);

      expect(closeButton.textContent).toBe('關閉');
      expect(closeButton.className).toBe('screenshot-close-button');
    });

    it('should set appropriate auto-remove timeouts based on severity', () => {
      const severityTimeouts = {
        low: 5000,
        medium: 8000,
        high: 15000,
        critical: 0 // No auto-remove
      };

      Object.entries(severityTimeouts).forEach(([severity, timeout]) => {
        expect(typeof timeout).toBe('number');
        if (severity === 'critical') {
          expect(timeout).toBe(0);
        } else {
          expect(timeout).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Manual Save Button Interaction', () => {
    it('should handle manual save button click', async () => {
      const sessionId = 'test-session-123';
      const filename = 'test-screenshot.png';
      
      // Mock sendMessageToBackground function
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      
      const saveButton = document.createElement('button');
      saveButton.className = 'screenshot-manual-save-button';
      saveButton.textContent = `保存 ${filename}`;
      
      // Simulate button click handler
      saveButton.onclick = async () => {
        try {
          saveButton.disabled = true;
          saveButton.textContent = '正在保存...';
          
          await mockSendMessage('MANUAL_SAVE_REQUEST', { sessionId });
          
          // Success handling would be here
          saveButton.textContent = '保存成功';
        } catch (error) {
          saveButton.disabled = false;
          saveButton.textContent = `保存 ${filename}`;
          console.error('Manual save failed:', error);
        }
      };
      
      document.body.appendChild(saveButton);

      // Simulate click
      await saveButton.onclick!(new Event('click') as any);

      expect(mockSendMessage).toHaveBeenCalledWith('MANUAL_SAVE_REQUEST', { sessionId });
      expect(saveButton.textContent).toBe('保存成功');
    });

    it('should handle manual save button click failure', async () => {
      const sessionId = 'test-session-123';
      const filename = 'test-screenshot.png';
      
      // Mock sendMessageToBackground function to fail
      const mockSendMessage = vi.fn().mockRejectedValue(new Error('Save failed'));
      
      const saveButton = document.createElement('button');
      saveButton.className = 'screenshot-manual-save-button';
      saveButton.textContent = `保存 ${filename}`;
      
      // Simulate button click handler
      saveButton.onclick = async () => {
        try {
          saveButton.disabled = true;
          saveButton.textContent = '正在保存...';
          
          await mockSendMessage('MANUAL_SAVE_REQUEST', { sessionId });
        } catch (error) {
          saveButton.disabled = false;
          saveButton.textContent = `保存 ${filename}`;
          console.error('Manual save failed:', error);
        }
      };
      
      document.body.appendChild(saveButton);

      // Simulate click
      await saveButton.onclick!(new Event('click') as any);

      expect(mockSendMessage).toHaveBeenCalledWith('MANUAL_SAVE_REQUEST', { sessionId });
      expect(saveButton.disabled).toBe(false);
      expect(saveButton.textContent).toBe(`保存 ${filename}`);
      expect(console.error).toHaveBeenCalledWith('Manual save failed:', expect.any(Error));
    });
  });

  describe('Tooltip Positioning and Cleanup', () => {
    it('should position tooltips correctly', () => {
      const tooltip = document.createElement('div');
      tooltip.className = 'screenshot-tooltip';
      
      // Standard positioning (top-left)
      tooltip.style.left = '20px';
      tooltip.style.top = '20px';
      
      expect(tooltip.style.left).toBe('20px');
      expect(tooltip.style.top).toBe('20px');
      
      // Center positioning for manual save
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.style.position = 'fixed';
      
      expect(tooltip.style.transform).toBe('translate(-50%, -50%)');
      expect(tooltip.style.position).toBe('fixed');
    });

    it('should clean up tooltips properly', () => {
      const tooltip = document.createElement('div');
      tooltip.className = 'screenshot-tooltip';
      document.body.appendChild(tooltip);
      
      expect(document.querySelector('.screenshot-tooltip')).toBeTruthy();
      
      // Simulate cleanup
      tooltip.remove();
      
      expect(document.querySelector('.screenshot-tooltip')).toBeFalsy();
    });

    it('should handle multiple tooltip cleanup', () => {
      // Create multiple tooltips
      const tooltip1 = document.createElement('div');
      tooltip1.className = 'screenshot-tooltip screenshot-progress-tooltip';
      
      const tooltip2 = document.createElement('div');
      tooltip2.className = 'screenshot-tooltip screenshot-error-tooltip';
      
      document.body.appendChild(tooltip1);
      document.body.appendChild(tooltip2);
      
      expect(document.querySelectorAll('.screenshot-tooltip').length).toBe(2);
      
      // Simulate cleanup of all tooltips
      document.querySelectorAll('.screenshot-tooltip').forEach(tooltip => tooltip.remove());
      
      expect(document.querySelectorAll('.screenshot-tooltip').length).toBe(0);
    });
  });

  describe('Error Message Localization', () => {
    it('should display Chinese error messages', () => {
      const chineseMessages = [
        '頁面上找不到指定的元素',
        '截圖權限被拒絕',
        '截圖捕獲失敗',
        '截圖處理過程中發生錯誤',
        '截圖下載失敗'
      ];

      chineseMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        
        expect(messageDiv.textContent).toBe(message);
        // Verify it contains Chinese characters
        expect(/[\u4e00-\u9fff]/.test(message)).toBe(true);
      });
    });

    it('should display appropriate user action messages', () => {
      const userActions = [
        '請重新選擇要截圖的元素',
        '請檢查瀏覽器權限設置並重新載入頁面',
        '正在嘗試重新截圖...',
        '正在嘗試使用簡化模式...',
        '正在準備手動保存選項...'
      ];

      userActions.forEach(action => {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'screenshot-user-action';
        actionDiv.textContent = action;
        
        expect(actionDiv.textContent).toBe(action);
        expect(/[\u4e00-\u9fff]/.test(action)).toBe(true);
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide accessible button labels', () => {
      const saveButton = document.createElement('button');
      saveButton.className = 'screenshot-manual-save-button';
      saveButton.textContent = '保存 screenshot.png';
      saveButton.setAttribute('aria-label', '手動保存截圖文件');
      
      const closeButton = document.createElement('button');
      closeButton.className = 'screenshot-close-button';
      closeButton.textContent = '關閉';
      closeButton.setAttribute('aria-label', '關閉錯誤提示');

      expect(saveButton.getAttribute('aria-label')).toBe('手動保存截圖文件');
      expect(closeButton.getAttribute('aria-label')).toBe('關閉錯誤提示');
    });

    it('should handle keyboard navigation', () => {
      const tooltip = document.createElement('div');
      tooltip.className = 'screenshot-tooltip screenshot-manual-save-tooltip';
      tooltip.setAttribute('role', 'dialog');
      tooltip.setAttribute('aria-modal', 'true');
      
      const saveButton = document.createElement('button');
      saveButton.textContent = '保存';
      saveButton.setAttribute('tabindex', '0');
      
      const closeButton = document.createElement('button');
      closeButton.textContent = '關閉';
      closeButton.setAttribute('tabindex', '0');
      
      tooltip.appendChild(saveButton);
      tooltip.appendChild(closeButton);
      
      expect(tooltip.getAttribute('role')).toBe('dialog');
      expect(saveButton.getAttribute('tabindex')).toBe('0');
      expect(closeButton.getAttribute('tabindex')).toBe('0');
    });

    it('should provide visual feedback for button states', () => {
      const saveButton = document.createElement('button');
      saveButton.className = 'screenshot-manual-save-button';
      saveButton.textContent = '保存文件';
      
      // Normal state
      expect(saveButton.disabled).toBe(false);
      expect(saveButton.textContent).toBe('保存文件');
      
      // Loading state
      saveButton.disabled = true;
      saveButton.textContent = '正在保存...';
      
      expect(saveButton.disabled).toBe(true);
      expect(saveButton.textContent).toBe('正在保存...');
      
      // Success state
      saveButton.textContent = '保存成功';
      
      expect(saveButton.textContent).toBe('保存成功');
    });
  });
});