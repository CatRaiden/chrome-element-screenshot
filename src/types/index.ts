// Core interfaces for the Chrome element screenshot extension

export interface ScreenshotRequest {
  elementSelector: string;
  isLongScreenshot: boolean;
  options: ScreenshotOptions;
}

export interface LongScreenshotSegment {
  dataUrl: string;
  scrollPosition: ScrollPosition;
  segmentIndex: number;
  elementRect: DOMRect;
}

export interface ScreenshotOptions {
  format: 'png' | 'jpeg';
  quality: number;
  filename: string;
}

export interface ElementInfo {
  selector: string;
  boundingRect: DOMRect;
  isScrollable: boolean;
  totalHeight: number;
  visibleHeight: number;
  // Complex element properties
  hasTransform: boolean;
  transformMatrix?: DOMMatrix;
  hasShadow: boolean;
  shadowInfo?: ShadowInfo;
  isInIframe: boolean;
  iframeInfo?: IframeInfo;
  isFixed: boolean;
  zIndex: number;
  computedStyles: ComputedElementStyles;
}

export interface ShadowInfo {
  boxShadow: string;
  textShadow: string;
  shadowBounds: DOMRect;
}

export interface IframeInfo {
  iframeSelector: string;
  iframeBounds: DOMRect;
  relativePosition: { x: number; y: number };
}

export interface ComputedElementStyles {
  position: string;
  transform: string;
  transformOrigin: string;
  boxShadow: string;
  textShadow: string;
  border: string;
  borderRadius: string;
  overflow: string;
  zIndex: string;
}

export interface ScrollPosition {
  x: number;
  y: number;
  isComplete: boolean;
}

export interface UserSettings {
  defaultFormat: 'png' | 'jpeg';
  defaultQuality: number;
  filenameTemplate: string;
  autoDownload: boolean;
  showProgress: boolean;
  highlightColor: string;
}

export interface ScreenshotSession {
  id: string;
  tabId: number;
  element: ElementInfo;
  options: ScreenshotOptions;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: string; // base64 image data
  isLongScreenshot?: boolean;
  segments?: LongScreenshotSegment[];
  totalSegments?: number;
}

export enum ScreenshotError {
  ELEMENT_NOT_FOUND = 'element_not_found',
  PERMISSION_DENIED = 'permission_denied',
  CAPTURE_FAILED = 'capture_failed',
  PROCESSING_ERROR = 'processing_error',
  DOWNLOAD_FAILED = 'download_failed'
}

// Message types for communication between components
export enum MessageType {
  // General
  PING = 'PING',
  
  // Screenshot related
  START_SCREENSHOT = 'START_SCREENSHOT',
  STOP_SCREENSHOT = 'STOP_SCREENSHOT',
  START_SCREENSHOT_MODE = 'START_SCREENSHOT_MODE',
  EXIT_SCREENSHOT_MODE = 'EXIT_SCREENSHOT_MODE',
  ELEMENT_SELECTED = 'ELEMENT_SELECTED',
  CAPTURE_SCREENSHOT = 'CAPTURE_SCREENSHOT',
  SCREENSHOT_PROGRESS = 'SCREENSHOT_PROGRESS',
  SCREENSHOT_COMPLETE = 'SCREENSHOT_COMPLETE',
  
  // Long screenshot related
  SCROLL_TO_POSITION = 'SCROLL_TO_POSITION',
  RESET_SCROLL = 'RESET_SCROLL',
  
  // Settings related
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  
  // Error handling
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  MANUAL_SAVE_REQUEST = 'MANUAL_SAVE_REQUEST'
}

export interface MessageRequest<T = any> {
  type: MessageType;
  payload?: T | undefined;
  requestId?: string | undefined;
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string | undefined;
}

// Specific message payload types
export interface StartScreenshotModePayload {
  options?: Partial<ScreenshotOptions>;
}

export interface ElementSelectedPayload {
  elementInfo: ElementInfo;
}

export interface CaptureScreenshotPayload {
  elementInfo: ElementInfo;
  options: ScreenshotOptions;
}

export interface ScreenshotProgressPayload {
  sessionId: string;
  progress: number;
  status: string;
}

export interface ScreenshotCompletePayload {
  sessionId: string;
  result: string; // base64 image data
  filename: string;
}

export interface ErrorPayload {
  error: ScreenshotError;
  message: string;
  details?: any;
}

export interface ScrollToPositionPayload {
  selector: string;
  scrollTop: number;
}

export interface ResetScrollPayload {
  selector: string;
}