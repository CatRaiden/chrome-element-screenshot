// Test setup file

// Mock Chrome APIs for testing
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    lastError: null,
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    captureVisibleTab: vi.fn(),
  },
  downloads: {
    download: vi.fn(),
  },
};

// @ts-ignore
global.chrome = mockChrome;