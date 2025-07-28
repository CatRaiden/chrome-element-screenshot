// Performance optimization utilities for screenshot processing

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
  segmentCount?: number;
  imageSize?: number;
  compressionRatio?: number;
  processingTimePerSegment?: number;
  devicePixelRatio?: number;
  screenWidth?: number;
  screenHeight?: number;
  browserInfo?: {
    version: string;
    platform: string;
  };
}

export interface OptimizationOptions {
  maxSegmentSize: number;
  compressionQuality: number;
  memoryThreshold: number;
  timeoutMs: number;
  enableProgressiveLoading: boolean;
  enableMemoryCleanup: boolean;
  adaptiveQuality?: boolean;
  adaptiveSegmentSize?: boolean;
  contentType?: 'photo' | 'text' | 'mixed' | 'chart';
}

export class PerformanceOptimizer {
  private static readonly DEFAULT_OPTIONS: OptimizationOptions = {
    maxSegmentSize: 2048, // Max height per segment in pixels
    compressionQuality: 0.85,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    timeoutMs: 30000, // 30 seconds
    enableProgressiveLoading: true,
    enableMemoryCleanup: true,
    adaptiveQuality: true,
    adaptiveSegmentSize: true
  };

  private static metrics: Map<string, PerformanceMetrics> = new Map();
  private static memoryWarningThreshold = 0.8; // 80% of available memory
  private static memoryCleanupThreshold = 0.7; // 70% of available memory
  private static lastMemoryCleanup = 0;
  private static memoryCleanupInterval = 5000; // 5 seconds

  /**
   * Start performance monitoring for a screenshot session
   */
  static startMonitoring(sessionId: string): void {
    this.metrics.set(sessionId, {
      startTime: performance.now()
    });
  }

  /**
   * End performance monitoring and calculate metrics
   */
  static endMonitoring(sessionId: string): PerformanceMetrics | null {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return null;

    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    // Estimate memory usage if available
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      metrics.memoryUsage = {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize
      };
    }

    // Calculate processing time per segment if applicable
    if (metrics.duration && metrics.segmentCount && metrics.segmentCount > 0) {
      metrics.processingTimePerSegment = metrics.duration / metrics.segmentCount;
    }

    return metrics;
  }

  /**
   * Get current metrics for a session
   */
  static getMetrics(sessionId: string): PerformanceMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  /**
   * Clear metrics for a session
   */
  static clearMetrics(sessionId: string): void {
    this.metrics.delete(sessionId);
  }

  /**
   * Calculate optimal segment size based on element dimensions and memory constraints
   */
  static calculateOptimalSegmentSize(
    elementHeight: number,
    elementWidth: number,
    devicePixelRatio: number,
    options: Partial<OptimizationOptions> = {}
  ): number {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Calculate memory usage per pixel (assuming 4 bytes per pixel for RGBA)
    const bytesPerPixel = 4;
    const scaledWidth = elementWidth * devicePixelRatio;
    const memoryPerPixelRow = scaledWidth * bytesPerPixel;
    
    // Calculate max rows that fit within memory threshold
    const maxRowsForMemory = Math.floor(opts.memoryThreshold / memoryPerPixelRow / 2); // Use half of threshold for safety
    
    // Use the smaller of configured max segment size or memory-constrained size
    const optimalHeight = Math.min(opts.maxSegmentSize, maxRowsForMemory);
    
    // Ensure minimum segment size of 100px
    return Math.max(100, optimalHeight);
  }

  /**
   * Calculate dynamic segment size based on real-time performance
   */
  static calculateDynamicSegmentSize(
    sessionId: string,
    baseSegmentSize: number,
    currentSegmentIndex: number,
    totalSegments: number,
    devicePixelRatio: number
  ): number {
    const metrics = this.metrics.get(sessionId);
    if (!metrics || currentSegmentIndex === 0) return baseSegmentSize;

    // Get memory usage
    this.monitorMemoryUsage(sessionId);
    
    const avgTimePerSegment = metrics.duration ? metrics.duration / currentSegmentIndex : 0;
    const memoryUsageRatio = metrics.memoryUsage ? 
      metrics.memoryUsage.used / metrics.memoryUsage.total : 0;

    // Adjust segment size based on performance
    let adjustmentFactor = 1.0;

    // If processing is slow, reduce segment size
    if (avgTimePerSegment > 1000) { // More than 1 second per segment
      adjustmentFactor *= 0.8;
    }

    // If memory usage is high, reduce segment size
    if (memoryUsageRatio > 0.7) { // More than 70% memory usage
      adjustmentFactor *= 0.7;
    } else if (memoryUsageRatio < 0.3 && avgTimePerSegment < 500) {
      // If memory usage is low and processing is fast, increase segment size
      adjustmentFactor *= 1.2;
    }

    // If we're near the end and performance is good, increase segment size
    if (currentSegmentIndex > totalSegments * 0.7 && avgTimePerSegment < 500) {
      adjustmentFactor *= 1.2;
    }

    // Adjust for high DPI displays
    if (devicePixelRatio > 2) {
      adjustmentFactor *= 0.9;
    }

    return Math.max(100, Math.floor(baseSegmentSize * adjustmentFactor));
  }

  /**
   * Optimize image quality based on file size and visual quality balance
   */
  static optimizeImageQuality(
    originalDataUrl: string,
    targetFileSizeKB: number,
    format: 'png' | 'jpeg' = 'jpeg',
    contentType: 'photo' | 'text' | 'mixed' | 'chart' = 'mixed'
  ): Promise<{ dataUrl: string; quality: number; fileSizeKB: number }> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Optimize canvas operations
        this.optimizeCanvasOperation(canvas, (ctx) => {
          ctx.drawImage(img, 0, 0);
        });

        // Get initial quality based on content type
        const initialQuality = this.getContentOptimizedQuality(contentType, format);
        
        // Binary search for optimal quality
        let minQuality = format === 'jpeg' ? 0.5 : 0.7; // Higher minimum for PNG
        let maxQuality = 1.0;
        let bestResult = {
          dataUrl: originalDataUrl,
          quality: 1.0,
          fileSizeKB: this.estimateFileSizeKB(originalDataUrl)
        };

        const findOptimalQuality = (iterations: number = 8): void => {
          if (iterations <= 0) {
            resolve(bestResult);
            return;
          }

          const testQuality = (minQuality + maxQuality) / 2;
          const testDataUrl = canvas.toDataURL(`image/${format}`, testQuality);
          const testFileSizeKB = this.estimateFileSizeKB(testDataUrl);

          if (testFileSizeKB <= targetFileSizeKB * 1.1) { // Allow 10% margin
            bestResult = {
              dataUrl: testDataUrl,
              quality: testQuality,
              fileSizeKB: testFileSizeKB
            };
            minQuality = testQuality;
          } else {
            maxQuality = testQuality;
          }

          // Use setTimeout to avoid blocking the UI thread
          setTimeout(() => findOptimalQuality(iterations - 1), 0);
        };

        findOptimalQuality();
      };

      img.onerror = () => reject(new Error('Failed to load image for optimization'));
      img.src = originalDataUrl;
    });
  }

  /**
   * Get optimal quality settings based on content type
   */
  static getContentOptimizedQuality(
    contentType: 'photo' | 'text' | 'mixed' | 'chart',
    targetFormat: 'png' | 'jpeg'
  ): number {
    const qualityMatrix = {
      photo: { png: 0.95, jpeg: 0.85 },
      text: { png: 1.0, jpeg: 0.95 },
      mixed: { png: 0.9, jpeg: 0.8 },
      chart: { png: 1.0, jpeg: 0.9 }
    };

    return qualityMatrix[contentType][targetFormat];
  }

  /**
   * Estimate file size from data URL
   */
  private static estimateFileSizeKB(dataUrl: string): number {
    // Remove data URL prefix and calculate base64 size
    const base64Data = dataUrl.split(',')[1] || '';
    const sizeBytes = (base64Data.length * 3) / 4;
    return sizeBytes / 1024;
  }

  /**
   * Progressive loading for long screenshots
   */
  static async processSegmentsProgressively<T>(
    segments: T[],
    processor: (segment: T, index: number) => Promise<any>,
    options: Partial<OptimizationOptions> = {}
  ): Promise<any[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const results: any[] = [];
    
    if (!opts.enableProgressiveLoading) {
      // Process all segments at once
      return Promise.all(segments.map(processor));
    }

    // Calculate optimal batch size based on memory
    const memoryPerSegment = opts.memoryThreshold / segments.length;
    const batchSize = Math.max(1, Math.floor(opts.memoryThreshold / memoryPerSegment / 2));
    
    for (let i = 0; i < segments.length; i += batchSize) {
      // Check memory before processing batch
      if (this.shouldPerformMemoryCleanup()) {
        await this.performMemoryCleanup();
      }
      
      const batch = segments.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((segment, index) => processor(segment, i + index))
      );
      
      results.push(...batchResults);
      
      // Memory cleanup between batches
      if (opts.enableMemoryCleanup && i + batchSize < segments.length) {
        await this.performMemoryCleanup();
      }
      
      // Give browser a chance to breathe between batches
      if (i + batchSize < segments.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  /**
   * Check if memory cleanup should be performed
   */
  private static shouldPerformMemoryCleanup(): boolean {
    if (!('memory' in performance)) return false;
    
    const now = Date.now();
    if (now - this.lastMemoryCleanup < this.memoryCleanupInterval) {
      return false;
    }
    
    const memInfo = (performance as any).memory;
    const memoryUsageRatio = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
    
    return memoryUsageRatio > this.memoryCleanupThreshold;
  }

  /**
   * Perform memory cleanup
   */
  private static async performMemoryCleanup(): Promise<void> {
    this.lastMemoryCleanup = Date.now();
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
    
    // Release object references
    const objectURLs = Object.getOwnPropertyNames(URL)
      .filter(prop => prop.startsWith('blob:'));
    
    objectURLs.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore errors
      }
    });
    
    // Give browser time to clean up
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Monitor memory usage during processing
   */
  static monitorMemoryUsage(sessionId: string): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;

    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      metrics.memoryUsage = {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize
      };
      
      // Check if memory usage is approaching limit
      const memoryUsageRatio = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
      if (memoryUsageRatio > this.memoryWarningThreshold) {
        console.warn(`High memory usage detected: ${Math.round(memoryUsageRatio * 100)}%`);
        
        // Trigger cleanup if needed
        if (this.shouldPerformMemoryCleanup()) {
          this.performMemoryCleanup();
        }
      }
    }
  }

  /**
   * Check if memory usage is within acceptable limits
   */
  static isMemoryUsageAcceptable(
    sessionId: string,
    options: Partial<OptimizationOptions> = {}
  ): boolean {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const metrics = this.metrics.get(sessionId);
    
    if (!metrics?.memoryUsage) return true;
    
    return metrics.memoryUsage.used < opts.memoryThreshold;
  }

  /**
   * Create timeout promise for operations
   */
  static createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number = this.DEFAULT_OPTIONS.timeoutMs
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      })
    ]);
  }

  /**
   * Optimize canvas operations for better performance
   */
  static optimizeCanvasOperation(
    canvas: HTMLCanvasElement,
    operation: (ctx: CanvasRenderingContext2D) => void
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current state
    ctx.save();
    
    try {
      // Disable image smoothing for better performance
      ctx.imageSmoothingEnabled = false;
      
      // Set composite operation for better performance
      ctx.globalCompositeOperation = 'source-over';
      
      // Execute the operation
      operation(ctx);
    } finally {
      // Restore state
      ctx.restore();
    }
  }

  /**
   * Calculate compression ratio
   */
  static calculateCompressionRatio(
    originalSize: number,
    compressedSize: number
  ): number {
    if (originalSize === 0) return 0;
    return (originalSize - compressedSize) / originalSize;
  }

  /**
   * Update metrics with processing information
   */
  static updateMetrics(
    sessionId: string,
    updates: Partial<PerformanceMetrics>
  ): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      Object.assign(metrics, updates);
    }
  }

  /**
   * Get performance recommendations based on metrics
   */
  static getPerformanceRecommendations(
    sessionId: string
  ): string[] {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return [];

    const recommendations: string[] = [];

    // Duration recommendations
    if (metrics.duration && metrics.duration > 10000) {
      recommendations.push('Consider reducing image quality or segment size for faster processing');
    }

    // Memory recommendations
    if (metrics.memoryUsage && metrics.memoryUsage.used > metrics.memoryUsage.total * 0.7) {
      recommendations.push('High memory usage detected - enable progressive loading');
    }

    // Segment count recommendations
    if (metrics.segmentCount && metrics.segmentCount > 20) {
      recommendations.push('Large number of segments - consider increasing segment size');
    }

    // Compression recommendations
    if (metrics.compressionRatio && metrics.compressionRatio < 0.3) {
      recommendations.push('Low compression ratio - consider using JPEG format for better file size');
    }

    // Device pixel ratio recommendations
    if (metrics.devicePixelRatio && metrics.devicePixelRatio > 2) {
      recommendations.push('High DPI display detected - consider optimizing for memory usage');
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(sessionId: string): string {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return 'No metrics available';

    const report = [
      '=== Screenshot Performance Report ===',
      `Duration: ${metrics.duration?.toFixed(2)}ms`,
      `Memory Usage: ${metrics.memoryUsage ? 
        `${(metrics.memoryUsage.used / 1024 / 1024).toFixed(2)}MB / ${(metrics.memoryUsage.total / 1024 / 1024).toFixed(2)}MB` : 
        'N/A'}`,
      `Segments: ${metrics.segmentCount || 'N/A'}`,
      `Image Size: ${metrics.imageSize ? `${(metrics.imageSize / 1024).toFixed(2)}KB` : 'N/A'}`,
      `Compression Ratio: ${metrics.compressionRatio ? `${(metrics.compressionRatio * 100).toFixed(1)}%` : 'N/A'}`,
      `Device Pixel Ratio: ${metrics.devicePixelRatio || 'N/A'}`,
      `Processing Time Per Segment: ${metrics.processingTimePerSegment ? 
        `${metrics.processingTimePerSegment.toFixed(2)}ms` : 'N/A'}`,
      '',
      'Recommendations:',
      ...this.getPerformanceRecommendations(sessionId).map(rec => `- ${rec}`)
    ];

    return report.join('\n');
  }

  /**
   * Optimize screenshot processing for different device types
   */
  static getDeviceOptimizedSettings(
    devicePixelRatio: number,
    screenWidth: number,
    screenHeight: number
  ): Partial<OptimizationOptions> {
    // Mobile devices (typically high DPR, smaller screens)
    if (devicePixelRatio >= 2.5 && screenWidth <= 414) {
      return {
        maxSegmentSize: 1024,
        compressionQuality: 0.8,
        memoryThreshold: 50 * 1024 * 1024, // 50MB for mobile
        enableProgressiveLoading: true,
        enableMemoryCleanup: true,
        adaptiveQuality: true,
        adaptiveSegmentSize: true
      };
    }

    // Tablet devices
    if (devicePixelRatio >= 2 && screenWidth <= 1024) {
      return {
        maxSegmentSize: 1536,
        compressionQuality: 0.85,
        memoryThreshold: 100 * 1024 * 1024, // 100MB for tablets
        enableProgressiveLoading: true,
        enableMemoryCleanup: true,
        adaptiveQuality: true,
        adaptiveSegmentSize: true
      };
    }

    // High-DPI desktop displays
    if (devicePixelRatio >= 2) {
      return {
        maxSegmentSize: 2048,
        compressionQuality: 0.9,
        memoryThreshold: 200 * 1024 * 1024, // 200MB for high-DPI desktop
        enableProgressiveLoading: true,
        enableMemoryCleanup: false,
        adaptiveQuality: true,
        adaptiveSegmentSize: true
      };
    }

    // Standard desktop displays
    return {
      maxSegmentSize: 2048,
      compressionQuality: 0.85,
      memoryThreshold: 150 * 1024 * 1024, // 150MB for standard desktop
      enableProgressiveLoading: false,
      enableMemoryCleanup: false,
      adaptiveQuality: true,
      adaptiveSegmentSize: false
    };
  }

  /**
   * Estimate processing time based on element characteristics
   */
  static estimateProcessingTime(
    elementWidth: number,
    elementHeight: number,
    devicePixelRatio: number,
    isLongScreenshot: boolean,
    segmentCount?: number
  ): number {
    const pixelCount = elementWidth * elementHeight * devicePixelRatio * devicePixelRatio;
    const baseTimePerPixel = 0.001; // 1ms per 1000 pixels (rough estimate)
    
    let estimatedTime = pixelCount * baseTimePerPixel;
    
    if (isLongScreenshot && segmentCount) {
      // Add overhead for scrolling and stitching
      estimatedTime += segmentCount * 200; // 200ms per segment overhead
      estimatedTime *= 1.5; // 50% overhead for coordination
    }
    
    return Math.max(1000, estimatedTime); // Minimum 1 second
  }

  /**
   * Cross-browser compatibility checks
   */
  static checkBrowserCompatibility(): {
    isCompatible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check Chrome version
    const userAgent = navigator.userAgent;
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    const chromeVersion = chromeMatch ? parseInt(chromeMatch[1]) : 0;

    if (chromeVersion < 88) {
      issues.push('Chrome version too old for Manifest V3');
      recommendations.push('Update Chrome to version 88 or later');
    }

    // Check API availability
    if (!chrome?.tabs?.captureVisibleTab) {
      issues.push('Screenshot API not available');
      recommendations.push('Ensure extension has activeTab permission');
    }

    if (!chrome?.scripting?.executeScript) {
      issues.push('Scripting API not available');
      recommendations.push('Update to Manifest V3 and ensure scripting permission');
    }

    // Check Canvas support
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        issues.push('Canvas 2D context not available');
        recommendations.push('Enable hardware acceleration in browser');
      }
    } catch (error) {
      issues.push('Canvas API not available');
      recommendations.push('Check browser compatibility');
    }

    // Check memory API
    if (!('memory' in performance)) {
      recommendations.push('Memory monitoring not available - performance metrics will be limited');
    }

    return {
      isCompatible: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Benchmark system performance
   */
  static async benchmarkPerformance(): Promise<{
    canvasPerformance: number;
    memoryAvailable: number;
    recommendedSettings: Partial<OptimizationOptions>;
  }> {
    const startTime = performance.now();
    
    // Canvas performance test
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw test pattern
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `hsl(${i * 3.6}, 50%, 50%)`;
        ctx.fillRect(i * 10, i * 10, 100, 100);
      }
      canvas.toDataURL('image/jpeg', 0.8);
    }
    
    const canvasTime = performance.now() - startTime;
    
    // Memory check
    let memoryAvailable = 100 * 1024 * 1024; // Default 100MB
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      memoryAvailable = memInfo.totalJSHeapSize - memInfo.usedJSHeapSize;
    }
    
    // Generate recommendations based on benchmark
    const recommendedSettings: Partial<OptimizationOptions> = {
      maxSegmentSize: canvasTime < 100 ? 2048 : canvasTime < 500 ? 1536 : 1024,
      compressionQuality: canvasTime < 100 ? 0.9 : 0.8,
      memoryThreshold: Math.min(memoryAvailable * 0.7, 200 * 1024 * 1024),
      enableProgressiveLoading: canvasTime > 200 || memoryAvailable < 100 * 1024 * 1024,
      enableMemoryCleanup: memoryAvailable < 150 * 1024 * 1024,
      adaptiveQuality: true,
      adaptiveSegmentSize: canvasTime > 300
    };
    
    return {
      canvasPerformance: canvasTime,
      memoryAvailable,
      recommendedSettings
    };
  }

  /**
   * Detect content type from image data
   */
  static detectContentType(
    imageData: ImageData
  ): 'photo' | 'text' | 'mixed' | 'chart' {
    // Simple heuristic based on color variance and edge detection
    const data = imageData.data;
    let edgeCount = 0;
    let colorVariance = 0;
    let lastR = 0, lastG = 0, lastB = 0;
    
    // Sample pixels for performance
    const sampleStep = Math.max(1, Math.floor(data.length / 4 / 1000));
    
    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check for edges (significant color changes)
      if (i > 0) {
        const diff = Math.abs(r - lastR) + Math.abs(g - lastG) + Math.abs(b - lastB);
        if (diff > 100) edgeCount++;
        colorVariance += diff;
      }
      
      lastR = r;
      lastG = g;
      lastB = b;
    }
    
    const samples = Math.floor(data.length / 4 / sampleStep);
    const normalizedEdgeCount = edgeCount / samples;
    const normalizedColorVariance = colorVariance / samples;
    
    // Classification based on edge density and color variance
    if (normalizedEdgeCount > 0.2 && normalizedColorVariance < 50) {
      return 'text'; // High edge count, low color variance = text
    } else if (normalizedEdgeCount > 0.1 && normalizedColorVariance > 100) {
      return 'chart'; // Medium edge count, high color variance = chart/diagram
    } else if (normalizedColorVariance > 80) {
      return 'photo'; // High color variance = photo
    } else {
      return 'mixed'; // Default
    }
  }

  /**
   * Optimize memory usage for large operations
   */
  static async optimizeMemoryUsage(
    operation: () => Promise<any>,
    sessionId: string
  ): Promise<any> {
    // Monitor memory before operation
    this.monitorMemoryUsage(sessionId);
    
    // Check if memory cleanup is needed
    if (this.shouldPerformMemoryCleanup()) {
      await this.performMemoryCleanup();
    }
    
    // Execute operation
    const result = await operation();
    
    // Monitor memory after operation
    this.monitorMemoryUsage(sessionId);
    
    // Cleanup if needed
    if (this.shouldPerformMemoryCleanup()) {
      await this.performMemoryCleanup();
    }
    
    return result;
  }

  /**
   * Get browser version information
   */
  static getBrowserInfo(): { version: string; platform: string } {
    const userAgent = navigator.userAgent;
    const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
    const version = chromeMatch ? chromeMatch[1] : 'unknown';
    const platform = navigator.platform || 'unknown';
    
    return { version, platform };
  }
}