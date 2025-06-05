import * as THREE from 'three';
import { BaseVisualization } from './base-visualization';
import { AudioAnalysisData } from '../../shared/types';
import { COLOR_PALETTES } from '../../shared/constants';
import { LodManager } from '../utils/lod-manager';
import { PerformanceMonitor } from '../utils/performance-monitor';

/**
 * Particle system visualization
 * Creates an interactive particle system that reacts to audio data
 */
export class ParticleVisualizer extends BaseVisualization {
  private particleSystem: THREE.Points | null = null;
  private baseParticleCount: number = 2000;
  private particleCount: number = 2000;
  private particleGeometry: THREE.BufferGeometry | null = null;
  private colors: string[] = [];
  private particlePositions: Float32Array | null = null;
  private particleSizes: Float32Array | null = null;
  private velocities: Float32Array | null = null;
  private particleGroup: THREE.Group | null = null;
  
  // Optimization flags
  private needsPositionUpdate: boolean = true;
  private needsSizeUpdate: boolean = true;
  private updateInterval: number = 1; // Update every frame by default
  private updateCounter: number = 0;
  private activeBatch: number = 0; // For batched updates
  private batchCount: number = 4; // Split updates into this many batches
  private activeParticleCount: number = 0; // Number of actually active particles
  private lastBeatTime: number = 0;
  
  // Parameters for particle behavior
  private centerAttraction: number = 0.01;
  private randomMotion: number = 0.02;
  private beatImpact: number = 0.2;
  private maxDistance: number = 10;

  constructor(scene: THREE.Scene, lodManager?: LodManager, performanceMonitor?: PerformanceMonitor) {
    super(scene, lodManager, performanceMonitor);
    console.log("Creating ParticleVisualizer");
    
    // Set up colors from palette
    this.colors = COLOR_PALETTES.cosmic;
    
    // Add particle-specific uniforms
    this.uniforms.particleSize = { value: 1.0 };
    this.uniforms.colorPalette = { value: this.createColorArray(this.colors) };
    this.uniforms.energyLevel = { value: 0.0 };
    
    // Apply performance-based settings
    this.updatePerformanceSettings();
  }
  
  /**
   * Update settings based on performance profile
   */
  private updatePerformanceSettings(): void {
    // Adjust particle count based on LOD
    if (this.lodManager) {
      this.particleCount = this.getParticleCount(this.baseParticleCount);
      this.updateInterval = this.lodManager.getCurrentLodLevel().updateFrequency;
      
      // Lower effect complexity means fewer batches (less work spread across more frames)
      const complexity = this.lodManager.getEffectComplexity();
      this.batchCount = Math.max(1, Math.floor(8 * complexity));
    }
  }
  
  /**
   * Initialize the visualization
   */
  init(): void {
    console.log("ParticleVisualizer.init() called");
    super.init();
    
    // Create a group to hold all particles
    this.particleGroup = new THREE.Group();
    this.addObject(this.particleGroup);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.addObject(ambientLight);
    
    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(0, 5, 5);
    this.addObject(pointLight);
    
    // Create particle system
    this.createParticleSystem();
    
    // Add glowing background
    this.createBackground();
    
    console.log("ParticleVisualizer initialized, scene children count:", this.scene.children.length);
  }
  
  /**
   * Create particle system
   */
  private createParticleSystem(): void {
    if (!this.particleGroup) return;
    
    // Start performance monitoring
    this.beginPerformanceSection('createParticleSystem');
    
    console.log("Creating particle system");
    
    // Update particle count based on performance profile
    this.updatePerformanceSettings();
    this.activeParticleCount = this.particleCount;
    
    // Initialize arrays for particle data - allocate maximum possible size
    this.particleGeometry = new THREE.BufferGeometry();
    // Use maximum possible size to avoid resizing the buffers
    const maxParticleCount = this.baseParticleCount;
    this.particlePositions = new Float32Array(maxParticleCount * 3);
    this.particleSizes = new Float32Array(maxParticleCount);
    this.velocities = new Float32Array(maxParticleCount * 3);
    
    // Initialize particle positions, sizes, and velocities
    for (let i = 0; i < maxParticleCount; i++) {
      // Only fully initialize particles that are active based on current quality level
      const isActive = i < this.activeParticleCount;
      
      // Position (random sphere)
      const radius = isActive ? Math.random() * 5 : 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      const idx = i * 3;
      this.particlePositions[idx] = x;
      this.particlePositions[idx + 1] = y;
      this.particlePositions[idx + 2] = z;
      
      // Size (varying for active particles, zero for inactive)
      this.particleSizes[i] = isActive ? (Math.random() * 0.5 + 0.5) : 0;
      
      // Initial velocity (small random for active, zero for inactive)
      this.velocities[idx] = isActive ? (Math.random() - 0.5) * 0.02 : 0;
      this.velocities[idx + 1] = isActive ? (Math.random() - 0.5) * 0.02 : 0;
      this.velocities[idx + 2] = isActive ? (Math.random() - 0.5) * 0.02 : 0;
    }
    
    // Set attributes in geometry
    const positionAttribute = new THREE.BufferAttribute(this.particlePositions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage); // Mark as dynamic for frequent updates
    this.particleGeometry.setAttribute('position', positionAttribute);
    
    const sizeAttribute = new THREE.BufferAttribute(this.particleSizes, 1);
    sizeAttribute.setUsage(THREE.DynamicDrawUsage); // Mark as dynamic for frequent updates
    this.particleGeometry.setAttribute('size', sizeAttribute);
    
    // Set draw range to limit rendering to active particles only
    this.particleGeometry.setDrawRange(0, this.activeParticleCount);
    
    // End performance monitoring
    this.endPerformanceSection('createParticleSystem');
    
    // Define shader for particles
    const particleVertexShader = `
      uniform float time;
      uniform float beat;
      uniform float volume;
      uniform float particleSize;
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      
      // Function to generate a color based on position
      vec3 getColor(vec3 position) {
        // Distance from center
        float dist = length(position);
        
        // Normalize distance (0-1)
        float normDist = clamp(dist / 10.0, 0.0, 1.0);
        
        // Create colors based on distance
        vec3 colorA = vec3(0.2, 0.0, 0.5);  // Deep purple (center)
        vec3 colorB = vec3(0.6, 0.1, 0.9);  // Bright purple (mid)
        vec3 colorC = vec3(0.9, 0.5, 1.0);  // Light purple/pink (outer)
        
        // Mix colors based on distance
        vec3 color = mix(colorA, colorB, normDist * 2.0);
        color = normDist > 0.5 ? mix(colorB, colorC, (normDist - 0.5) * 2.0) : color;
        
        // Add time variation
        float pulse = sin(time * 2.0 + dist * 3.0) * 0.2 + 0.8;
        color *= pulse;
        
        // Adjust color on beat
        if (beat > 0.5) {
          color *= 1.3;
        }
        
        return color;
      }
      
      void main() {
        // Get particle position
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Calculate particle size based on position and audio
        float sizeMultiplier = 1.0 + volume * 2.0 + beat * 0.5;
        float pSize = size * particleSize * sizeMultiplier;
        
        // Adjust size based on distance (closer particles appear larger)
        pSize *= (20.0 / -mvPosition.z);
        
        // Set the point size
        gl_PointSize = pSize;
        
        // Standard projection
        gl_Position = projectionMatrix * mvPosition;
        
        // Pass color to fragment shader
        vColor = getColor(position);
        
        // Calculate alpha based on distance from center
        vAlpha = mix(1.0, 0.5, length(position) / 10.0);
        
        // Boost alpha on beat
        vAlpha = mix(vAlpha, 1.0, beat * 0.7);
      }
    `;
    
    const particleFragmentShader = `
      uniform float time;
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        // Calculate distance from particle center
        vec2 center = vec2(0.5, 0.5);
        float dist = length(gl_PointCoord - center);
        
        // Create soft particle effect
        float alpha = smoothstep(0.5, 0.3, dist) * vAlpha;
        
        // Add glow effect
        vec3 color = vColor;
        color += vColor * smoothstep(0.5, 0.3, dist) * 0.5;
        
        // Apply color and alpha
        gl_FragColor = vec4(color, alpha);
      }
    `;
    
    // Create shader material
    const particleMaterial = this.createShaderMaterial(
      particleVertexShader, 
      particleFragmentShader
    );
    
    particleMaterial.transparent = true;
    particleMaterial.depthWrite = false;
    particleMaterial.blending = THREE.AdditiveBlending;
    
    // Create the particle system
    this.particleSystem = new THREE.Points(this.particleGeometry, particleMaterial);
    this.particleGroup.add(this.particleSystem);
  }
  
  /**
   * Create a cosmic background for particles
   */
  private createBackground(): void {
    console.log("Creating particle background");
    
    // Create a particle nebula background
    const bgVertexShader = `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const bgFragmentShader = `
      uniform float time;
      uniform float beat;
      uniform float volume;
      uniform float energyLevel;
      varying vec2 vUv;
      
      // Simplex noise function
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                            0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                            -0.577350269189626,  // -1.0 + 2.0 * C.x
                            0.024390243902439); // 1.0 / 41.0
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i); // Avoid truncation effects in permutation
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
      
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
      
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
      
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        
        // Create energy flow effect with noise
        float speed = time * 0.1;
        float energyScale = 3.0 + energyLevel * 2.0 + sin(time * 0.2) * 0.5;
        
        // Add beat reactivity
        energyScale += beat * 0.8;
        
        // Create energy flows with multiple noise layers
        float noise1 = snoise(p * energyScale + vec2(speed, speed * 0.2));
        float noise2 = snoise(p * energyScale * 1.5 + vec2(-speed * 0.7, speed * 0.5));
        float noise3 = snoise(p * energyScale * 0.8 + vec2(speed * 0.5, -speed * 0.6));
        
        float energyFlow = (noise1 + noise2 * 0.4 + noise3 * 0.2) * 0.5 + 0.5;
        
        // Create particle energy field color gradient
        vec3 darkColor = vec3(0.1, 0.0, 0.2); // Deep purple
        vec3 midColor = vec3(0.3, 0.05, 0.5); // Medium purple
        vec3 brightColor = vec3(0.6, 0.2, 0.9); // Light purple
        
        // Mix colors based on energy flow
        vec3 color = mix(darkColor, midColor, energyFlow);
        color = mix(color, brightColor, pow(energyFlow, 3.0) * 0.7);
        
        // Add volume reactivity
        color += volume * 0.3 * vec3(0.5, 0.1, 0.7);
        
        // Add beat glow
        if (beat > 0.5) {
          color += vec3(0.2, 0.05, 0.3) * beat;
        }
        
        // Add vignette effect
        float vignette = 1.0 - dot(p, p) * 0.7;
        color *= vignette;
        
        // Create energy aura with subtle variation
        float aura = pow(sin(time * 0.5) * 0.5 + 0.5, 2.0) * 0.1;
        color += vec3(0.3, 0.1, 0.5) * aura;
        
        gl_FragColor = vec4(color, 0.85);
      }
    `;
    
    // Create a plane for the background
    const bgGeometry = new THREE.PlaneGeometry(20, 20);
    const bgMaterial = this.createShaderMaterial(bgVertexShader, bgFragmentShader);
    bgMaterial.transparent = true;
    bgMaterial.depthWrite = false;
    bgMaterial.blending = THREE.AdditiveBlending;
    
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.z = -5;
    this.addObject(background);
  }
  
  /**
   * Update visualization with new audio data
   */
  protected updateVisualization(audioData: AudioAnalysisData): void {
    if (!this.particleSystem || !this.particlePositions || !this.velocities || !this.particleGeometry) return;
    
    // Start performance monitoring
    this.beginPerformanceSection('updateParticles');
    
    // Extract useful audio data
    const frequencyData = audioData.frequencyData;
    const volume = audioData.volume;
    const isBeat = audioData.beat.detected;
    const beatConfidence = audioData.beat.confidence;
    const currentTime = this.clock.getElapsedTime();
    
    // Update quality settings if needed
    if (this.lodManager && this.qualityScale !== this.lodManager.getEffectComplexity()) {
      this.updatePerformanceSettings();
      
      // Update active particle count based on LOD
      const newActiveCount = this.getParticleCount(this.baseParticleCount);
      if (newActiveCount !== this.activeParticleCount) {
        this.activeParticleCount = newActiveCount;
        this.particleGeometry.setDrawRange(0, this.activeParticleCount);
        
        // If we're increasing count, initialize new particles
        if (newActiveCount > this.particleCount) {
          for (let i = this.particleCount; i < newActiveCount; i++) {
            const idx = i * 3;
            // Position (random sphere)
            const radius = Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            this.particlePositions[idx] = radius * Math.sin(phi) * Math.cos(theta);
            this.particlePositions[idx + 1] = radius * Math.sin(phi) * Math.sin(theta);
            this.particlePositions[idx + 2] = radius * Math.cos(phi);
            
            // Size
            this.particleSizes[i] = Math.random() * 0.5 + 0.5;
            
            // Initial velocity
            this.velocities[idx] = (Math.random() - 0.5) * 0.02;
            this.velocities[idx + 1] = (Math.random() - 0.5) * 0.02;
            this.velocities[idx + 2] = (Math.random() - 0.5) * 0.02;
          }
        }
        
        this.particleCount = newActiveCount;
        this.needsPositionUpdate = true;
        this.needsSizeUpdate = true;
      }
    }
    
    // Update energy level uniform
    const energyLevel = this.calculateEnergyLevel(frequencyData);
    this.uniforms.energyLevel.value = energyLevel;
    this.uniforms.particleSize.value = 1.0 + volume * 2.0;
    
    // Increment update counter
    this.updateCounter++;
    
    // Check if we should update this batch of particles
    const shouldUpdateBatch = (this.updateCounter % this.updateInterval === 0);
    
    // Force update on beat for better reactivity
    const timeSinceLastBeat = currentTime - this.lastBeatTime;
    if (isBeat && beatConfidence > 0.5 && timeSinceLastBeat > 0.1) {
      this.lastBeatTime = currentTime;
      this.needsPositionUpdate = true;
      this.needsSizeUpdate = true;
    }
    
    // Apply beat impulse to particles
    const beatImpulseStrength = isBeat ? this.beatImpact * beatConfidence : 0;
    
    // Get positions array to update
    const positions = this.particlePositions;
    const positionAttribute = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    
    // Calculate batch bounds for this update
    const particlesPerBatch = Math.ceil(this.particleCount / this.batchCount);
    const startIdx = this.activeBatch * particlesPerBatch;
    const endIdx = Math.min(startIdx + particlesPerBatch, this.particleCount);
    
    // Only update if we need to
    if (shouldUpdateBatch || this.needsPositionUpdate) {
      // Update particles in the current batch
      for (let i = startIdx; i < endIdx; i++) {
        const idx = i * 3;
        
        // Current position
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];
        
        // Calculate distance from center
        const distance = Math.sqrt(x*x + y*y + z*z);
        
        // Skip particles that are too far away or inactive
        if (distance === 0 && i >= this.activeParticleCount) continue;
        
        // Center attraction force (stronger when further)
        let fx = -x * this.centerAttraction * distance;
        let fy = -y * this.centerAttraction * distance;
        let fz = -z * this.centerAttraction * distance;
        
        // Add random motion - scale down for performance on low-end devices
        const randomScale = this.qualityScale;
        fx += (Math.random() - 0.5) * this.randomMotion * randomScale;
        fy += (Math.random() - 0.5) * this.randomMotion * randomScale;
        fz += (Math.random() - 0.5) * this.randomMotion * randomScale;
        
        // On beat, add outward explosion force
        if (isBeat) {
          const beatDirection = Math.random() > 0.5 ? 1 : -1;
          fx += (x / (distance + 0.001)) * beatImpulseStrength * beatDirection;
          fy += (y / (distance + 0.001)) * beatImpulseStrength * beatDirection;
          fz += (z / (distance + 0.001)) * beatImpulseStrength * beatDirection;
        }
        
        // Apply force to velocity
        this.velocities[idx] += fx;
        this.velocities[idx + 1] += fy;
        this.velocities[idx + 2] += fz;
        
        // Apply some damping to velocity
        this.velocities[idx] *= 0.95;
        this.velocities[idx + 1] *= 0.95;
        this.velocities[idx + 2] *= 0.95;
        
        // Update position
        positions[idx] += this.velocities[idx];
        positions[idx + 1] += this.velocities[idx + 1];
        positions[idx + 2] += this.velocities[idx + 2];
        
        // Keep particles within bounds
        const newDistance = Math.sqrt(
          positions[idx]*positions[idx] + 
          positions[idx+1]*positions[idx+1] + 
          positions[idx+2]*positions[idx+2]
        );
        
        if (newDistance > this.maxDistance) {
          const scale = this.maxDistance / newDistance;
          positions[idx] *= scale;
          positions[idx + 1] *= scale;
          positions[idx + 2] *= scale;
        }
      }
      
      // Update particle geometry for this batch
      // Only update the part of the buffer that changed
      positionAttribute.updateRange.offset = startIdx * 3;
      positionAttribute.updateRange.count = (endIdx - startIdx) * 3;
      positionAttribute.needsUpdate = true;
      
      // Move to next batch for the next update
      this.activeBatch = (this.activeBatch + 1) % this.batchCount;
      
      // If we've gone through all batches, clear the flag
      if (this.activeBatch === 0) {
        this.needsPositionUpdate = false;
      }
    }
    
    // Update particle sizes on beat or when needed
    if (isBeat || this.needsSizeUpdate) {
      // Update sizes with audio reactivity
      const sizeAttribute = this.particleGeometry.getAttribute('size') as THREE.BufferAttribute;
      
      for (let i = 0; i < this.particleCount; i++) {
        // Make sizes react to volume and beat
        const baseSize = Math.random() * 0.5 + 0.5;
        this.particleSizes[i] = baseSize * (1.0 + volume * 2.0);
        
        // Increase size on beat
        if (isBeat) {
          this.particleSizes[i] *= 1.0 + beatConfidence * 0.5;
        }
      }
      
      sizeAttribute.needsUpdate = true;
      this.needsSizeUpdate = false;
    }
    
    // Slowly rotate the entire particle system
    if (this.particleGroup) {
      this.particleGroup.rotation.y += 0.001;
      this.particleGroup.rotation.x += 0.0005;
      
      // Add beat reactivity to rotation
      if (isBeat) {
        this.particleGroup.rotation.y += 0.01 * beatConfidence;
        this.particleGroup.rotation.z += 0.005 * beatConfidence;
      }
    }
    
    // End performance monitoring
    this.endPerformanceSection('updateParticles');
  }
  
  /**
   * Calculate energy level from frequency data
   */
  private calculateEnergyLevel(frequencyData: Float32Array): number {
    // Calculate overall energy by summing frequency bins
    // Focus on mid-range frequencies (where most musical energy is)
    let midRangeEnergy = 0;
    const startBin = Math.floor(frequencyData.length * 0.1);  // Skip lowest 10%
    const endBin = Math.floor(frequencyData.length * 0.7);    // Use up to 70%
    
    for (let i = startBin; i < endBin; i++) {
      // Convert from dB (-140 to 0 typically) to a 0-1 range
      const normalized = (frequencyData[i] + 140) / 140;
      midRangeEnergy += normalized;
    }
    
    // Normalize by bin count and scale
    return Math.min(1, midRangeEnergy / (endBin - startBin) * 2);
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    console.log("ParticleVisualizer.dispose() called");
    
    // Start performance monitoring
    this.beginPerformanceSection('dispose');
    
    // Explicitly dispose of geometry to free GPU memory
    if (this.particleGeometry) {
      this.particleGeometry.dispose();
    }
    
    // Clear all references
    this.particleSystem = null;
    this.particleGeometry = null;
    this.particlePositions = null;
    this.particleSizes = null;
    this.velocities = null;
    this.particleGroup = null;
    
    // End performance monitoring
    this.endPerformanceSection('dispose');
    
    // Call base class dispose (which handles materials and scene clearing)
    super.dispose();
  }
  
  /**
   * Handle quality changes
   * This can be called when performance settings change
   */
  setLodManager(lodManager: LodManager): void {
    super.setLodManager(lodManager);
    
    // Update performance settings when LOD manager changes
    this.updatePerformanceSettings();
    
    // Update particle system if it already exists
    if (this.particleSystem && this.particleGeometry) {
      // Update active particle count
      const newActiveCount = this.getParticleCount(this.baseParticleCount);
      if (newActiveCount !== this.activeParticleCount) {
        this.activeParticleCount = newActiveCount;
        this.particleGeometry.setDrawRange(0, this.activeParticleCount);
        this.particleCount = newActiveCount;
        this.needsPositionUpdate = true;
        this.needsSizeUpdate = true;
      }
    }
  }
  
  /**
   * Create an array of THREE.Vector3 from color strings for shader use
   */
  private createColorArray(colors: string[]): THREE.Vector3[] {
    return colors.map(color => {
      const c = new THREE.Color(color);
      return new THREE.Vector3(c.r, c.g, c.b);
    });
  }
}