// Content script for element selection and DOM manipulation

import { MessageRouter, sendMessageToBackground } from '../utils/messageHandler';
import { MessageType, ElementInfo, ScrollPosition, StartScreenshotModePayload, ElementSelectedPayload, ShadowInfo, IframeInfo, ComputedElementStyles } from '../types';

// Initialize message router
const messageRouter = new MessageRouter();

// Element selection state
let isSelectionMode = false;
let highlightDiv: HTMLElement | null = null;
let overlayElement: HTMLElement | null = null;
let tooltipElement: HTMLElement | null = null;
let currentHoveredElement: Element | null = null;

// Initialize content script
console.log('Chrome元素截圖工具 content script 已載入');

// Setup message handlers
setupMessageHandlers();

// Setup message listener
messageRouter.setupListener();

/**
 * Setup message handlers for different message types
 */
function setupMessageHandlers(): void {
  // Ping handler for connectivity testing
  messageRouter.register(MessageType.PING, async () => {
    return 'content script ready';
  });

  // Start screenshot mode
  messageRouter.register(MessageType.START_SCREENSHOT_MODE, async (_payload: StartScreenshotModePayload) => {
    console.log('Starting screenshot mode in content script');
    startElementSelection();
    return { status: 'screenshot_mode_started_in_content' };
  });

  // Exit screenshot mode
  messageRouter.register(MessageType.EXIT_SCREENSHOT_MODE, async (_payload) => {
    console.log('Exiting screenshot mode in content script');
    exitElementSelection();
    return { status: 'screenshot_mode_exited_in_content' };
  });

  // Handle screenshot progress updates
  messageRouter.register(MessageType.SCREENSHOT_PROGRESS, async (payload) => {
    console.log('Screenshot progress:', payload);
    showProgressTooltip(payload.status, payload.progress);
    return { status: 'progress_updated' };
  });

  // Handle screenshot completion
  messageRouter.register(MessageType.SCREENSHOT_COMPLETE, async (payload) => {
    console.log('Screenshot completed:', payload);
    showTooltip(`截圖完成！文件已保存為: ${payload.filename}`);
    setTimeout(() => {
      removeTooltip();
    }, 3000);
    return { status: 'completion_handled' };
  });

  // Handle screenshot errors with enhanced UI
  messageRouter.register(MessageType.ERROR_OCCURRED, async (payload) => {
    console.error('Screenshot error:', payload);
    
    // Show enhanced error message
    const errorMessage = payload.message || '截圖過程中發生未知錯誤';
    const details = payload.details || {};
    
    if (details.manualSaveAvailable) {
      // Show manual save option
      showManualSaveTooltip(errorMessage, details.sessionId, details.filename);
    } else if (details.retryable) {
      // Show retry message
      showRetryTooltip(errorMessage, details.userAction);
    } else {
      // Show standard error message
      showErrorTooltip(errorMessage, details.userAction, details.severity);
    }
    
    return { status: 'error_handled' };
  });

  // Handle scroll control for long screenshots
  messageRouter.register(MessageType.SCROLL_TO_POSITION, async (payload) => {
    try {
      const scrollPosition = await scrollElementToPosition(payload.selector, payload.scrollTop);
      return { status: 'scrolled', scrollPosition };
    } catch (error) {
      console.error('Failed to scroll element:', error);
      throw new Error(`Scroll failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Handle scroll reset
  messageRouter.register(MessageType.RESET_SCROLL, async (payload) => {
    try {
      await resetElementScroll(payload.selector);
      return { status: 'scroll_reset' };
    } catch (error) {
      console.error('Failed to reset scroll:', error);
      throw new Error(`Scroll reset failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Send test message to background script (for testing purposes)
 */
export async function testBackgroundConnection(): Promise<boolean> {
  try {
    const response = await sendMessageToBackground(MessageType.PING);
    return response.success && response.data === 'pong';
  } catch (error) {
    console.error('Failed to connect to background script:', error);
    return false;
  }
}

/**
 * Get user settings from background script
 */
export async function getUserSettings() {
  try {
    const response = await sendMessageToBackground(MessageType.GET_SETTINGS);
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Failed to get user settings:', error);
    throw error;
  }
}

// ===== Element Selection Functionality =====

/**
 * Start element selection mode
 */
function startElementSelection(): void {
  if (isSelectionMode) {
    return;
  }

  isSelectionMode = true;
  createOverlay();
  addEventListeners();
  showTooltip('將滑鼠懸停在元素上並點擊以選擇截圖區域。按 ESC 鍵退出。');
  
  console.log('Element selection mode started');
}

/**
 * Exit element selection mode
 */
function exitElementSelection(): void {
  if (!isSelectionMode) {
    return;
  }

  isSelectionMode = false;
  removeEventListeners();
  removeHighlight();
  removeOverlay();
  removeTooltip();
  currentHoveredElement = null;
  
  console.log('Element selection mode exited');
}

/**
 * Create overlay element for selection mode
 */
function createOverlay(): void {
  if (overlayElement) {
    return;
  }

  overlayElement = document.createElement('div');
  overlayElement.className = 'screenshot-selection-overlay';
  document.body.appendChild(overlayElement);
}

/**
 * Remove overlay element
 */
function removeOverlay(): void {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}

/**
 * Add event listeners for element selection
 */
function addEventListeners(): void {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Prevent default context menu during selection
  document.addEventListener('contextmenu', preventDefault, true);
}

/**
 * Remove event listeners
 */
function removeEventListeners(): void {
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('contextmenu', preventDefault, true);
}

/**
 * Handle mouse over events for element highlighting
 */
function handleMouseOver(event: MouseEvent): void {
  if (!isSelectionMode) {
    return;
  }

  const target = event.target as Element;
  
  // Skip if hovering over our own overlay or highlight elements
  if (target.classList.contains('screenshot-selection-overlay') ||
      target.classList.contains('screenshot-element-highlight') ||
      target.classList.contains('screenshot-tooltip')) {
    return;
  }

  // Skip if same element
  if (target === currentHoveredElement) {
    return;
  }

  currentHoveredElement = target;
  highlightElement(target);
  updateTooltip(target, event);
}

/**
 * Handle mouse out events
 */
function handleMouseOut(event: MouseEvent): void {
  if (!isSelectionMode) {
    return;
  }

  const target = event.target as Element;
  const relatedTarget = event.relatedTarget as Element;

  // Don't remove highlight if moving to our overlay elements
  if (relatedTarget && (
    relatedTarget.classList.contains('screenshot-selection-overlay') ||
    relatedTarget.classList.contains('screenshot-element-highlight') ||
    relatedTarget.classList.contains('screenshot-tooltip')
  )) {
    return;
  }

  // Only remove highlight if we're actually leaving the element
  if (target === currentHoveredElement) {
    removeHighlight();
    currentHoveredElement = null;
  }
}

/**
 * Handle click events for element selection
 */
function handleClick(event: MouseEvent): void {
  if (!isSelectionMode) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const target = event.target as Element;
  
  // Skip if clicking on our overlay elements
  if (target.classList.contains('screenshot-selection-overlay') ||
      target.classList.contains('screenshot-element-highlight') ||
      target.classList.contains('screenshot-tooltip')) {
    return;
  }

  selectElement(target);
}

/**
 * Handle keyboard events
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!isSelectionMode) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    exitElementSelection();
    sendMessageToBackground(MessageType.EXIT_SCREENSHOT_MODE);
  }
}

/**
 * Prevent default behavior
 */
function preventDefault(event: Event): void {
  if (isSelectionMode) {
    event.preventDefault();
  }
}

/**
 * Highlight the specified element
 */
function highlightElement(element: Element): void {
  removeHighlight();

  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  highlightDiv = document.createElement('div');
  highlightDiv.className = 'screenshot-element-highlight';
  
  // Position the highlight overlay
  highlightDiv.style.left = `${rect.left + scrollX}px`;
  highlightDiv.style.top = `${rect.top + scrollY}px`;
  highlightDiv.style.width = `${rect.width}px`;
  highlightDiv.style.height = `${rect.height}px`;

  document.body.appendChild(highlightDiv);
}

/**
 * Remove element highlight
 */
function removeHighlight(): void {
  if (highlightDiv) {
    highlightDiv.remove();
    highlightDiv = null;
  }
}

/**
 * Show tooltip with instructions
 */
function showTooltip(message: string): void {
  removeTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'screenshot-tooltip';
  tooltipElement.textContent = message;
  
  // Position tooltip at top-left of viewport
  tooltipElement.style.left = '20px';
  tooltipElement.style.top = '20px';

  document.body.appendChild(tooltipElement);
}

/**
 * Update tooltip with element information
 */
function updateTooltip(element: Element, event: MouseEvent): void {
  if (!tooltipElement) {
    return;
  }

  const tagName = element.tagName.toLowerCase();
  const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
  const id = element.id ? `#${element.id}` : '';
  
  let elementInfo = tagName;
  if (id) elementInfo += id;
  if (className) elementInfo += className;
  
  tooltipElement.textContent = `點擊選擇: ${elementInfo}`;
  
  // Position tooltip near cursor but keep it visible
  const rect = tooltipElement.getBoundingClientRect();
  const x = Math.min(event.clientX + 10, window.innerWidth - rect.width - 10);
  const y = Math.max(event.clientY - rect.height - 10, 10);
  
  tooltipElement.style.left = `${x}px`;
  tooltipElement.style.top = `${y}px`;
}

/**
 * Remove tooltip
 */
function removeTooltip(): void {
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
}

/**
 * Show progress tooltip with progress bar
 */
function showProgressTooltip(message: string, progress: number): void {
  removeTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'screenshot-tooltip screenshot-progress-tooltip';
  
  // Create progress content
  const messageDiv = document.createElement('div');
  messageDiv.textContent = message;
  
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'screenshot-progress-bar-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'screenshot-progress-bar';
  progressBar.style.width = `${progress}%`;
  
  const progressText = document.createElement('div');
  progressText.className = 'screenshot-progress-text';
  progressText.textContent = `${progress}%`;
  
  progressBarContainer.appendChild(progressBar);
  tooltipElement.appendChild(messageDiv);
  tooltipElement.appendChild(progressBarContainer);
  tooltipElement.appendChild(progressText);
  
  // Position tooltip at top-left of viewport
  tooltipElement.style.left = '20px';
  tooltipElement.style.top = '20px';

  document.body.appendChild(tooltipElement);
}

/**
 * Show manual save tooltip with download button
 */
function showManualSaveTooltip(errorMessage: string, sessionId: string, filename: string): void {
  removeTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'screenshot-tooltip screenshot-error-tooltip screenshot-manual-save-tooltip';
  
  // Error message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'screenshot-error-message';
  messageDiv.textContent = errorMessage;
  
  // Manual save instruction
  const instructionDiv = document.createElement('div');
  instructionDiv.className = 'screenshot-manual-save-instruction';
  instructionDiv.textContent = '點擊下方按鈕手動保存截圖：';
  
  // Manual save button
  const saveButton = document.createElement('button');
  saveButton.className = 'screenshot-manual-save-button';
  saveButton.textContent = `保存 ${filename}`;
  saveButton.onclick = async () => {
    try {
      saveButton.disabled = true;
      saveButton.textContent = '正在保存...';
      
      await sendMessageToBackground(MessageType.MANUAL_SAVE_REQUEST, { sessionId });
      
      showTooltip('截圖已成功保存！');
      setTimeout(() => removeTooltip(), 3000);
    } catch (error) {
      console.error('Manual save failed:', error);
      saveButton.disabled = false;
      saveButton.textContent = `保存 ${filename}`;
      showTooltip('手動保存失敗，請重試');
    }
  };
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'screenshot-close-button';
  closeButton.textContent = '關閉';
  closeButton.onclick = () => removeTooltip();
  
  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'screenshot-button-container';
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(closeButton);
  
  tooltipElement.appendChild(messageDiv);
  tooltipElement.appendChild(instructionDiv);
  tooltipElement.appendChild(buttonContainer);
  
  // Position tooltip at center of viewport
  tooltipElement.style.left = '50%';
  tooltipElement.style.top = '50%';
  tooltipElement.style.transform = 'translate(-50%, -50%)';
  tooltipElement.style.position = 'fixed';
  tooltipElement.style.zIndex = '10001';

  document.body.appendChild(tooltipElement);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (tooltipElement && tooltipElement.classList.contains('screenshot-manual-save-tooltip')) {
      removeTooltip();
    }
  }, 30000);
}

/**
 * Show retry tooltip with retry information
 */
function showRetryTooltip(errorMessage: string, userAction?: string): void {
  removeTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'screenshot-tooltip screenshot-error-tooltip screenshot-retry-tooltip';
  
  // Error message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'screenshot-error-message';
  messageDiv.textContent = errorMessage;
  
  // User action message
  if (userAction) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'screenshot-user-action';
    actionDiv.textContent = userAction;
    tooltipElement.appendChild(actionDiv);
  }
  
  // Retry indicator
  const retryDiv = document.createElement('div');
  retryDiv.className = 'screenshot-retry-indicator';
  retryDiv.textContent = '系統正在自動重試...';
  
  tooltipElement.appendChild(messageDiv);
  tooltipElement.appendChild(retryDiv);
  
  // Position tooltip at top-left of viewport
  tooltipElement.style.left = '20px';
  tooltipElement.style.top = '20px';

  document.body.appendChild(tooltipElement);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (tooltipElement && tooltipElement.classList.contains('screenshot-retry-tooltip')) {
      removeTooltip();
    }
  }, 10000);
}

/**
 * Show error tooltip with severity-based styling
 */
function showErrorTooltip(errorMessage: string, userAction?: string, severity: string = 'medium'): void {
  removeTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = `screenshot-tooltip screenshot-error-tooltip screenshot-error-${severity}`;
  
  // Error message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'screenshot-error-message';
  messageDiv.textContent = errorMessage;
  
  // User action message
  if (userAction) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'screenshot-user-action';
    actionDiv.textContent = userAction;
    tooltipElement.appendChild(actionDiv);
  }
  
  // Close button for persistent errors
  if (severity === 'high' || severity === 'critical') {
    const closeButton = document.createElement('button');
    closeButton.className = 'screenshot-close-button';
    closeButton.textContent = '關閉';
    closeButton.onclick = () => removeTooltip();
    tooltipElement.appendChild(closeButton);
  }
  
  tooltipElement.appendChild(messageDiv);
  
  // Position tooltip at top-left of viewport
  tooltipElement.style.left = '20px';
  tooltipElement.style.top = '20px';

  document.body.appendChild(tooltipElement);
  
  // Auto-remove based on severity
  const autoRemoveDelay = severity === 'critical' ? 0 : // Don't auto-remove critical errors
                         severity === 'high' ? 15000 :
                         severity === 'medium' ? 8000 : 5000;
  
  if (autoRemoveDelay > 0) {
    setTimeout(() => {
      if (tooltipElement && tooltipElement.classList.contains('screenshot-error-tooltip')) {
        removeTooltip();
      }
    }, autoRemoveDelay);
  }
}

/**
 * Select an element and send selection info to background
 */
async function selectElement(element: Element): Promise<void> {
  try {
    const elementInfo = getElementInfo(element);
    
    // Send element selection to background script
    const payload: ElementSelectedPayload = {
      elementInfo
    };
    
    const response = await sendMessageToBackground(MessageType.ELEMENT_SELECTED, payload);
    
    if (response.success) {
      console.log('Element selected successfully:', elementInfo);
      // Exit selection mode after successful selection
      exitElementSelection();
    } else {
      console.error('Failed to select element:', response.error);
      showTooltip('選擇元素失敗，請重試');
    }
  } catch (error) {
    console.error('Error selecting element:', error);
    showTooltip('選擇元素時發生錯誤');
  }
}

/**
 * Get detailed information about an element
 */
function getElementInfo(element: Element): ElementInfo {
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  
  // Create a more specific selector
  const selector = generateElementSelector(element);
  
  // Enhanced scrollable detection
  const scrollInfo = detectScrollableElement(element);
  
  // Detect complex element properties
  const complexInfo = analyzeComplexElement(element);
  
  return {
    selector,
    boundingRect: {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      top: rect.top + scrollY,
      right: rect.right + scrollX,
      bottom: rect.bottom + scrollY,
      left: rect.left + scrollX,
      toJSON: () => ({
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
        top: rect.top + scrollY,
        right: rect.right + scrollX,
        bottom: rect.bottom + scrollY,
        left: rect.left + scrollX
      })
    } as DOMRect,
    isScrollable: scrollInfo.isScrollable,
    totalHeight: scrollInfo.totalHeight,
    visibleHeight: scrollInfo.visibleHeight,
    ...complexInfo
  };
}

/**
 * Detect if element is scrollable and get scroll dimensions
 */
function detectScrollableElement(element: Element): {
  isScrollable: boolean;
  totalHeight: number;
  visibleHeight: number;
} {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  
  // Check various overflow conditions
  const hasVerticalOverflow = computedStyle.overflowY === 'scroll' || 
                             computedStyle.overflowY === 'auto' ||
                             computedStyle.overflow === 'scroll' ||
                             computedStyle.overflow === 'auto';
  
  // Get scroll dimensions
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;
  const visibleHeight = rect.height;
  
  // Element is scrollable if it has overflow and content exceeds visible area
  const isScrollable = hasVerticalOverflow && scrollHeight > clientHeight;
  
  // For long screenshot detection, also consider if content significantly exceeds viewport
  const exceedsViewport = scrollHeight > window.innerHeight * 1.5;
  const isLongContent = isScrollable || exceedsViewport;
  
  return {
    isScrollable: isLongContent,
    totalHeight: Math.max(scrollHeight, visibleHeight),
    visibleHeight: visibleHeight
  };
}

/**
 * Generate a unique CSS selector for an element
 */
function generateElementSelector(element: Element): string {
  // If element has an ID, use it
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Build path from element to root
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // Add class if available and not too generic
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(cls => 
        cls && !cls.startsWith('screenshot-') // Skip our own classes
      );
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => 
        child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// ===== Long Screenshot Scroll Control =====

/**
 * Scroll element to specific position for long screenshot
 */
export async function scrollElementToPosition(
  selector: string, 
  scrollTop: number
): Promise<ScrollPosition> {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Scroll to position
  element.scrollTop = scrollTop;
  
  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get current scroll position
  const currentScrollTop = element.scrollTop;
  const maxScrollTop = element.scrollHeight - element.clientHeight;
  
  return {
    x: element.scrollLeft,
    y: currentScrollTop,
    isComplete: currentScrollTop >= maxScrollTop
  };
}

/**
 * Calculate scroll positions for long screenshot segments
 */
export function calculateScrollSegments(elementInfo: ElementInfo): ScrollPosition[] {
  const { totalHeight, visibleHeight } = elementInfo;
  
  if (!elementInfo.isScrollable || totalHeight <= visibleHeight) {
    // Not scrollable, return single position
    return [{ x: 0, y: 0, isComplete: true }];
  }
  
  const segments: ScrollPosition[] = [];
  const segmentHeight = visibleHeight * 0.9; // 90% overlap to ensure no gaps
  const totalScrollHeight = totalHeight - visibleHeight;
  
  let currentScrollTop = 0;
  let segmentIndex = 0;
  
  while (currentScrollTop <= totalScrollHeight) {
    segments.push({
      x: 0,
      y: currentScrollTop,
      isComplete: currentScrollTop >= totalScrollHeight
    });
    
    if (currentScrollTop >= totalScrollHeight) {
      break;
    }
    
    currentScrollTop += segmentHeight;
    segmentIndex++;
    
    // Safety limit to prevent infinite loops
    if (segmentIndex > 50) {
      console.warn('Too many scroll segments, limiting to 50');
      break;
    }
  }
  
  return segments;
}

/**
 * Reset element scroll position
 */
export async function resetElementScroll(selector: string): Promise<void> {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollTop = 0;
    element.scrollLeft = 0;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Analyze complex element properties for enhanced screenshot handling
 */
function analyzeComplexElement(element: Element): {
  hasTransform: boolean;
  transformMatrix?: DOMMatrix;
  hasShadow: boolean;
  shadowInfo?: ShadowInfo;
  isInIframe: boolean;
  iframeInfo?: IframeInfo;
  isFixed: boolean;
  zIndex: number;
  computedStyles: ComputedElementStyles;
} {
  const computedStyle = window.getComputedStyle(element);
  
  // Analyze CSS transforms
  const transform = computedStyle.transform;
  const hasTransform = Boolean(transform && transform !== 'none' && transform !== '');
  let transformMatrix: DOMMatrix | undefined;
  
  if (hasTransform) {
    try {
      transformMatrix = new DOMMatrix(transform);
    } catch (error) {
      console.warn('Failed to parse transform matrix:', error);
    }
  }
  
  // Analyze shadows
  const boxShadow = computedStyle.boxShadow;
  const textShadow = computedStyle.textShadow;
  const hasShadow = (boxShadow && boxShadow !== 'none' && boxShadow !== '') || 
                    (textShadow && textShadow !== 'none' && textShadow !== '');
  
  let shadowInfo: ShadowInfo | undefined;
  if (hasShadow) {
    shadowInfo = calculateShadowBounds(element, boxShadow, textShadow);
  }
  
  // Check if element is in iframe
  const iframeInfo = detectIframeContext(element);
  const isInIframe = iframeInfo !== null;
  
  // Check positioning
  const position = computedStyle.position;
  const isFixed = position === 'fixed' || position === 'sticky';
  
  // Get z-index
  const zIndexStr = computedStyle.zIndex;
  const zIndex = zIndexStr === 'auto' ? 0 : parseInt(zIndexStr, 10) || 0;
  
  // Collect computed styles
  const computedStyles: ComputedElementStyles = {
    position: computedStyle.position,
    transform: computedStyle.transform,
    transformOrigin: computedStyle.transformOrigin,
    boxShadow: computedStyle.boxShadow,
    textShadow: computedStyle.textShadow,
    border: computedStyle.border,
    borderRadius: computedStyle.borderRadius,
    overflow: computedStyle.overflow,
    zIndex: computedStyle.zIndex
  };
  
  return {
    hasTransform,
    transformMatrix,
    hasShadow,
    shadowInfo,
    isInIframe,
    iframeInfo,
    isFixed,
    zIndex,
    computedStyles
  };
}

/**
 * Calculate shadow bounds for an element
 */
function calculateShadowBounds(element: Element, boxShadow: string, textShadow: string): ShadowInfo {
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  
  // Parse shadow values to calculate extended bounds
  let maxShadowExtent = 0;
  
  // Parse box-shadow
  if (boxShadow && boxShadow !== 'none') {
    const shadowExtent = parseShadowExtent(boxShadow);
    maxShadowExtent = Math.max(maxShadowExtent, shadowExtent);
  }
  
  // Parse text-shadow
  if (textShadow && textShadow !== 'none') {
    const shadowExtent = parseShadowExtent(textShadow);
    maxShadowExtent = Math.max(maxShadowExtent, shadowExtent);
  }
  
  // Calculate shadow bounds (element bounds + shadow extent)
  const shadowBounds: DOMRect = {
    x: rect.left + scrollX - maxShadowExtent,
    y: rect.top + scrollY - maxShadowExtent,
    width: rect.width + (maxShadowExtent * 2),
    height: rect.height + (maxShadowExtent * 2),
    top: rect.top + scrollY - maxShadowExtent,
    right: rect.right + scrollX + maxShadowExtent,
    bottom: rect.bottom + scrollY + maxShadowExtent,
    left: rect.left + scrollX - maxShadowExtent,
    toJSON: () => ({
      x: rect.left + scrollX - maxShadowExtent,
      y: rect.top + scrollY - maxShadowExtent,
      width: rect.width + (maxShadowExtent * 2),
      height: rect.height + (maxShadowExtent * 2),
      top: rect.top + scrollY - maxShadowExtent,
      right: rect.right + scrollX + maxShadowExtent,
      bottom: rect.bottom + scrollY + maxShadowExtent,
      left: rect.left + scrollX - maxShadowExtent
    })
  } as DOMRect;
  
  return {
    boxShadow,
    textShadow,
    shadowBounds
  };
}

/**
 * Parse shadow CSS value to get maximum extent
 */
function parseShadowExtent(shadowValue: string): number {
  let maxExtent = 0;
  
  try {
    // Split multiple shadows
    const shadows = shadowValue.split(',');
    
    for (const shadow of shadows) {
      // Parse shadow values: offset-x offset-y blur-radius spread-radius color
      const values = shadow.trim().split(/\s+/);
      
      if (values.length >= 2) {
        const offsetX = Math.abs(parseFloat(values[0]) || 0);
        const offsetY = Math.abs(parseFloat(values[1]) || 0);
        const blurRadius = Math.abs(parseFloat(values[2]) || 0);
        const spreadRadius = Math.abs(parseFloat(values[3]) || 0);
        
        // Calculate maximum extent for this shadow
        const extent = Math.max(offsetX, offsetY) + blurRadius + spreadRadius;
        maxExtent = Math.max(maxExtent, extent);
      }
    }
  } catch (error) {
    console.warn('Failed to parse shadow extent:', error);
    // Fallback to a reasonable default
    maxExtent = 10;
  }
  
  return maxExtent;
}

/**
 * Detect if element is within an iframe and get iframe information
 */
function detectIframeContext(element: Element): IframeInfo | null {
  try {
    // Check if we're in an iframe by comparing window objects
    if (window.parent === window) {
      return null; // Not in iframe
    }
    
    // We're in an iframe, but we can't access parent due to cross-origin restrictions
    // We'll need to handle this differently by detecting iframe elements in the current document
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        // Check if element is within this iframe's content
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframeDoc.contains(element)) {
          const iframeRect = iframe.getBoundingClientRect();
          const scrollX = window.scrollX || document.documentElement.scrollLeft;
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          const elementRect = element.getBoundingClientRect();
          
          return {
            iframeSelector: generateElementSelector(iframe),
            iframeBounds: {
              x: iframeRect.left + scrollX,
              y: iframeRect.top + scrollY,
              width: iframeRect.width,
              height: iframeRect.height,
              top: iframeRect.top + scrollY,
              right: iframeRect.right + scrollX,
              bottom: iframeRect.bottom + scrollY,
              left: iframeRect.left + scrollX,
              toJSON: () => ({
                x: iframeRect.left + scrollX,
                y: iframeRect.top + scrollY,
                width: iframeRect.width,
                height: iframeRect.height,
                top: iframeRect.top + scrollY,
                right: iframeRect.right + scrollX,
                bottom: iframeRect.bottom + scrollY,
                left: iframeRect.left + scrollX
              })
            } as DOMRect,
            relativePosition: {
              x: elementRect.left - iframeRect.left,
              y: elementRect.top - iframeRect.top
            }
          };
        }
      } catch (error) {
        // Cross-origin iframe, skip
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to detect iframe context:', error);
    return null;
  }
}

/**
 * Get element bounds including transforms and shadows
 */
function getComplexElementBounds(element: Element): DOMRect {
  const elementInfo = getElementInfo(element);
  
  // Start with basic bounds
  let bounds = elementInfo.boundingRect;
  
  // Extend bounds for shadows
  if (elementInfo.hasShadow && elementInfo.shadowInfo) {
    bounds = elementInfo.shadowInfo.shadowBounds;
  }
  
  // Handle transforms
  if (elementInfo.hasTransform && elementInfo.transformMatrix) {
    bounds = calculateTransformedBounds(bounds, elementInfo.transformMatrix);
  }
  
  return bounds;
}

/**
 * Calculate bounds after applying transform matrix
 */
function calculateTransformedBounds(bounds: DOMRect, matrix: DOMMatrix): DOMRect {
  // Get all four corners of the element
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ];
  
  // Transform each corner
  const transformedCorners = corners.map(corner => {
    const point = new DOMPoint(corner.x, corner.y);
    return matrix.transformPoint(point);
  });
  
  // Find bounding box of transformed corners
  const xs = transformedCorners.map(p => p.x);
  const ys = transformedCorners.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    top: minY,
    right: maxX,
    bottom: maxY,
    left: minX,
    toJSON: () => ({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      top: minY,
      right: maxX,
      bottom: maxY,
      left: minX
    })
  } as DOMRect;
}

// Export functions for testing
export {
  startElementSelection,
  exitElementSelection,
  getElementInfo,
  generateElementSelector,
  detectScrollableElement,
  analyzeComplexElement,
  getComplexElementBounds,
  calculateShadowBounds,
  detectIframeContext
};