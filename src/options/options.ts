// Options page script for user settings management

import { UserSettings } from '../types';
import { 
  loadSettings, 
  saveSettings, 
  resetSettings, 
  validateSettings, 
  generateFilename,
  DEFAULT_SETTINGS 
} from '../utils/settingsManager';

// DOM elements
let formatSelect: HTMLSelectElement;
let qualitySlider: HTMLInputElement;
let qualityValue: HTMLSpanElement;
let filenameTemplate: HTMLInputElement;
let autoDownloadCheckbox: HTMLInputElement;
let showProgressCheckbox: HTMLInputElement;
let highlightColorInput: HTMLInputElement;
let saveButton: HTMLButtonElement;
let resetButton: HTMLButtonElement;

// Import default settings from settings manager

document.addEventListener('DOMContentLoaded', () => {
  initializeOptions();
});

function initializeOptions() {
  console.log('Options page 已初始化');
  
  // Get DOM elements
  getDOMElements();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load and display current settings
  loadAndDisplaySettings();
}

function getDOMElements() {
  formatSelect = document.getElementById('format-select') as HTMLSelectElement;
  qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
  qualityValue = document.getElementById('quality-value') as HTMLSpanElement;
  filenameTemplate = document.getElementById('filename-template') as HTMLInputElement;
  autoDownloadCheckbox = document.getElementById('auto-download') as HTMLInputElement;
  showProgressCheckbox = document.getElementById('show-progress') as HTMLInputElement;
  highlightColorInput = document.getElementById('highlight-color') as HTMLInputElement;
  saveButton = document.getElementById('save-settings') as HTMLButtonElement;
  resetButton = document.getElementById('reset-settings') as HTMLButtonElement;
}

function setupEventListeners() {
  // Quality slider real-time update
  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  
  // Filename template validation
  filenameTemplate.addEventListener('input', () => validateFilenameTemplate());
  
  // Save settings
  saveButton.addEventListener('click', saveUserSettings);
  
  // Reset settings
  resetButton.addEventListener('click', resetUserSettings);
  
  // Format change handler (show/hide quality setting for JPEG)
  formatSelect.addEventListener('change', () => handleFormatChange());
}

function handleFormatChange(formatElement?: HTMLSelectElement) {
  const format = formatElement || formatSelect;
  if (!format) return;
  
  const qualityGroup = document.querySelector('.quality-group') as HTMLElement;
  if (!qualityGroup) return;
  
  if (format.value === 'jpeg') {
    qualityGroup.style.display = 'flex';
  } else {
    qualityGroup.style.display = 'none';
  }
}

function validateFilenameTemplate(templateInput?: HTMLInputElement) {
  const input = templateInput || filenameTemplate;
  if (!input) return false;
  
  const template = input.value.trim();
  const isValid = template.length > 0 && !template.includes('/') && !template.includes('\\');
  
  if (isValid) {
    input.classList.remove('invalid');
    input.title = '';
  } else {
    input.classList.add('invalid');
    input.title = '文件名模板不能為空且不能包含路徑分隔符';
  }
  
  return isValid;
}

async function loadAndDisplaySettings() {
  try {
    const settings = await loadSettings();
    displaySettings(settings);
    console.log('Settings loaded and displayed:', settings);
  } catch (error) {
    console.error('Failed to load settings:', error);
    showNotification('載入設置失敗', 'error');
  }
}

function displaySettings(settings: UserSettings, elements?: {
  formatSelect?: HTMLSelectElement;
  qualitySlider?: HTMLInputElement;
  qualityValue?: HTMLSpanElement;
  filenameTemplate?: HTMLInputElement;
  autoDownloadCheckbox?: HTMLInputElement;
  showProgressCheckbox?: HTMLInputElement;
  highlightColorInput?: HTMLInputElement;
}) {
  const format = elements?.formatSelect || formatSelect;
  const quality = elements?.qualitySlider || qualitySlider;
  const qualityVal = elements?.qualityValue || qualityValue;
  const filename = elements?.filenameTemplate || filenameTemplate;
  const autoDownload = elements?.autoDownloadCheckbox || autoDownloadCheckbox;
  const showProgress = elements?.showProgressCheckbox || showProgressCheckbox;
  const highlightColor = elements?.highlightColorInput || highlightColorInput;
  
  if (format) format.value = settings.defaultFormat;
  if (quality) quality.value = settings.defaultQuality.toString();
  if (qualityVal) qualityVal.textContent = `${settings.defaultQuality}%`;
  if (filename) filename.value = settings.filenameTemplate;
  if (autoDownload) autoDownload.checked = settings.autoDownload;
  if (showProgress) showProgress.checked = settings.showProgress;
  if (highlightColor) highlightColor.value = settings.highlightColor;
  
  // Handle format-specific UI
  handleFormatChange(format);
}

async function saveUserSettings() {
  try {
    // Validate filename template
    if (!validateFilenameTemplate()) {
      showNotification('請修正文件名模板', 'error');
      return;
    }
    
    const settings: UserSettings = {
      defaultFormat: formatSelect.value as 'png' | 'jpeg',
      defaultQuality: parseInt(qualitySlider.value),
      filenameTemplate: filenameTemplate.value.trim(),
      autoDownload: autoDownloadCheckbox.checked,
      showProgress: showProgressCheckbox.checked,
      highlightColor: highlightColorInput?.value || DEFAULT_SETTINGS.highlightColor
    };
    
    // Validate settings before saving
    const validation = validateSettings(settings);
    if (!validation.isValid) {
      showNotification(`設置驗證失敗: ${validation.errors.join(', ')}`, 'error');
      return;
    }
    
    await saveSettings(settings);
    showNotification('設置已保存', 'success');
    console.log('Settings saved:', settings);
    
    // Show preview of generated filename
    const previewFilename = generateFilename(settings.filenameTemplate, settings.defaultFormat);
    showNotification(`文件名預覽: ${previewFilename}`, 'info');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showNotification('保存設置失敗', 'error');
  }
}

async function resetUserSettings() {
  try {
    const defaultSettings = await resetSettings();
    displaySettings(defaultSettings);
    showNotification('設置已重置為默認值', 'success');
    console.log('Settings reset to defaults');
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showNotification('重置設置失敗', 'error');
  }
}

// Settings functions are now imported from settingsManager

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  // Remove existing notifications
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Insert at the top of the container
  const container = document.querySelector('.options-container');
  if (container) {
    container.insertBefore(notification, container.firstChild);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
}

// Export functions for testing
export {
  validateFilenameTemplate,
  showNotification,
  displaySettings
};