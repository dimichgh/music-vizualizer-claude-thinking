/**
 * Post-processing Effects Manager
 * Handles bloom, film grain, and chromatic aberration effects
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

import { AudioAnalysisData } from '../../shared/types';

/**
 * Post-processing effects configuration
 */
export interface PostProcessingConfig {
  // Global enabled state
  enabled: boolean;
  
  // Bloom effect configuration
  bloom: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
    // Reactive components
    strengthReactivity: number; // How much strength reacts to audio
    radiusReactivity: number;   // How much radius reacts to audio
  };
  
  // Film grain effect configuration
  filmGrain: {
    enabled: boolean;
    intensity: number;
    scanlines: number;
    grayscale: boolean;
    // Reactive components
    intensityReactivity: number; // How much intensity reacts to audio
  };
  
  // Chromatic aberration effect configuration
  chromaticAberration: {
    enabled: boolean;
    amount: number;
    // Reactive components
    amountReactivity: number; // How much aberration reacts to audio
  };
}

/**
 * Default post-processing configuration
 */
export const defaultPostProcessingConfig: PostProcessingConfig = {
  enabled: true,
  bloom: {
    enabled: true,
    strength: 0.7,
    radius: 0.5,
    threshold: 0.2,
    strengthReactivity: 0.5,
    radiusReactivity: 0.3
  },
  filmGrain: {
    enabled: true,
    intensity: 0.35,
    scanlines: 0.5,
    grayscale: false,
    intensityReactivity: 0.4
  },
  chromaticAberration: {
    enabled: true,
    amount: 0.003,
    amountReactivity: 0.6
  }
};

// Default quality presets for different performance profiles
export const PostProcessingPresets = {
  ultraLow: {
    enabled: false,
    bloom: {
      enabled: false,
      strength: 0.4,
      radius: 0.3,
      threshold: 0.3,
      strengthReactivity: 0.3,
      radiusReactivity: 0.2
    },
    filmGrain: {
      enabled: false,
      intensity: 0.2,
      scanlines: 0.3,
      grayscale: false,
      intensityReactivity: 0.2
    },
    chromaticAberration: {
      enabled: false,
      amount: 0.002,
      amountReactivity: 0.3
    }
  },
  low: {
    enabled: true,
    bloom: {
      enabled: true,
      strength: 0.5,
      radius: 0.4,
      threshold: 0.25,
      strengthReactivity: 0.4,
      radiusReactivity: 0.2
    },
    filmGrain: {
      enabled: false,
      intensity: 0.25,
      scanlines: 0.4,
      grayscale: false,
      intensityReactivity: 0.3
    },
    chromaticAberration: {
      enabled: false,
      amount: 0.002,
      amountReactivity: 0.4
    }
  },
  medium: {
    enabled: true,
    bloom: {
      enabled: true,
      strength: 0.6,
      radius: 0.45,
      threshold: 0.22,
      strengthReactivity: 0.4,
      radiusReactivity: 0.25
    },
    filmGrain: {
      enabled: true,
      intensity: 0.3,
      scanlines: 0.4,
      grayscale: false,
      intensityReactivity: 0.35
    },
    chromaticAberration: {
      enabled: true,
      amount: 0.0025,
      amountReactivity: 0.5
    }
  },
  high: {
    enabled: true,
    bloom: {
      enabled: true,
      strength: 0.7,
      radius: 0.5,
      threshold: 0.2,
      strengthReactivity: 0.5,
      radiusReactivity: 0.3
    },
    filmGrain: {
      enabled: true,
      intensity: 0.35,
      scanlines: 0.5,
      grayscale: false,
      intensityReactivity: 0.4
    },
    chromaticAberration: {
      enabled: true,
      amount: 0.003,
      amountReactivity: 0.6
    }
  }
};

/**
 * Class for managing post-processing effects
 */
export class PostProcessingManager {
  private composer: EffectComposer;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private config: PostProcessingConfig;
  
  // Effect passes
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass | null = null;
  private filmPass: FilmPass | null = null;
  private rgbShiftPass: ShaderPass | null = null;
  
  // Enabled flags
  private bloomEnabled: boolean = true;
  private filmGrainEnabled: boolean = true;
  private chromaticAberrationEnabled: boolean = true;
  
  // Performance optimization
  private halfSizeRenderTarget: boolean = false; // Render at half resolution for performance
  private skipFrames: number = 0; // Skip frames for effects that don't need to update every frame
  private frameCount: number = 0;
  private lastUpdateTime: number = 0;
  private renderTargetCache: Map<string, THREE.WebGLRenderTarget> = new Map();
  private performanceMonitor: any = null; // Reference to performance monitor (if available)
  
  /**
   * Create a new post-processing manager
   * @param renderer The Three.js renderer
   * @param scene The Three.js scene
   * @param camera The Three.js camera
   * @param config Optional configuration (uses default if not provided)
   */
  constructor(
    renderer: THREE.WebGLRenderer, 
    scene: THREE.Scene, 
    camera: THREE.Camera,
    config: PostProcessingConfig = defaultPostProcessingConfig,
    performanceMonitor?: any // Optional performance monitor
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = { ...defaultPostProcessingConfig, ...config };
    this.performanceMonitor = performanceMonitor || null;
    
    // Detect device capabilities to adjust initial quality
    this.detectCapabilities();
    
    // Create composer with appropriate render target
    const pixelRatio = this.halfSizeRenderTarget ? 
      this.renderer.getPixelRatio() * 0.5 : 
      this.renderer.getPixelRatio();
    
    const size = this.renderer.getSize(new THREE.Vector2());
    const renderTarget = this.getCachedRenderTarget(
      Math.floor(size.width * pixelRatio),
      Math.floor(size.height * pixelRatio)
    );
    
    this.composer = new EffectComposer(this.renderer, renderTarget);
    
    // Add render pass (always required)
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    
    // Initialize effects based on config
    this.initializeEffects();
    
    // Listen for memory pressure events
    document.addEventListener('memory-pressure', this.handleMemoryPressure.bind(this));
    document.addEventListener('lod-memory-optimization', this.handleLodOptimization.bind(this));
  }
  
  /**
   * Detect device capabilities and adjust initial quality settings
   */
  private detectCapabilities(): void {
    // Check for mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check for low memory devices
    const isLowMemory = ('deviceMemory' in navigator) && (navigator as any).deviceMemory < 4;
    
    // Adjust quality based on device capabilities
    if (isMobile || isLowMemory) {
      // Use half size render targets on mobile/low memory devices
      this.halfSizeRenderTarget = true;
      
      // Skip frames on low-end devices
      this.skipFrames = isMobile ? 2 : 1; // Update every 3rd frame on mobile, every other frame on low memory
      
      console.log(`Reduced post-processing quality for ${isMobile ? 'mobile' : 'low memory'} device`);
    }
  }
  
  /**
   * Get a cached render target or create a new one
   * @param width Width in pixels
   * @param height Height in pixels
   * @returns WebGLRenderTarget
   */
  private getCachedRenderTarget(width: number, height: number): THREE.WebGLRenderTarget {
    const key = `${width}x${height}`;
    
    if (this.renderTargetCache.has(key)) {
      return this.renderTargetCache.get(key)!;
    }
    
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      encoding: THREE.sRGBEncoding
    });
    
    this.renderTargetCache.set(key, renderTarget);
    return renderTarget;
  }
  
  /**
   * Initialize effects based on current configuration
   */
  private initializeEffects(): void {
    // Start performance monitoring if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('postProcessingInit');
    }
    
    // Initialize bloom effect
    if (this.config.bloom.enabled) {
      this.bloomEnabled = true;
      
      // Calculate appropriate size for the bloom pass
      const pixelRatio = this.halfSizeRenderTarget ? 
        this.renderer.getPixelRatio() * 0.5 : 
        this.renderer.getPixelRatio();
      
      const size = this.renderer.getSize(new THREE.Vector2());
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.width * pixelRatio, size.height * pixelRatio),
        this.config.bloom.strength, 
        this.config.bloom.radius, 
        this.config.bloom.threshold
      );
      
      // Optimize bloom pass based on device capabilities
      if (this.halfSizeRenderTarget) {
        // Reduce quality for low-end devices
        bloomPass.resolution = new THREE.Vector2(256, 256); // Force smaller resolution
      }
      
      this.bloomPass = bloomPass;
      this.composer.addPass(bloomPass);
    }
    
    // Initialize film grain effect
    if (this.config.filmGrain.enabled) {
      this.filmGrainEnabled = true;
      // For FilmPass, only use the first parameter as it doesn't accept all 4 in newer versions
      const filmPass = new FilmPass(
        this.config.filmGrain.intensity
      );
      this.filmPass = filmPass;
      this.composer.addPass(filmPass);
    }
    
    // Initialize chromatic aberration effect
    if (this.config.chromaticAberration.enabled) {
      this.chromaticAberrationEnabled = true;
      const rgbShiftPass = new ShaderPass(RGBShiftShader);
      rgbShiftPass.uniforms['amount'].value = this.config.chromaticAberration.amount;
      this.rgbShiftPass = rgbShiftPass;
      this.composer.addPass(rgbShiftPass);
    }
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('postProcessingInit');
    }
  }
  
  /**
   * Update effects based on audio data
   * @param audioData Current audio analysis data
   */
  update(audioData: AudioAnalysisData): void {
    // Start performance monitoring if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('postProcessing');
    }
    
    // Increment frame counter
    this.frameCount++;
    
    // Skip updates for some frames if needed (performance optimization)
    if (this.skipFrames > 0 && this.frameCount % (this.skipFrames + 1) !== 0) {
      // Skip this frame update but still track time
      this.lastUpdateTime = performance.now();
      
      if (this.performanceMonitor) {
        this.performanceMonitor.endSection('postProcessing');
      }
      return;
    }
    
    const volume = audioData.volume;
    const isBeat = audioData.beat.detected;
    const beatConfidence = audioData.beat.confidence;
    
    // Calculate reactive factor - stronger for beats
    const beatFactor = isBeat ? 1.0 + beatConfidence : 1.0;
    
    // Update bloom effect (most expensive effect)
    if (this.bloomEnabled && this.bloomPass) {
      // Only update bloom on beats or significant volume changes to save performance
      // Store last volume directly on the bloomPass instance using our own property
      const lastVolume = (this.bloomPass as any)._lastVolume || 0;
      const significantChange = isBeat || Math.abs(volume - lastVolume) > 0.1;
      
      if (significantChange) {
        // Base values
        let strength = this.config.bloom.strength;
        let radius = this.config.bloom.radius;
        
        // Apply reactivity to volume
        if (this.config.bloom.strengthReactivity > 0) {
          strength += volume * this.config.bloom.strengthReactivity * beatFactor;
        }
        
        if (this.config.bloom.radiusReactivity > 0) {
          radius += volume * this.config.bloom.radiusReactivity * beatFactor;
        }
        
        // Clamp values to reasonable ranges
        strength = Math.max(0.1, Math.min(2.0, strength));
        radius = Math.max(0.1, Math.min(1.0, radius));
        
        // Apply changes
        this.bloomPass.strength = strength;
        this.bloomPass.radius = radius;
        
        // Store last volume for change detection using our own property
        (this.bloomPass as any)._lastVolume = volume;
      }
    }
    
    // Update film grain effect
    if (this.filmGrainEnabled && this.filmPass) {
      // Base value
      let intensity = this.config.filmGrain.intensity;
      
      // Apply reactivity to volume
      if (this.config.filmGrain.intensityReactivity > 0) {
        intensity += volume * this.config.filmGrain.intensityReactivity * beatFactor;
      }
      
      // Clamp value to reasonable range
      intensity = Math.max(0.0, Math.min(1.0, intensity));
      
      // Apply changes - access uniforms carefully
      try {
        if (this.filmPass.uniforms && this.filmPass.uniforms) {
          // Type assertion to allow indexing
          const uniforms = this.filmPass.uniforms as Record<string, { value: number }>;
          if (uniforms.nIntensity) {
            uniforms.nIntensity.value = intensity;
          }
        }
      } catch (e) {
        console.warn('Could not update film pass intensity:', e);
      }
    }
    
    // Update chromatic aberration effect
    if (this.chromaticAberrationEnabled && this.rgbShiftPass) {
      // Only update on significant events to save performance
      if (isBeat || this.frameCount % 10 === 0) { // Update on beats or every 10 frames
        // Base value
        let amount = this.config.chromaticAberration.amount;
        
        // Apply reactivity to volume and beat
        if (this.config.chromaticAberration.amountReactivity > 0) {
          amount += volume * this.config.chromaticAberration.amountReactivity * beatFactor;
        }
        
        // Additional spike on beat detection
        if (isBeat) {
          amount += 0.002 * beatConfidence;
        }
        
        // Clamp value to reasonable range
        amount = Math.max(0.0, Math.min(0.015, amount));
        
        // Apply changes
        this.rgbShiftPass.uniforms['amount'].value = amount;
      }
    }
    
    // Store last update time
    this.lastUpdateTime = performance.now();
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('postProcessing');
    }
  }
  
  /**
   * Render the scene with post-processing effects
   */
  render(): void {
    // Start performance monitoring if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('postProcessingRender');
    }
    
    this.composer.render();
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('postProcessingRender');
    }
  }
  
  /**
   * Set post-processing configuration
   * @param config New configuration
   */
  setConfig(config: Partial<PostProcessingConfig>): void {
    // Update config with new values
    this.config = {
      ...this.config,
      ...config,
      bloom: { ...this.config.bloom, ...(config.bloom || {}) },
      filmGrain: { ...this.config.filmGrain, ...(config.filmGrain || {}) },
      chromaticAberration: { ...this.config.chromaticAberration, ...(config.chromaticAberration || {}) }
    };
    
    // Rebuild effects with new config
    this.dispose();
    this.initializeEffects();
  }
  
  /**
   * Set whether all post-processing effects are enabled
   * @param enabled Whether post-processing is enabled
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    // If we're turning everything off, disable all passes
    if (!enabled) {
      this.setBloomEnabled(false);
      this.setFilmGrainEnabled(false);
      this.setChromaticAberrationEnabled(false);
    } else {
      // Re-enable passes based on their individual settings
      this.setBloomEnabled(this.config.bloom.enabled);
      this.setFilmGrainEnabled(this.config.filmGrain.enabled);
      this.setChromaticAberrationEnabled(this.config.chromaticAberration.enabled);
    }
  }
  
  /**
   * Toggle bloom effect
   * @param enabled Whether the effect is enabled
   */
  setBloomEnabled(enabled: boolean): void {
    if (enabled === this.bloomEnabled) return;
    
    this.config.bloom.enabled = enabled;
    this.bloomEnabled = enabled;
    
    if (enabled && !this.bloomPass) {
      // Create and add bloom pass
      const pixelRatio = this.renderer.getPixelRatio();
      const size = this.renderer.getSize(new THREE.Vector2());
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.width * pixelRatio, size.height * pixelRatio),
        this.config.bloom.strength, 
        this.config.bloom.radius, 
        this.config.bloom.threshold
      );
      this.bloomPass = bloomPass;
      this.composer.addPass(bloomPass);
    } else if (!enabled && this.bloomPass) {
      // Remove bloom pass
      this.composer.removePass(this.bloomPass);
      this.bloomPass = null;
    }
  }
  
  /**
   * Toggle film grain effect
   * @param enabled Whether the effect is enabled
   */
  setFilmGrainEnabled(enabled: boolean): void {
    if (enabled === this.filmGrainEnabled) return;
    
    this.config.filmGrain.enabled = enabled;
    this.filmGrainEnabled = enabled;
    
    if (enabled && !this.filmPass) {
      // Create and add film pass
      const filmPass = new FilmPass(
        this.config.filmGrain.intensity
      );
      this.filmPass = filmPass;
      this.composer.addPass(filmPass);
    } else if (!enabled && this.filmPass) {
      // Remove film pass
      this.composer.removePass(this.filmPass);
      this.filmPass = null;
    }
  }
  
  /**
   * Toggle chromatic aberration effect
   * @param enabled Whether the effect is enabled
   */
  setChromaticAberrationEnabled(enabled: boolean): void {
    if (enabled === this.chromaticAberrationEnabled) return;
    
    this.config.chromaticAberration.enabled = enabled;
    this.chromaticAberrationEnabled = enabled;
    
    if (enabled && !this.rgbShiftPass) {
      // Create and add RGB shift pass
      const rgbShiftPass = new ShaderPass(RGBShiftShader);
      rgbShiftPass.uniforms['amount'].value = this.config.chromaticAberration.amount;
      this.rgbShiftPass = rgbShiftPass;
      this.composer.addPass(rgbShiftPass);
    } else if (!enabled && this.rgbShiftPass) {
      // Remove RGB shift pass
      this.composer.removePass(this.rgbShiftPass);
      this.rgbShiftPass = null;
    }
  }
  
  /**
   * Handle window resize
   */
  handleResize(): void {
    // Start performance monitoring if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('postProcessingResize');
    }
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate appropriate size for render targets
    const pixelRatio = this.halfSizeRenderTarget ? 
      this.renderer.getPixelRatio() * 0.5 : 
      this.renderer.getPixelRatio();
    
    const renderWidth = Math.floor(width * pixelRatio);
    const renderHeight = Math.floor(height * pixelRatio);
    
    // Get a cached render target or create a new one
    const renderTarget = this.getCachedRenderTarget(renderWidth, renderHeight);
    
    // Update composer size and render target
    this.composer.setSize(width, height);
    
    // Update bloom pass with new size - this is more efficient than recreating
    if (this.bloomEnabled && this.bloomPass) {
      // Update resolution for the bloom pass
      this.bloomPass.resolution.set(renderWidth, renderHeight);
      
      // We don't need to recreate the pass every time, just update the size
      // This avoids expensive shader recompilation
    }
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('postProcessingResize');
    }
  }
  
  /**
   * Set the preset configuration for a specific quality level
   * @param presetName The name of the preset to use (ultraLow, low, medium, high)
   */
  setQualityPreset(presetName: 'ultraLow' | 'low' | 'medium' | 'high'): void {
    // Get the preset configuration
    const preset = PostProcessingPresets[presetName];
    if (!preset) return;
    
    // Apply the preset
    this.setConfig(preset);
    
    // Update half-size rendering flag based on preset
    this.halfSizeRenderTarget = presetName === 'ultraLow' || presetName === 'low';
    
    // Update skip frames based on preset
    this.skipFrames = presetName === 'ultraLow' ? 2 : 
                    presetName === 'low' ? 1 : 0;
    
    console.log(`Applied ${presetName} post-processing preset`);
  }
  
  /**
   * Handle memory pressure event
   */
  private handleMemoryPressure(): void {
    console.log('Post-processing handling memory pressure');
    
    // Switch to ultraLow preset
    this.setQualityPreset('ultraLow');
    
    // Clear render target cache except for current size
    const currentSize = this.renderer.getSize(new THREE.Vector2());
    const currentKey = `${Math.floor(currentSize.width * this.renderer.getPixelRatio() * 0.5)}x${Math.floor(currentSize.height * this.renderer.getPixelRatio() * 0.5)}`;
    
    this.renderTargetCache.forEach((target, key) => {
      if (key !== currentKey) {
        target.dispose();
      }
    });
    
    // Keep only the current render target
    const currentTarget = this.renderTargetCache.get(currentKey);
    this.renderTargetCache.clear();
    if (currentTarget) {
      this.renderTargetCache.set(currentKey, currentTarget);
    }
  }
  
  /**
   * Handle LOD optimization event
   */
  private handleLodOptimization(event: CustomEvent): void {
    const level = event.detail?.level || 0;
    
    // Set quality preset based on LOD level
    if (level === 0) {
      this.setQualityPreset('ultraLow');
    } else if (level === 1) {
      this.setQualityPreset('low');
    } else if (level === 2) {
      this.setQualityPreset('medium');
    } else {
      this.setQualityPreset('high');
    }
  }
  
  /**
   * Clean up post-processing resources
   */
  dispose(): void {
    // Start performance monitoring if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('postProcessingDispose');
    }
    
    // Remove event listeners
    document.removeEventListener('memory-pressure', this.handleMemoryPressure.bind(this));
    document.removeEventListener('lod-memory-optimization', this.handleLodOptimization.bind(this));
    
    // Dispose of passes
    if (this.bloomPass) {
      this.composer.removePass(this.bloomPass);
      this.bloomPass = null;
    }
    
    if (this.filmPass) {
      this.composer.removePass(this.filmPass);
      this.filmPass = null;
    }
    
    if (this.rgbShiftPass) {
      this.composer.removePass(this.rgbShiftPass);
      this.rgbShiftPass = null;
    }
    
    // Dispose render targets
    this.renderTargetCache.forEach(target => {
      target.dispose();
    });
    this.renderTargetCache.clear();
    
    // Reset flags
    this.bloomEnabled = false;
    this.filmGrainEnabled = false;
    this.chromaticAberrationEnabled = false;
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('postProcessingDispose');
    }
  }
}