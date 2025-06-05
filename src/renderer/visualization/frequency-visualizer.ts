import * as THREE from 'three';
import { BaseVisualization } from './base-visualization';
import { AudioAnalysisData } from '../../shared/types';
import { COLOR_PALETTES } from '../../shared/constants';

/**
 * Frequency spectrum visualization
 * Creates a circular frequency spectrum visualization with reactive elements
 */
export class FrequencyVisualizer extends BaseVisualization {
  private bars: THREE.Mesh[] = [];
  private barGroup: THREE.Group | null = null;
  private readonly numBars = 128;
  private readonly radius = 3;
  private readonly maxBarHeight = 2;
  private colors: string[] = [];
  
  constructor(scene: THREE.Scene) {
    super(scene);
    console.log("Creating FrequencyVisualizer");
    this.colors = COLOR_PALETTES.cosmic;
    
    // Add frequency-specific uniforms
    this.uniforms.frequencyData = { value: new Float32Array(this.numBars) };
    this.uniforms.colorPalette = { value: this.createColorArray(this.colors) };
  }
  
  /**
   * Initialize the visualization
   */
  init(): void {
    console.log("FrequencyVisualizer.init() called");
    super.init();
    
    // Create a group to hold all bars
    this.barGroup = new THREE.Group();
    this.addObject(this.barGroup);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.addObject(ambientLight);
    
    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(0, 0, 5);
    this.addObject(pointLight);
    
    // Create bars
    this.createBars();
    
    // Add background
    this.createBackground();
    
    console.log("FrequencyVisualizer initialized, scene children count:", this.scene.children.length);
  }
  
  /**
   * Create frequency bars arranged in a circle
   */
  private createBars(): void {
    if (!this.barGroup) return;
    
    console.log("Creating frequency bars");
    
    const barWidth = 0.05;
    const barDepth = 0.05;
    
    // Clear any existing bars
    this.bars = [];
    
    for (let i = 0; i < this.numBars; i++) {
      // Calculate angle and position on the circle
      const angle = (i / this.numBars) * Math.PI * 2;
      const x = Math.cos(angle) * this.radius;
      const z = Math.sin(angle) * this.radius;
      
      // Create geometry and material
      const geometry = new THREE.BoxGeometry(barWidth, 0.1, barDepth);
      
      // Determine color based on position in the spectrum
      const colorIndex = Math.floor((i / this.numBars) * (this.colors.length - 1));
      const color = new THREE.Color(this.colors[colorIndex]);
      
      const material = new THREE.MeshPhongMaterial({
        color,
        shininess: 100,
        emissive: color.clone().multiplyScalar(0.2),
      });
      
      // Create mesh and set initial position
      const bar = new THREE.Mesh(geometry, material);
      bar.position.set(x, 0, z);
      
      // Rotate to face center
      bar.lookAt(0, 0, 0);
      
      // Add to group
      this.barGroup.add(bar);
      
      // Add to tracking arrays
      this.bars.push(bar);
      this.materials.push(material);
    }
    
    console.log("Created", this.bars.length, "frequency bars");
  }
  
  /**
   * Create a cosmic background
   */
  private createBackground(): void {
    console.log("Creating cosmic background");
    
    // Add a starfield background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    
    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
      const x = THREE.MathUtils.randFloatSpread(20);
      const y = THREE.MathUtils.randFloatSpread(20);
      const z = THREE.MathUtils.randFloatSpread(20) - 10; // Push stars behind the visualization
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    this.addObject(starField);
    this.materials.push(starsMaterial);
    
    // Add a cosmic nebula
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
        
        // Create a cosmic nebula effect
        float speed = time * 0.05;
        float scale = 3.0 + sin(time * 0.1) * 0.5;
        
        // Add beat reactivity
        scale += beat * 0.5;
        
        // Create several layers of noise
        float noise1 = snoise(p * scale + vec2(speed, speed * 0.5));
        float noise2 = snoise(p * scale * 2.0 + vec2(-speed * 1.5, speed * 0.2));
        float noise3 = snoise(p * scale * 0.5 + vec2(speed * 0.3, -speed * 0.4));
        
        float combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) * 0.5 + 0.5;
        
        // Create color gradient
        vec3 color1 = vec3(0.1, 0.0, 0.2); // Deep purple
        vec3 color2 = vec3(0.4, 0.1, 0.6); // Violet
        vec3 color3 = vec3(0.0, 0.2, 0.5); // Deep blue
        
        // Mix colors based on noise
        vec3 color = mix(color1, color2, combinedNoise);
        color = mix(color, color3, noise2 * 0.5 + 0.25);
        
        // Add volume reactivity
        color += volume * 0.5;
        
        // Add vignette effect
        float vignette = 1.0 - dot(p, p) * 0.5;
        color *= vignette;
        
        // Add stars
        float stars = pow(snoise(p * 50.0 + time * 0.01), 10.0) * 0.8;
        stars += pow(snoise(p * 100.0 - time * 0.02), 20.0) * 0.6;
        
        color += vec3(stars);
        
        // Add glow on beat
        if (beat > 0.5) {
          color += vec3(0.1, 0.0, 0.2) * beat;
        }
        
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
    if (!this.barGroup) return;
    
    // Update frequency data uniform
    this.uniforms.frequencyData.value = audioData.frequencyData;
    
    // Get frequency data for visualization
    const frequencyData = audioData.frequencyData;
    const binSize = Math.floor(frequencyData.length / this.numBars);
    
    // Update each bar
    for (let i = 0; i < this.numBars; i++) {
      const bar = this.bars[i];
      if (!bar) continue;
      
      // Calculate average value for this frequency bin
      let sum = 0;
      const startBin = i * binSize;
      const endBin = startBin + binSize;
      
      for (let j = startBin; j < endBin; j++) {
        if (j < frequencyData.length) {
          // Convert from dB to a normalized value (approximately)
          sum += (frequencyData[j] + 140) / 140;
        }
      }
      
      // Get the average and apply scaling
      const value = sum / binSize;
      const scaledValue = this.mapRange(value, 0, 1, 0.1, this.maxBarHeight);
      
      // Update bar height and scale
      bar.scale.y = scaledValue;
      
      // Center the bar vertically
      bar.position.y = scaledValue / 2;
      
      // Add some rotation based on volume and beat
      if (audioData.beat.detected) {
        bar.rotation.z += 0.02;
      }
    }
    
    // Rotate the bar group slowly
    if (this.barGroup) {
      this.barGroup.rotation.y += 0.001;
      
      // Add reactivity to the rotation
      if (audioData.beat.detected) {
        this.barGroup.rotation.y += 0.01 * audioData.beat.confidence;
      }
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    console.log("FrequencyVisualizer.dispose() called");
    
    // Clear references to bars
    this.bars = [];
    this.barGroup = null;
    
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