import * as THREE from 'three';
import { BaseVisualization } from './base-visualization';
import { AudioAnalysisData } from '../../shared/types';
import { COLOR_PALETTES } from '../../shared/constants';

/**
 * Cosmic Visualization
 * Creates an immersive cosmic/space visualization with nebulae, stars, and celestial objects
 * that react to audio data with cosmic events and visual effects
 */
export class CosmicVisualizer extends BaseVisualization {
  // Main scene elements
  private nebulaeGroup: THREE.Group | null = null;
  private starsGroup: THREE.Group | null = null;
  private celestialObjects: THREE.Object3D[] = [];
  private nebulaMaterials: THREE.ShaderMaterial[] = [];
  
  // Configuration parameters
  private readonly numStars = 2000;
  private readonly numCelestialObjects = 15;
  private readonly nebulaeCount = 3;
  private colors: string[] = [];
  private energyLevel: number = 0;
  private lastBeatTime: number = 0;
  
  // Cosmic events state
  private isSupernovaActive = false;
  private supernovaProgress = 0;
  private wormholeActive = false;
  private wormholeProgress = 0;

  constructor(scene: THREE.Scene) {
    super(scene);
    console.log("Creating CosmicVisualizer");
    
    // Set up colors from palette
    this.colors = COLOR_PALETTES.cosmic;
    
    // Add cosmic-specific uniforms
    this.uniforms.energyLevel = { value: 0.0 };
    this.uniforms.starBrightness = { value: 1.0 };
    this.uniforms.cosmicEvent = { value: 0.0 };
    this.uniforms.wormholeProgress = { value: 0.0 };
    this.uniforms.colorPalette = { value: this.createColorArray(this.colors) };
    this.uniforms.nebulaePositions = { value: [
      new THREE.Vector3(-3, 2, -10),
      new THREE.Vector3(4, -2, -12),
      new THREE.Vector3(0, -5, -8),
    ]};
  }
  
  /**
   * Initialize the visualization
   */
  init(): void {
    console.log("CosmicVisualizer.init() called");
    super.init();
    
    // Create cosmic scene elements
    this.createStarfield();
    this.createNebulae();
    this.createCelestialObjects();
    this.createCosmicBackground();
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x111122, 0.8);
    this.addObject(ambientLight);
    
    const blueLight = new THREE.PointLight(0x3333ff, 0.5);
    blueLight.position.set(-10, 5, 5);
    this.addObject(blueLight);
    
    const purpleLight = new THREE.PointLight(0x9933ff, 0.8);
    purpleLight.position.set(10, -5, 3);
    this.addObject(purpleLight);
    
    console.log("CosmicVisualizer initialized, scene children count:", this.scene.children.length);
  }
  
  /**
   * Create starfield with different star types and brightness
   */
  private createStarfield(): void {
    console.log("Creating cosmic starfield");
    this.starsGroup = new THREE.Group();
    
    // Create stars using instanced buffer geometry for efficiency
    const starGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const starMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(starMaterial);
    
    // Create different star type groups with different attributes
    // 1. Distant stars (small, numerous)
    const distantStarPositions = [];
    for (let i = 0; i < this.numStars * 0.7; i++) {
      const radius = 20 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) - 30; // Push back into the distance
      
      distantStarPositions.push(x, y, z);
    }
    
    const distantStarsGeometry = new THREE.BufferGeometry();
    distantStarsGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(distantStarPositions, 3)
    );
    
    const distantStarsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(distantStarsMaterial);
    
    const distantStars = new THREE.Points(distantStarsGeometry, distantStarsMaterial);
    this.starsGroup.add(distantStars);
    
    // 2. Bright foreground stars (larger, fewer)
    for (let i = 0; i < this.numStars * 0.2; i++) {
      const radius = 10 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) - 20;
      
      // Create star with random size
      const scale = 0.05 + Math.random() * 0.15;
      const star = new THREE.Mesh(starGeometry, starMaterial.clone());
      star.position.set(x, y, z);
      star.scale.set(scale, scale, scale);
      
      // Store any custom properties for animation
      star.userData.twinkleSpeed = 0.5 + Math.random() * 2;
      star.userData.twinklePhase = Math.random() * Math.PI * 2;
      
      this.starsGroup.add(star);
      this.materials.push(star.material as THREE.Material);
    }
    
    // 3. Colored stars (with slight hue variations)
    const coloredStarColors = [
      0xffdddd, // Reddish
      0xddddff, // Bluish
      0xffeedd, // Yellowish
      0xddffee, // Greenish
      0xeeddff, // Purplish
    ];
    
    for (let i = 0; i < this.numStars * 0.1; i++) {
      const radius = 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) - 15;
      
      // Select random color
      const colorIndex = Math.floor(Math.random() * coloredStarColors.length);
      const material = new THREE.MeshBasicMaterial({
        color: coloredStarColors[colorIndex],
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      
      // Create slightly larger star
      const scale = 0.1 + Math.random() * 0.2;
      const star = new THREE.Mesh(starGeometry, material);
      star.position.set(x, y, z);
      star.scale.set(scale, scale, scale);
      
      // Store custom properties
      star.userData.twinkleSpeed = 0.2 + Math.random();
      star.userData.twinklePhase = Math.random() * Math.PI * 2;
      star.userData.colorIndex = colorIndex;
      
      this.starsGroup.add(star);
      this.materials.push(material);
    }
    
    this.addObject(this.starsGroup);
  }
  
  /**
   * Create nebulae using shader-based volumetric rendering
   */
  private createNebulae(): void {
    console.log("Creating cosmic nebulae");
    this.nebulaeGroup = new THREE.Group();
    
    // Nebula vertex shader for volumetric effects
    const nebulaVertexShader = `
      uniform float time;
      uniform float beat;
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        
        // Slight movement based on time
        float displacement = sin(position.x * 2.0 + time * 0.2) * cos(position.z * 2.0 + time * 0.1) * 0.1;
        displacement *= 1.0 + beat * 0.3;
        
        // Apply displacement along normal
        vec3 newPosition = position + normal * displacement;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
    
    // Nebula fragment shader with volumetric cloud rendering
    const nebulaFragmentShader = `
      uniform float time;
      uniform float beat;
      uniform float volume;
      uniform float energyLevel;
      uniform float cosmicEvent;
      uniform vec3 colorPalette[6];
      varying vec2 vUv;
      varying vec3 vPosition;
      
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
      
      // 3D noise function
      float noise3D(vec3 p) {
        // Project 3D point onto multiple 2D planes and combine
        float xy = snoise(p.xy + vec2(0.0, 10.0));
        float yz = snoise(p.yz + vec2(10.0, 0.0));
        float xz = snoise(p.xz + vec2(0.0, 0.0));
        
        return (xy + yz + xz) / 3.0;
      }
      
      // Cloud density function
      float cloudDensity(vec3 p, float scale, float timeOffset) {
        float speed = time * 0.05 + timeOffset;
        
        // Layer multiple octaves of noise
        float density = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float totalAmplitude = 0.0;
        
        for (int i = 0; i < 5; i++) {
          // Add beat reactivity to the noise
          float beatMod = 1.0 + beat * 0.3 * float(i == 0);
          
          // Get noise value
          vec3 q = p * frequency * scale * beatMod + vec3(speed * (0.5 + float(i) * 0.1), speed * 0.3, speed * 0.2);
          density += amplitude * noise3D(q);
          
          // Update for next octave
          totalAmplitude += amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        
        // Normalize
        density /= totalAmplitude;
        
        // Enhance contrast
        density = pow(density * 0.5 + 0.5, 1.5) * 2.0 - 1.0;
        
        // Apply cosmic event effects (supernova or wormhole)
        density *= 1.0 + cosmicEvent * 0.5 * sin(time * 5.0 + length(p) * 2.0);
        
        return density;
      }
      
      void main() {
        // Get position data for 3D effects
        vec3 viewDir = normalize(vPosition);
        
        // Create a nebula cloud effect
        float density = cloudDensity(vPosition * 0.5, 1.0, 0.0);
        
        // Make density stronger near the center
        float radialGradient = 1.0 - smoothstep(0.0, 1.0, length(vUv * 2.0 - 1.0));
        density *= radialGradient;
        
        // Enhance with volume data
        density *= 1.0 + volume * 0.5;
        
        // Get colors for nebula
        vec3 nebulaColor1 = colorPalette[1]; // Deep purple
        vec3 nebulaColor2 = colorPalette[2]; // Medium purple
        vec3 nebulaColor3 = colorPalette[3]; // Light purple
        vec3 glowColor = colorPalette[4];    // Very light purple
        
        // Mix colors based on density
        vec3 color = mix(nebulaColor1, nebulaColor2, clamp(density * 0.5 + 0.5, 0.0, 1.0));
        color = mix(color, nebulaColor3, pow(clamp(density * 0.5 + 0.5, 0.0, 1.0), 2.0));
        
        // Add subtle glow for highlights
        color += glowColor * pow(max(0.0, density), 3.0) * (1.0 + beat * 0.5);
        
        // Add energy level glow
        color += nebulaColor3 * energyLevel * 0.3;
        
        // Add cosmic event burst
        if (cosmicEvent > 0.1) {
          color += glowColor * cosmicEvent * 0.7 * (0.5 + 0.5 * sin(time * 10.0));
        }
        
        // Adjust alpha based on density
        float alpha = smoothstep(0.0, 0.2, density) * 0.85;
        
        // Apply final color with transparency
        gl_FragColor = vec4(color, alpha);
      }
    `;
    
    // Create multiple nebulae at different positions
    for (let i = 0; i < this.nebulaeCount; i++) {
      // Get nebula position from uniforms
      const position = this.uniforms.nebulaePositions.value[i];
      
      // Create nebula geometry (slightly randomized)
      const size = 5 + Math.random() * 3;
      const nebulaGeometry = new THREE.SphereGeometry(size, 32, 32);
      
      // Create material with custom shaders
      const nebulaMaterial = this.createShaderMaterial(
        nebulaVertexShader, 
        nebulaFragmentShader
      );
      
      nebulaMaterial.transparent = true;
      nebulaMaterial.depthWrite = false;
      nebulaMaterial.blending = THREE.AdditiveBlending;
      this.nebulaMaterials.push(nebulaMaterial);
      
      // Create mesh and position it
      const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
      nebula.position.copy(position);
      
      // Add some random rotation
      nebula.rotation.x = Math.random() * Math.PI;
      nebula.rotation.y = Math.random() * Math.PI;
      nebula.rotation.z = Math.random() * Math.PI;
      
      // Add to group
      this.nebulaeGroup.add(nebula);
    }
    
    this.addObject(this.nebulaeGroup);
  }
  
  /**
   * Create various celestial objects (planets, asteroids, etc.)
   */
  private createCelestialObjects(): void {
    console.log("Creating celestial objects");
    
    // Create several celestial objects
    for (let i = 0; i < this.numCelestialObjects; i++) {
      // Determine object type based on index
      let celestialObject: THREE.Object3D;
      const objectType = i % 5; // 5 different object types
      
      if (objectType === 0) {
        // Planet with rings
        celestialObject = this.createPlanet(0.2 + Math.random() * 0.3, true);
      } else if (objectType === 1) {
        // Planet without rings
        celestialObject = this.createPlanet(0.15 + Math.random() * 0.25, false);
      } else if (objectType === 2) {
        // Small asteroid
        celestialObject = this.createAsteroid(0.05 + Math.random() * 0.1);
      } else if (objectType === 3) {
        // Asteroid cluster
        celestialObject = this.createAsteroidCluster(0.05, 5 + Math.floor(Math.random() * 8));
      } else {
        // Comet with tail
        celestialObject = this.createComet(0.08 + Math.random() * 0.12);
      }
      
      // Position object in space
      const radius = 5 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) - 15; // Push back a bit
      
      celestialObject.position.set(x, y, z);
      
      // Give it random rotation
      celestialObject.rotation.x = Math.random() * Math.PI * 2;
      celestialObject.rotation.y = Math.random() * Math.PI * 2;
      celestialObject.rotation.z = Math.random() * Math.PI * 2;
      
      // Add custom data for animation
      celestialObject.userData.orbitRadius = radius;
      celestialObject.userData.orbitSpeed = 0.02 + Math.random() * 0.04;
      celestialObject.userData.orbitCenter = new THREE.Vector3(
        Math.random() * 2 - 1, 
        Math.random() * 2 - 1, 
        -15
      );
      celestialObject.userData.rotationSpeed = {
        x: (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.01
      };
      
      // Add to scene
      this.addObject(celestialObject);
      this.celestialObjects.push(celestialObject);
    }
  }
  
  /**
   * Create a planet with optional rings
   */
  private createPlanet(radius: number, hasRings: boolean): THREE.Group {
    const planet = new THREE.Group();
    
    // Create planet body
    const planetGeometry = new THREE.SphereGeometry(radius, 32, 32);
    
    // Choose random planet color
    const planetColorIndex = Math.floor(Math.random() * (this.colors.length - 1)) + 1;
    const planetColor = new THREE.Color(this.colors[planetColorIndex]);
    
    // Create planet material with subtle texture
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: planetColor,
      shininess: 20,
      emissive: planetColor.clone().multiplyScalar(0.2),
    });
    
    const planetBody = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.add(planetBody);
    this.materials.push(planetMaterial);
    
    // Add rings if needed
    if (hasRings) {
      const ringsGeometry = new THREE.RingGeometry(radius * 1.4, radius * 2.2, 64);
      const ringsMaterial = new THREE.MeshBasicMaterial({
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      
      const rings = new THREE.Mesh(ringsGeometry, ringsMaterial);
      rings.rotation.x = Math.PI / 2 + Math.random() * 0.5;
      planet.add(rings);
      this.materials.push(ringsMaterial);
    }
    
    return planet;
  }
  
  /**
   * Create an asteroid object
   */
  private createAsteroid(radius: number): THREE.Mesh {
    // Create irregular geometry for asteroid
    const asteroidGeometry = new THREE.IcosahedronGeometry(radius, 1);
    
    // Distort vertices to make it look irregular
    const positions = asteroidGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const distortFactor = 0.2;
      positions.setX(i, x + (Math.random() - 0.5) * distortFactor);
      positions.setY(i, y + (Math.random() - 0.5) * distortFactor);
      positions.setZ(i, z + (Math.random() - 0.5) * distortFactor);
    }
    
    // Update normals
    asteroidGeometry.computeVertexNormals();
    
    // Choose random dark color
    const asteroidMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.1,
    });
    
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
    this.materials.push(asteroidMaterial);
    
    return asteroid;
  }
  
  /**
   * Create a cluster of asteroids
   */
  private createAsteroidCluster(radius: number, count: number): THREE.Group {
    const cluster = new THREE.Group();
    
    for (let i = 0; i < count; i++) {
      const asteroid = this.createAsteroid(radius * (0.5 + Math.random() * 0.5));
      
      // Position within cluster
      const distance = radius * 5 * Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);
      
      asteroid.position.set(x, y, z);
      
      // Add custom rotation for animation
      asteroid.userData.rotationSpeed = {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      };
      
      cluster.add(asteroid);
    }
    
    return cluster;
  }
  
  /**
   * Create a comet with tail
   */
  private createComet(radius: number): THREE.Group {
    const comet = new THREE.Group();
    
    // Create comet head
    const headGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: 0xeeeeff,
      transparent: true,
      opacity: 0.8,
    });
    
    const head = new THREE.Mesh(headGeometry, headMaterial);
    comet.add(head);
    this.materials.push(headMaterial);
    
    // Create comet tail using particles
    const tailGeometry = new THREE.BufferGeometry();
    const tailPositions = [];
    const tailColors = [];
    
    const tailLength = radius * 10;
    const tailSegments = 20;
    
    for (let i = 0; i < tailSegments; i++) {
      const segmentPosition = i / tailSegments;
      const tailWidth = radius * (1 - segmentPosition);
      
      // Create circle of particles at this segment
      const circleSegments = 8;
      for (let j = 0; j < circleSegments; j++) {
        const angle = (j / circleSegments) * Math.PI * 2;
        const x = Math.cos(angle) * tailWidth;
        const y = Math.sin(angle) * tailWidth;
        const z = -segmentPosition * tailLength;
        
        tailPositions.push(x, y, z);
        
        // Color fades out along tail
        const color = new THREE.Color(0x8888ff);
        color.multiplyScalar(1 - segmentPosition);
        tailColors.push(color.r, color.g, color.b);
      }
    }
    
    tailGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(tailPositions, 3)
    );
    
    tailGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(tailColors, 3)
    );
    
    const tailMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    
    const tail = new THREE.Points(tailGeometry, tailMaterial);
    comet.add(tail);
    this.materials.push(tailMaterial);
    
    return comet;
  }
  
  /**
   * Create cosmic background with distant galaxies and nebulae
   */
  private createCosmicBackground(): void {
    console.log("Creating cosmic background");
    
    // Background shader for cosmic effects
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
      uniform float cosmicEvent;
      uniform float wormholeProgress;
      uniform vec3 colorPalette[6];
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
        // Create center-based coordinates
        vec2 p = vUv * 2.0 - 1.0;
        float dist = length(p);
        
        // Create cosmic background with nebula effects
        float speed = time * 0.03;
        float cosmicScale = 2.0 + sin(time * 0.1) * 0.2;
        
        // Add beat reactivity
        cosmicScale += beat * 0.3;
        
        // Create several layers of noise for cosmic clouds
        float noise1 = snoise(p * cosmicScale + vec2(speed, speed * 0.3));
        float noise2 = snoise(p * cosmicScale * 2.0 + vec2(-speed * 1.2, speed * 0.5));
        float noise3 = snoise(p * cosmicScale * 0.5 + vec2(speed * 0.5, -speed * 0.2));
        
        // Combine noise layers
        float cosmicClouds = (noise1 + noise2 * 0.4 + noise3 * 0.2) * 0.5 + 0.5;
        
        // Create distant galaxy clusters with noise
        float galaxyNoise = pow(snoise(p * 8.0 + vec2(time * 0.02, 0.0)) * 0.5 + 0.5, 2.0);
        
        // Create color gradient using palette
        vec3 darkColor = colorPalette[0]; // Black
        vec3 deepColor = colorPalette[1]; // Deep purple
        vec3 midColor = colorPalette[2];  // Medium purple
        vec3 brightColor = colorPalette[4]; // Light purple
        
        // Mix colors based on cosmic clouds
        vec3 color = mix(darkColor, deepColor, cosmicClouds);
        color = mix(color, midColor, pow(cosmicClouds, 2.0) * 0.5);
        
        // Add distant galaxies
        color += brightColor * galaxyNoise * 0.3;
        
        // Add volume reactivity
        color += midColor * volume * 0.4;
        
        // Add energy level influence
        color += brightColor * energyLevel * 0.3;
        
        // Add beat reactivity
        if (beat > 0.5) {
          color += brightColor * beat * 0.3;
        }
        
        // Add vignette effect
        float vignette = 1.0 - pow(dist, 2.0) * 0.5;
        color *= vignette;
        
        // Create stars in the background
        float stars = pow(snoise(p * 50.0 + time * 0.005), 20.0) * 2.0;
        stars += pow(snoise(p * 100.0 - time * 0.01), 20.0) * 1.5;
        color += vec3(stars);
        
        // Add cosmic event effects (supernova)
        if (cosmicEvent > 0.1) {
          // Create expanding shockwave
          float shockwave = smoothstep(cosmicEvent - 0.1, cosmicEvent, dist) * 
                            smoothstep(cosmicEvent + 0.1, cosmicEvent, dist);
          shockwave *= 3.0 * (1.0 - cosmicEvent); // Fade as it expands
          
          // Add to color
          color += brightColor * shockwave * (0.5 + 0.5 * sin(time * 20.0));
        }
        
        // Add wormhole effect
        if (wormholeProgress > 0.0) {
          // Create wormhole distortion
          float wormholeRadius = 0.5 * wormholeProgress;
          float wormholeEdge = smoothstep(wormholeRadius - 0.1, wormholeRadius, dist) * 
                               smoothstep(wormholeRadius + 0.1, wormholeRadius, dist);
          
          // Create swirl effect
          float swirl = atan(p.y, p.x) + dist * 10.0 * wormholeProgress + time * 2.0;
          float wormholePattern = 0.5 + 0.5 * sin(swirl * 20.0);
          
          // Add to color
          color += midColor * wormholeEdge * 2.0;
          color += brightColor * wormholePattern * wormholeEdge * 2.0;
          
          // Create center void
          if (dist < wormholeRadius - 0.1) {
            // Darken center but add swirling energy
            color = mix(color, darkColor, smoothstep(wormholeRadius - 0.3, wormholeRadius - 0.1, dist));
            
            // Add energy streams in the void
            float energyStreams = 0.5 + 0.5 * sin(swirl * 30.0 + time * 10.0);
            color += brightColor * energyStreams * smoothstep(wormholeRadius - 0.3, 0.0, dist) * 0.5;
          }
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    // Create a plane for the background
    const bgGeometry = new THREE.PlaneGeometry(40, 40);
    const bgMaterial = this.createShaderMaterial(bgVertexShader, bgFragmentShader);
    
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.z = -30;
    this.addObject(background);
  }
  
  /**
   * Trigger a supernova cosmic event
   */
  private triggerSupernova(): void {
    console.log("Triggering supernova event");
    this.isSupernovaActive = true;
    this.supernovaProgress = 0.0;
    
    // Choose a random celestial object to explode
    if (this.celestialObjects.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.celestialObjects.length);
      const explodingObject = this.celestialObjects[randomIndex];
      
      // Mark for animation and special effects
      explodingObject.userData.isExploding = true;
      explodingObject.userData.explosionProgress = 0.0;
      
      // Move camera focus to this object (would require integration with the camera system)
    }
  }
  
  /**
   * Trigger a wormhole cosmic event
   */
  private triggerWormhole(): void {
    console.log("Triggering wormhole event");
    this.wormholeActive = true;
    this.wormholeProgress = 0.0;
  }
  
  /**
   * Calculate energy level from frequency data
   */
  private calculateEnergyLevel(frequencyData: Float32Array): number {
    // Calculate overall energy focusing on different frequency ranges
    let bassEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    
    // Define frequency range indices (approximate)
    const bassRange = { start: 0, end: Math.floor(frequencyData.length * 0.1) };
    const midRange = { 
      start: Math.floor(frequencyData.length * 0.1), 
      end: Math.floor(frequencyData.length * 0.5) 
    };
    const highRange = { 
      start: Math.floor(frequencyData.length * 0.5), 
      end: frequencyData.length 
    };
    
    // Calculate energy in each range
    for (let i = bassRange.start; i < bassRange.end; i++) {
      bassEnergy += (frequencyData[i] + 140) / 140; // Convert from dB
    }
    
    for (let i = midRange.start; i < midRange.end; i++) {
      midEnergy += (frequencyData[i] + 140) / 140;
    }
    
    for (let i = highRange.start; i < highRange.end; i++) {
      highEnergy += (frequencyData[i] + 140) / 140;
    }
    
    // Normalize by bin count
    bassEnergy /= (bassRange.end - bassRange.start);
    midEnergy /= (midRange.end - midRange.start);
    highEnergy /= (highRange.end - highRange.start);
    
    // Weight different ranges differently
    const energyLevel = (bassEnergy * 0.5 + midEnergy * 0.3 + highEnergy * 0.2) * 1.5;
    
    // Cap at 1.0
    return Math.min(1.0, energyLevel);
  }
  
  /**
   * Update visualization with new audio data
   */
  protected updateVisualization(audioData: AudioAnalysisData): void {
    // Calculate energy level from frequency data
    const energyLevel = this.calculateEnergyLevel(audioData.frequencyData);
    this.energyLevel = energyLevel;
    this.uniforms.energyLevel.value = energyLevel;
    
    // Handle beat detection
    const isBeat = audioData.beat.detected;
    const beatConfidence = audioData.beat.confidence;
    const currentTime = this.clock.getElapsedTime();
    const timeSinceLastBeat = currentTime - this.lastBeatTime;
    
    if (isBeat && beatConfidence > 0.5 && timeSinceLastBeat > 0.1) {
      this.lastBeatTime = currentTime;
      
      // Possibly trigger cosmic events on strong beats
      if (beatConfidence > 0.8 && energyLevel > 0.7 && Math.random() < 0.2) {
        if (Math.random() < 0.5) {
          this.triggerSupernova();
        } else {
          this.triggerWormhole();
        }
      }
    }
    
    // Update cosmic events
    if (this.isSupernovaActive) {
      this.updateSupernova();
    }
    
    if (this.wormholeActive) {
      this.updateWormhole();
    }
    
    // Update star twinkle
    if (this.starsGroup) {
      this.updateStars(energyLevel, isBeat, beatConfidence);
    }
    
    // Update nebulae
    if (this.nebulaeGroup) {
      this.updateNebulae(energyLevel, isBeat, beatConfidence);
    }
    
    // Update celestial objects
    this.updateCelestialObjects(energyLevel, isBeat, beatConfidence);
  }
  
  /**
   * Update supernova cosmic event
   */
  private updateSupernova(): void {
    // Update supernova progress
    this.supernovaProgress += 0.01;
    this.uniforms.cosmicEvent.value = this.supernovaProgress;
    
    // Update any exploding objects
    for (let i = 0; i < this.celestialObjects.length; i++) {
      const object = this.celestialObjects[i];
      if (object.userData.isExploding) {
        object.userData.explosionProgress += 0.02;
        
        // Scale up the object
        const scale = 1.0 + object.userData.explosionProgress * 3.0;
        object.scale.set(scale, scale, scale);
        
        // Fade out the object
        if (object.children.length > 0) {
          object.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
              const material = child.material as THREE.Material;
              if (material.opacity !== undefined) {
                material.opacity = Math.max(0, 1.0 - object.userData.explosionProgress);
              }
            }
          });
        }
        
        // Remove if finished exploding
        if (object.userData.explosionProgress >= 1.0) {
          object.visible = false;
        }
      }
    }
    
    // End supernova effect when complete
    if (this.supernovaProgress >= 1.0) {
      this.isSupernovaActive = false;
      this.uniforms.cosmicEvent.value = 0.0;
      
      // Reset any exploded objects
      for (let i = 0; i < this.celestialObjects.length; i++) {
        const object = this.celestialObjects[i];
        if (object.userData.isExploding) {
          object.userData.isExploding = false;
          object.userData.explosionProgress = 0.0;
          object.scale.set(1, 1, 1);
          object.visible = true;
          
          // Reset opacity
          if (object.children.length > 0) {
            object.children.forEach(child => {
              if (child instanceof THREE.Mesh) {
                const material = child.material as THREE.Material;
                if (material.opacity !== undefined) {
                  material.opacity = 1.0;
                }
              }
            });
          }
        }
      }
    }
  }
  
  /**
   * Update wormhole cosmic event
   */
  private updateWormhole(): void {
    // Update wormhole progress
    this.wormholeProgress += 0.005;
    this.uniforms.wormholeProgress.value = this.wormholeProgress;
    
    // Move objects toward wormhole center
    if (this.wormholeProgress > 0.2) {
      for (let i = 0; i < this.celestialObjects.length; i++) {
        const object = this.celestialObjects[i];
        
        // Calculate direction to center
        const direction = new THREE.Vector3(0, 0, -15).sub(object.position).normalize();
        
        // Move object toward center with increasing speed
        const speed = this.wormholeProgress * 0.1;
        object.position.add(direction.multiplyScalar(speed));
        
        // Add spiraling effect
        const distance = object.position.distanceTo(new THREE.Vector3(0, 0, -15));
        if (distance < 5) {
          // Add rotation as it approaches center
          object.rotation.x += 0.05;
          object.rotation.y += 0.05;
          object.rotation.z += 0.05;
          
          // Scale down as it approaches center
          const scale = Math.max(0.1, distance / 5);
          object.scale.set(scale, scale, scale);
        }
      }
    }
    
    // End wormhole effect when complete
    if (this.wormholeProgress >= 1.0) {
      this.wormholeActive = false;
      this.uniforms.wormholeProgress.value = 0.0;
      
      // Reset celestial objects to new positions
      for (let i = 0; i < this.celestialObjects.length; i++) {
        const object = this.celestialObjects[i];
        
        // New random position
        const radius = 5 + Math.random() * 12;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi) - 15;
        
        object.position.set(x, y, z);
        object.scale.set(1, 1, 1);
        
        // Update orbit center
        object.userData.orbitCenter = new THREE.Vector3(
          Math.random() * 2 - 1, 
          Math.random() * 2 - 1, 
          -15
        );
      }
    }
  }
  
  /**
   * Update star twinkle and effects
   */
  private updateStars(energyLevel: number, isBeat: boolean, beatConfidence: number): void {
    if (!this.starsGroup) return;
    
    // Update stars brightness and twinkle based on audio
    const starBrightness = 1.0 + energyLevel * 0.5;
    this.uniforms.starBrightness.value = starBrightness;
    
    // Apply beat effect
    const beatIntensity = isBeat ? beatConfidence : 0;
    
    // Apply effects to each star child
    this.starsGroup.children.forEach(child => {
      // Skip non-mesh children (like Points)
      if (!(child instanceof THREE.Mesh)) return;
      
      // Apply twinkle animation to individual stars
      if (child.userData.twinkleSpeed) {
        const time = this.clock.getElapsedTime();
        child.userData.twinklePhase += child.userData.twinkleSpeed * 0.01;
        
        // Calculate twinkle effect
        const twinkle = 0.7 + 0.3 * Math.sin(time * child.userData.twinkleSpeed + child.userData.twinklePhase);
        
        // Add beat pulse
        const pulse = 1.0 + beatIntensity * 0.5;
        
        // Apply scale
        const finalScale = child.userData.baseScale || 1;
        child.scale.set(
          finalScale * twinkle * pulse,
          finalScale * twinkle * pulse,
          finalScale * twinkle * pulse
        );
        
        // Make colored stars pulse with beat
        if (child.userData.colorIndex !== undefined) {
          const material = child.material as THREE.MeshBasicMaterial;
          material.opacity = 0.7 + beatIntensity * 0.3 + energyLevel * 0.2;
        }
      }
    });
    
    // Rotate the entire star field very slowly
    this.starsGroup.rotation.y += 0.0001;
    this.starsGroup.rotation.x += 0.00005;
  }
  
  /**
   * Update nebulae movement and effects
   */
  private updateNebulae(energyLevel: number, isBeat: boolean, beatConfidence: number): void {
    if (!this.nebulaeGroup) return;
    
    // Apply beat effect
    const beatIntensity = isBeat ? beatConfidence : 0;
    
    // Update each nebula
    this.nebulaeGroup.children.forEach((nebula, index) => {
      // Gentle rotation
      nebula.rotation.x += 0.001;
      nebula.rotation.y += 0.0015;
      nebula.rotation.z += 0.0005;
      
      // Beat-reactive pulse
      if (isBeat) {
        nebula.scale.x += beatIntensity * 0.05;
        nebula.scale.y += beatIntensity * 0.05;
        nebula.scale.z += beatIntensity * 0.05;
      } else {
        // Return to normal size
        nebula.scale.x = Math.max(1, nebula.scale.x * 0.98);
        nebula.scale.y = Math.max(1, nebula.scale.y * 0.98);
        nebula.scale.z = Math.max(1, nebula.scale.z * 0.98);
      }
      
      // Energy-reactive movement
      const positionOffset = energyLevel * 0.2;
      nebula.position.x += (Math.random() - 0.5) * positionOffset;
      nebula.position.y += (Math.random() - 0.5) * positionOffset;
      nebula.position.z += (Math.random() - 0.5) * positionOffset;
      
      // Return to original position slowly
      const originalPosition = this.uniforms.nebulaePositions.value[index];
      nebula.position.x += (originalPosition.x - nebula.position.x) * 0.01;
      nebula.position.y += (originalPosition.y - nebula.position.y) * 0.01;
      nebula.position.z += (originalPosition.z - nebula.position.z) * 0.01;
    });
  }
  
  /**
   * Update celestial objects movement and effects
   */
  private updateCelestialObjects(energyLevel: number, isBeat: boolean, beatConfidence: number): void {
    // Skip if no objects or supernova/wormhole is active
    if (this.celestialObjects.length === 0 || this.isSupernovaActive || this.wormholeActive) return;
    
    const time = this.clock.getElapsedTime();
    const beatIntensity = isBeat ? beatConfidence : 0;
    
    // Update each celestial object
    this.celestialObjects.forEach(object => {
      // Skip objects that are exploding
      if (object.userData.isExploding) return;
      
      // Get orbit data
      const orbitRadius = object.userData.orbitRadius || 5;
      const orbitSpeed = object.userData.orbitSpeed || 0.02;
      const orbitCenter = object.userData.orbitCenter || new THREE.Vector3(0, 0, -15);
      
      // Calculate orbit position
      const angle = time * orbitSpeed;
      const x = orbitCenter.x + Math.cos(angle) * orbitRadius;
      const y = orbitCenter.y + Math.sin(angle) * orbitRadius;
      const z = orbitCenter.z;
      
      // Update position
      object.position.x = x;
      object.position.y = y;
      object.position.z = z;
      
      // Update rotation
      if (object.userData.rotationSpeed) {
        object.rotation.x += object.userData.rotationSpeed.x;
        object.rotation.y += object.userData.rotationSpeed.y;
        object.rotation.z += object.userData.rotationSpeed.z;
      }
      
      // Apply beat-reactive effects
      if (isBeat && beatIntensity > 0.5) {
        // Momentary speed boost
        const boost = 1.0 + beatIntensity * 0.5;
        if (object.userData.rotationSpeed) {
          object.userData.rotationSpeed.x *= boost;
          object.userData.rotationSpeed.y *= boost;
          object.userData.rotationSpeed.z *= boost;
        }
        
        // Apply any beat-specific effects to object materials
        object.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.Material;
            if ('emissive' in material) {
              const emissiveMaterial = material as THREE.MeshPhongMaterial;
              const originalEmissive = emissiveMaterial.emissive.clone();
              emissiveMaterial.emissive.multiplyScalar(1 + beatIntensity);
              
              // Reset after a short delay (would need setTimeout in a real implementation)
              // For this example, it will reset on the next frame
            }
          }
        });
      }
      
      // Energy level affects orbit speed
      object.userData.orbitSpeed = object.userData.orbitSpeed * (1 + energyLevel * 0.1);
      
      // Dampen rotation speed over time to prevent too fast spinning
      if (object.userData.rotationSpeed) {
        object.userData.rotationSpeed.x *= 0.99;
        object.userData.rotationSpeed.y *= 0.99;
        object.userData.rotationSpeed.z *= 0.99;
      }
    });
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    console.log("CosmicVisualizer.dispose() called");
    
    // Clear references
    this.nebulaeGroup = null;
    this.starsGroup = null;
    this.celestialObjects = [];
    this.nebulaMaterials = [];
    
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