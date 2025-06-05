import * as THREE from 'three';
import { AudioAnalysisData, DetectedInstrument } from '../../shared/types';
import { Pool, ObjectPool } from '../utils/object-pool';
import { LodManager } from '../utils/lod-manager';
import { PerformanceMonitor } from '../utils/performance-monitor';

// Common shader chunks for reuse across visualizations
export const ShaderChunks = {
  // Common vertex shader functions
  vertexFunctions: `
    // Convert HSL to RGB color space
    vec3 hslToRgb(float h, float s, float l) {
      float r, g, b;
      
      if (s == 0.0) {
        r = g = b = l; // achromatic
      } else {
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        r = hueToRgb(p, q, h + 1.0/3.0);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1.0/3.0);
      }
      
      return vec3(r, g, b);
    }
    
    // Helper for HSL to RGB conversion
    float hueToRgb(float p, float q, float t) {
      if (t < 0.0) t += 1.0;
      if (t > 1.0) t -= 1.0;
      if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
      if (t < 1.0/2.0) return q;
      if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
      return p;
    }
  `,
  
  // Common fragment shader functions
  fragmentFunctions: `
    // Smooth circular particle shape with soft edges
    float circle(vec2 uv, float radius, float softness) {
      float dist = length(uv - vec2(0.5));
      return smoothstep(radius + softness, radius - softness, dist);
    }
    
    // Create a glow effect
    float glow(vec2 uv, float radius, float intensity) {
      float dist = length(uv - vec2(0.5));
      return pow(1.0 - smoothstep(0.0, radius, dist), intensity);
    }
    
    // Noise function for effects
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
  `,
  
  // Common uniforms shared across shaders
  commonUniforms: `
    uniform float time;      // Global time in seconds
    uniform float beat;      // Beat detection (0 = no beat, 1 = beat)
    uniform float volume;    // Audio volume (0-1)
    uniform float qualityScale; // Quality scaling factor
  `,
  
  // Optimization presets for different quality levels
  lowQualityFrag: `
    // Simplified version without complex effects
    gl_FragColor = vec4(color, alpha);
  `,
  
  mediumQualityFrag: `
    // Add simple glow effect
    color += glow * 0.2;
    gl_FragColor = vec4(color, alpha);
  `,
  
  highQualityFrag: `
    // Add advanced effects: glow, bloom hints, color correction
    color += glow * 0.3;
    color = pow(color, vec3(0.95)); // Slight gamma adjustment
    color *= 1.0 + beat * 0.2; // Enhance on beat
    gl_FragColor = vec4(color, alpha);
  `
};

/**
 * Base class for all visualizations
 */
export abstract class BaseVisualization {
  protected scene: THREE.Scene;
  protected objects: THREE.Object3D[] = [];
  protected materials: THREE.Material[] = [];
  protected geometries: THREE.BufferGeometry[] = [];
  protected uniforms: { [key: string]: THREE.IUniform };
  protected clock: THREE.Clock;
  protected detectedInstruments: DetectedInstrument[] = [];
  
  // Performance optimization properties
  protected objectPools: Map<string, ObjectPool<any>> = new Map();
  protected lastUpdateTime: number = 0;
  protected frameCount: number = 0;
  protected isVisible: boolean = true;
  protected distanceToCamera: number = 0;
  protected visibilityThreshold: number = 100; // Units beyond which to disable detailed updates
  protected updateFrequency: number = 1; // How many frames between updates (1 = every frame)
  protected qualityScale: number = 1.0; // Current quality scaling factor
  
  // Draw call optimization properties
  protected drawCallBudget: number = 20; // Target maximum draw calls
  protected currentDrawCalls: number = 0;
  protected shouldBatchGeometry: boolean = true; // Whether to batch geometry for fewer draw calls
  protected useInstancing: boolean = true; // Whether to use instanced rendering
  protected shaderComplexity: 'low' | 'medium' | 'high' = 'medium'; // Current shader complexity
  
  // Frustum culling optimization
  protected useFrustumCulling: boolean = true;
  protected frustum: THREE.Frustum = new THREE.Frustum();
  protected frustumMatrix: THREE.Matrix4 = new THREE.Matrix4();
  protected boundingSpheres: Map<THREE.Object3D, THREE.Sphere> = new Map();
  
  // Memory management
  protected textureCache: Map<string, THREE.Texture> = new Map();
  protected materialCache: Map<string, THREE.Material> = new Map();
  protected geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  protected lastCleanupTime: number = 0;
  protected memoryCleanupInterval: number = 30000; // 30 seconds
  
  // LOD and performance monitoring
  protected lodManager: LodManager | null = null;
  protected performanceMonitor: PerformanceMonitor | null = null;

  constructor(scene: THREE.Scene, lodManager?: LodManager, performanceMonitor?: PerformanceMonitor) {
    console.log("Creating BaseVisualization");
    this.scene = scene;
    this.uniforms = {
      time: { value: 0 },
      beat: { value: 0 },
      volume: { value: 0 },
      qualityScale: { value: 1.0 },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };
    this.clock = new THREE.Clock();
    
    // Store references to LOD and performance managers if provided
    this.lodManager = lodManager || null;
    this.performanceMonitor = performanceMonitor || null;
    
    // Apply initial quality settings if LOD manager is available
    if (this.lodManager) {
      this.qualityScale = this.lodManager.getEffectComplexity();
      this.uniforms.qualityScale.value = this.qualityScale;
      this.updateFrequency = this.lodManager.getCurrentLodLevel().updateFrequency;
      
      // Set shader complexity based on quality scale
      if (this.qualityScale < 0.4) {
        this.shaderComplexity = 'low';
      } else if (this.qualityScale < 0.8) {
        this.shaderComplexity = 'medium';
      } else {
        this.shaderComplexity = 'high';
      }
    }
    
    // Listen for memory pressure events
    document.addEventListener('memory-pressure', this.handleMemoryPressure.bind(this));
    
    // Initialize frustum for culling
    this.updateFrustum();
    
    // Adjust draw call budget based on device capabilities
    if (window.navigator.hardwareConcurrency) {
      // More powerful devices can handle more draw calls
      this.drawCallBudget = Math.min(50, Math.max(10, window.navigator.hardwareConcurrency * 4));
    }
  }

  /**
   * Initialize the visualization
   */
  init(): void {
    console.log("BaseVisualization.init() called");
    this.clearScene();
    this.clock.start();
  }

  /**
   * Update the visualization with new audio data
   * @param audioData Current audio analysis data
   * @param detectedInstruments Optional array of detected instruments
   * @param camera Optional camera for distance-based optimizations
   */
  update(audioData: AudioAnalysisData, detectedInstruments: DetectedInstrument[] = [], camera?: THREE.Camera): void {
    // Start performance monitoring for this update if available
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('update');
    }
    
    // Increment frame counter
    this.frameCount++;
    
    // Update common uniforms that are needed every frame
    this.uniforms.time.value = this.clock.getElapsedTime();
    this.uniforms.beat.value = audioData.beat.detected ? 1.0 : 0.0;
    this.uniforms.volume.value = audioData.volume;
    
    // Store detected instruments
    this.detectedInstruments = detectedInstruments;
    
    // Calculate distance to camera if provided (for LOD adjustments)
    if (camera) {
      // Use the scene position as reference point for distance calculation
      // This is a simple approach; specific visualizations may use a more accurate center point
      const visualizationCenter = new THREE.Vector3(0, 0, 0);
      this.distanceToCamera = camera.position.distanceTo(visualizationCenter);
      
      // Update visibility based on distance
      this.isVisible = this.distanceToCamera < this.visibilityThreshold;
      
      // Update frustum for culling
      if (this.useFrustumCulling) {
        this.updateFrustum(camera);
      }
    } else {
      // If no camera provided, assume always visible
      this.isVisible = true;
      this.distanceToCamera = 0;
    }
    
    // Calculate importance factor for this visualization (higher = more important)
    // This could be based on audio analysis, like updating more frequently during beats or loud sections
    const importanceFactor = audioData.beat.detected ? 0.9 : 
                           audioData.volume > 0.7 ? 0.8 : 0.5;
    
    // Check if we should update this frame based on frequency, LOD, and importance
    let shouldUpdate = true;
    
    // Check LOD manager first
    if (this.lodManager) {
      shouldUpdate = this.lodManager.shouldUpdate(importanceFactor, this.distanceToCamera);
      
      // Update quality scale from LOD manager
      const newQualityScale = this.lodManager.getEffectComplexity();
      if (newQualityScale !== this.qualityScale) {
        this.qualityScale = newQualityScale;
        this.uniforms.qualityScale.value = this.qualityScale;
        
        // Update shader complexity based on new quality scale
        if (this.qualityScale < 0.4) {
          this.shaderComplexity = 'low';
        } else if (this.qualityScale < 0.8) {
          this.shaderComplexity = 'medium';
        } else {
          this.shaderComplexity = 'high';
        }
        
        // Force an update when quality changes
        shouldUpdate = true;
      }
    } 
    // Otherwise use local update frequency
    else if (this.frameCount % this.updateFrequency !== 0) {
      shouldUpdate = false;
    }
    
    // Always update on beats for better audio reactivity regardless of other settings
    if (audioData.beat.detected && audioData.beat.confidence > 0.5) {
      shouldUpdate = true;
    }
    
    // Check if memory cleanup is needed
    const currentTime = this.uniforms.time.value;
    if (currentTime - this.lastCleanupTime > this.memoryCleanupInterval / 1000) {
      this.cleanupUnusedResources();
      this.lastCleanupTime = currentTime;
    }
    
    // Skip detailed update if not needed
    if (!this.isVisible || !shouldUpdate) {
      if (this.performanceMonitor) {
        this.performanceMonitor.endSection('update');
      }
      return;
    }
    
    // Record update time
    this.lastUpdateTime = this.uniforms.time.value;
    
    // Reset draw call counter
    this.currentDrawCalls = 0;
    
    // Call specific implementation update
    this.updateVisualization(audioData);
    
    // End performance monitoring for this update
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('update');
    }
  }

  /**
   * Implementation-specific update
   * @param audioData Current audio analysis data
   */
  protected abstract updateVisualization(audioData: AudioAnalysisData): void;
  
  /**
   * Get color based on dominant instrument
   * @returns Color value as THREE.Color
   */
  protected getInstrumentColor(): THREE.Color {
    // Default color if no instruments detected
    const defaultColor = new THREE.Color(0x4169e1); // Royal blue
    
    // Return default color if no instruments detected
    if (!this.detectedInstruments || this.detectedInstruments.length === 0) {
      return defaultColor;
    }
    
    // Get the most dominant instrument
    const dominantInstrument = this.detectedInstruments[0];
    
    // Assign colors based on instrument type
    switch (dominantInstrument.type) {
      case 'bass':
        return new THREE.Color(0x800080); // Purple
      case 'drums':
        return new THREE.Color(0xff4500); // Orange red
      case 'piano':
        return new THREE.Color(0x00ced1); // Dark turquoise
      case 'guitar':
        return new THREE.Color(0xff8c00); // Dark orange
      case 'strings':
        return new THREE.Color(0x9370db); // Medium purple
      case 'woodwinds':
        return new THREE.Color(0x228b22); // Forest green
      case 'brass':
        return new THREE.Color(0xffd700); // Gold
      case 'vocals':
        return new THREE.Color(0xff1493); // Deep pink
      default:
        return defaultColor;
    }
  }
  
  /**
   * Update visualization parameters based on detected instruments
   * @returns Object with visualization parameters
   */
  protected getInstrumentParameters(): { [key: string]: number } {
    const params: { [key: string]: number } = {
      intensity: 1.0,
      complexity: 0.5,
      speed: 1.0,
      size: 1.0
    };
    
    // Return default params if no instruments detected
    if (!this.detectedInstruments || this.detectedInstruments.length === 0) {
      return params;
    }
    
    // Adjust parameters based on detected instruments and their confidence
    for (const instrument of this.detectedInstruments) {
      switch (instrument.type) {
        case 'bass':
          params.size *= (1.0 + instrument.confidence * 0.5);
          break;
        case 'drums':
          params.intensity *= (1.0 + instrument.confidence * 0.7);
          params.speed *= (1.0 + instrument.confidence * 0.3);
          break;
        case 'piano':
          params.complexity *= (1.0 + instrument.confidence * 0.4);
          break;
        case 'guitar':
          params.intensity *= (1.0 + instrument.confidence * 0.3);
          params.complexity *= (1.0 + instrument.confidence * 0.2);
          break;
        case 'strings':
          params.size *= (1.0 + instrument.confidence * 0.2);
          params.complexity *= (1.0 + instrument.confidence * 0.4);
          break;
        case 'woodwinds':
          params.speed *= (1.0 - instrument.confidence * 0.2); // Slower
          params.complexity *= (1.0 + instrument.confidence * 0.5);
          break;
        case 'brass':
          params.intensity *= (1.0 + instrument.confidence * 0.6);
          break;
        case 'vocals':
          params.complexity *= (1.0 + instrument.confidence * 0.6);
          params.size *= (1.0 + instrument.confidence * 0.3);
          break;
      }
    }
    
    // Clamp values to reasonable ranges
    params.intensity = Math.max(0.5, Math.min(2.0, params.intensity));
    params.complexity = Math.max(0.3, Math.min(2.0, params.complexity));
    params.speed = Math.max(0.5, Math.min(2.0, params.speed));
    params.size = Math.max(0.5, Math.min(2.0, params.size));
    
    return params;
  }

  /**
   * Clean up visualization resources
   */
  dispose(): void {
    console.log("BaseVisualization.dispose() called");
    
    // Start performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('dispose');
    }
    
    // Remove event listeners
    document.removeEventListener('memory-pressure', this.handleMemoryPressure.bind(this));
    
    // Dispose of materials
    this.materials.forEach(material => {
      material.dispose();
    });
    
    // Dispose of geometries
    this.geometries.forEach(geometry => {
      geometry.dispose();
    });
    
    // Clear object pools
    this.objectPools.forEach(pool => {
      pool.clear();
    });
    
    // Clear caches
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
    
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();
    
    this.geometryCache.forEach(geometry => geometry.dispose());
    this.geometryCache.clear();
    
    // Clear arrays and maps
    this.materials = [];
    this.geometries = [];
    this.objectPools.clear();
    this.boundingSpheres.clear();
    
    // Remove all objects from scene
    this.clearScene();
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('dispose');
    }
  }

  /**
   * Map audio data to a value range
   * @param value Raw audio value
   * @param inMin Input minimum
   * @param inMax Input maximum
   * @param outMin Output minimum
   * @param outMax Output maximum
   * @param clamp Whether to clamp the output to the output range
   * @returns Mapped value
   */
  protected mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
    clamp: boolean = false
  ): number {
    let result = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    
    if (clamp) {
      result = Math.max(outMin, Math.min(outMax, result));
    }
    
    return result;
  }

  /**
   * Create a new shader material with the visualization's uniforms
   * Optimized version that adapts shader complexity based on performance profile
   * 
   * @param vertexShader Vertex shader code
   * @param fragmentShader Fragment shader code
   * @param customUniforms Optional additional uniforms to merge with the common uniforms
   * @param cacheKey Optional key to cache and reuse this material
   * @returns ShaderMaterial
   */
  protected createShaderMaterial(
    vertexShader: string,
    fragmentShader: string,
    customUniforms?: { [key: string]: THREE.IUniform },
    cacheKey?: string
  ): THREE.ShaderMaterial {
    // Check cache first if a cache key is provided
    if (cacheKey && this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey) as THREE.ShaderMaterial;
    }
    
    // Start performance monitoring for shader creation
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('shaderCreate');
    }
    
    // Add common shader functions if not already included
    let processedVertexShader = vertexShader;
    let processedFragmentShader = fragmentShader;
    
    // Add common uniforms declaration if not already included
    if (!processedVertexShader.includes('uniform float time')) {
      processedVertexShader = ShaderChunks.commonUniforms + processedVertexShader;
    }
    
    if (!processedFragmentShader.includes('uniform float time')) {
      processedFragmentShader = ShaderChunks.commonUniforms + processedFragmentShader;
    }
    
    // Add common vertex functions if needed
    if (processedVertexShader.includes('hslToRgb(') && 
        !processedVertexShader.includes('vec3 hslToRgb')) {
      processedVertexShader = ShaderChunks.vertexFunctions + processedVertexShader;
    }
    
    // Add common fragment functions if needed
    if ((processedFragmentShader.includes('circle(') || 
         processedFragmentShader.includes('glow(') || 
         processedFragmentShader.includes('noise(')) && 
        !processedFragmentShader.includes('float circle')) {
      processedFragmentShader = ShaderChunks.fragmentFunctions + processedFragmentShader;
    }
    
    // Simplify shaders based on quality setting
    if (this.shaderComplexity === 'low') {
      // Remove expensive operations (replace with regex for real implementation)
      processedFragmentShader = processedFragmentShader
        .replace(/pow\([^,]+,[^\)]+\)/g, '1.0') // Replace pow() with 1.0
        .replace(/exp\([^\)]+\)/g, '1.0')       // Replace exp() with 1.0
        .replace(/log\([^\)]+\)/g, '0.0')       // Replace log() with 0.0
        .replace(/sin\([^\)]+\)/g, '0.0')       // Simplify sin() calculations
        .replace(/cos\([^\)]+\)/g, '1.0');      // Simplify cos() calculations
    }
    
    // Merge common uniforms with custom uniforms if provided
    const mergedUniforms = customUniforms ? 
      { ...this.uniforms, ...customUniforms } : 
      this.uniforms;
    
    // Create the material with appropriate settings
    const material = new THREE.ShaderMaterial({
      uniforms: mergedUniforms,
      vertexShader: processedVertexShader,
      fragmentShader: processedFragmentShader,
      transparent: true,
      // Apply performance-optimized settings
      depthWrite: false, // Disable depth writing for transparent objects
      depthTest: true,   // Keep depth testing enabled
      blending: THREE.AdditiveBlending, // Common blending mode for visualizations
    });
    
    // Cache the material if a cache key was provided
    if (cacheKey) {
      this.materialCache.set(cacheKey, material);
    }
    
    // Track for disposal
    this.materials.push(material);
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('shaderCreate');
    }
    
    return material;
  }

  /**
   * Add an object to the scene and tracking list with draw call optimization
   * @param object Object to add
   * @param trackForDisposal Whether to track this object for disposal (default: true)
   * @param importance Importance of this object for LOD (0-1, higher = more important)
   */
  protected addObject(object: THREE.Object3D, trackForDisposal: boolean = true, importance: number = 0.5): void {
    // Start performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('addObject');
    }
    
    // Increment draw call counter if this object will cause a draw call
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || 
        object instanceof THREE.Line || object instanceof THREE.Sprite) {
      this.currentDrawCalls++;
    }
    
    // Check if we need to optimize draw calls
    if (this.currentDrawCalls > this.drawCallBudget && 
        object instanceof THREE.Mesh && 
        this.shouldBatchGeometry) {
      
      // Instead of adding as a separate object, try to merge with existing geometry
      this.mergeWithExistingGeometry(object as THREE.Mesh);
    } else {
      // Add to scene normally
      this.scene.add(object);
      
      // Only track objects we want to dispose later
      if (trackForDisposal) {
        this.objects.push(object);
      }
      
      // Track any geometries and materials for proper disposal
      if (object instanceof THREE.Mesh) {
        if (object.geometry && !this.geometries.includes(object.geometry)) {
          this.geometries.push(object.geometry);
        }
        
        if (object.material instanceof THREE.Material && 
            !this.materials.includes(object.material)) {
          this.materials.push(object.material);
        } else if (Array.isArray(object.material)) {
          object.material.forEach(mat => {
            if (!this.materials.includes(mat)) {
              this.materials.push(mat);
            }
          });
        }
        
        // Create bounding sphere for frustum culling
        if (this.useFrustumCulling) {
          const sphere = new THREE.Sphere();
          object.geometry.computeBoundingSphere();
          sphere.copy(object.geometry.boundingSphere);
          sphere.applyMatrix4(object.matrixWorld);
          this.boundingSpheres.set(object, sphere);
        }
      }
      
      // Mark as important in LOD manager if importance is high
      if (importance > 0.7 && this.lodManager) {
        this.lodManager.markAsImportant(object);
      }
    }
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('addObject');
    }
  }
  
  /**
   * Update frustum for culling calculations
   * @param camera Camera to use for frustum calculation
   */
  protected updateFrustum(camera?: THREE.Camera): void {
    if (!camera) return;
    
    this.frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
  }
  
  /**
   * Merge a mesh with existing geometry to reduce draw calls
   * @param mesh Mesh to merge
   */
  protected mergeWithExistingGeometry(mesh: THREE.Mesh): void {
    // This is a simplified version - in a real implementation, you would:
    // 1. Find compatible existing meshes (same material)
    // 2. Merge their geometries
    // 3. Update the scene graph
    
    // For now, just add the mesh to avoid complexity
    this.scene.add(mesh);
    this.objects.push(mesh);
    
    // Track for disposal
    if (mesh.geometry && !this.geometries.includes(mesh.geometry)) {
      this.geometries.push(mesh.geometry);
    }
    
    if (mesh.material instanceof THREE.Material && 
        !this.materials.includes(mesh.material)) {
      this.materials.push(mesh.material);
    }
  }
  
  /**
   * Clean up unused cached resources to free memory
   */
  protected cleanupUnusedResources(): void {
    // Start performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.beginSection('cleanup');
    }
    
    console.log('Cleaning up unused resources');
    
    // Clean unused textures
    const texturesToRemove: string[] = [];
    this.textureCache.forEach((texture, key) => {
      // If texture hasn't been used recently, dispose it
      if (!texture.userData.lastUsed || 
          this.uniforms.time.value - texture.userData.lastUsed > 60) { // 60 seconds
        texture.dispose();
        texturesToRemove.push(key);
      }
    });
    
    texturesToRemove.forEach(key => this.textureCache.delete(key));
    
    // Clean unused materials
    const materialsToRemove: string[] = [];
    this.materialCache.forEach((material, key) => {
      // If material hasn't been used recently, dispose it
      if (!material.userData.lastUsed || 
          this.uniforms.time.value - material.userData.lastUsed > 60) { // 60 seconds
        material.dispose();
        materialsToRemove.push(key);
      }
    });
    
    materialsToRemove.forEach(key => this.materialCache.delete(key));
    
    // Clean unused geometries
    const geometriesToRemove: string[] = [];
    this.geometryCache.forEach((geometry, key) => {
      // If geometry hasn't been used recently, dispose it
      if (!geometry.userData.lastUsed || 
          this.uniforms.time.value - geometry.userData.lastUsed > 60) { // 60 seconds
        geometry.dispose();
        geometriesToRemove.push(key);
      }
    });
    
    geometriesToRemove.forEach(key => this.geometryCache.delete(key));
    
    // End performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.endSection('cleanup');
    }
  }
  
  /**
   * Handle memory pressure events
   */
  protected handleMemoryPressure(): void {
    console.log('Visualization handling memory pressure');
    
    // Force immediate resource cleanup
    this.cleanupUnusedResources();
    
    // Clear all caches
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
    
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();
    
    this.geometryCache.forEach(geometry => geometry.dispose());
    this.geometryCache.clear();
    
    // Release unused pool objects
    this.objectPools.forEach(pool => pool.handleMemoryPressure());
  }

  /**
   * Remove all objects from the scene
   * @param removeAllChildren Whether to also remove all other children from the scene
   */
  protected clearScene(removeAllChildren: boolean = true): void {
    console.log("Clearing scene objects, count:", this.objects.length);
    
    // Remove tracked objects from scene
    this.objects.forEach(object => {
      console.log("Removing object from scene:", object.type);
      this.scene.remove(object);
    });
    
    // Clear array
    this.objects = [];
    
    // Additional cleanup for any children that might still be in the scene
    if (removeAllChildren) {
      while (this.scene.children.length > 0) {
        const child = this.scene.children[0];
        console.log("Removing additional child from scene:", child.type);
        this.scene.remove(child);
      }
    }
  }
  
  /**
   * Create or get an object pool
   * @param key Unique identifier for this pool
   * @param factory Function to create new objects
   * @param resetFn Function to reset objects before reuse
   * @param initialSize Initial pool size
   * @param maxSize Maximum pool size (0 for unlimited)
   * @returns The object pool
   */
  protected getObjectPool<T>(
    key: string, 
    factory: () => T, 
    resetFn: (obj: T) => void = () => {}, 
    initialSize: number = 0, 
    maxSize: number = 0
  ): ObjectPool<T> {
    // Return existing pool if available
    if (this.objectPools.has(key)) {
      return this.objectPools.get(key) as ObjectPool<T>;
    }
    
    // Create new pool
    const pool = new Pool<T>(factory, resetFn, initialSize, maxSize);
    this.objectPools.set(key, pool);
    return pool;
  }
  
  /**
   * Set the LOD manager for this visualization
   * @param lodManager LOD manager instance
   */
  setLodManager(lodManager: LodManager): void {
    this.lodManager = lodManager;
    
    // Apply initial quality settings
    if (this.lodManager) {
      this.qualityScale = this.lodManager.getEffectComplexity();
      this.uniforms.qualityScale.value = this.qualityScale;
      this.updateFrequency = this.lodManager.getCurrentLodLevel().updateFrequency;
    }
  }
  
  /**
   * Set the performance monitor for this visualization
   * @param performanceMonitor Performance monitor instance
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
  }
  
  /**
   * Get the number of particles to use based on current quality level
   * @param baseCount Base particle count at highest quality
   * @returns Adjusted particle count based on current quality
   */
  protected getParticleCount(baseCount: number): number {
    // If LOD manager is available, use it to determine particle count
    if (this.lodManager) {
      return this.lodManager.getParticleCount(baseCount);
    }
    
    // Otherwise scale based on quality scale
    return Math.floor(baseCount * this.qualityScale);
  }
  
  /**
   * Get the geometry detail level based on current quality
   * @param baseDetail Base detail level (1.0 = normal)
   * @returns Adjusted detail level based on current quality
   */
  protected getGeometryDetail(baseDetail: number): number {
    // If LOD manager is available, use it to determine geometry detail
    if (this.lodManager) {
      return this.lodManager.getGeometryDetail(baseDetail, this.distanceToCamera);
    }
    
    // Otherwise scale based on quality scale and distance
    let detail = baseDetail * this.qualityScale;
    
    // Apply distance-based scaling
    if (this.distanceToCamera > 50) {
      detail *= Math.max(0.25, 1 - (this.distanceToCamera - 50) / 100);
    }
    
    return detail;
  }
  
  /**
   * Start performance monitoring for a named section
   * @param sectionName Name of the code section to monitor
   */
  protected beginPerformanceSection(sectionName: string): void {
    if (this.performanceMonitor) {
      console.time(`perf:${sectionName}`);
    }
  }
  
  /**
   * End performance monitoring for a named section
   * @param sectionName Name of the code section being monitored
   */
  protected endPerformanceSection(sectionName: string): void {
    if (this.performanceMonitor) {
      console.timeEnd(`perf:${sectionName}`);
    }
  }
}