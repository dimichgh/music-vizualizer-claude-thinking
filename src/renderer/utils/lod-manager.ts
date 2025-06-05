/**
 * Level of Detail (LOD) Manager
 * 
 * Provides dynamic adjustment of visualization complexity based on performance metrics
 * to maintain target frame rates across different hardware capabilities.
 */

import * as THREE from 'three';
import { PerformanceMonitor } from './performance-monitor';

/**
 * LOD configuration for a specific quality level
 */
export interface LodLevel {
  // General settings
  level: number;                // Quality level (0 = lowest, higher = better)
  name: string;                 // Display name (e.g., "Low", "Medium", "High")
  
  // Visual complexity settings
  particleCount: number;        // Number of particles to render
  geometryDetail: number;       // Detail level for geometries (1.0 = normal)
  textureSize: number;          // Texture size multiplier (1.0 = normal)
  shadowQuality: 'off' | 'low' | 'medium' | 'high'; // Shadow quality
  postProcessingEnabled: boolean; // Whether to use post-processing effects
  
  // Performance impact factors
  effectComplexity: number;     // Visual effect complexity (0-1)
  maxObjects: number;           // Maximum number of objects to render
  updateFrequency: number;      // Frequency for non-critical updates (frames)
}

/**
 * Default LOD levels from lowest to highest quality
 */
export const DEFAULT_LOD_LEVELS: LodLevel[] = [
  {
    level: 0,
    name: "Very Low",
    particleCount: 100,         // Extremely limited particles
    geometryDetail: 0.2,        // Very low geometry detail
    textureSize: 0.25,          // Quarter resolution textures
    shadowQuality: 'off',       // No shadows
    postProcessingEnabled: false, // No post-processing
    effectComplexity: 0.1,      // Minimal visual effects
    maxObjects: 10,             // Very few objects
    updateFrequency: 5          // Update every 5 frames
  },
  {
    level: 1,
    name: "Low",
    particleCount: 300,         // Very limited particles
    geometryDetail: 0.4,        // Low geometry detail
    textureSize: 0.5,           // Half resolution textures
    shadowQuality: 'off',       // No shadows
    postProcessingEnabled: false, // No post-processing
    effectComplexity: 0.3,      // Limited visual effects
    maxObjects: 30,             // Few objects
    updateFrequency: 3          // Update every 3 frames
  },
  {
    level: 2,
    name: "Medium",
    particleCount: 800,         // Moderate particle count
    geometryDetail: 0.6,        // Medium geometry detail
    textureSize: 0.75,          // 75% resolution textures
    shadowQuality: 'low',       // Basic shadows
    postProcessingEnabled: true, // Basic post-processing
    effectComplexity: 0.5,      // Medium visual effects
    maxObjects: 100,            // Moderate object count
    updateFrequency: 2          // Update every 2 frames
  },
  {
    level: 3,
    name: "High",
    particleCount: 1500,        // High particle count
    geometryDetail: 0.9,        // High geometry detail
    textureSize: 1.0,           // Full resolution textures
    shadowQuality: 'medium',    // Medium quality shadows
    postProcessingEnabled: true, // Full post-processing
    effectComplexity: 0.75,     // Advanced visual effects
    maxObjects: 250,            // Many objects
    updateFrequency: 1          // Update every frame
  },
  {
    level: 4,
    name: "Ultra",
    particleCount: 3000,        // Maximum particle count
    geometryDetail: 1.1,        // Extra high geometry detail
    textureSize: 1.0,           // Full resolution textures
    shadowQuality: 'high',      // High quality shadows
    postProcessingEnabled: true, // Full post-processing
    effectComplexity: 1.0,      // Maximum visual effects
    maxObjects: 500,            // Maximum objects
    updateFrequency: 1          // Update every frame
  }
];

/**
 * Device capability detection for initial LOD setting
 */
function detectDeviceCapabilities(): number {
  // Check for basic device capabilities to make an initial guess at appropriate quality level
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    // WebGL not supported, use lowest quality
    return 0;
  }
  
  // Get basic information about the device if WebGL is available
  let renderer = '';
  let vendor = '';
  
  if (gl instanceof WebGLRenderingContext) {
    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
      vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
    } catch (e) {
      console.error('Failed to get WebGL renderer info:', e);
    }
  }
  
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check if it's likely a high-end device
  const isHighEnd = renderer.includes('RTX') || 
                   renderer.includes('Radeon') && !renderer.includes('Mobile') ||
                   renderer.includes('Intel') && renderer.includes('Iris');
                   
  // Make a guess at appropriate quality level
  if (isMobile) {
    return 1; // Low for mobile devices
  } else if (isHighEnd) {
    return 3; // High for gaming/workstation GPUs
  } else {
    return 2; // Medium for standard desktop GPUs
  }
}

/**
 * Manager for Level of Detail adjustments
 */
export class LodManager {
  private levels: LodLevel[];
  private currentLevel: number;
  private performanceMonitor: PerformanceMonitor;
  private renderer: THREE.WebGLRenderer;
  private onLodChange: (lod: LodLevel) => void;
  private frameCounter: number = 0;
  
  // Adaptive settings
  private dynamicUpdateFrequency: boolean = true; // Whether to dynamically adjust update frequency
  private distanceScalingEnabled: boolean = true; // Whether to scale detail based on distance
  private importanceBasedLod: boolean = true;     // Whether to use importance-based LOD
  private importantObjects: Set<THREE.Object3D> = new Set(); // Objects that should maintain higher quality
  private adaptiveDistance: number = 50;          // Distance at which to start reducing quality
  
  // Performance tracking
  private performanceHistory: number[] = [];       // History of performance scores
  private lastAdaptiveAdjustment: number = 0;      // Time of last micro-adjustment
  private adaptiveAdjustmentInterval: number = 500; // Time between micro-adjustments (ms)
  
  constructor(
    renderer: THREE.WebGLRenderer, 
    performanceMonitor: PerformanceMonitor,
    onLodChange?: (lod: LodLevel) => void,
    levels: LodLevel[] = DEFAULT_LOD_LEVELS
  ) {
    this.levels = levels;
    
    // Make initial quality guess based on device capabilities
    const initialQualityGuess = detectDeviceCapabilities();
    this.currentLevel = Math.min(initialQualityGuess, levels.length - 1);
    
    console.log(`Initial LOD level set to ${this.currentLevel} (${levels[this.currentLevel].name})`);
    
    this.renderer = renderer;
    this.performanceMonitor = performanceMonitor;
    this.onLodChange = onLodChange || (() => {});
    
    // Setup initial renderer quality based on current level
    this.applyRendererSettings(this.getCurrentLodLevel());
    
    // Setup performance monitor quality change callback
    this.performanceMonitor.setQualityLevel(this.currentLevel);
    this.setupPerformanceCallback();
    
    // Listen for memory pressure events
    document.addEventListener('memory-pressure', this.handleMemoryPressure.bind(this));
  }
  
  /**
   * Setup callback from performance monitor for quality changes
   */
  private setupPerformanceCallback(): void {
    // Replace any existing callback in the performance monitor
    this.performanceMonitor['onQualityChange'] = (qualityLevel: number) => {
      this.setQualityLevel(qualityLevel);
    };
  }
  
  /**
   * Set the quality level and apply changes
   */
  setQualityLevel(level: number): void {
    // Ensure level is within valid range
    const newLevel = Math.max(0, Math.min(this.levels.length - 1, level));
    
    // Skip if no change
    if (newLevel === this.currentLevel) {
      return;
    }
    
    // Update current level
    this.currentLevel = newLevel;
    const lodLevel = this.getCurrentLodLevel();
    
    // Apply renderer settings
    this.applyRendererSettings(lodLevel);
    
    // Notify listeners
    this.onLodChange(lodLevel);
    
    console.log(`LOD changed to: ${lodLevel.name} (level ${lodLevel.level})`);
  }
  
  /**
   * Apply renderer settings based on LOD level
   */
  private applyRendererSettings(lod: LodLevel): void {
    // Apply renderer quality settings
    this.renderer.shadowMap.enabled = lod.shadowQuality !== 'off';
    
    // Set shadow map type based on quality
    switch (lod.shadowQuality) {
      case 'low':
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        break;
      case 'medium':
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        break;
      case 'high':
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
    }
    
    // Set pixel ratio based on quality
    // For lower quality, we can render at lower resolution
    if (lod.level === 0) {
      // Very low - render at half resolution
      this.renderer.setPixelRatio(window.devicePixelRatio * 0.5);
    } else if (lod.level === 1) {
      // Low - render at 75% resolution
      this.renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    } else {
      // Medium and above - render at full resolution
      this.renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    // Set antialiasing based on quality
    // Note: This doesn't work at runtime, but included for completeness
    if (this.renderer.capabilities.isWebGL2) {
      if (lod.level >= 3) {
        // High and Ultra - Use MSAA if available
        // Note: This requires creating a new renderer, so it's not applied here
        // but is documented for reference
      }
    }
    
    // Configure additional WebGL parameters based on quality
    if (lod.level <= 1) {
      // Reduce texture anisotropy for low quality levels
      this.renderer.capabilities.getMaxAnisotropy = () => 1;
    }
    
    // Apply power preference based on quality
    // Note: This is just for documentation, as it can only be set at renderer creation
    // For production, you would set this when creating the renderer
    /*
    if (lod.level >= 3) {
      // High performance mode for high quality
      // renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
    } else if (lod.level <= 1) {
      // Low power mode for low quality
      // renderer = new THREE.WebGLRenderer({ powerPreference: 'low-power' });
    } else {
      // Default for medium quality
      // renderer = new THREE.WebGLRenderer({ powerPreference: 'default' });
    }
    */
  }
  
  /**
   * Get the current LOD level configuration
   */
  getCurrentLodLevel(): LodLevel {
    return this.levels[this.currentLevel];
  }
  
  /**
   * Check if an update should occur based on the current LOD's update frequency
   * @param importance Optional importance value (0-1) to prioritize updates
   * @param distance Optional distance from camera
   */
  shouldUpdate(importance: number = 0.5, distance: number = 0): boolean {
    const lod = this.getCurrentLodLevel();
    
    // Increment the frame counter
    this.frameCounter++;
    
    // Dynamic update frequency based on distance and importance
    let effectiveFrequency = lod.updateFrequency;
    
    // If dynamic update frequency is enabled, adjust based on distance and importance
    if (this.dynamicUpdateFrequency) {
      // Increase frequency (update more often) for important objects
      if (importance > 0.8) {
        effectiveFrequency = Math.max(1, effectiveFrequency - 1);
      }
      
      // Decrease frequency (update less often) for distant objects
      if (distance > this.adaptiveDistance && this.distanceScalingEnabled) {
        const distanceFactor = Math.min(3, Math.floor((distance - this.adaptiveDistance) / 30) + 1);
        effectiveFrequency = Math.min(6, effectiveFrequency + distanceFactor);
      }
    }
    
    // Check if we should update this frame based on calculated frequency
    const shouldUpdate = this.frameCounter % effectiveFrequency === 0;
    
    return shouldUpdate;
  }
  
  /**
   * Get the appropriate geometry detail level for a given object
   * This can be used to dynamically adjust geometry complexity
   * 
   * @param baseDetail Base detail level (1.0 = normal)
   * @param distanceToCamera Distance to camera (for distance-based LOD)
   * @param importance Optional importance value (0-1) to prioritize detail
   * @returns Adjusted detail level
   */
  getGeometryDetail(baseDetail: number, distanceToCamera?: number, importance: number = 0.5): number {
    const lod = this.getCurrentLodLevel();
    let detail = baseDetail * lod.geometryDetail;
    
    // Apply importance-based scaling if enabled
    if (this.importanceBasedLod && importance !== 0.5) {
      // Boost detail for important objects, reduce for less important
      const importanceFactor = 0.5 + (importance - 0.5) * 0.5; // Scale to 0.25-0.75 range
      detail *= importanceFactor;
    }
    
    // Apply distance-based scaling if distance is provided and feature is enabled
    if (distanceToCamera !== undefined && this.distanceScalingEnabled) {
      // Reduce detail for distant objects
      // Objects beyond adaptive distance threshold get reduced detail
      if (distanceToCamera > this.adaptiveDistance) {
        // Apply a smooth falloff curve for detail reduction
        const falloffFactor = Math.max(0.1, 1 - (distanceToCamera - this.adaptiveDistance) / 100);
        detail *= falloffFactor;
      }
    }
    
    // Apply a minimum detail level based on LOD to prevent too low detail
    const minDetail = lod.geometryDetail * 0.1;
    return Math.max(minDetail, detail);
  }
  
  /**
   * Calculate the appropriate number of particles based on current LOD
   * 
   * @param baseCount Base particle count at highest quality
   * @param importance Optional importance value (0-1) for this particle system
   * @param distance Optional distance from camera
   * @returns Adjusted particle count
   */
  getParticleCount(baseCount: number, importance: number = 0.5, distance: number = 0): number {
    const lod = this.getCurrentLodLevel();
    
    // Calculate base scale factor from LOD level
    const baseFactor = lod.particleCount / DEFAULT_LOD_LEVELS[DEFAULT_LOD_LEVELS.length - 1].particleCount;
    let scaleFactor = baseFactor;
    
    // Apply importance-based scaling if enabled
    if (this.importanceBasedLod) {
      // Boost particle count for important effects, reduce for less important
      // Map importance 0-1 to a scaling factor of 0.5-1.5
      const importanceFactor = 0.5 + importance;
      scaleFactor *= importanceFactor;
    }
    
    // Apply distance-based scaling if feature is enabled
    if (distance > 0 && this.distanceScalingEnabled) {
      // Reduce particles for distant effects
      if (distance > this.adaptiveDistance) {
        // Apply a smooth falloff curve
        const distanceFactor = Math.max(0.2, 1 - (distance - this.adaptiveDistance) / 150);
        scaleFactor *= distanceFactor;
      }
    }
    
    // Calculate final count and ensure it's at least 10% of base count
    const minCount = Math.max(10, Math.floor(baseCount * 0.1));
    return Math.max(minCount, Math.floor(baseCount * scaleFactor));
  }
  
  /**
   * Mark an object as important for LOD purposes
   * Important objects maintain higher detail even at lower quality levels
   * @param object The object to mark as important
   */
  markAsImportant(object: THREE.Object3D): void {
    this.importantObjects.add(object);
  }
  
  /**
   * Remove importance marking from an object
   * @param object The object to remove importance from
   */
  clearImportance(object: THREE.Object3D): void {
    this.importantObjects.delete(object);
  }
  
  /**
   * Check if an object is marked as important
   * @param object The object to check
   * @returns True if the object is marked as important
   */
  isImportant(object: THREE.Object3D): boolean {
    return this.importantObjects.has(object);
  }
  
  /**
   * Handle memory pressure events
   * Reduces LOD level and applies aggressive memory optimizations
   */
  private handleMemoryPressure(): void {
    console.log('LOD Manager handling memory pressure event');
    
    // Reduce LOD level immediately if not already at minimum
    if (this.currentLevel > 0) {
      this.setQualityLevel(Math.max(0, this.currentLevel - 1));
    }
    
    // Apply more aggressive distance scaling
    this.adaptiveDistance = 30; // Reduce distance threshold
    
    // Emit event for visualizations to handle
    const event = new CustomEvent('lod-memory-optimization', {
      detail: { level: this.currentLevel }
    });
    document.dispatchEvent(event);
  }
  
  /**
   * Check if post-processing should be enabled
   */
  isPostProcessingEnabled(): boolean {
    return this.getCurrentLodLevel().postProcessingEnabled;
  }
  
  /**
   * Get the effect complexity factor (0-1)
   * This can be used to scale various effect parameters
   */
  getEffectComplexity(): number {
    return this.getCurrentLodLevel().effectComplexity;
  }
  
  /**
   * Get maximum number of objects to render
   */
  getMaxObjectCount(): number {
    return this.getCurrentLodLevel().maxObjects;
  }
}