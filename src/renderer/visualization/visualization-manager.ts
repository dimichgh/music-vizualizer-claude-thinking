/**
 * Visualization Manager
 * Manages and coordinates different visualization types
 */

import * as THREE from 'three';
import { BaseVisualization } from './base-visualization';
import { FrequencyVisualizer } from './frequency-visualizer';
import { ParticleVisualizer } from './particle-visualizer';
import { WaveformVisualizer } from './waveform-visualizer';
import { CosmicVisualizer } from './cosmic-visualizer';
import { PostProcessingManager, PostProcessingConfig, defaultPostProcessingConfig } from './post-processing';
import { AudioAnalysisData, VisualizationType, VisualizationOptions, DetectedInstrument, PerformanceProfileType } from '../../shared/types';
import { InstrumentDetector } from '../instrument/instrument-detector';
import { PerformanceMonitor, PerformanceMetrics, PerformanceSettings } from '../utils/performance-monitor';
import { LodManager, LodLevel, DEFAULT_LOD_LEVELS } from '../utils/lod-manager';

/**
 * Class for managing different visualizations
 */
export class VisualizationManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.Camera | null = null;
  private currentVisualization: BaseVisualization | null = null;
  private visualizationType: VisualizationType = VisualizationType.FREQUENCY;
  private showInstruments: boolean = true;
  private colorPalette: string = 'cosmic';
  private intensity: number = 1.0;
  private instrumentDetector: InstrumentDetector | null = null;
  private detectedInstruments: DetectedInstrument[] = [];
  private postProcessing: PostProcessingManager | null = null;
  private postProcessingConfig: PostProcessingConfig = defaultPostProcessingConfig;
  
  // Performance optimization components
  private performanceMonitor: PerformanceMonitor | null = null;
  private lodManager: LodManager | null = null;
  private performanceProfile: PerformanceProfileType = PerformanceProfileType.BALANCED;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    console.log("Visualization Manager created");
  }

  /**
   * Set the renderer and camera for post-processing
   * @param renderer The WebGL renderer
   * @param camera The camera
   */
  setRenderingContext(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    this.renderer = renderer;
    this.camera = camera;
    
    // Initialize performance monitoring
    this.initPerformanceMonitoring();
    
    // Initialize post-processing if we have a renderer and camera
    if (this.renderer && this.camera) {
      this.initPostProcessing();
    }
  }
  
  /**
   * Initialize performance monitoring systems
   */
  private initPerformanceMonitoring(): void {
    if (!this.renderer) {
      console.warn("Cannot initialize performance monitoring without renderer");
      return;
    }
    
    // Clean up existing performance monitor if any
    if (this.performanceMonitor) {
      this.performanceMonitor.dispose();
      this.performanceMonitor = null;
    }
    
    // Create performance monitor
    const performanceSettings: PerformanceSettings = {
      targetFps: 60,
      criticalFps: 30,
      adjustmentPeriod: 2000,
      qualityLevels: DEFAULT_LOD_LEVELS.length
    };
    
    // Create performance monitor with callback
    this.performanceMonitor = new PerformanceMonitor(
      this.renderer,
      performanceSettings,
      this.handleQualityChange.bind(this)
    );
    
    // Create LOD manager
    if (this.camera) {
      this.lodManager = new LodManager(
        this.renderer,
        this.performanceMonitor,
        this.handleLodChange.bind(this)
      );
    }
    
    console.log("Performance monitoring initialized");
  }
  
  /**
   * Handle quality level changes from performance monitor
   */
  private handleQualityChange(qualityLevel: number): void {
    console.log(`Quality changed to level ${qualityLevel}`);
    
    // Update LOD manager
    if (this.lodManager) {
      this.lodManager.setQualityLevel(qualityLevel);
    }
    
    // Update visualizations
    if (this.currentVisualization) {
      if (this.lodManager) {
        this.currentVisualization.setLodManager(this.lodManager);
      }
      if (this.performanceMonitor) {
        this.currentVisualization.setPerformanceMonitor(this.performanceMonitor);
      }
    }
  }
  
  /**
   * Handle LOD level changes
   */
  private handleLodChange(lod: LodLevel): void {
    console.log(`LOD changed to: ${lod.name}`);
    
    // Update post-processing based on LOD level
    if (this.postProcessing) {
      // Adjust post-processing settings based on LOD
      this.postProcessingConfig.enabled = lod.postProcessingEnabled;
      
      if (lod.level <= 1) {
        // Lower quality post-processing for low-end devices
        this.postProcessingConfig.bloom.strength *= 0.5;
        this.postProcessingConfig.bloom.radius *= 0.5;
        this.postProcessingConfig.chromaticAberration.enabled = false;
      } else {
        // Use normal settings for higher-end devices
        this.postProcessing.setConfig(this.postProcessingConfig);
      }
    }
  }
  
  /**
   * Initialize post-processing effects
   */
  private initPostProcessing(): void {
    if (!this.renderer || !this.camera) {
      console.warn("Cannot initialize post-processing without renderer and camera");
      return;
    }
    
    // Clean up existing post-processing if any
    if (this.postProcessing) {
      this.postProcessing.dispose();
      this.postProcessing = null;
    }
    
    // Create new post-processing manager
    this.postProcessing = new PostProcessingManager(
      this.renderer,
      this.scene,
      this.camera,
      this.postProcessingConfig
    );
    
    console.log("Post-processing initialized");
  }

  /**
   * Initialize the visualization manager
   */
  init(): void {
    console.log("Initializing Visualization Manager");
    // Initialize with default visualization
    this.setVisualizationType(this.visualizationType);
  }

  /**
   * Set the type of visualization to display
   * @param type Visualization type
   */
  setVisualizationType(type: VisualizationType): void {
    console.log("Setting visualization type:", type);
    
    // Skip if already showing this type
    if (type === this.visualizationType && this.currentVisualization) {
      console.log("Already showing this visualization type, skipping");
      return;
    }
    
    // Clean up current visualization if exists
    if (this.currentVisualization) {
      console.log("Disposing current visualization");
      this.currentVisualization.dispose();
      this.currentVisualization = null;
    }
    
    // Create new visualization based on type
    console.log("Creating new visualization for type:", type);
    switch (type) {
      case VisualizationType.FREQUENCY:
        this.currentVisualization = new FrequencyVisualizer(this.scene);
        break;
      case VisualizationType.WAVEFORM:
        this.currentVisualization = new WaveformVisualizer(this.scene);
        break;
      case VisualizationType.PARTICLES:
        this.currentVisualization = new ParticleVisualizer(this.scene);
        break;
      case VisualizationType.COSMIC:
        this.currentVisualization = new CosmicVisualizer(this.scene);
        break;
      default:
        console.log("Unknown visualization type, defaulting to frequency");
        this.currentVisualization = new FrequencyVisualizer(this.scene);
    }
    
    // Initialize the new visualization
    console.log("Initializing new visualization");
    this.currentVisualization.init();
    
    // Store the current type
    this.visualizationType = type;
    console.log("Visualization type set to:", type);
  }

  /**
   * Update visualizations with new audio data
   * @param audioData Audio analysis data
   */
  update(audioData: AudioAnalysisData): void {
    // Begin performance monitoring for this frame
    if (this.performanceMonitor) {
      this.performanceMonitor.beginFrame();
    }
    
    // Track frame time for animations
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;
    
    // Detect instruments if detector is available and instruments should be shown
    if (this.instrumentDetector && this.showInstruments) {
      this.detectedInstruments = this.instrumentDetector.detectInstruments(audioData);
    } else {
      this.detectedInstruments = [];
    }
    
    // Update main visualization with audio data and detected instruments
    if (this.currentVisualization) {
      // Pass camera for distance-based optimizations
      this.currentVisualization.update(audioData, this.detectedInstruments, this.camera);
    }
    
    // Update post-processing effects with audio data
    if (this.postProcessing) {
      // Disable post-processing on low-end devices if LOD manager suggests it
      if (this.lodManager) {
        this.postProcessing.setEnabled(this.lodManager.isPostProcessingEnabled());
      }
      
      this.postProcessing.update(audioData);
    }
    
    // End performance monitoring for this frame
    if (this.performanceMonitor) {
      this.performanceMonitor.endFrame();
    }
  }

  /**
   * Set whether to show instrument visualizations
   * @param show Whether to show instruments
   */
  setShowInstruments(show: boolean): void {
    this.showInstruments = show;
  }

  /**
   * Set the color palette for visualizations
   * @param palette Color palette name
   */
  setColorPalette(palette: string): void {
    this.colorPalette = palette;
    // Recreate visualizations with new palette
    this.setVisualizationType(this.visualizationType);
  }

  /**
   * Set the intensity of visualizations
   * @param intensity Intensity value (0-1)
   */
  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
    // Recreate visualizations with new intensity
    this.setVisualizationType(this.visualizationType);
  }
  
  /**
   * Set all visualization options at once
   * @param options Visualization options
   */
  setVisualizationOptions(options: VisualizationOptions): void {
    this.visualizationType = options.type;
    this.showInstruments = options.showInstruments;
    this.colorPalette = options.colorPalette;
    this.intensity = options.intensity;
    
    // Only recreate visualization if it's already been initialized
    if (this.currentVisualization) {
      this.setVisualizationType(this.visualizationType);
    }
  }
  
  /**
   * Set post-processing configuration
   * @param config Post-processing configuration
   */
  setPostProcessingConfig(config: Partial<PostProcessingConfig>): void {
    // Update local config
    this.postProcessingConfig = {
      ...this.postProcessingConfig,
      ...config,
      bloom: { ...this.postProcessingConfig.bloom, ...(config.bloom || {}) },
      filmGrain: { ...this.postProcessingConfig.filmGrain, ...(config.filmGrain || {}) },
      chromaticAberration: { ...this.postProcessingConfig.chromaticAberration, ...(config.chromaticAberration || {}) }
    };
    
    // Update post-processing if initialized
    if (this.postProcessing) {
      this.postProcessing.setConfig(this.postProcessingConfig);
    }
  }
  
  /**
   * Get post-processing configuration
   * @returns Current post-processing configuration
   */
  getPostProcessingConfig(): PostProcessingConfig {
    return this.postProcessingConfig;
  }
  
  /**
   * Render the scene with post-processing
   */
  render(): void {
    // Begin performance monitoring for rendering
    if (this.performanceMonitor) {
      this.performanceMonitor.beginFrame();
    }
    
    if (this.postProcessing && this.postProcessingConfig?.enabled) {
      // Render with post-processing effects
      this.postProcessing.render();
    } else if (this.renderer && this.camera) {
      // Fallback to normal rendering
      this.renderer.render(this.scene, this.camera);
    }
    
    // End performance monitoring for rendering
    if (this.performanceMonitor) {
      this.performanceMonitor.endFrame();
    }
  }
  
  /**
   * Set performance profile
   * @param profile Performance profile type
   */
  setPerformanceProfile(profile: PerformanceProfileType): void {
    this.performanceProfile = profile;
    
    // Apply profile settings to performance monitor
    if (this.performanceMonitor) {
      const settings: Partial<PerformanceSettings> = {};
      
      switch (profile) {
        case PerformanceProfileType.BATTERY:
          // Optimize for battery life
          settings.targetFps = 30;
          settings.criticalFps = 20;
          break;
        
        case PerformanceProfileType.QUALITY:
          // Prioritize quality
          settings.targetFps = 60;
          settings.criticalFps = 40;
          // Use longer adjustment period to avoid too frequent changes
          settings.adjustmentPeriod = 5000;
          break;
        
        case PerformanceProfileType.BALANCED:
        default:
          // Balanced settings (default)
          settings.targetFps = 60;
          settings.criticalFps = 30;
          settings.adjustmentPeriod = 2000;
          break;
      }
      
      // Apply new settings to performance monitor
      // (Assuming an updateSettings method exists or similar approach)
      // this.performanceMonitor.updateSettings(settings);
      
      // Force quality change to apply new settings
      if (this.lodManager) {
        const currentQuality = this.lodManager.getCurrentLodLevel().level;
        this.handleQualityChange(currentQuality);
      }
    }
  }
  
  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getMetrics();
    }
    return null;
  }
  
  /**
   * Handle window resize
   */
  handleResize(): void {
    if (this.postProcessing) {
      this.postProcessing.handleResize();
    }
  }
  
  /**
   * Set the instrument detector to use for visualizations
   * @param detector Instrument detector instance
   */
  setInstrumentDetector(detector: InstrumentDetector): void {
    this.instrumentDetector = detector;
  }
  
  /**
   * Get the currently detected instruments
   * @returns Array of detected instruments
   */
  getDetectedInstruments(): DetectedInstrument[] {
    return this.detectedInstruments;
  }

  /**
   * Clean up all visualizations
   */
  dispose(): void {
    if (this.currentVisualization) {
      this.currentVisualization.dispose();
      this.currentVisualization = null;
    }
    
    // Dispose post-processing
    if (this.postProcessing) {
      this.postProcessing.dispose();
      this.postProcessing = null;
    }
    
    // Dispose performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.dispose();
      this.performanceMonitor = null;
    }
    
    // No need to explicitly dispose LOD manager as it doesn't have resources
    // that need manual cleanup
    this.lodManager = null;
    
    // Clear references but don't dispose the detector (it's managed externally)
    this.instrumentDetector = null;
    this.detectedInstruments = [];
  }
}