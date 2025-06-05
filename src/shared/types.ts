/**
 * Merged type definitions for the audio visualization system
 */

/**
 * Audio file data structure
 */
export interface AudioFile {
  path: string;
  name: string;
  duration?: number;
}

/**
 * Audio player state
 */
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
}

/**
 * Audio analysis data structure
 */
export interface AudioAnalysisData {
  // Raw frequency data in dB (typically -140 to 0 range)
  frequencyData: Float32Array;
  
  // Time domain data (-1.0 to 1.0 range)
  timeData: Float32Array;
  
  // For backward compatibility
  timeDomainData: Float32Array;
  
  // Overall audio volume (0.0 to 1.0)
  volume: number;
  
  // Beat detection information
  beat: {
    detected: boolean;
    confidence: number;
    bpm: number;
  };
  
  // Frequency band energy levels (0.0 to 1.0)
  energyDistribution: {
    low: number;
    mid: number;
    high: number;
  };

  // Advanced audio features from Meyda
  rms?: number;             // Root Mean Square (loudness)
  spectralCentroid?: number; // Perceived brightness of sound
  spectralFlatness?: number; // Distinguishes between tonal vs. noise sounds (0-1)
  chroma?: Float32Array;     // Distribution of energy along the 12 pitch classes
}

/**
 * Detected instrument information
 */
export interface DetectedInstrument {
  // Instrument type (e.g., 'bass', 'drums', 'piano', etc.)
  type: string;
  
  // Confidence level (0.0 to 1.0)
  confidence: number;
  
  // Normalized amplitude of the instrument (0.0 to 1.0)
  amplitude: number;
}

/**
 * Visualization types
 */
export enum VisualizationType {
  FREQUENCY = 'frequency',
  WAVEFORM = 'waveform',
  PARTICLES = 'particles',
  COSMIC = 'cosmic'
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  // Type of visualization
  type: VisualizationType;
  
  // Whether to show instrument-specific visualizations
  showInstruments: boolean;
  
  // Color palette to use
  colorPalette: string;
  
  // Intensity of visualization effects (0.0 to 1.0)
  intensity: number;
  
  // Enable post-processing effects
  postProcessingEnabled?: boolean;
  
  // Performance settings
  performance?: {
    // Target FPS (frames per second)
    targetFps: number;
    
    // Quality level (0 = lowest, higher = better)
    qualityLevel: number;
    
    // Whether to use adaptive quality
    adaptiveQuality: boolean;
  };
}

/**
 * Performance profile types
 */
export enum PerformanceProfileType {
  AUTO = 'auto',       // Automatically adjust based on hardware
  BATTERY = 'battery', // Optimize for battery life
  BALANCED = 'balanced', // Balance performance and quality
  QUALITY = 'quality'  // Prioritize visual quality
}

/**
 * Renderer capabilities and info
 */
export interface RendererInfo {
  // GPU vendor and renderer strings
  vendor: string;
  renderer: string;
  
  // WebGL version
  webglVersion: number;
  
  // Maximum texture size supported
  maxTextureSize: number;
  
  // Whether specific features are supported
  capabilities: {
    floatTextures: boolean;
    instancedArrays: boolean;
    multipleRenderTargets: boolean;
  };
  
  // Estimated performance tier (1-5, higher is better)
  performanceTier: number;
}

/**
 * Post-processing effect type
 */
export enum PostProcessingEffectType {
  BLOOM = 'bloom',
  FILM_GRAIN = 'filmGrain',
  CHROMATIC_ABERRATION = 'chromaticAberration'
}

/**
 * Instrument detection mode
 */
export enum DetectionMode {
  FREQUENCY = 'frequency', // Traditional frequency analysis only
  ML = 'ml',               // Machine learning only
  HYBRID = 'hybrid',       // Combination of frequency analysis and ML
}

/**
 * Electron API exposed to renderer process
 */
export interface ElectronAPI {
  openFile: () => Promise<{ canceled: boolean; filePath?: string }>;
  loadAudioFile: (filePath: string) => Promise<{ 
    success: boolean; 
    data?: ArrayBuffer; 
    filePath?: string;
    error?: string;
  }>;
}