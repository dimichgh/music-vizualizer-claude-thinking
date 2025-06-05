/**
 * Audio Analyzer
 * Analyzes audio data for visualization and instrument detection
 */

import { FFT_SIZE, INSTRUMENT_FREQUENCY_RANGES } from '../../shared/constants';
import { AudioAnalysisData, DetectedInstrument } from '../../shared/types';
// @ts-ignore - Using require instead of import to avoid type issues
const Meyda = require('meyda');

/**
 * Class for analyzing audio data
 */
export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyserNode: AnalyserNode;
  private timeDataArray: Float32Array;
  private frequencyDataArray: Float32Array;
  private previousFrequencyData: Float32Array;
  private beatDetectionThreshold: number = -600;
  private beatSmoothingFactor: number = 0.85;
  private lastBeatTime: number = 0;
  private minBeatInterval: number = 0.25; // Minimum time between beats in seconds
  private beatHistory: number[] = []; // Array to store timestamps of detected beats
  private meydaAnalyzer: any | null = null;
  private meydaFeatures: any = {};

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    // Create analyzer node
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // Create data arrays
    this.timeDataArray = new Float32Array(this.analyserNode.fftSize);
    this.frequencyDataArray = new Float32Array(this.analyserNode.frequencyBinCount);
    this.previousFrequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
    
    // Initialize Meyda analyzer
    this.initializeMeydaAnalyzer();
  }
  
  /**
   * Initialize Meyda analyzer for advanced audio feature extraction
   */
  private initializeMeydaAnalyzer(): void {
    try {
      // Make sure Meyda is properly imported
      if (!Meyda || typeof Meyda.create !== 'function') {
        console.error('Meyda library not properly loaded');
        return;
      }
      
      // Create a source node to connect to Meyda (if needed)
      // Note: Some configurations might require a specific node setup
      let sourceNode = this.analyserNode;
      
      // Create a Meyda analyzer connected to our audio context
      this.meydaAnalyzer = Meyda.create({
        audioContext: this.audioContext,
        source: sourceNode,
        bufferSize: FFT_SIZE,
        featureExtractors: [
          'rms',
          'spectralCentroid',
          'spectralFlatness',
          'chroma'
        ],
        callback: (features: any) => {
          // Store the features for later use
          this.meydaFeatures = features;
        }
      });
      
      // Start the analyzer
      this.meydaAnalyzer.start();
      console.log('Meyda analyzer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Meyda analyzer:', error);
      // Set to null to ensure we know it's not available
      this.meydaAnalyzer = null;
    }
  }

  /**
   * Get the analyzer node
   * @returns AnalyserNode
   */
  getAnalyserNode(): AnalyserNode {
    return this.analyserNode;
  }

  /**
   * Get current audio analysis data
   * @returns Analysis data for visualization
   */
  getAnalysisData(): AudioAnalysisData {
    // Update data arrays
    this.analyserNode.getFloatTimeDomainData(this.timeDataArray);
    this.analyserNode.getFloatFrequencyData(this.frequencyDataArray);
    
    // Calculate volume (RMS) from the time domain data
    // We still keep our own RMS calculation as a fallback
    const volume = this.calculateRMS(this.timeDataArray);
    
    // Detect beats
    const beat = this.detectBeat();
    
    // Store current frequency data for next frame
    this.previousFrequencyData.set(this.frequencyDataArray);
    
    // Advanced features from Meyda (if available)
    const meydaFeatures = this.extractMeydaFeatures();
    
    // If Meyda provided an RMS value, we can compare it with our calculated value
    // For debugging purposes, we could log this comparison occasionally
    if (meydaFeatures.rms !== undefined && Math.random() < 0.01) { // Log only 1% of the time
      console.log('RMS comparison - Internal:', volume, 'Meyda:', meydaFeatures.rms);
    }
    
    // Calculate energy distribution for the different frequency bands
    const energyDistribution = this.calculateEnergyDistribution(this.frequencyDataArray);
    
    return {
      timeData: this.timeDataArray,
      frequencyData: this.frequencyDataArray,
      // We use our own volume calculation for consistency with previous implementation
      volume,
      beat: {
        detected: beat.detected,
        confidence: beat.confidence,
        bpm: beat.bpm || 0
      },
      // Add backward compatibility fields
      timeDomainData: this.timeDataArray,
      energyDistribution,
      // Add Meyda features
      ...meydaFeatures
    };
  }
  
  /**
   * Extract features from Meyda analyzer
   * @returns Object containing the advanced audio features
   */
  private extractMeydaFeatures(): {
    rms?: number;
    spectralCentroid?: number;
    spectralFlatness?: number;
    chroma?: Float32Array;
  } {
    // If Meyda analyzer isn't available, return empty features
    if (!this.meydaAnalyzer) {
      return {};
    }
    
    try {
      // First check if we have features from the callback
      if (this.meydaFeatures && Object.keys(this.meydaFeatures).length > 0) {
        const features = this.meydaFeatures;
        
        return {
          rms: features.rms as number,
          spectralCentroid: features.spectralCentroid as number,
          spectralFlatness: features.spectralFlatness as number,
          chroma: new Float32Array(features.chroma || [])
        };
      }
      
      // As a fallback, get features synchronously
      // This might be less efficient but ensures we always have data
      const featuresObject = this.meydaAnalyzer.get([
        'rms',
        'spectralCentroid',
        'spectralFlatness',
        'chroma'
      ]);
      
      if (featuresObject) {
        return {
          rms: featuresObject.rms as number,
          spectralCentroid: featuresObject.spectralCentroid as number,
          spectralFlatness: featuresObject.spectralFlatness as number,
          chroma: featuresObject.chroma as Float32Array
        };
      }
    } catch (error) {
      console.error('Error extracting Meyda features:', error);
    }
    
    // If all fails, return empty object
    return {};
  }

  /**
   * Detect instruments in the current audio frame
   * @returns Array of detected instruments
   */
  detectInstruments(): DetectedInstrument[] {
    // This is a simplified implementation
    // A more accurate implementation would use machine learning models
    
    const instruments: DetectedInstrument[] = [];
    const frequencyData = this.frequencyDataArray;
    
    // Helper function to calculate energy in a frequency range
    const calculateEnergy = (minFreq: number, maxFreq: number): number => {
      const minBin = Math.floor(minFreq / (this.audioContext.sampleRate / FFT_SIZE));
      const maxBin = Math.ceil(maxFreq / (this.audioContext.sampleRate / FFT_SIZE));
      
      let energy = 0;
      for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
        // Convert from dB to linear scale (approximately)
        energy += Math.pow(10, frequencyData[i] / 20);
      }
      
      return energy / (maxBin - minBin + 1);
    };
    
    // Check each instrument frequency range
    for (const [instrument, [minFreq, maxFreq]] of Object.entries(INSTRUMENT_FREQUENCY_RANGES)) {
      const energy = calculateEnergy(minFreq, maxFreq);
      
      // Normalize energy to a 0-1 confidence value (approximate)
      // This is a very simplified approach
      const confidence = Math.min(1, Math.max(0, (energy - 0.001) / 0.01));
      
      if (confidence > 0.3) { // Only include instruments with reasonable confidence
        instruments.push({
          type: instrument,
          confidence,
          amplitude: confidence // Use confidence as amplitude for now
        });
      }
    }
    
    // Sort by confidence
    instruments.sort((a, b) => b.confidence - a.confidence);
    
    return instruments;
  }

  /**
   * Calculate energy distribution across frequency bands
   * @param frequencyData Audio frequency data
   * @returns Object with normalized energy levels for low, mid, and high frequency bands
   */
  private calculateEnergyDistribution(frequencyData: Float32Array): { low: number; mid: number; high: number } {
    // Define frequency bands (indices in the frequencyData array)
    const lowBandRange = [0, 10];  // Low frequencies
    const midBandRange = [11, 100]; // Mid frequencies
    const highBandRange = [101, frequencyData.length - 1]; // High frequencies
    
    // Calculate energy for each band
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    
    // Low band
    for (let i = lowBandRange[0]; i <= lowBandRange[1]; i++) {
      // Convert from dB scale (-140 to 0) to linear scale (0 to 1)
      lowEnergy += (frequencyData[i] + 140) / 140;
    }
    
    // Mid band
    for (let i = midBandRange[0]; i <= midBandRange[1]; i++) {
      midEnergy += (frequencyData[i] + 140) / 140;
    }
    
    // High band
    for (let i = highBandRange[0]; i <= highBandRange[1]; i++) {
      highEnergy += (frequencyData[i] + 140) / 140;
    }
    
    // Normalize by the number of frequency bins in each band
    lowEnergy /= (lowBandRange[1] - lowBandRange[0] + 1);
    midEnergy /= (midBandRange[1] - midBandRange[0] + 1);
    highEnergy /= (highBandRange[1] - highBandRange[0] + 1);
    
    // Ensure values are between 0 and 1
    return {
      low: Math.max(0, Math.min(1, lowEnergy)),
      mid: Math.max(0, Math.min(1, midEnergy)),
      high: Math.max(0, Math.min(1, highEnergy))
    };
  }
  
  /**
   * Calculate RMS (Root Mean Square) of audio data
   * @param data Audio time domain data
   * @returns RMS value
   */
  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Detect beats in audio
   * @returns Beat detection result
   */
  private detectBeat(): { detected: boolean; confidence: number; bpm?: number } {
    // Simple beat detection using bass frequency energy
    const bassSum = this.frequencyDataArray.slice(0, 10).reduce((acc, val) => acc + val, 0);
    
    // Threshold detection
    const isAboveThreshold = bassSum > this.beatDetectionThreshold;
    
    // Time-based filtering to prevent too rapid beats
    const currentTime = this.audioContext.currentTime;
    const timeSinceLastBeat = currentTime - this.lastBeatTime;
    
    // Calculate spectral flux (difference from previous frame)
    let flux = 0;
    for (let i = 0; i < 20; i++) { // Focus on lower frequencies for beat detection
      flux += Math.abs(this.frequencyDataArray[i] - this.previousFrequencyData[i]);
    }
    
    // Determine if this is a beat
    let beatDetected = false;
    
    if (isAboveThreshold && timeSinceLastBeat > this.minBeatInterval && flux > 50) {
      beatDetected = true;
      this.lastBeatTime = currentTime;
      
      // Add to beat history, keep only last 10 beats for BPM calculation
      this.beatHistory.push(currentTime);
      if (this.beatHistory.length > 10) {
        this.beatHistory.shift();
      }
    }
    
    // Calculate confidence
    const confidence = (bassSum + 700) / 100; // Normalize to 0-1 range approximately
    
    // Calculate BPM if we've detected enough beats
    let bpm = undefined;
    if (this.beatHistory.length > 0) {
      // Simple BPM calculation based on average time between beats
      const avgTimeBetweenBeats = this.beatHistory.reduce((sum, time, i, arr) => {
        if (i === 0) return sum;
        return sum + (time - arr[i-1]);
      }, 0) / (this.beatHistory.length - 1 || 1);
      
      if (avgTimeBetweenBeats > 0) {
        bpm = 60 / avgTimeBetweenBeats;
      }
    }

    return {
      detected: beatDetected,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
      bpm
    };
  }

  /**
   * Adjust beat detection sensitivity
   * @param threshold New threshold value
   */
  setBeatDetectionThreshold(threshold: number): void {
    this.beatDetectionThreshold = threshold;
  }

  /**
   * Set minimum time between detected beats
   * @param seconds Minimum interval in seconds
   */
  setMinBeatInterval(seconds: number): void {
    this.minBeatInterval = seconds;
  }
  
  /**
   * Get the Meyda analyzer instance
   * @returns The Meyda analyzer or null if not available
   */
  getMeydaAnalyzer(): any | null {
    return this.meydaAnalyzer;
  }
  
  /**
   * Update the Meyda feature extractors to be used
   * @param featureExtractors Array of feature names to extract
   * @returns Boolean indicating success
   */
  updateMeydaFeatures(featureExtractors: string[]): boolean {
    if (!this.meydaAnalyzer) {
      console.error('Cannot update features: Meyda analyzer not initialized');
      return false;
    }
    
    try {
      // Stop the analyzer before updating
      this.meydaAnalyzer.stop();
      
      // Create a new analyzer with updated features
      this.meydaAnalyzer = Meyda.create({
        audioContext: this.audioContext,
        source: this.analyserNode,
        bufferSize: FFT_SIZE,
        featureExtractors: featureExtractors,
        callback: (features: any) => {
          this.meydaFeatures = features;
        }
      });
      
      // Start the new analyzer
      this.meydaAnalyzer.start();
      return true;
    } catch (error) {
      console.error('Failed to update Meyda features:', error);
      return false;
    }
  }
  
  /**
   * Clean up resources when the analyzer is no longer needed
   */
  dispose(): void {
    // Stop and clean up Meyda analyzer if it exists
    if (this.meydaAnalyzer) {
      try {
        this.meydaAnalyzer.stop();
      } catch (error) {
        console.error('Error stopping Meyda analyzer:', error);
      }
      this.meydaAnalyzer = null;
    }
  }
}