// Performance optimization tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceOptimizer } from '../src/utils/performanceOptimizer';

// Mock performance API
let mockTime = 0;
const mockPerformance = {
  now: vi.fn(() => {
    mockTime += 100; // Increment by 100ms each call
    return mockTime;
  }),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024 // 100MB
  }
};

global.performance = mockPerformance as any;

// Mock DOM APIs
const mockCanvas = {
  getContext: vi.fn(),
  width: 0,
  height: 0,
  toDataURL: vi.fn()
};

const mockContext = {
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  imageSmoothingEnabled: true,
  globalCompositeOperation: 'source-over'
};

global.document = {
  createElement: vi.fn(() => mockCanvas)
} as any;

global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';
  width: number = 1920;
  height: number = 1080;
  
  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
} as any;

describe('Performance Optimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTime = 0; // Reset mock time
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,optimized-image');
  });

  describe('Performance Monitoring', () => {
    it('should start and end monitoring correctly', () => {
      const sessionId = 'test-session';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      const startMetrics = PerformanceOptimizer.getMetrics(sessionId);
      
      expect(startMetrics).toBeDefined();
      expect(startMetrics?.startTime).toBeDefined();
      expect(startMetrics?.endTime).toBeUndefined();
      
      // Simulate some processing time
      mockPerformance.now.mockReturnValue(Date.now() + 1000);
      
      const endMetrics = PerformanceOptimizer.endMonitoring(sessionId);
      
      expect(endMetrics).toBeDefined();
      expect(endMetrics?.endTime).toBeDefined();
      expect(endMetrics?.duration).toBeGreaterThan(0);
      expect(endMetrics?.memoryUsage).toBeDefined();
    });

    it('should clear metrics correctly', () => {
      const sessionId = 'test-session-clear';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      expect(PerformanceOptimizer.getMetrics(sessionId)).toBeDefined();
      
      PerformanceOptimizer.clearMetrics(sessionId);
      expect(PerformanceOptimizer.getMetrics(sessionId)).toBeNull();
    });

    it('should update metrics correctly', () => {
      const sessionId = 'test-session-update';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.updateMetrics(sessionId, {
        segmentCount: 5,
        imageSize: 1024 * 100 // 100KB
      });
      
      const metrics = PerformanceOptimizer.getMetrics(sessionId);
      expect(metrics?.segmentCount).toBe(5);
      expect(metrics?.imageSize).toBe(102400);
    });
  });

  describe('Segment Size Optimization', () => {
    it('should calculate optimal segment size based on memory constraints', () => {
      const elementHeight = 5000;
      const elementWidth = 1920;
      const devicePixelRatio = 2;
      
      const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
        elementHeight,
        elementWidth,
        devicePixelRatio,
        { memoryThreshold: 50 * 1024 * 1024 } // 50MB
      );
      
      expect(optimalSize).toBeGreaterThan(100); // Minimum size
      expect(optimalSize).toBeLessThanOrEqual(2048); // Default max
    });

    it('should respect minimum segment size', () => {
      const elementHeight = 50;
      const elementWidth = 100;
      const devicePixelRatio = 1;
      
      const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
        elementHeight,
        elementWidth,
        devicePixelRatio,
        { memoryThreshold: 1024 } // Very small memory
      );
      
      expect(optimalSize).toBe(100); // Should enforce minimum
    });

    it('should handle high DPI displays', () => {
      const elementHeight = 2000;
      const elementWidth = 1920;
      const devicePixelRatio = 3; // High DPI
      
      const optimalSize = PerformanceOptimizer.calculateOptimalSegmentSize(
        elementHeight,
        elementWidth,
        devicePixelRatio,
        { memoryThreshold: 100 * 1024 * 1024 } // 100MB
      );
      
      expect(optimalSize).toBeGreaterThan(100);
      // Should be smaller due to higher memory usage per pixel
      expect(optimalSize).toBeLessThanOrEqual(2048);
    });
  });

  describe('Image Quality Optimization', () => {
    it('should optimize image quality to target file size', async () => {
      const originalDataUrl = 'data:image/png;base64,original-large-image';
      const targetFileSizeKB = 100;
      
      // Mock different quality results
      mockCanvas.toDataURL
        .mockReturnValueOnce('data:image/jpeg;base64,high-quality') // First attempt
        .mockReturnValueOnce('data:image/jpeg;base64,medium-quality') // Second attempt
        .mockReturnValueOnce('data:image/jpeg;base64,optimized'); // Final result
      
      const result = await PerformanceOptimizer.optimizeImageQuality(
        originalDataUrl,
        targetFileSizeKB,
        'jpeg'
      );
      
      expect(result.dataUrl).toBeDefined();
      expect(result.quality).toBeGreaterThan(0);
      expect(result.quality).toBeLessThanOrEqual(1);
      expect(result.fileSizeKB).toBeGreaterThan(0);
    });

    it('should handle image loading errors', async () => {
      const originalDataUrl = 'data:image/png;base64,invalid-image';
      
      // Mock image loading failure
      global.Image = class MockFailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as any;
      
      await expect(
        PerformanceOptimizer.optimizeImageQuality(originalDataUrl, 100)
      ).rejects.toThrow('Failed to load image for optimization');
    });
  });

  describe('Progressive Processing', () => {
    it('should process segments progressively', async () => {
      const segments = Array.from({ length: 10 }, (_, i) => ({ id: i, data: `segment-${i}` }));
      const processor = vi.fn().mockImplementation(async (segment) => `processed-${segment.id}`);
      
      const results = await PerformanceOptimizer.processSegmentsProgressively(
        segments,
        processor,
        { enableProgressiveLoading: true, memoryThreshold: 10 * 1024 * 1024 }
      );
      
      expect(results).toHaveLength(10);
      expect(processor).toHaveBeenCalledTimes(10);
      results.forEach((result, index) => {
        expect(result).toBe(`processed-${index}`);
      });
    });

    it('should process all segments at once when progressive loading is disabled', async () => {
      const segments = Array.from({ length: 5 }, (_, i) => ({ id: i, data: `segment-${i}` }));
      const processor = vi.fn().mockImplementation(async (segment) => `processed-${segment.id}`);
      
      const results = await PerformanceOptimizer.processSegmentsProgressively(
        segments,
        processor,
        { enableProgressiveLoading: false }
      );
      
      expect(results).toHaveLength(5);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle processing errors gracefully', async () => {
      const segments = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const processor = vi.fn()
        .mockResolvedValueOnce('success-1')
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce('success-3');
      
      await expect(
        PerformanceOptimizer.processSegmentsProgressively(segments, processor)
      ).rejects.toThrow('Processing failed');
    });
  });

  describe('Memory Management', () => {
    it('should monitor memory usage', () => {
      const sessionId = 'memory-test';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.monitorMemoryUsage(sessionId);
      
      const metrics = PerformanceOptimizer.getMetrics(sessionId);
      expect(metrics?.memoryUsage).toBeDefined();
      expect(metrics?.memoryUsage?.used).toBe(50 * 1024 * 1024);
      expect(metrics?.memoryUsage?.total).toBe(100 * 1024 * 1024);
    });

    it('should check memory usage acceptability', () => {
      const sessionId = 'memory-check';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.monitorMemoryUsage(sessionId);
      
      const isAcceptable = PerformanceOptimizer.isMemoryUsageAcceptable(
        sessionId,
        { memoryThreshold: 60 * 1024 * 1024 } // 60MB threshold
      );
      
      expect(isAcceptable).toBe(true); // 50MB used < 60MB threshold
    });

    it('should detect high memory usage', () => {
      const sessionId = 'high-memory';
      
      // Mock high memory usage
      mockPerformance.memory.usedJSHeapSize = 80 * 1024 * 1024; // 80MB
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.monitorMemoryUsage(sessionId);
      
      const isAcceptable = PerformanceOptimizer.isMemoryUsageAcceptable(
        sessionId,
        { memoryThreshold: 70 * 1024 * 1024 } // 70MB threshold
      );
      
      expect(isAcceptable).toBe(false); // 80MB used > 70MB threshold
    });
  });

  describe('Timeout Handling', () => {
    it('should resolve promise within timeout', async () => {
      const fastPromise = Promise.resolve('success');
      
      const result = await PerformanceOptimizer.createTimeoutPromise(
        fastPromise,
        1000
      );
      
      expect(result).toBe('success');
    });

    it('should timeout slow promises', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('too-late'), 2000);
      });
      
      await expect(
        PerformanceOptimizer.createTimeoutPromise(slowPromise, 100)
      ).rejects.toThrow('Operation timed out');
    });
  });

  describe('Canvas Optimization', () => {
    it('should optimize canvas operations', () => {
      const canvas = mockCanvas as any;
      const operation = vi.fn();
      
      PerformanceOptimizer.optimizeCanvasOperation(canvas, operation);
      
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledWith(mockContext);
      expect(mockContext.imageSmoothingEnabled).toBe(false);
      expect(mockContext.globalCompositeOperation).toBe('source-over');
    });

    it('should handle canvas context unavailable', () => {
      const canvas = { getContext: vi.fn(() => null) } as any;
      const operation = vi.fn();
      
      PerformanceOptimizer.optimizeCanvasOperation(canvas, operation);
      
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('Performance Analysis', () => {
    it('should calculate compression ratio correctly', () => {
      const originalSize = 1000;
      const compressedSize = 300;
      
      const ratio = PerformanceOptimizer.calculateCompressionRatio(
        originalSize,
        compressedSize
      );
      
      expect(ratio).toBe(0.7); // 70% compression
    });

    it('should handle zero original size', () => {
      const ratio = PerformanceOptimizer.calculateCompressionRatio(0, 100);
      expect(ratio).toBe(0);
    });

    it('should generate performance recommendations', () => {
      const sessionId = 'recommendations-test';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.updateMetrics(sessionId, {
        duration: 15000, // Long duration
        segmentCount: 25, // Many segments
        compressionRatio: 0.2 // Low compression
      });
      PerformanceOptimizer.monitorMemoryUsage(sessionId);
      
      const recommendations = PerformanceOptimizer.getPerformanceRecommendations(sessionId);
      
      expect(recommendations).toContain('Consider reducing image quality or segment size for faster processing');
      expect(recommendations).toContain('Large number of segments - consider increasing segment size');
      expect(recommendations).toContain('Low compression ratio - consider using JPEG format for better file size');
    });

    it('should generate performance report', () => {
      const sessionId = 'report-test';
      
      PerformanceOptimizer.startMonitoring(sessionId);
      PerformanceOptimizer.updateMetrics(sessionId, {
        duration: 5000,
        segmentCount: 3,
        imageSize: 150 * 1024, // 150KB
        compressionRatio: 0.6
      });
      PerformanceOptimizer.monitorMemoryUsage(sessionId);
      
      const report = PerformanceOptimizer.generatePerformanceReport(sessionId);
      
      expect(report).toContain('Screenshot Performance Report');
      expect(report).toContain('Duration: 5000.00ms');
      expect(report).toContain('Segments: 3');
      expect(report).toContain('Image Size: 150.00KB');
      expect(report).toContain('Compression Ratio: 60.0%');
    });

    it('should handle missing metrics in report', () => {
      const report = PerformanceOptimizer.generatePerformanceReport('non-existent');
      expect(report).toBe('No metrics available');
    });
  });

  describe('Integration with Screenshot Processor', () => {
    it('should optimize long screenshot processing', async () => {
      const sessionId = 'integration-test';
      const segments = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        dataUrl: `data:image/png;base64,segment-${i}`,
        size: 1024 * 50 // 50KB each
      }));
      
      PerformanceOptimizer.startMonitoring(sessionId);
      
      // Add initial delay to ensure start time is recorded
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const processor = async (segment: any) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 5));
        return `processed-${segment.id}`;
      };
      
      const results = await PerformanceOptimizer.processSegmentsProgressively(
        segments,
        processor,
        {
          enableProgressiveLoading: true,
          enableMemoryCleanup: true,
          memoryThreshold: 20 * 1024 * 1024 // 20MB
        }
      );
      
      const metrics = PerformanceOptimizer.endMonitoring(sessionId);
      
      expect(results).toHaveLength(20);
      expect(metrics).toBeDefined();
      expect(metrics?.duration).toBeGreaterThan(0);
      
      const recommendations = PerformanceOptimizer.getPerformanceRecommendations(sessionId);
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});