// Screenshot processing utilities for Chrome element screenshot extension

import { ScreenshotOptions, ElementInfo, LongScreenshotSegment, ScrollPosition } from '../types';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ScreenshotProcessor {
  /**
   * Capture full page screenshot using Chrome tabs API
   */
  static async captureFullPage(tabId: number): Promise<string> {
    try {
      // Get the window ID for the tab
      const tab = await chrome.tabs.get(tabId);
      const windowId = tab.windowId;
      
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100
      });
      
      if (!dataUrl) {
        throw new Error('Failed to capture screenshot');
      }
      
      return dataUrl;
    } catch (error) {
      console.error('Failed to capture full page screenshot:', error);
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Crop screenshot to element area with complex element handling
   */
  static async cropToElement(
    screenshotDataUrl: string,
    elementInfo: ElementInfo,
    devicePixelRatio: number = window.devicePixelRatio || 1
  ): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Load the screenshot image
      const img = await this.loadImage(screenshotDataUrl);
      
      // Calculate crop area for complex elements
      const cropArea = this.calculateComplexElementCropArea(elementInfo, devicePixelRatio);

      // Ensure crop area is within image bounds
      const adjustedCropArea = this.adjustCropArea(cropArea, img.width, img.height);
      
      // Set canvas size to cropped area
      canvas.width = adjustedCropArea.width;
      canvas.height = adjustedCropArea.height;

      // Handle complex element rendering
      if (elementInfo.hasTransform || elementInfo.hasShadow || elementInfo.isFixed) {
        await this.renderComplexElement(ctx, img, elementInfo, adjustedCropArea, devicePixelRatio);
      } else {
        // Standard cropping for simple elements
        ctx.drawImage(
          img,
          adjustedCropArea.x, adjustedCropArea.y, adjustedCropArea.width, adjustedCropArea.height,
          0, 0, adjustedCropArea.width, adjustedCropArea.height
        );
      }

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Failed to crop screenshot:', error);
      throw new Error(`Screenshot cropping failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert screenshot to specified format and quality
   */
  static convertFormat(
    dataUrl: string,
    options: ScreenshotOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        const img = new Image();
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Fill with white background for JPEG format
          if (options.format === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const convertedDataUrl = canvas.toDataURL(mimeType, options.quality);
          
          resolve(convertedDataUrl);
        };
        
        img.onerror = () => {
          reject(new Error('Format conversion failed: Failed to load image for format conversion'));
        };
        
        img.src = dataUrl;
      } catch (error) {
        reject(new Error(`Format conversion failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Generate filename based on template and current timestamp
   */
  static generateFilename(template: string, format: 'png' | 'jpeg'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    
    let filename = template
      .replace('{timestamp}', timestamp)
      .replace('{date}', dateStr)
      .replace('{time}', timeStr)
      .replace('{format}', format);
    
    // Ensure filename has correct extension
    const extension = format === 'jpeg' ? 'jpg' : 'png';
    if (!filename.endsWith(`.${extension}`)) {
      filename += `.${extension}`;
    }
    
    return filename;
  }

  /**
   * Download screenshot file
   */
  static async downloadScreenshot(
    dataUrl: string,
    filename: string
  ): Promise<void> {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create object URL
      const objectUrl = URL.createObjectURL(blob);
      
      // Use Chrome downloads API
      await chrome.downloads.download({
        url: objectUrl,
        filename: filename,
        saveAs: false
      });
      
      // Clean up object URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to download screenshot:', error);
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load image from data URL
   */
  private static loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.src = dataUrl;
    });
  }

  /**
   * Adjust crop area to ensure it's within image bounds
   */
  private static adjustCropArea(
    cropArea: CropArea,
    imageWidth: number,
    imageHeight: number
  ): CropArea {
    const adjusted: CropArea = { ...cropArea };
    
    // Ensure crop area starts within image bounds
    adjusted.x = Math.max(0, Math.min(adjusted.x, imageWidth - 1));
    adjusted.y = Math.max(0, Math.min(adjusted.y, imageHeight - 1));
    
    // Ensure crop area doesn't exceed image bounds
    adjusted.width = Math.min(adjusted.width, imageWidth - adjusted.x);
    adjusted.height = Math.min(adjusted.height, imageHeight - adjusted.y);
    
    // Ensure minimum size
    adjusted.width = Math.max(1, adjusted.width);
    adjusted.height = Math.max(1, adjusted.height);
    
    return adjusted;
  }

  /**
   * Get device pixel ratio from tab
   */
  static async getDevicePixelRatio(tabId: number): Promise<number> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.devicePixelRatio || 1
      });
      
      return results[0]?.result || 1;
    } catch (error) {
      console.warn('Failed to get device pixel ratio, using default:', error);
      return 1;
    }
  }

  /**
   * Capture long screenshot by scrolling and stitching multiple segments
   */
  static async captureLongScreenshot(
    tabId: number,
    elementInfo: ElementInfo,
    _devicePixelRatio: number = 1
  ): Promise<{ segments: LongScreenshotSegment[]; totalHeight: number }> {
    try {
      // Import types for messaging
      const { MessageType } = await import('../types');
      
      // Calculate scroll segments
      const scrollSegments = await this.calculateScrollSegments(elementInfo);
      const segments: LongScreenshotSegment[] = [];
      
      console.log(`Capturing ${scrollSegments.length} segments for long screenshot`);
      
      // Reset scroll position first
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.RESET_SCROLL,
        payload: { selector: elementInfo.selector }
      });
      
      // Capture each segment
      for (let i = 0; i < scrollSegments.length; i++) {
        const scrollPos = scrollSegments[i];
        
        // Scroll to position
        await chrome.tabs.sendMessage(tabId, {
          type: MessageType.SCROLL_TO_POSITION,
          payload: { 
            selector: elementInfo.selector, 
            scrollTop: scrollPos.y 
          }
        });
        
        // Wait for scroll to settle
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Capture screenshot at this position
        const screenshotDataUrl = await this.captureFullPage(tabId);
        
        // Get current element rect after scroll
        const currentElementRect = await this.getElementRectAfterScroll(
          tabId, 
          elementInfo.selector
        );
        
        segments.push({
          dataUrl: screenshotDataUrl,
          scrollPosition: scrollPos,
          segmentIndex: i,
          elementRect: currentElementRect
        });
      }
      
      // Reset scroll position after capture
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.RESET_SCROLL,
        payload: { selector: elementInfo.selector }
      });
      
      return {
        segments,
        totalHeight: elementInfo.totalHeight
      };
      
    } catch (error) {
      console.error('Failed to capture long screenshot:', error);
      throw new Error(`Long screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stitch multiple screenshot segments into a single image
   */
  static async stitchScreenshotSegments(
    segments: LongScreenshotSegment[],
    elementInfo: ElementInfo,
    devicePixelRatio: number = 1
  ): Promise<string> {
    try {
      if (segments.length === 0) {
        throw new Error('No segments to stitch');
      }
      
      if (segments.length === 1) {
        // Single segment, just crop it
        return this.cropToElement(segments[0].dataUrl, elementInfo, devicePixelRatio);
      }
      
      // Create canvas for final stitched image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Calculate final dimensions
      const elementWidth = elementInfo.boundingRect.width * devicePixelRatio;
      const totalHeight = elementInfo.totalHeight * devicePixelRatio;
      
      canvas.width = elementWidth;
      canvas.height = totalHeight;
      
      // Load and process each segment
      let currentY = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const img = await this.loadImage(segment.dataUrl);
        
        // Calculate crop area for this segment
        const cropArea: CropArea = {
          x: segment.elementRect.left * devicePixelRatio,
          y: segment.elementRect.top * devicePixelRatio,
          width: elementWidth,
          height: segment.elementRect.height * devicePixelRatio
        };
        
        // Adjust crop area to image bounds
        const adjustedCropArea = this.adjustCropArea(cropArea, img.width, img.height);
        
        // Calculate how much of this segment to use
        let segmentHeight = adjustedCropArea.height;
        
        // For overlapping segments, avoid duplicating content
        if (i > 0) {
          const overlapHeight = this.calculateOverlapHeight(segments, i, devicePixelRatio);
          segmentHeight -= overlapHeight;
          adjustedCropArea.y += overlapHeight;
          adjustedCropArea.height = segmentHeight;
        }
        
        // Draw segment onto final canvas
        ctx.drawImage(
          img,
          adjustedCropArea.x, adjustedCropArea.y, adjustedCropArea.width, segmentHeight,
          0, currentY, elementWidth, segmentHeight
        );
        
        currentY += segmentHeight;
      }
      
      return canvas.toDataURL('image/png', 1.0);
      
    } catch (error) {
      console.error('Failed to stitch screenshot segments:', error);
      throw new Error(`Screenshot stitching failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate scroll segments for long screenshot
   */
  private static async calculateScrollSegments(elementInfo: ElementInfo): Promise<ScrollPosition[]> {
    const { totalHeight, visibleHeight } = elementInfo;
    
    if (!elementInfo.isScrollable || totalHeight <= visibleHeight) {
      return [{ x: 0, y: 0, isComplete: true }];
    }
    
    const segments: ScrollPosition[] = [];
    const segmentHeight = visibleHeight * 0.8; // 80% to ensure overlap
    const totalScrollHeight = totalHeight - visibleHeight;
    
    let currentScrollTop = 0;
    
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
      
      // Safety limit
      if (segments.length > 50) {
        console.warn('Too many scroll segments, limiting to 50');
        break;
      }
    }
    
    return segments;
  }

  /**
   * Get element rect after scroll
   */
  private static async getElementRectAfterScroll(
    tabId: number, 
    selector: string
  ): Promise<DOMRect> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string) => {
          const element = document.querySelector(sel);
          if (!element) {
            throw new Error(`Element not found: ${sel}`);
          }
          const rect = element.getBoundingClientRect();
          const scrollX = window.scrollX || document.documentElement.scrollLeft;
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          
          return {
            x: rect.left + scrollX,
            y: rect.top + scrollY,
            width: rect.width,
            height: rect.height,
            top: rect.top + scrollY,
            right: rect.right + scrollX,
            bottom: rect.bottom + scrollY,
            left: rect.left + scrollX
          };
        },
        args: [selector]
      });
      
      return results[0]?.result as DOMRect;
    } catch (error) {
      console.error('Failed to get element rect after scroll:', error);
      throw error;
    }
  }

  /**
   * Calculate overlap height between segments
   */
  private static calculateOverlapHeight(
    segments: LongScreenshotSegment[], 
    currentIndex: number, 
    devicePixelRatio: number
  ): number {
    if (currentIndex === 0) return 0;
    
    const currentSegment = segments[currentIndex];
    const previousSegment = segments[currentIndex - 1];
    
    // Calculate expected overlap based on scroll positions
    const scrollDiff = currentSegment.scrollPosition.y - previousSegment.scrollPosition.y;
    const segmentHeight = currentSegment.elementRect.height;
    
    // Overlap is the difference between segment height and scroll distance
    const overlapHeight = Math.max(0, segmentHeight - scrollDiff);
    
    return overlapHeight * devicePixelRatio;
  }

  /**
   * Calculate crop area for complex elements (transforms, shadows, etc.)
   */
  private static calculateComplexElementCropArea(
    elementInfo: ElementInfo,
    devicePixelRatio: number
  ): CropArea {
    let bounds = elementInfo.boundingRect;
    
    // Use shadow bounds if element has shadows
    if (elementInfo.hasShadow && elementInfo.shadowInfo) {
      bounds = elementInfo.shadowInfo.shadowBounds;
    }
    
    // Handle iframe elements
    if (elementInfo.isInIframe && elementInfo.iframeInfo) {
      // Adjust bounds relative to iframe
      const iframeBounds = elementInfo.iframeInfo.iframeBounds;
      bounds = {
        ...bounds,
        x: iframeBounds.x + elementInfo.iframeInfo.relativePosition.x,
        y: iframeBounds.y + elementInfo.iframeInfo.relativePosition.y,
        left: iframeBounds.left + elementInfo.iframeInfo.relativePosition.x,
        top: iframeBounds.top + elementInfo.iframeInfo.relativePosition.y,
        right: iframeBounds.left + elementInfo.iframeInfo.relativePosition.x + bounds.width,
        bottom: iframeBounds.top + elementInfo.iframeInfo.relativePosition.y + bounds.height
      } as DOMRect;
    }
    
    // Handle transforms by calculating transformed bounds
    if (elementInfo.hasTransform && elementInfo.transformMatrix) {
      bounds = this.calculateTransformedBounds(bounds, elementInfo.transformMatrix);
    }
    
    return {
      x: bounds.left * devicePixelRatio,
      y: bounds.top * devicePixelRatio,
      width: bounds.width * devicePixelRatio,
      height: bounds.height * devicePixelRatio
    };
  }

  /**
   * Calculate bounds after applying transform matrix
   */
  private static calculateTransformedBounds(bounds: DOMRect, matrix: DOMMatrix): DOMRect {
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

  /**
   * Render complex elements with special handling for transforms, shadows, etc.
   */
  private static async renderComplexElement(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    elementInfo: ElementInfo,
    cropArea: CropArea,
    devicePixelRatio: number
  ): Promise<void> {
    // Save canvas state
    ctx.save();
    
    try {
      // Handle fixed positioning elements
      if (elementInfo.isFixed) {
        // Fixed elements might need special viewport handling
        await this.handleFixedPositionElement(ctx, img, elementInfo, cropArea, devicePixelRatio);
      } else if (elementInfo.hasTransform) {
        // Handle transformed elements
        await this.handleTransformedElement(ctx, img, elementInfo, cropArea, devicePixelRatio);
      } else {
        // Standard rendering with shadow consideration
        ctx.drawImage(
          img,
          cropArea.x, cropArea.y, cropArea.width, cropArea.height,
          0, 0, cropArea.width, cropArea.height
        );
      }
    } finally {
      // Restore canvas state
      ctx.restore();
    }
  }

  /**
   * Handle fixed position elements
   */
  private static async handleFixedPositionElement(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    elementInfo: ElementInfo,
    cropArea: CropArea,
    _devicePixelRatio: number
  ): Promise<void> {
    // Fixed elements are positioned relative to viewport
    // We need to ensure they're captured correctly regardless of scroll position
    
    // For now, use standard cropping but this could be enhanced
    // to handle viewport-relative positioning
    ctx.drawImage(
      img,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );
    
    // Add visual indicator for fixed elements (optional)
    if (elementInfo.zIndex > 0) {
      // Could add special handling for high z-index elements
    }
  }

  /**
   * Handle transformed elements
   */
  private static async handleTransformedElement(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    elementInfo: ElementInfo,
    cropArea: CropArea,
    _devicePixelRatio: number
  ): Promise<void> {
    // Apply transform to canvas context if needed
    if (elementInfo.transformMatrix) {
      const matrix = elementInfo.transformMatrix;
      ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    }
    
    // Draw the transformed element
    ctx.drawImage(
      img,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );
  }

  /**
   * Capture iframe content if accessible
   */
  static async captureIframeContent(
    tabId: number,
    elementInfo: ElementInfo
  ): Promise<string | null> {
    if (!elementInfo.isInIframe || !elementInfo.iframeInfo) {
      return null;
    }
    
    try {
      // Try to capture iframe content
      // This is limited by same-origin policy
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (iframeSelector: string) => {
          const iframe = document.querySelector(iframeSelector) as HTMLIFrameElement;
          if (!iframe) return null;
          
          try {
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc) return null;
            
            // Return iframe document HTML for processing
            return iframeDoc.documentElement.outerHTML;
          } catch (error) {
            // Cross-origin iframe
            return null;
          }
        },
        args: [elementInfo.iframeInfo.iframeSelector]
      });
      
      return results[0]?.result || null;
    } catch (error) {
      console.warn('Failed to capture iframe content:', error);
      return null;
    }
  }
}