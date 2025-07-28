// Settings manager utility for Chrome extension
import { UserSettings } from '../types';

// Default settings
export const DEFAULT_SETTINGS: UserSettings = {
  defaultFormat: 'png',
  defaultQuality: 90,
  filenameTemplate: 'screenshot-{timestamp}',
  autoDownload: true,
  showProgress: true,
  highlightColor: '#007bff'
};

/**
 * Load user settings from Chrome storage
 */
export async function loadSettings(): Promise<UserSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        const settings = { ...DEFAULT_SETTINGS, ...items };
        resolve(settings);
      }
    });
  });
}

/**
 * Save user settings to Chrome storage
 */
export async function saveSettings(settings: UserSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update specific setting values
 */
export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const currentSettings = await loadSettings();
  const newSettings = { ...currentSettings, ...updates };
  await saveSettings(newSettings);
  return newSettings;
}

/**
 * Reset settings to default values
 */
export async function resetSettings(): Promise<UserSettings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/**
 * Validate settings object
 */
export function validateSettings(settings: Partial<UserSettings>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate format
  if (settings.defaultFormat && !['png', 'jpeg'].includes(settings.defaultFormat)) {
    errors.push('Invalid format: must be png or jpeg');
  }

  // Validate quality
  if (settings.defaultQuality !== undefined) {
    if (typeof settings.defaultQuality !== 'number' || 
        settings.defaultQuality < 10 || 
        settings.defaultQuality > 100) {
      errors.push('Invalid quality: must be a number between 10 and 100');
    }
  }

  // Validate filename template
  if (settings.filenameTemplate !== undefined) {
    const template = settings.filenameTemplate.trim();
    if (!template || template.includes('/') || template.includes('\\')) {
      errors.push('Invalid filename template: cannot be empty or contain path separators');
    }
  }

  // Validate boolean settings
  if (settings.autoDownload !== undefined && typeof settings.autoDownload !== 'boolean') {
    errors.push('Invalid autoDownload: must be boolean');
  }

  if (settings.showProgress !== undefined && typeof settings.showProgress !== 'boolean') {
    errors.push('Invalid showProgress: must be boolean');
  }

  // Validate highlight color
  if (settings.highlightColor !== undefined) {
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    if (!colorRegex.test(settings.highlightColor)) {
      errors.push('Invalid highlight color: must be a valid hex color');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate filename from template
 */
export function generateFilename(template: string, format: 'png' | 'jpeg'): string {
  const now = new Date();
  const timestamp = now.getTime().toString();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

  let filename = template
    .replace(/{timestamp}/g, timestamp)
    .replace(/{date}/g, date)
    .replace(/{time}/g, time);

  // Ensure proper extension
  const extension = format === 'jpeg' ? 'jpg' : format;
  if (!filename.toLowerCase().endsWith(`.${extension}`)) {
    filename += `.${extension}`;
  }

  return filename;
}

/**
 * Get setting value with fallback to default
 */
export async function getSetting<K extends keyof UserSettings>(
  key: K, 
  fallback?: UserSettings[K]
): Promise<UserSettings[K]> {
  try {
    const settings = await loadSettings();
    return settings[key] ?? fallback ?? DEFAULT_SETTINGS[key];
  } catch (error) {
    console.error('Failed to get setting:', error);
    return fallback ?? DEFAULT_SETTINGS[key];
  }
}

/**
 * Listen for settings changes
 */
export function onSettingsChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      callback(changes);
    }
  });
}

/**
 * Export settings to JSON
 */
export async function exportSettings(): Promise<string> {
  const settings = await loadSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from JSON
 */
export async function importSettings(jsonString: string): Promise<UserSettings> {
  try {
    const importedSettings = JSON.parse(jsonString);
    const validation = validateSettings(importedSettings);
    
    if (!validation.isValid) {
      throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
    }
    
    const settings = { ...DEFAULT_SETTINGS, ...importedSettings };
    await saveSettings(settings);
    return settings;
  } catch (error) {
    throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}