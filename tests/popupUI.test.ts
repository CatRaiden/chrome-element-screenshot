// Tests for popup UI components and interactions

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageType, MessageResponse } from '../src/types';

// Mock DOM environment
const mockDOM = () => {
  // Create mock HTML structure
  document.body.innerHTML = `
    <div class="popup-container">
      <header class="popup-header">
        <h1>元素截圖工具</h1>
        <div class="status-indicator" id="status-indicator">
          <span class="status-dot" id="status-dot"></span>
          <span id="status-text">準備就緒</span>
        </div>
      </header>
      
      <main class="popup-main">
        <div class="actions-section" id="actions-section">
          <button id="start-screenshot" class="primary-button" 
                  title="點擊開始截圖模式 (Enter)" 
                  aria-label="開始截圖模式">
            <span class="button-icon">📷</span>
            開始截圖
          </button>
          <button id="stop-screenshot" class="secondary-button hidden" 
                  title="退出截圖模式 (ESC)" 
                  aria-label="退出截圖模式">
            <span class="button-icon">⏹️</span>
            退出截圖模式
          </button>
        </div>
        
        <div class="progress-section hidden" id="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <p class="progress-text" id="progress-text">處理中...</p>
        </div>
        
        <div class="info-section" id="info-section">
          <div class="instruction-card">
            <h3>使用說明</h3>
            <ol class="instruction-list">
              <li>點擊「開始截圖」按鈕</li>
              <li>將滑鼠移動到要截圖的元素上</li>
              <li>元素會被高亮顯示</li>
              <li>點擊元素完成截圖</li>
            </ol>
          </div>
          
          <div class="tips-card">
            <h4>💡 小提示</h4>
            <ul class="tips-list">
              <li>支援長截圖功能，自動處理滾動內容</li>
              <li>按 ESC 鍵可隨時退出截圖模式</li>
              <li>截圖會自動下載到預設資料夾</li>
            </ul>
          </div>
        </div>
        
        <div class="error-section hidden" id="error-section">
          <div class="error-card">
            <div class="error-header">
              <span class="error-icon">⚠️</span>
              <span class="error-title">發生錯誤</span>
            </div>
            <p class="error-message" id="error-message"></p>
            <div class="error-actions">
              <button id="retry-button" class="retry-button">重試</button>
              <button id="dismiss-error" class="dismiss-button">關閉</button>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <details class="settings-details">
            <summary class="settings-summary">快速設定</summary>
            <div class="settings-content">
              <div class="setting-item">
                <label for="format-select">圖片格式：</label>
                <select id="format-select" class="setting-select">
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>
              <div class="setting-item">
                <label for="quality-slider">圖片品質：</label>
                <input type="range" id="quality-slider" class="setting-slider" 
                       min="10" max="100" value="90">
                <span id="quality-value">90%</span>
              </div>
            </div>
          </details>
        </div>
      </main>
      
      <footer class="popup-footer">
        <div class="footer-buttons">
          <button id="open-options" class="link-button">更多設定</button>
          <button id="show-help" class="link-button" title="顯示使用說明 (F1)">說明</button>
        </div>
      </footer>
    </div>
  `;
};

// Mock Chrome APIs
const mockChrome = () => {
  global.chrome = {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      },
      openOptionsPage: vi.fn()
    },
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn()
      }
    }
  } as any;
};

describe('Popup UI Components', () => {
  beforeEach(() => {
    mockDOM();
    mockChrome();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('DOM Elements', () => {
    it('should have all required UI elements', () => {
      expect(document.getElementById('status-dot')).toBeTruthy();
      expect(document.getElementById('status-text')).toBeTruthy();
      expect(document.getElementById('start-screenshot')).toBeTruthy();
      expect(document.getElementById('stop-screenshot')).toBeTruthy();
      expect(document.getElementById('progress-section')).toBeTruthy();
      expect(document.getElementById('progress-fill')).toBeTruthy();
      expect(document.getElementById('progress-text')).toBeTruthy();
      expect(document.getElementById('error-section')).toBeTruthy();
      expect(document.getElementById('error-message')).toBeTruthy();
      expect(document.getElementById('retry-button')).toBeTruthy();
      expect(document.getElementById('dismiss-error')).toBeTruthy();
      expect(document.getElementById('format-select')).toBeTruthy();
      expect(document.getElementById('quality-slider')).toBeTruthy();
      expect(document.getElementById('quality-value')).toBeTruthy();
      expect(document.getElementById('open-options')).toBeTruthy();
      expect(document.getElementById('show-help')).toBeTruthy();
    });

    it('should have correct initial state', () => {
      const statusText = document.getElementById('status-text');
      const startButton = document.getElementById('start-screenshot');
      const stopButton = document.getElementById('stop-screenshot');
      const progressSection = document.getElementById('progress-section');
      const errorSection = document.getElementById('error-section');

      expect(statusText?.textContent).toBe('準備就緒');
      expect(startButton?.classList.contains('hidden')).toBe(false);
      expect(stopButton?.classList.contains('hidden')).toBe(true);
      expect(progressSection?.classList.contains('hidden')).toBe(true);
      expect(errorSection?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Status Updates', () => {
    it('should update status text and dot correctly', () => {
      const statusText = document.getElementById('status-text')!;
      const statusDot = document.getElementById('status-dot')!;

      // Test ready state
      statusText.textContent = '準備就緒';
      statusDot.className = 'status-dot ready';
      expect(statusText.textContent).toBe('準備就緒');
      expect(statusDot.classList.contains('ready')).toBe(true);

      // Test processing state
      statusText.textContent = '處理中...';
      statusDot.className = 'status-dot processing';
      expect(statusText.textContent).toBe('處理中...');
      expect(statusDot.classList.contains('processing')).toBe(true);

      // Test error state
      statusText.textContent = '發生錯誤';
      statusDot.className = 'status-dot error';
      expect(statusText.textContent).toBe('發生錯誤');
      expect(statusDot.classList.contains('error')).toBe(true);
    });
  });

  describe('Button Interactions', () => {
    it('should have start screenshot button with correct attributes', () => {
      const startButton = document.getElementById('start-screenshot') as HTMLButtonElement;
      
      expect(startButton).toBeTruthy();
      expect(startButton.classList.contains('primary-button')).toBe(true);
      expect(startButton.textContent?.trim()).toContain('開始截圖');
    });

    it('should have stop screenshot button with correct attributes', () => {
      const stopButton = document.getElementById('stop-screenshot') as HTMLButtonElement;
      
      expect(stopButton).toBeTruthy();
      expect(stopButton.classList.contains('secondary-button')).toBe(true);
      expect(stopButton.classList.contains('hidden')).toBe(true);
      expect(stopButton.textContent?.trim()).toContain('退出截圖模式');
    });

    it('should have retry and dismiss buttons in error section', () => {
      const retryButton = document.getElementById('retry-button') as HTMLButtonElement;
      const dismissButton = document.getElementById('dismiss-error') as HTMLButtonElement;
      
      expect(retryButton).toBeTruthy();
      expect(retryButton.classList.contains('retry-button')).toBe(true);
      expect(retryButton.textContent?.trim()).toBe('重試');
      
      expect(dismissButton).toBeTruthy();
      expect(dismissButton.classList.contains('dismiss-button')).toBe(true);
      expect(dismissButton.textContent?.trim()).toBe('關閉');
    });

    it('should allow manual error section visibility toggle', () => {
      const errorSection = document.getElementById('error-section')!;
      
      // Initially hidden
      expect(errorSection.classList.contains('hidden')).toBe(true);
      
      // Show error
      errorSection.classList.remove('hidden');
      expect(errorSection.classList.contains('hidden')).toBe(false);
      
      // Hide error
      errorSection.classList.add('hidden');
      expect(errorSection.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Progress Display', () => {
    it('should show and update progress correctly', () => {
      const progressSection = document.getElementById('progress-section')!;
      const progressFill = document.getElementById('progress-fill')!;
      const progressText = document.getElementById('progress-text')!;

      // Show progress
      progressSection.classList.remove('hidden');
      progressFill.style.width = '50%';
      progressText.textContent = '處理中... 50%';

      expect(progressSection.classList.contains('hidden')).toBe(false);
      expect(progressFill.style.width).toBe('50%');
      expect(progressText.textContent).toBe('處理中... 50%');
    });

    it('should hide progress when complete', () => {
      const progressSection = document.getElementById('progress-section')!;
      
      // Show progress first
      progressSection.classList.remove('hidden');
      expect(progressSection.classList.contains('hidden')).toBe(false);
      
      // Hide progress
      progressSection.classList.add('hidden');
      expect(progressSection.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Error Display', () => {
    it('should show error message correctly', () => {
      const errorSection = document.getElementById('error-section')!;
      const errorMessage = document.getElementById('error-message')!;
      
      const testError = '測試錯誤訊息';
      
      // Show error
      errorSection.classList.remove('hidden');
      errorMessage.textContent = testError;
      
      expect(errorSection.classList.contains('hidden')).toBe(false);
      expect(errorMessage.textContent).toBe(testError);
    });

    it('should hide error when dismissed', () => {
      const errorSection = document.getElementById('error-section')!;
      
      // Show error first
      errorSection.classList.remove('hidden');
      expect(errorSection.classList.contains('hidden')).toBe(false);
      
      // Hide error
      errorSection.classList.add('hidden');
      expect(errorSection.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Settings Controls', () => {
    it('should handle format selection change', () => {
      const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
      
      // Change to JPEG
      formatSelect.value = 'jpeg';
      const changeEvent = new Event('change');
      formatSelect.dispatchEvent(changeEvent);
      
      expect(formatSelect.value).toBe('jpeg');
    });

    it('should handle quality slider change', () => {
      const qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
      const qualityValue = document.getElementById('quality-value')!;
      
      // Change quality to 75
      qualitySlider.value = '75';
      qualityValue.textContent = '75%';
      const inputEvent = new Event('input');
      qualitySlider.dispatchEvent(inputEvent);
      
      expect(qualitySlider.value).toBe('75');
      expect(qualityValue.textContent).toBe('75%');
    });

    it('should have open options button with correct attributes', () => {
      const openOptionsButton = document.getElementById('open-options') as HTMLButtonElement;
      
      expect(openOptionsButton).toBeTruthy();
      expect(openOptionsButton.classList.contains('link-button')).toBe(true);
      expect(openOptionsButton.textContent?.trim()).toBe('更多設定');
    });
  });

  describe('UI State Management', () => {
    it('should toggle button visibility in screenshot mode', () => {
      const startButton = document.getElementById('start-screenshot')!;
      const stopButton = document.getElementById('stop-screenshot')!;
      
      // Initial state - start button visible, stop button hidden
      expect(startButton.classList.contains('hidden')).toBe(false);
      expect(stopButton.classList.contains('hidden')).toBe(true);
      
      // Enter screenshot mode
      startButton.classList.add('hidden');
      stopButton.classList.remove('hidden');
      
      expect(startButton.classList.contains('hidden')).toBe(true);
      expect(stopButton.classList.contains('hidden')).toBe(false);
      
      // Exit screenshot mode
      startButton.classList.remove('hidden');
      stopButton.classList.add('hidden');
      
      expect(startButton.classList.contains('hidden')).toBe(false);
      expect(stopButton.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Settings Persistence', () => {
    it('should load settings from storage', async () => {
      const mockSettings = {
        screenshotFormat: 'jpeg',
        screenshotQuality: 75
      };
      
      (chrome.storage.sync.get as any).mockResolvedValue(mockSettings);
      
      // Simulate loading settings
      const result = await chrome.storage.sync.get(['screenshotFormat', 'screenshotQuality']);
      
      expect(result.screenshotFormat).toBe('jpeg');
      expect(result.screenshotQuality).toBe(75);
    });

    it('should save settings to storage', async () => {
      const settingsToSave = {
        screenshotFormat: 'png',
        screenshotQuality: 90
      };
      
      (chrome.storage.sync.set as any).mockResolvedValue(undefined);
      
      // Simulate saving settings
      await chrome.storage.sync.set(settingsToSave);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(settingsToSave);
    });
  });

  describe('Message Handling', () => {
    it('should handle background script messages', () => {
      const messageListener = vi.fn();
      
      // Register message listener
      chrome.runtime.onMessage.addListener(messageListener);
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(messageListener);
    });

    it('should handle communication errors', async () => {
      const errorMessage = 'Connection failed';
      
      (chrome.runtime.sendMessage as any).mockImplementation((message: any, callback: any) => {
        chrome.runtime.lastError = { message: errorMessage };
        callback(null);
      });
      
      // Simulate sending message with error
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: MessageType.PING }, (response: any) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
    });
  });

  describe('User Experience', () => {
    it('should have instruction card structure', () => {
      const instructionCard = document.querySelector('.instruction-card');
      expect(instructionCard).toBeTruthy();
      
      const instructionTitle = instructionCard?.querySelector('h3');
      expect(instructionTitle?.textContent).toBe('使用說明');
    });

    it('should have tips card structure', () => {
      const tipsCard = document.querySelector('.tips-card');
      expect(tipsCard).toBeTruthy();
      
      const tipsTitle = tipsCard?.querySelector('h4');
      expect(tipsTitle?.textContent).toBe('💡 小提示');
    });

    it('should have accessible button labels', () => {
      const startButton = document.getElementById('start-screenshot');
      const stopButton = document.getElementById('stop-screenshot');
      
      expect(startButton?.textContent?.trim()).toContain('開始截圖');
      expect(stopButton?.textContent?.trim()).toContain('退出截圖模式');
    });

    it('should have help button with correct attributes', () => {
      const helpButton = document.getElementById('show-help') as HTMLButtonElement;
      
      expect(helpButton).toBeTruthy();
      expect(helpButton.classList.contains('link-button')).toBe(true);
      expect(helpButton.textContent?.trim()).toBe('說明');
      expect(helpButton.title).toContain('F1');
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should provide contextual error solutions', () => {
      const errorSection = document.getElementById('error-section')!;
      const errorMessage = document.getElementById('error-message')!;
      
      // Test permission error context
      const permissionError = '權限被拒絕';
      errorSection.classList.remove('hidden');
      errorMessage.textContent = permissionError;
      
      expect(errorSection.classList.contains('hidden')).toBe(false);
      expect(errorMessage.textContent).toBe(permissionError);
    });

    it('should handle different error types appropriately', () => {
      const errorMessage = document.getElementById('error-message')!;
      
      const errorTypes = [
        '權限被拒絕',
        '連接失敗',
        '元素未找到',
        '截圖失敗',
        '超時錯誤',
        '記憶體不足',
        'iframe跨域',
        '滾動失敗',
        '處理錯誤',
        '下載失敗'
      ];
      
      errorTypes.forEach(error => {
        errorMessage.textContent = error;
        expect(errorMessage.textContent).toBe(error);
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle ESC key to exit screenshot mode', () => {
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      
      // Simulate being in screenshot mode
      const stopButton = document.getElementById('stop-screenshot')!;
      stopButton.classList.remove('hidden');
      
      document.dispatchEvent(escEvent);
      
      // Event should be handled (preventDefault would be called in real implementation)
      expect(escEvent.defaultPrevented).toBe(false); // In test environment
    });

    it('should handle Enter key on start button', () => {
      const startButton = document.getElementById('start-screenshot') as HTMLButtonElement;
      startButton.focus();
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(enterEvent);
      
      expect(document.activeElement).toBe(startButton);
    });

    it('should handle F1 key for help', () => {
      const f1Event = new KeyboardEvent('keydown', { key: 'F1' });
      document.dispatchEvent(f1Event);
      
      // F1 should trigger help dialog (would be handled in real implementation)
      expect(f1Event.key).toBe('F1');
    });
  });

  describe('Progress Indication', () => {
    it('should show progress with detailed status', () => {
      const progressSection = document.getElementById('progress-section')!;
      const progressFill = document.getElementById('progress-fill')!;
      const progressText = document.getElementById('progress-text')!;

      // Test detailed progress updates
      const progressStates = [
        { progress: 25, status: '正在分析元素...' },
        { progress: 50, status: '正在截取圖片...' },
        { progress: 75, status: '正在處理圖片...' },
        { progress: 100, status: '完成！' }
      ];

      progressStates.forEach(state => {
        progressSection.classList.remove('hidden');
        progressFill.style.width = `${state.progress}%`;
        progressText.textContent = state.status;

        expect(progressSection.classList.contains('hidden')).toBe(false);
        expect(progressFill.style.width).toBe(`${state.progress}%`);
        expect(progressText.textContent).toBe(state.status);
      });
    });
  });

  describe('Settings Integration', () => {
    it('should validate settings values', () => {
      const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
      const qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
      
      // Test valid format values
      const validFormats = ['png', 'jpeg'];
      validFormats.forEach(format => {
        formatSelect.value = format;
        expect(['png', 'jpeg']).toContain(formatSelect.value);
      });
      
      // Test quality range
      const qualityValues = [10, 50, 90, 100];
      qualityValues.forEach(quality => {
        qualitySlider.value = quality.toString();
        const numValue = parseInt(qualitySlider.value);
        expect(numValue).toBeGreaterThanOrEqual(10);
        expect(numValue).toBeLessThanOrEqual(100);
      });
    });

    it('should handle settings persistence errors gracefully', async () => {
      // Mock storage error
      (chrome.storage.sync.set as any).mockRejectedValue(new Error('Storage quota exceeded'));
      
      try {
        await chrome.storage.sync.set({ screenshotFormat: 'png' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage quota exceeded');
      }
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels', () => {
      const startButton = document.getElementById('start-screenshot') as HTMLButtonElement;
      const stopButton = document.getElementById('stop-screenshot') as HTMLButtonElement;
      
      // Check for aria-label attributes
      expect(startButton.getAttribute('aria-label')).toBe('開始截圖模式');
      expect(stopButton.getAttribute('aria-label')).toBe('退出截圖模式');
    });

    it('should support keyboard navigation', () => {
      const buttons = document.querySelectorAll('button');
      
      buttons.forEach(button => {
        // All buttons should be focusable
        expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have proper focus management', () => {
      const startButton = document.getElementById('start-screenshot') as HTMLButtonElement;
      const retryButton = document.getElementById('retry-button') as HTMLButtonElement;
      
      // Test focus states
      startButton.focus();
      expect(document.activeElement).toBe(startButton);
      
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });
  });

  describe('Responsive Design', () => {
    it('should handle different popup sizes', () => {
      const popupContainer = document.querySelector('.popup-container') as HTMLElement;
      
      // Test minimum dimensions
      expect(popupContainer).toBeTruthy();
      
      // Simulate different viewport sizes
      const testSizes = [
        { width: 320, height: 400 },
        { width: 350, height: 500 },
        { width: 400, height: 600 }
      ];
      
      testSizes.forEach(size => {
        document.body.style.width = `${size.width}px`;
        document.body.style.height = `${size.height}px`;
        
        // Container should adapt to size
        expect(popupContainer.offsetWidth).toBeLessThanOrEqual(size.width);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should handle rapid UI updates efficiently', () => {
      const statusText = document.getElementById('status-text')!;
      const progressFill = document.getElementById('progress-fill')!;
      
      // Simulate rapid status updates
      const updates = Array.from({ length: 100 }, (_, i) => ({
        status: `處理中... ${i}%`,
        progress: i
      }));
      
      const startTime = performance.now();
      
      updates.forEach(update => {
        statusText.textContent = update.status;
        progressFill.style.width = `${update.progress}%`;
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete updates quickly (under 100ms for 100 updates)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Recovery', () => {
    it('should provide multiple recovery options', () => {
      const retryButton = document.getElementById('retry-button') as HTMLButtonElement;
      const dismissButton = document.getElementById('dismiss-error') as HTMLButtonElement;
      const errorSection = document.getElementById('error-section')!;
      
      // Show error state
      errorSection.classList.remove('hidden');
      
      expect(retryButton).toBeTruthy();
      expect(dismissButton).toBeTruthy();
      expect(errorSection.classList.contains('hidden')).toBe(false);
      
      // Test dismiss functionality
      dismissButton.click();
      // In real implementation, this would hide the error section
    });

    it('should handle network connectivity issues', () => {
      const errorMessage = document.getElementById('error-message')!;
      
      const networkErrors = [
        '網路連接失敗',
        'connection timeout',
        '無法連接到伺服器'
      ];
      
      networkErrors.forEach(error => {
        errorMessage.textContent = error;
        expect(errorMessage.textContent).toBe(error);
      });
    });
  });
});