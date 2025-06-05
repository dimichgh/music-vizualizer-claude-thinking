/**
 * Performance Monitor
 * 
 * Monitors and records performance metrics like frame rate and memory usage
 * to help optimize visualization rendering.
 */

import * as THREE from 'three';
import Stats from 'stats.js';

/**
 * Performance metrics and settings
 */
export interface PerformanceMetrics {
  // Frame rate metrics
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  fpsStability: number; // 0-1 score indicating stability (less variance = more stable)
  
  // Frame time metrics (in ms)
  frameTime: number;
  averageFrameTime: number;
  maxFrameTime: number;
  
  // Memory metrics (in MB)
  memoryUsage: number;
  memoryPeak: number;
  
  // GPU metrics (if available)
  gpuMemoryUsage?: number;
  gpuUtilization?: number;
  
  // Performance status
  isPerformanceCritical: boolean;
  isMemoryConstrained: boolean;
  
  // Quality adjustment metrics
  currentQualityLevel: number;
  targetQualityLevel: number;
  
  // Timing breakdown (in ms)
  updateTime: number;      // Time spent in update logic
  renderTime: number;      // Time spent in rendering
  shaderTime: number;      // Time spent in shader processing
  postProcessingTime: number; // Time spent in post-processing
  physicsTime: number;     // Time spent in physics calculations
  gcTime: number;          // Estimated time spent in garbage collection
  
  // Draw call metrics
  drawCalls: number;
  triangles: number;
  particles: number;
  
  // Frame budget analysis
  frameBudgetUsage: number; // 0-1 showing how much of frame budget is used
  hasFrameDrops: boolean;   // Whether frames are being dropped
}

/**
 * Performance target settings
 */
export interface PerformanceSettings {
  targetFps: number;        // Target frame rate (e.g., 60)
  criticalFps: number;      // Critical threshold for quality reduction (e.g., 30)
  adjustmentPeriod: number; // Time between quality adjustments in ms (e.g., 2000)
  qualityLevels: number;    // Number of quality levels (e.g., 5 levels from 0-4)
}

/**
 * Class for monitoring and managing performance
 */
export class PerformanceMonitor {
  private stats: Stats;
  private metrics: PerformanceMetrics;
  private settings: PerformanceSettings;
  
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private historySize = 60; // Keep last 60 frames for average calculation
  private lastAdjustmentTime = 0;
  private frameCount = 0;
  private renderer: THREE.WebGLRenderer;
  private onQualityChange: (qualityLevel: number) => void;
  
  // Additional timing metrics
  private timingMarkers: Map<string, number> = new Map();
  private sectionTimes: Map<string, number[]> = new Map();
  private memoryPeak: number = 0;
  private frameStartTime: number = 0;
  private lastFrameTime: number = 0;
  private gcDetectionThreshold: number = 50; // ms threshold for GC detection
  
  // Frame budget settings (16.67ms for 60fps)
  private frameBudget: number = 16.67;
  private frameBudgetBreakdown = {
    update: 0.4,       // 40% for update logic
    render: 0.3,       // 30% for rendering
    postProcessing: 0.2, // 20% for post-processing
    overhead: 0.1      // 10% for browser overhead
  };
  
  // Draw call tracking
  private lastDrawCalls: number = 0;
  private currentDrawCalls: number = 0;
  private triangleCount: number = 0;
  private particleCount: number = 0;
  
  constructor(
    renderer: THREE.WebGLRenderer, 
    settings?: Partial<PerformanceSettings>,
    onQualityChange?: (qualityLevel: number) => void
  ) {
    // Initialize Stats.js for FPS monitoring
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    this.renderer = renderer;
    
    // Set default settings
    this.settings = {
      targetFps: 60,
      criticalFps: 30,
      adjustmentPeriod: 2000, // 2 seconds
      qualityLevels: 5,
      ...settings
    };
    
    // Calculate frame budget based on target FPS
    this.frameBudget = 1000 / this.settings.targetFps;
    
    // Initialize metrics
    this.metrics = {
      fps: 0,
      averageFps: 0,
      minFps: Infinity,
      maxFps: 0,
      fpsStability: 1.0,
      frameTime: 0,
      averageFrameTime: 0,
      maxFrameTime: 0,
      memoryUsage: 0,
      memoryPeak: 0,
      isPerformanceCritical: false,
      isMemoryConstrained: false,
      currentQualityLevel: this.settings.qualityLevels - 1, // Start at highest quality
      targetQualityLevel: this.settings.qualityLevels - 1,
      updateTime: 0,
      renderTime: 0,
      shaderTime: 0,
      postProcessingTime: 0,
      physicsTime: 0,
      gcTime: 0,
      drawCalls: 0,
      triangles: 0,
      particles: 0,
      frameBudgetUsage: 0,
      hasFrameDrops: false
    };
    
    // Store callback
    this.onQualityChange = onQualityChange || (() => {});
    
    // Initialize stats panel
    this.initializeStatsPanel();
  }
  
  /**
   * Initialize the Stats.js panel for display
   */
  private initializeStatsPanel(): void {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.zIndex = '100';
    document.body.appendChild(container);
    container.appendChild(this.stats.dom);
  }
  
  /**
   * Begin a new frame (call at start of render loop)
   */
  beginFrame(): void {
    this.stats.begin();
    this.frameStartTime = performance.now();
    
    // Record draw calls at start of frame
    if (this.renderer.info && this.renderer.info.render) {
      this.lastDrawCalls = this.renderer.info.render.calls || 0;
      this.triangleCount = this.renderer.info.render.triangles || 0;
    }
  }
  
  /**
   * Begin timing a specific section of code
   * @param section Name of the section to time
   */
  beginSection(section: string): void {
    this.timingMarkers.set(section, performance.now());
  }
  
  /**
   * End timing a specific section of code
   * @param section Name of the section to stop timing
   */
  endSection(section: string): void {
    const startTime = this.timingMarkers.get(section);
    if (startTime === undefined) {
      console.warn(`No start time found for section: ${section}`);
      return;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Store in section times history
    if (!this.sectionTimes.has(section)) {
      this.sectionTimes.set(section, []);
    }
    
    const times = this.sectionTimes.get(section)!;
    times.push(duration);
    
    // Keep a limited history for each section
    if (times.length > this.historySize) {
      times.shift();
    }
    
    // Update specific metrics based on section name
    switch (section) {
      case 'update':
        this.metrics.updateTime = duration;
        break;
      case 'render':
        this.metrics.renderTime = duration;
        break;
      case 'postProcessing':
        this.metrics.postProcessingTime = duration;
        break;
      case 'shaders':
        this.metrics.shaderTime = duration;
        break;
      case 'physics':
        this.metrics.physicsTime = duration;
        break;
    }
  }
  
  /**
   * Track particles for performance monitoring
   * @param count Number of active particles being rendered
   */
  trackParticles(count: number): void {
    this.particleCount = count;
    this.metrics.particles = count;
  }
  
  /**
   * End the current frame and update metrics (call at end of render loop)
   */
  endFrame(): void {
    this.stats.end();
    
    // Calculate frame time
    const now = performance.now();
    const frameTime = now - this.frameStartTime;
    
    // Detect potential GC pauses
    const timeSinceLastFrame = now - this.lastFrameTime;
    if (this.lastFrameTime > 0 && timeSinceLastFrame > this.gcDetectionThreshold) {
      // Possible garbage collection detected
      this.metrics.gcTime = timeSinceLastFrame;
      console.log(`Possible GC pause detected: ${timeSinceLastFrame.toFixed(2)}ms`);
    } else {
      // Slowly decay GC time to zero when no GC is detected
      this.metrics.gcTime *= 0.9;
    }
    this.lastFrameTime = now;
    
    // Update metrics based on current frame
    this.frameCount++;
    
    // Update stats and get current FPS
    this.stats.update(); 
    const currentFps = this.metrics.fps || 60; // Default to 60 if not available
    this.metrics.fps = currentFps;
    this.metrics.frameTime = frameTime;
    
    // Update frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift();
    }
    
    // Update min/max
    this.metrics.minFps = Math.min(this.metrics.minFps, currentFps);
    this.metrics.maxFps = Math.max(this.metrics.maxFps, currentFps);
    this.metrics.maxFrameTime = Math.max(this.metrics.maxFrameTime, frameTime);
    
    // Update FPS history
    this.fpsHistory.push(currentFps);
    if (this.fpsHistory.length > this.historySize) {
      this.fpsHistory.shift();
    }
    
    // Calculate average FPS and frame time
    const fpsSum = this.fpsHistory.reduce((a, b) => a + b, 0);
    this.metrics.averageFps = fpsSum / this.fpsHistory.length;
    
    const frameTimeSum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    this.metrics.averageFrameTime = frameTimeSum / this.frameTimeHistory.length;
    
    // Calculate FPS stability (1 - coefficient of variation)
    if (this.fpsHistory.length > 5) {
      const fpsVariance = this.fpsHistory.reduce((sum, fps) => {
        return sum + Math.pow(fps - this.metrics.averageFps, 2);
      }, 0) / this.fpsHistory.length;
      const fpsStdDev = Math.sqrt(fpsVariance);
      this.metrics.fpsStability = Math.max(0, 1 - (fpsStdDev / this.metrics.averageFps));
    }
    
    // Update memory metrics if available
    if (window.performance && (window.performance as any).memory) {
      try {
        const memory = (window.performance as any).memory;
        const currentMemory = memory.usedJSHeapSize / (1024 * 1024);
        this.metrics.memoryUsage = currentMemory;
        this.memoryPeak = Math.max(this.memoryPeak, currentMemory);
        this.metrics.memoryPeak = this.memoryPeak;
        
        // Add to memory history
        this.memoryHistory.push(currentMemory);
        if (this.memoryHistory.length > this.historySize) {
          this.memoryHistory.shift();
        }
        
        // Check for memory constraints
        const memoryLimit = memory.jsHeapSizeLimit / (1024 * 1024);
        this.metrics.isMemoryConstrained = currentMemory > memoryLimit * 0.8; // 80% of limit
      } catch (e) {
        // Memory API might throw or be unavailable
        console.warn('Error accessing memory metrics:', e);
      }
    }
    
    // Update draw call metrics
    if (this.renderer.info && this.renderer.info.render) {
      this.currentDrawCalls = this.renderer.info.render.calls || 0;
      this.metrics.drawCalls = this.currentDrawCalls;
      this.metrics.triangles = this.renderer.info.render.triangles || 0;
    }
    
    // Calculate frame budget usage
    const targetFrameTime = 1000 / this.settings.targetFps;
    this.metrics.frameBudgetUsage = Math.min(1, frameTime / targetFrameTime);
    this.metrics.hasFrameDrops = frameTime > targetFrameTime * 1.2; // 20% over budget
    
    // Determine performance status
    this.metrics.isPerformanceCritical = this.metrics.averageFps < this.settings.criticalFps ||
                                       this.metrics.frameBudgetUsage > 0.95;
    
    // Check if we need to adjust quality
    this.checkQualityAdjustment();
  }
  
  /**
   * Check if quality level adjustment is needed
   */
  private checkQualityAdjustment(): void {
    const now = performance.now();
    
    // Only adjust quality periodically to avoid oscillation
    if (now - this.lastAdjustmentTime < this.settings.adjustmentPeriod) {
      return;
    }
    
    // Skip early frames to let the system stabilize
    if (this.frameCount < 100) {
      return;
    }
    
    // Determine target quality level based on performance
    let targetLevel = this.metrics.currentQualityLevel;
    let needsAdjustment = false;
    
    // If memory is constrained, decrease quality regardless of FPS
    if (this.metrics.isMemoryConstrained) {
      targetLevel = Math.max(0, targetLevel - 1);
      needsAdjustment = true;
      console.log('Quality reduction due to memory constraints');
    }
    // If performance is critical, decrease quality immediately
    else if (this.metrics.isPerformanceCritical) {
      targetLevel = Math.max(0, targetLevel - 1);
      needsAdjustment = true;
      console.log('Quality reduction due to critical performance');
    }
    // If frame budget usage is high but not critical, consider decreasing quality
    else if (this.metrics.frameBudgetUsage > 0.9 && this.metrics.fpsStability < 0.7) {
      targetLevel = Math.max(0, targetLevel - 1);
      needsAdjustment = true;
      console.log('Quality reduction due to high frame budget usage');
    }
    // If performance is good and stable, consider increasing quality
    else if (this.metrics.averageFps > this.settings.targetFps * 1.1 && 
             this.metrics.fpsStability > 0.8 &&
             this.metrics.frameBudgetUsage < 0.7) {
      // Only increase if we're not already at max quality
      if (targetLevel < this.settings.qualityLevels - 1) {
        targetLevel++;
        needsAdjustment = true;
        console.log('Quality increase due to good performance');
      }
    }
    // If performance is below target but not critical, decrease quality gradually
    else if (this.metrics.averageFps < this.settings.targetFps * 0.9 || 
             this.metrics.fpsStability < 0.6) {
      targetLevel = Math.max(0, targetLevel - 1);
      needsAdjustment = true;
      console.log('Quality reduction due to below-target performance');
    }
    
    // Special case: if we have frequent GC pauses, reduce quality to limit memory pressure
    if (this.metrics.gcTime > 30) {
      targetLevel = Math.max(0, targetLevel - 1);
      needsAdjustment = true;
      console.log('Quality reduction due to excessive GC pauses');
    }
    
    // Update target quality level
    if (needsAdjustment && targetLevel !== this.metrics.targetQualityLevel) {
      this.metrics.targetQualityLevel = targetLevel;
      this.lastAdjustmentTime = now;
      
      // Notify about quality change
      this.onQualityChange(targetLevel);
    }
  }
  
  /**
   * Manually set quality level (0 = lowest, qualityLevels-1 = highest)
   */
  setQualityLevel(level: number): void {
    const clampedLevel = Math.max(0, Math.min(this.settings.qualityLevels - 1, level));
    this.metrics.currentQualityLevel = clampedLevel;
    this.metrics.targetQualityLevel = clampedLevel;
    this.onQualityChange(clampedLevel);
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // Update metrics with latest values
    this.metrics.particles = this.particleCount;
    
    // Return a copy to prevent external modifications
    return { ...this.metrics };
  }
  
  /**
   * Get performance breakdown for a specific section
   * @param section Name of the section to get timing for
   * @returns Average time in milliseconds or 0 if not available
   */
  getSectionPerformance(section: string): number {
    const times = this.sectionTimes.get(section);
    if (!times || times.length === 0) {
      return 0;
    }
    
    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }
  
  /**
   * Check if a system is under memory pressure
   * @returns True if the system is under memory pressure
   */
  isUnderMemoryPressure(): boolean {
    return this.metrics.isMemoryConstrained;
  }
  
  /**
   * Trigger memory optimization if system is under memory pressure
   * This will notify registered listeners to release memory
   */
  handleMemoryPressure(): void {
    if (this.isUnderMemoryPressure()) {
      console.log('Memory pressure detected, triggering optimization');
      // Emit memory pressure event or call handlers
      document.dispatchEvent(new CustomEvent('memory-pressure'));
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove stats.js panel
    if (this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
  }
}