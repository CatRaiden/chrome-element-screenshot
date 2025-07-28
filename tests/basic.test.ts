// Basic tests to verify project structure and configuration

import { describe, it, expect } from 'vitest';
import { ScreenshotError } from '../src/types';

describe('Project Structure', () => {
  it('should have correct TypeScript types defined', () => {
    expect(ScreenshotError.ELEMENT_NOT_FOUND).toBe('element_not_found');
    expect(ScreenshotError.PERMISSION_DENIED).toBe('permission_denied');
    expect(ScreenshotError.CAPTURE_FAILED).toBe('capture_failed');
    expect(ScreenshotError.PROCESSING_ERROR).toBe('processing_error');
    expect(ScreenshotError.DOWNLOAD_FAILED).toBe('download_failed');
  });

  it('should have Chrome APIs mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.storage).toBeDefined();
  });
});