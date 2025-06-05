/**
 * Instrument Visualizer
 * Creates visual representations of detected instruments
 */

import * as THREE from 'three';
import { BaseVisualization } from '../visualization/base-visualization';
import { AudioAnalysisData, DetectedInstrument } from '../../shared/types';
import { InstrumentDetector } from './instrument-detector';
import { COLOR_PALETTES } from '../../shared/constants';
import { lerpColor, lerp } from '../../shared/utils/helpers';

/**
 * Class for visualizing detected instruments
 */
export class InstrumentVisualizer extends BaseVisualization {
  private instrumentDetector: InstrumentDetector;
  private instrumentGroups: Map<string, THREE.Group> = new Map();
  private instrumentMaterials: Map<string, THREE.Material[]> = new Map();
  private particleSystems: Map<string, THREE.Points> = new Map();
  private colors: string[] = [];
  private maxInstruments: number = 3; // Maximum instruments to visualize simultaneously
  
  constructor(scene: THREE.Scene) {
    super(scene);
    this.instrumentDetector = new InstrumentDetector();
    this.colors = COLOR_PALETTES.cosmic;
    
    // Add instrument-specific uniforms
    this.uniforms.instrumentData = { value: [] };
  }
  
  /**
   * Initialize the visualization
   */
  init(): void {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.addObject(ambientLight);
    
    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(0, 0, 5);
    this.addObject(pointLight);
    
    // Create instrument visualizations
    this.createInstrumentVisualizations();
    
    // Create cosmic background
    this.createBackground();
  }
  
  /**
   * Update visualization with new audio data
   */
  protected updateVisualization(audioData: AudioAnalysisData): void {
    // Detect instruments
    const detectedInstruments = this.instrumentDetector.detectInstruments(audioData);
    
    // Update instrument data uniform
    this.uniforms.instrumentData.value = detectedInstruments;
    
    // Hide all instruments first
    this.instrumentGroups.forEach((group) => {
      group.visible = false;
    });
    
    // Show and update top instruments
    const topInstruments = detectedInstruments.slice(0, this.maxInstruments);
    
    topInstruments.forEach((instrument, index) => {
      const group = this.instrumentGroups.get(instrument.type);
      if (!group) return;
      
      // Show this instrument
      group.visible = true;
      
      // Position based on index (spread them out)
      const angle = (index / this.maxInstruments) * Math.PI * 2;
      const radius = 2.5;
      group.position.x = Math.cos(angle) * radius;
      group.position.z = Math.sin(angle) * radius;
      
      // Scale based on dominance
      const scale = 0.3 + (instrument.amplitude || instrument.confidence) * 0.7;
      group.scale.set(scale, scale, scale);
      
      // Update opacity based on confidence
      const materials = this.instrumentMaterials.get(instrument.type) || [];
      materials.forEach(material => {
        if ('opacity' in material) {
          (material as THREE.Material & { opacity: number }).opacity = 
            Math.max(0.2, instrument.confidence);
        }
      });
      
      // Update particle system
      const particles = this.particleSystems.get(instrument.type);
      if (particles && particles.material instanceof THREE.PointsMaterial) {
        particles.material.size = 0.02 + audioData.volume * 0.05;
        particles.visible = true;
        
        // Update particle positions based on audio
        const positions = particles.geometry.getAttribute('position');
        const count = positions.count;
        
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);
          
          // Apply subtle movement based on audio
          const freq = audioData.frequencyData[i % audioData.frequencyData.length];
          const freqNormalized = (freq + 140) / 140; // Normalize from dB scale
          
          // Calculate new position with subtle movement
          const time = this.uniforms.time.value;
          const noise = Math.sin(x * 5 + time) * Math.cos(z * 3 + time) * 0.05;
          
          positions.setXYZ(
            i,
            x + noise * freqNormalized,
            y + Math.sin(time * 0.5 + i) * 0.02 * audioData.volume,
            z + noise * freqNormalized
          );
        }
        
        positions.needsUpdate = true;
      }
      
      // Add some rotation based on the beat
      if (audioData.beat.detected) {
        group.rotation.y += 0.1 * audioData.beat.confidence;
      }
      
      // Subtle continuous rotation
      group.rotation.y += 0.002;
    });
    
    // Hide particle systems for non-displayed instruments
    this.particleSystems.forEach((particles, type) => {
      if (!topInstruments.some(instr => instr.type === type)) {
        particles.visible = false;
      }
    });
  }
  
  /**
   * Create visualizations for each instrument type
   */
  private createInstrumentVisualizations(): void {
    // Create a visualization for each instrument type
    this.createStringInstrument('guitar');
    this.createStringInstrument('bass');
    this.createPercussionInstrument('drums');
    this.createWindInstrument('woodwinds');
    this.createWindInstrument('brass');
    this.createVocalInstrument('vocals');
    this.createKeyboardInstrument('piano');
  }
  
  /**
   * Create a visualization for string instruments
   * @param type Instrument type
   */
  private createStringInstrument(type: string): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    
    // Create a flowing string-like shape
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, -0.3, 0),
      new THREE.Vector3(-0.5, 0.2, 0.2),
      new THREE.Vector3(0, 0.4, 0),
      new THREE.Vector3(0.5, 0.2, -0.2),
      new THREE.Vector3(0.8, -0.3, 0),
    ]);
    
    // Create a tube geometry along the curve
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.02, 8, false);
    
    // Create a glowing material
    const color = type === 'bass' ? '#4F25BA' : '#7B5AC5';
    const tubeMaterial = new THREE.MeshPhongMaterial({
      color,
      shininess: 100,
      transparent: true,
      opacity: 0.7,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    materials.push(tubeMaterial);
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    group.add(tube);
    
    // Add resonating body
    const bodyGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      shininess: 80,
    });
    materials.push(bodyMaterial);
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(1, 0.6, 0.2);
    body.position.set(0, -0.3, 0);
    group.add(body);
    
    // Add particle system
    const particleCount = 200;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const t = i / particleCount;
      const pos = curve.getPoint(t);
      
      // Add some randomization around the curve
      particlePositions[i3] = pos.x + (Math.random() - 0.5) * 0.4;
      particlePositions[i3 + 1] = pos.y + (Math.random() - 0.5) * 0.4;
      particlePositions[i3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;
    }
    
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    materials.push(particleMaterial);
    
    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    group.add(particles);
    
    // Store the group and materials
    group.visible = false;
    this.instrumentGroups.set(type, group);
    this.instrumentMaterials.set(type, materials);
    this.particleSystems.set(type, particles);
    this.addObject(group);
  }
  
  /**
   * Create a visualization for percussion instruments
   * @param type Instrument type
   */
  private createPercussionInstrument(type: string): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    
    // Create a circular drum-like shape
    const color = '#A495DE';
    
    // Create drum head
    const drumGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
    const drumMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      shininess: 90,
    });
    materials.push(drumMaterial);
    
    const drum = new THREE.Mesh(drumGeometry, drumMaterial);
    drum.rotation.x = Math.PI / 2;
    group.add(drum);
    
    // Create drum shell
    const shellGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32, 1, true);
    const shellMaterial = new THREE.MeshPhongMaterial({
      color: '#3E1F92',
      transparent: true,
      opacity: 0.5,
      shininess: 70,
    });
    materials.push(shellMaterial);
    
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.set(0, -0.15, 0);
    drum.add(shell);
    
    // Add particle system for drum hits
    const particleCount = 300;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.4 * Math.random();
      
      particlePositions[i3] = Math.cos(angle) * radius;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 0.5;
      particlePositions[i3 + 2] = Math.sin(angle) * radius;
    }
    
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    materials.push(particleMaterial);
    
    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    group.add(particles);
    
    // Store the group and materials
    group.visible = false;
    this.instrumentGroups.set(type, group);
    this.instrumentMaterials.set(type, materials);
    this.particleSystems.set(type, particles);
    this.addObject(group);
  }
  
  /**
   * Create a visualization for wind instruments
   * @param type Instrument type
   */
  private createWindInstrument(type: string): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    
    // Choose color based on instrument type
    const color = type === 'woodwinds' ? '#55BF80' : '#F25C05';
    
    // Create a tube for the instrument
    const points = [];
    const segmentCount = 5;
    
    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount;
      points.push(new THREE.Vector3(
        Math.sin(t * Math.PI) * 0.2,
        t * 0.8 - 0.4,
        0
      ));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.04, 8, false);
    
    const tubeMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      shininess: 90,
      emissive: color,
      emissiveIntensity: 0.2,
    });
    materials.push(tubeMaterial);
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    group.add(tube);
    
    // Create a bell at the end
    const bellGeometry = new THREE.ConeGeometry(0.15, 0.3, 32, 1, true);
    const bellMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      shininess: 70,
    });
    materials.push(bellMaterial);
    
    const bell = new THREE.Mesh(bellGeometry, bellMaterial);
    bell.position.set(0, 0.4, 0);
    bell.rotation.x = Math.PI;
    group.add(bell);
    
    // Add swirling particle system for air
    const particleCount = 200;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const t = Math.random();
      const angle = t * Math.PI * 6;
      const radius = 0.1 + t * 0.3;
      
      particlePositions[i3] = Math.cos(angle) * radius;
      particlePositions[i3 + 1] = 0.4 + t * 0.5;
      particlePositions[i3 + 2] = Math.sin(angle) * radius;
    }
    
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: type === 'woodwinds' ? '#CAFFB9' : '#FFBF00',
      size: 0.02,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    materials.push(particleMaterial);
    
    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    group.add(particles);
    
    // Store the group and materials
    group.visible = false;
    this.instrumentGroups.set(type, group);
    this.instrumentMaterials.set(type, materials);
    this.particleSystems.set(type, particles);
    this.addObject(group);
  }
  
  /**
   * Create a visualization for vocal instruments
   * @param type Instrument type
   */
  private createVocalInstrument(type: string): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    
    // Create a silhouette-like shape
    const color = '#FF00FF';
    
    // Create head silhouette
    const headGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const headMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      shininess: 100,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    materials.push(headMaterial);
    
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.3, 0);
    group.add(head);
    
    // Create body silhouette
    const bodyGeometry = new THREE.CapsuleGeometry(0.15, 0.4, 8, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      shininess: 90,
    });
    materials.push(bodyMaterial);
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, -0.1, 0);
    group.add(body);
    
    // Add particle system for sound waves
    const particleCount = 300;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const radius = 0.3 + Math.random() * 0.5;
      
      particlePositions[i3] = Math.sin(theta) * Math.cos(phi) * radius;
      particlePositions[i3 + 1] = Math.cos(theta) * radius + 0.3; // Centered around head
      particlePositions[i3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    }
    
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: '#B12FF3',
      size: 0.02,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    materials.push(particleMaterial);
    
    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    group.add(particles);
    
    // Store the group and materials
    group.visible = false;
    this.instrumentGroups.set(type, group);
    this.instrumentMaterials.set(type, materials);
    this.particleSystems.set(type, particles);
    this.addObject(group);
  }
  
  /**
   * Create a visualization for keyboard instruments
   * @param type Instrument type
   */
  private createKeyboardInstrument(type: string): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    
    // Create a piano-like shape
    const color = '#00CDF9';
    
    // Create keyboard base
    const baseGeometry = new THREE.BoxGeometry(0.8, 0.05, 0.3);
    const baseMaterial = new THREE.MeshPhongMaterial({
      color: '#01395C',
      transparent: true,
      opacity: 0.7,
      shininess: 80,
    });
    materials.push(baseMaterial);
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);
    
    // Create white keys
    const whiteKeyCount = 7;
    const whiteKeyWidth = 0.1;
    const whiteKeyGeometry = new THREE.BoxGeometry(whiteKeyWidth * 0.9, 0.02, 0.25);
    const whiteKeyMaterial = new THREE.MeshPhongMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.8,
      shininess: 100,
    });
    materials.push(whiteKeyMaterial);
    
    for (let i = 0; i < whiteKeyCount; i++) {
      const key = new THREE.Mesh(whiteKeyGeometry, whiteKeyMaterial);
      key.position.set(
        (i - (whiteKeyCount - 1) / 2) * whiteKeyWidth,
        0.035,
        0
      );
      group.add(key);
    }
    
    // Create black keys
    const blackKeyPositions = [-0.3, -0.1, 0.1, 0.3];
    const blackKeyGeometry = new THREE.BoxGeometry(0.06, 0.03, 0.15);
    const blackKeyMaterial = new THREE.MeshPhongMaterial({
      color: '#000C14',
      transparent: true,
      opacity: 0.9,
      shininess: 90,
    });
    materials.push(blackKeyMaterial);
    
    for (const x of blackKeyPositions) {
      const key = new THREE.Mesh(blackKeyGeometry, blackKeyMaterial);
      key.position.set(x, 0.06, -0.05);
      group.add(key);
    }
    
    // Add particle system for notes
    const particleCount = 250;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Distribute particles above the keyboard
      particlePositions[i3] = (Math.random() - 0.5) * 0.8;
      particlePositions[i3 + 1] = Math.random() * 0.6 + 0.1;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    materials.push(particleMaterial);
    
    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    group.add(particles);
    
    // Store the group and materials
    group.visible = false;
    this.instrumentGroups.set(type, group);
    this.instrumentMaterials.set(type, materials);
    this.particleSystems.set(type, particles);
    this.addObject(group);
  }
  
  /**
   * Create a cosmic background
   */
  private createBackground(): void {
    // Add a subtle glow effect in the background
    const bgGeometry = new THREE.PlaneGeometry(20, 20);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0, // Nearly invisible, just to catch some reflections
    });
    
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.z = -5;
    this.addObject(background);
  }
  
  /**
   * Set the maximum number of instruments to visualize simultaneously
   * @param count Maximum count
   */
  setMaxInstruments(count: number): void {
    this.maxInstruments = Math.max(1, Math.min(5, count));
  }
}