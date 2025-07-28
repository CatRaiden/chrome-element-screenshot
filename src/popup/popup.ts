// Popup UI script for the Chrome extension

import { MessageRequest, MessageResponse, MessageType } from '../types';

// UI state management
interface UIState {
  isScreenshotMode: boolean;
  isProcessing: boolean;
  currentError: string | null;
  settings: {
    format: 'png' | 'jpeg';
    quality: number;
  };
}

let uiState: UIState = {
  isScreenshotMode: false,
  isProcessing: false,
  currentError: null,
  settings: {
    format: 'png',
    quality: 90
  }
};

// DOM elements
let elements: {
  statusDot: HTMLElement;
  statusText: HTMLElement;
  startButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  progressSection: HTMLElement;
  progressFill: HTMLElement;
  progressText: HTMLElement;
  errorSection: HTMLElement;
  errorMessage: HTMLElement;
  retryButton: HTMLButtonElement;
  dismissButton: HTMLButtonElement;
  formatSelect: HTMLSelectElement;
  qualitySlider: HTMLInputElement;
  qualityValue: HTMLElement;
  openOptionsButton: HTMLButtonElement;
  showHelpButton: HTMLButtonElement;
} = {} as any;

document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

// Add keyboard shortcuts support
document.addEventListener('keydown', handleKeyboardShortcuts);

function initializePopup() {
  console.log('Popup UI 已初始化');
  
  // Get DOM elements
  getElements();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load saved settings
  loadSettings();
  
  // Update initial UI state
  updateUI();
  
  // Test communication with background script
  sendMessage({ type: MessageType.PING })
    .then(response => {
      console.log('Background script response:', response);
      updateStatus('ready', '準備就緒');
    })
    .catch(error => {
      console.error('Failed to communicate with background script:', error);
      showError('無法連接到背景腳本，請重新載入擴展');
    });
}

function getElements() {
  elements.statusDot = document.getElementById('status-dot')!;
  elements.statusText = document.getElementById('status-text')!;
  elements.startButton = document.getElementById('start-screenshot') as HTMLButtonElement;
  elements.stopButton = document.getElementById('stop-screenshot') as HTMLButtonElement;
  elements.progressSection = document.getElementById('progress-section')!;
  elements.progressFill = document.getElementById('progress-fill')!;
  elements.progressText = document.getElementById('progress-text')!;
  elements.errorSection = document.getElementById('error-section')!;
  elements.errorMessage = document.getElementById('error-message')!;
  elements.retryButton = document.getElementById('retry-button') as HTMLButtonElement;
  elements.dismissButton = document.getElementById('dismiss-error') as HTMLButtonElement;
  elements.formatSelect = document.getElementById('format-select') as HTMLSelectElement;
  elements.qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
  elements.qualityValue = document.getElementById('quality-value')!;
  elements.openOptionsButton = document.getElementById('open-options') as HTMLButtonElement;
  elements.showHelpButton = document.getElementById('show-help') as HTMLButtonElement;
}

function setupEventListeners() {
  // Screenshot mode controls
  elements.startButton.addEventListener('click', startScreenshotMode);
  elements.stopButton.addEventListener('click', stopScreenshotMode);
  
  // Error handling
  elements.retryButton.addEventListener('click', retryLastAction);
  elements.dismissButton.addEventListener('click', dismissError);
  
  // Settings
  elements.formatSelect.addEventListener('change', updateFormat);
  elements.qualitySlider.addEventListener('input', updateQuality);
  elements.openOptionsButton.addEventListener('click', openOptionsPage);
  elements.showHelpButton.addEventListener('click', showHelpDialog);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

async function startScreenshotMode() {
  try {
    updateStatus('processing', '啟動截圖模式...');
    uiState.isScreenshotMode = true;
    
    // Send message to background script to start screenshot mode
    const response = await sendMessage({
      type: MessageType.START_SCREENSHOT,
      payload: {
        format: uiState.settings.format,
        quality: uiState.settings.quality
      }
    });
    
    if (response.success) {
      updateStatus('active', '截圖模式已啟動');
      updateUI();
      
      // Close popup to allow user interaction with page
      window.close();
    } else {
      throw new Error(response.error || '啟動截圖模式失敗');
    }
  } catch (error) {
    console.error('Failed to start screenshot mode:', error);
    showError(error instanceof Error ? error.message : '啟動截圖模式時發生錯誤');
    uiState.isScreenshotMode = false;
    updateUI();
  }
}

async function stopScreenshotMode() {
  try {
    updateStatus('processing', '退出截圖模式...');
    
    const response = await sendMessage({
      type: MessageType.STOP_SCREENSHOT
    });
    
    if (response.success) {
      uiState.isScreenshotMode = false;
      updateStatus('ready', '準備就緒');
      updateUI();
    } else {
      throw new Error(response.error || '退出截圖模式失敗');
    }
  } catch (error) {
    console.error('Failed to stop screenshot mode:', error);
    showError(error instanceof Error ? error.message : '退出截圖模式時發生錯誤');
  }
}

function retryLastAction() {
  dismissError();
  if (!uiState.isScreenshotMode) {
    startScreenshotMode();
  }
}

function dismissError() {
  uiState.currentError = null;
  elements.errorSection.classList.add('hidden');
}

function updateFormat() {
  uiState.settings.format = elements.formatSelect.value as 'png' | 'jpeg';
  saveSettings();
}

function updateQuality() {
  uiState.settings.quality = parseInt(elements.qualitySlider.value);
  elements.qualityValue.textContent = `${uiState.settings.quality}%`;
  saveSettings();
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

function handleBackgroundMessage(message: any, _sender: any, _sendResponse: any) {
  console.log('Received message from background:', message);
  
  switch (message.type) {
    case 'SCREENSHOT_PROGRESS':
      updateProgress(message.data.progress, message.data.status);
      break;
    case 'SCREENSHOT_COMPLETE':
      handleScreenshotComplete(message.data);
      break;
    case 'SCREENSHOT_ERROR':
      handleScreenshotError(message.data.error);
      break;
    case 'MODE_CHANGED':
      uiState.isScreenshotMode = message.data.isActive;
      updateUI();
      updateStatus(message.data.isActive ? 'active' : 'ready', 
                   message.data.isActive ? '截圖模式已啟動' : '準備就緒');
      break;
    case 'ELEMENT_SELECTED':
      updateStatus('processing', '正在處理選中的元素...');
      break;
    case 'ELEMENT_HIGHLIGHTED':
      updateStatus('active', '元素已高亮，點擊以截圖');
      break;
  }
}

function updateProgress(progress: number, status: string) {
  elements.progressSection.classList.remove('hidden');
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = status;
  updateStatus('processing', status);
}

function handleScreenshotComplete(data: any) {
  elements.progressSection.classList.add('hidden');
  uiState.isScreenshotMode = false;
  updateUI();
  
  // Show success message with more details
  const filename = data.filename || '未知檔名';
  const fileSize = data.fileSize ? ` (${formatFileSize(data.fileSize)})` : '';
  const screenshotType = data.isLongScreenshot ? '長截圖' : '截圖';
  updateStatus('ready', `✅ ${screenshotType}已保存: ${filename}${fileSize}`);
  
  // Show success notification with enhanced details
  showSuccessNotification(`${screenshotType}已成功保存為 ${filename}`, data.isLongScreenshot);
  
  // Show completion summary
  showCompletionSummary(data);
  
  setTimeout(() => {
    updateStatus('ready', '準備就緒');
  }, 8000);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showSuccessNotification(message: string, isLongScreenshot: boolean = false) {
  // Create temporary success notification
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  
  const icon = isLongScreenshot ? '📜' : '📷';
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icon}</span>
      <span class="notification-text">${message}</span>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #34a853;
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
    max-width: 280px;
  `;
  
  // Add CSS for notification content
  const style = document.createElement('style');
  style.textContent = `
    .notification-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .notification-icon {
      font-size: 14px;
    }
    .notification-text {
      flex: 1;
      line-height: 1.3;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 4000);
}

function handleScreenshotError(error: string) {
  elements.progressSection.classList.add('hidden');
  uiState.isScreenshotMode = false;
  updateUI();
  showError(error);
}

function updateStatus(type: 'ready' | 'active' | 'processing' | 'error', message: string) {
  elements.statusText.textContent = message;
  
  // Update status dot
  elements.statusDot.className = 'status-dot';
  switch (type) {
    case 'ready':
      elements.statusDot.classList.add('ready');
      break;
    case 'active':
      elements.statusDot.classList.add('warning');
      break;
    case 'processing':
      elements.statusDot.classList.add('processing');
      break;
    case 'error':
      elements.statusDot.classList.add('error');
      break;
  }
}

function showError(message: string) {
  uiState.currentError = message;
  
  // Auto-hide progress if showing
  elements.progressSection.classList.add('hidden');
  
  // Provide helpful error context
  const errorContext = getErrorContext(message);
  const fullMessage = errorContext ? `${message}\n\n💡 建議解決方案：\n${errorContext}` : message;
  
  elements.errorMessage.textContent = fullMessage;
  elements.errorSection.classList.remove('hidden');
  updateStatus('error', '發生錯誤');
  
  // Scroll error into view for better visibility
  elements.errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  // Auto-dismiss error after 10 seconds for non-critical errors
  if (!message.includes('權限') && !message.includes('permission')) {
    setTimeout(() => {
      if (uiState.currentError === message) {
        dismissError();
      }
    }, 10000);
  }
}

function getErrorContext(errorMessage: string): string | null {
  const errorMappings = [
    {
      keywords: ['權限', 'permission'],
      solution: '請確保已授予擴展必要的權限，並重新載入頁面後再試。您可以在瀏覽器設定中檢查擴展權限。'
    },
    {
      keywords: ['連接', '通信', 'connection'],
      solution: '請嘗試重新載入擴展或重啟瀏覽器。如果問題持續，請檢查網路連接。'
    },
    {
      keywords: ['元素', 'element'],
      solution: '請確保頁面已完全載入，然後重新選擇元素。避免選擇動態變化的元素。'
    },
    {
      keywords: ['截圖', 'screenshot'],
      solution: '請檢查頁面內容是否過大，或嘗試選擇較小的元素。大型元素可能需要更多處理時間。'
    },
    {
      keywords: ['timeout', '超時'],
      solution: '操作超時，請嘗試選擇較小的元素或檢查網路連接。長截圖可能需要更多時間處理。'
    },
    {
      keywords: ['memory', '記憶體'],
      solution: '記憶體不足，請關閉其他分頁或選擇較小的元素進行截圖。'
    },
    {
      keywords: ['iframe', '跨域'],
      solution: '無法截取跨域iframe內容。請嘗試直接在目標頁面中使用截圖工具。'
    },
    {
      keywords: ['scroll', '滾動'],
      solution: '滾動處理失敗，請確保元素可以正常滾動，或嘗試截取可見部分。'
    },
    {
      keywords: ['canvas', '處理'],
      solution: '圖片處理失敗，可能是元素過大或格式不支援。請嘗試調整截圖設定。'
    },
    {
      keywords: ['download', '下載'],
      solution: '下載失敗，請檢查瀏覽器下載設定和磁碟空間。您可以嘗試手動保存截圖。'
    }
  ];

  for (const mapping of errorMappings) {
    if (mapping.keywords.some(keyword => errorMessage.includes(keyword))) {
      return mapping.solution;
    }
  }
  
  return '如果問題持續發生，請嘗試重新載入頁面或重啟瀏覽器。您也可以嘗試調整截圖設定或選擇不同的元素。';
}

function updateUI() {
  // Update button visibility
  if (uiState.isScreenshotMode) {
    elements.startButton.classList.add('hidden');
    elements.stopButton.classList.remove('hidden');
  } else {
    elements.startButton.classList.remove('hidden');
    elements.stopButton.classList.add('hidden');
  }
  
  // Update progress visibility
  if (!uiState.isProcessing) {
    elements.progressSection.classList.add('hidden');
  }
  
  // Update error visibility
  if (!uiState.currentError) {
    elements.errorSection.classList.add('hidden');
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['screenshotFormat', 'screenshotQuality']);
    
    if (result.screenshotFormat) {
      uiState.settings.format = result.screenshotFormat;
      elements.formatSelect.value = result.screenshotFormat;
    }
    
    if (result.screenshotQuality) {
      uiState.settings.quality = result.screenshotQuality;
      elements.qualitySlider.value = result.screenshotQuality.toString();
      elements.qualityValue.textContent = `${result.screenshotQuality}%`;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      screenshotFormat: uiState.settings.format,
      screenshotQuality: uiState.settings.quality
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

async function sendMessage(request: MessageRequest): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: MessageResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function showCompletionSummary(data: any) {
  // Create a temporary completion summary overlay
  const overlay = document.createElement('div');
  overlay.className = 'completion-overlay';
  
  const processingTime = data.processingTime ? `處理時間: ${data.processingTime}ms` : '';
  const dimensions = data.dimensions ? `尺寸: ${data.dimensions.width}×${data.dimensions.height}` : '';
  const fileSize = data.fileSize ? `檔案大小: ${formatFileSize(data.fileSize)}` : '';
  
  overlay.innerHTML = `
    <div class="completion-card">
      <div class="completion-header">
        <span class="completion-icon">✅</span>
        <h3>截圖完成</h3>
      </div>
      <div class="completion-details">
        ${data.filename ? `<p><strong>檔名:</strong> ${data.filename}</p>` : ''}
        ${dimensions ? `<p><strong>尺寸:</strong> ${dimensions}</p>` : ''}
        ${fileSize ? `<p><strong>大小:</strong> ${fileSize}</p>` : ''}
        ${processingTime ? `<p><strong>處理時間:</strong> ${processingTime}</p>` : ''}
        ${data.isLongScreenshot ? '<p><strong>類型:</strong> 長截圖 (多段拼接)</p>' : '<p><strong>類型:</strong> 標準截圖</p>'}
      </div>
      <button class="completion-close">確定</button>
    </div>
  `;
  
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.3s ease-out;
  `;
  
  // Add styles for completion card
  const style = document.createElement('style');
  style.textContent = `
    .completion-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 300px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    }
    .completion-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .completion-icon {
      font-size: 20px;
    }
    .completion-header h3 {
      margin: 0;
      color: #1a73e8;
      font-size: 16px;
    }
    .completion-details p {
      margin: 8px 0;
      font-size: 13px;
      color: #5f6368;
    }
    .completion-details strong {
      color: #333;
    }
    .completion-close {
      width: 100%;
      padding: 10px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 16px;
      font-size: 14px;
    }
    .completion-close:hover {
      background: #1557b0;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(overlay);
  
  // Handle close button
  const closeButton = overlay.querySelector('.completion-close') as HTMLButtonElement;
  closeButton.addEventListener('click', () => {
    overlay.style.animation = 'fadeOut 0.3s ease-in';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  });
  
  // Auto-close after 8 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      closeButton.click();
    }
  }, 8000);
}

function handleKeyboardShortcuts(event: KeyboardEvent) {
  // ESC key to exit screenshot mode
  if (event.key === 'Escape' && uiState.isScreenshotMode) {
    event.preventDefault();
    stopScreenshotMode();
    showTemporaryMessage('已退出截圖模式', 'info');
    return;
  }
  
  // Enter key to start screenshot mode when start button is focused
  if (event.key === 'Enter' && document.activeElement === elements.startButton) {
    event.preventDefault();
    startScreenshotMode();
    return;
  }
  
  // Space key to retry when retry button is focused
  if (event.key === ' ' && document.activeElement === elements.retryButton) {
    event.preventDefault();
    retryLastAction();
    return;
  }
  
  // Ctrl/Cmd + S to open settings
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    openOptionsPage();
    return;
  }
  
  // F1 key to show help
  if (event.key === 'F1') {
    event.preventDefault();
    showHelpDialog();
    return;
  }
  
  // Ctrl/Cmd + R to retry last action
  if ((event.ctrlKey || event.metaKey) && event.key === 'r' && uiState.currentError) {
    event.preventDefault();
    retryLastAction();
    return;
  }
}

function showTemporaryMessage(message: string, type: 'info' | 'success' | 'warning' = 'info') {
  const messageElement = document.createElement('div');
  messageElement.className = `temporary-message ${type}`;
  messageElement.textContent = message;
  
  messageElement.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#34a853' : type === 'warning' ? '#fbbc04' : '#1a73e8'};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
  `;
  
  document.body.appendChild(messageElement);
  
  setTimeout(() => {
    messageElement.style.animation = 'slideUp 0.3s ease-in';
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300);
  }, 2000);
}

function showHelpDialog() {
  const helpDialog = document.createElement('div');
  helpDialog.className = 'help-dialog-overlay';
  
  helpDialog.innerHTML = `
    <div class="help-dialog">
      <div class="help-header">
        <h3>使用說明與快捷鍵</h3>
        <button class="help-close" aria-label="關閉說明">×</button>
      </div>
      <div class="help-content">
        <div class="help-section">
          <h4>基本操作</h4>
          <ul>
            <li>點擊「開始截圖」或按 Enter 鍵啟動截圖模式</li>
            <li>將滑鼠移動到要截圖的元素上，元素會被高亮顯示</li>
            <li>點擊元素完成截圖，支援長截圖自動拼接</li>
            <li>按 ESC 鍵隨時退出截圖模式</li>
          </ul>
        </div>
        <div class="help-section">
          <h4>快捷鍵</h4>
          <ul>
            <li><kbd>ESC</kbd> - 退出截圖模式</li>
            <li><kbd>Enter</kbd> - 開始截圖（當按鈕聚焦時）</li>
            <li><kbd>Ctrl/Cmd + S</kbd> - 打開設定頁面</li>
            <li><kbd>Ctrl/Cmd + R</kbd> - 重試上次操作（錯誤時）</li>
            <li><kbd>F1</kbd> - 顯示此說明</li>
          </ul>
        </div>
        <div class="help-section">
          <h4>小提示</h4>
          <ul>
            <li>支援 PNG 和 JPEG 格式，可調整圖片品質</li>
            <li>長截圖會自動處理滾動內容並拼接</li>
            <li>截圖會自動下載到瀏覽器預設下載資料夾</li>
            <li>如遇問題，請檢查擴展權限設定</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  
  helpDialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.3s ease-out;
  `;
  
  document.body.appendChild(helpDialog);
  
  // Handle close button
  const closeButton = helpDialog.querySelector('.help-close') as HTMLButtonElement;
  closeButton.addEventListener('click', () => {
    helpDialog.style.animation = 'fadeOut 0.3s ease-in';
    setTimeout(() => {
      if (helpDialog.parentNode) {
        helpDialog.parentNode.removeChild(helpDialog);
      }
    }, 300);
  });
  
  // Close on ESC key
  const handleEsc = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeButton.click();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // Close on backdrop click
  helpDialog.addEventListener('click', (event) => {
    if (event.target === helpDialog) {
      closeButton.click();
    }
  });
}