import * as THREE from 'three';
import { BaseVisualization } from './base-visualization';
import { AudioAnalysisData } from '../../shared/types';
import { COLOR_PALETTES } from '../../shared/constants';

/**
 * Waveform Visualization
 * Creates a visualization based on audio time-domain data (waveform)
 * with interactive shaders and beat reactivity
 */
export class WaveformVisualizer extends BaseVisualization {
  private waveformMesh: THREE.Mesh | null = null;
  private waveLinePoints: THREE.Vector3[] = [];
  private waveLineMesh: THREE.Line | null = null;
  private ripples: THREE.Mesh[] = [];
  private rippleGroup: THREE.Group | null = null;
  private colors: string[] = [];
  private readonly waveformResolution = 128;
  private readonly waveformAmplitude = 2.0;
  private readonly waveformWidth = 10.0;
  
  constructor(scene: THREE.Scene) {
    super(scene);
    console.log("Creating WaveformVisualizer");
    
    // Set up colors from palette
    this.colors = COLOR_PALETTES.cosmic;
    
    // Add waveform-specific uniforms
    this.uniforms.waveformData = { value: new Float32Array(this.waveformResolution) };
    this.uniforms.colorPalette = { value: this.createColorArray(this.colors) };
    this.uniforms.waveAmplitude = { value: this.waveformAmplitude };
    this.uniforms.waveWidth = { value: this.waveformWidth };
  }
  
  /**
   * Initialize the visualization
   */
  init(): void {
    console.log("WaveformVisualizer.init() called");
    super.init();
    
    // Create a group to hold ripple effects
    this.rippleGroup = new THREE.Group();
    this.addObject(this.rippleGroup);
    
    // Add ambient and point lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.addObject(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(0, 2, 5);
    this.addObject(pointLight);
    
    // Create waveform visualization elements
    this.createWaveformMesh();
    this.createWaveformLine();
    
    // Create background
    this.createBackground();
    
    console.log("WaveformVisualizer initialized, scene children count:", this.scene.children.length);
  }
  
  /**
   * Create main waveform surface mesh with shaders
   */
  private createWaveformMesh(): void {
    console.log("Creating waveform mesh");
    
    // Create a plane geometry for the waveform surface
    const waveGeometry = new THREE.PlaneGeometry(this.waveformWidth, 5, this.waveformResolution, 1);
    
    // Define shaders for the waveform surface
    const waveVertexShader = `
      uniform float time;
      uniform float beat;
      uniform float volume;
      uniform float waveAmplitude;
      uniform float waveWidth;
      uniform float[${this.waveformResolution}] waveformData;
      varying vec2 vUv;
      varying float vHeight;
      
      void main() {
        vUv = uv;
        
        // Calculate position in the waveform array
        float waveIndex = position.x / waveWidth * ${this.waveformResolution - 1}. + ${(this.waveformResolution - 1) / 2}.;
        int index = int(waveIndex);
        
        // Get waveform value and calculate displacement
        float waveValue = 0.0;
        if (index >= 0 && index < ${this.waveformResolution}) {
          waveValue = waveformData[index];
        }
        
        // Apply displacement to y-coordinate
        float displacement = waveValue * waveAmplitude;
        
        // Add effects based on beat and time
        displacement += sin(position.x * 2.0 + time * 3.0) * 0.1 * beat;
        
        // Store height for fragment shader
        vHeight = displacement;
        
        // Apply displacement
        vec3 newPosition = position;
        newPosition.y = displacement;
        
        // Standard transformation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
    
    const waveFragmentShader = `
      uniform float time;
      uniform float beat;
      uniform float volume;
      uniform vec3 colorPalette[6];
      varying vec2 vUv;
      varying float vHeight;
      
      // Function to get color from palette
      vec3 getGradientColor(float value) {
        value = clamp(value, 0.0, 0.999);
        float indexFloat = value * 5.0;
        int index = int(floor(indexFloat));
        float mix_factor = fract(indexFloat);
        return mix(colorPalette[index], colorPalette[index + 1], mix_factor);
      }
      
      void main() {
        // Normalize height for color mapping
        float normHeight = (vHeight + waveAmplitude) / (2.0 * waveAmplitude);
        
        // Get base color from palette
        vec3 color = getGradientColor(normHeight);
        
        // Add time-based color variation
        float shimmer = sin(vUv.x * 50.0 + time * 2.0) * 0.5 + 0.5;
        color += shimmer * 0.1;
        
        // Add beat effect
        if (beat > 0.5) {
          color += vec3(0.2, 0.05, 0.3) * beat;
        }
        
        // Add volume response
        color += volume * 0.2;
        
        // Add glowing edges
        float edge = smoothstep(0.4, 0.5, abs(vHeight));
        color += edge * vec3(0.5, 0.2, 0.8) * (0.5 + 0.5 * sin(time * 3.0));
        
        // Final color with slight transparency
        gl_FragColor = vec4(color, 0.9);
      }
    `;
    
    // Create shader material
    const waveMaterial = this.createShaderMaterial(waveVertexShader, waveFragmentShader);
    waveMaterial.side = THREE.DoubleSide;
    waveMaterial.transparent = true;
    
    // Create mesh and add to scene
    this.waveformMesh = new THREE.Mesh(waveGeometry, waveMaterial);
    this.waveformMesh.position.z = 0;
    this.waveformMesh.rotation.x = -Math.PI / 6; // Tilt slightly
    this.addObject(this.waveformMesh);
  }
  
  /**
   * Create line representation of the waveform
   */
  private createWaveformLine(): void {
    console.log("Creating waveform line");
    
    // Create points for the line
    const lineGeometry = new THREE.BufferGeometry();
    
    // Initialize points at 0 height
    this.waveLinePoints = [];
    for (let i = 0; i < this.waveformResolution; i++) {
      const x = (i / (this.waveformResolution - 1)) * this.waveformWidth - this.waveformWidth / 2;
      this.waveLinePoints.push(new THREE.Vector3(x, 0, 0));
    }
    
    lineGeometry.setFromPoints(this.waveLinePoints);
    
    // Create neon-like material
    const lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.colors[3]),
      linewidth: 2,
    });
    
    this.materials.push(lineMaterial);
    
    // Create line and position it slightly above the mesh
    this.waveLineMesh = new THREE.Line(lineGeometry, lineMaterial);
    this.waveLineMesh.position.z = 0.1;
    this.waveLineMesh.position.y = 0.1;
    this.waveLineMesh.rotation.x = -Math.PI / 6; // Match mesh tilt
    this.addObject(this.waveLineMesh);
  }
  
  /**
   * Create ripple effect when beats are detected
   */
  private createRipple(intensity: number): void {
    if (!this.rippleGroup) return;
    
    // Create a ring geometry
    const ringGeometry = new THREE.RingGeometry(0.1, 0.2, 32);
    
    // Get color based on intensity
    const colorIndex = Math.floor(intensity * (this.colors.length - 1));
    const color = new THREE.Color(this.colors[colorIndex]);
    
    // Create material with glow effect
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    
    this.materials.push(ringMaterial);
    
    // Create mesh
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Position at random location along waveform
    const xPos = (Math.random() - 0.5) * this.waveformWidth;
    const yPos = Math.random() * 2 - 1;
    
    ring.position.set(xPos, yPos, 0.2);
    ring.rotation.x = -Math.PI / 6; // Match waveform tilt
    
    // Store reference for animation
    ring.userData = {
      createTime: this.clock.getElapsedTime(),
      duration: 1.0 + Math.random(), // Random duration
      maxScale: 2.0 + intensity * 3.0, // Scale based on intensity
      material: ringMaterial,
    };
    
    // Add to scene and tracking
    this.rippleGroup.add(ring);
    this.ripples.push(ring);
  }
  
  /**
   * Create animated background for waveform
   */
  private createBackground(): void {
    console.log("Creating waveform background");
    
    // Create a backdrop with shaders
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
        
        // Create wave-like background patterns
        float speed = time * 0.2;
        float scale = 4.0 + sin(time * 0.1) * 0.5;
        
        // Add beat reactivity
        scale += beat * 0.7;
        
        // Create wave pattern
        float waves = sin(p.x * 10.0 + time) * 0.05 + 
                      sin(p.y * 8.0 - time * 0.5) * 0.05;
        
        // Add noise layers
        float noise1 = snoise(p * scale + vec2(speed, 0.0));
        float noise2 = snoise(p * scale * 1.5 + vec2(-speed * 0.5, speed * 0.2));
        
        float pattern = waves + noise1 * 0.3 + noise2 * 0.2;
        
        // Create color gradient for waveform-style background
        vec3 darkColor = vec3(0.05, 0.0, 0.1); // Deep indigo
        vec3 midColor = vec3(0.2, 0.05, 0.3);  // Purple
        vec3 brightColor = vec3(0.5, 0.2, 0.7); // Violet
        
        // Mix colors based on position and pattern
        vec3 color = mix(darkColor, midColor, (p.y + 1.0) * 0.5);
        color = mix(color, brightColor, pow(abs(pattern), 2.0));
        
        // Add horizontal scan lines
        float scanline = sin(p.y * 50.0) * 0.5 + 0.5;
        scanline = pow(scanline, 8.0) * 0.15;
        color += vec3(scanline);
        
        // Add volume reactivity
        color += volume * 0.2 * vec3(0.3, 0.1, 0.5);
        
        // Add beat glow
        if (beat > 0.5) {
          color += vec3(0.2, 0.0, 0.3) * beat;
        }
        
        // Add vignette effect
        float vignette = 1.0 - dot(p, p) * 0.5;
        color *= vignette;
        
        gl_FragColor = vec4(color, 0.9);
      }
    `;
    
    // Create a plane for the background
    const bgGeometry = new THREE.PlaneGeometry(20, 20);
    const bgMaterial = this.createShaderMaterial(bgVertexShader, bgFragmentShader);
    bgMaterial.transparent = true;
    bgMaterial.depthWrite = false;
    
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.z = -5;
    this.addObject(background);
  }
  
  /**
   * Update visualization with new audio data
   */
  protected updateVisualization(audioData: AudioAnalysisData): void {
    // Create dummy data if timeData is not available
    const timeData = audioData.timeData || new Float32Array(128).fill(0);
    
    // Update waveform data uniform
    this.updateWaveformData(timeData);
    
    // Update the line representation
    this.updateWaveformLine(timeData);
    
    // Update ripple effects
    this.updateRipples();
    
    // Create new ripples on beat
    if (audioData.beat.detected) {
      const intensity = audioData.beat.confidence;
      const rippleCount = Math.ceil(intensity * 3); // Create 1-3 ripples based on intensity
      
      for (let i = 0; i < rippleCount; i++) {
        this.createRipple(intensity);
      }
    }
  }
  
  /**
   * Process and update waveform data
   */
  private updateWaveformData(timeData: Float32Array): void {
    // Process the raw time domain data for visualization
    const waveformData = new Float32Array(this.waveformResolution);
    
    // Downsample the time data to our visualization resolution
    const step = Math.floor(timeData.length / this.waveformResolution);
    
    for (let i = 0; i < this.waveformResolution; i++) {
      const dataIndex = i * step;
      if (dataIndex < timeData.length) {
        waveformData[i] = timeData[dataIndex];
      }
    }
    
    // Update the uniform
    this.uniforms.waveformData.value = waveformData;
  }
  
  /**
   * Update the line representation of the waveform
   */
  private updateWaveformLine(timeData: Float32Array): void {
    if (!this.waveLineMesh) return;
    
    const lineGeometry = this.waveLineMesh.geometry;
    const positions = lineGeometry.getAttribute('position') as THREE.BufferAttribute;
    
    // Update each point in the line
    const step = Math.floor(timeData.length / this.waveformResolution);
    
    for (let i = 0; i < this.waveformResolution; i++) {
      const dataIndex = i * step;
      let y = 0;
      
      if (dataIndex < timeData.length) {
        y = timeData[dataIndex] * this.waveformAmplitude;
      }
      
      // Update point position
      positions.setY(i, y);
    }
    
    positions.needsUpdate = true;
  }
  
  /**
   * Update ripple animations
   */
  private updateRipples(): void {
    if (!this.rippleGroup) return;
    
    const currentTime = this.clock.getElapsedTime();
    const ripplesToRemove = [];
    
    // Update each ripple
    for (const ripple of this.ripples) {
      const data = ripple.userData;
      const age = currentTime - data.createTime;
      const progress = age / data.duration;
      
      if (progress >= 1.0) {
        // Mark for removal
        ripplesToRemove.push(ripple);
      } else {
        // Update scale
        const scale = data.maxScale * progress;
        ripple.scale.set(scale, scale, scale);
        
        // Update opacity (fade out)
        data.material.opacity = 0.8 * (1 - progress);
      }
    }
    
    // Remove completed ripples
    for (const ripple of ripplesToRemove) {
      this.rippleGroup.remove(ripple);
      this.ripples = this.ripples.filter(r => r !== ripple);
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    console.log("WaveformVisualizer.dispose() called");
    
    // Clear references
    this.waveformMesh = null;
    this.waveLineMesh = null;
    this.waveLinePoints = [];
    this.ripples = [];
    this.rippleGroup = null;
    
    // Call base class dispose
    super.dispose();
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