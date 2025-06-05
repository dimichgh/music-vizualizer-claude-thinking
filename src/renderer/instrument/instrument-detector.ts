/**
 * Instrument Detector
 * Analyzes audio to detect musical instruments using both frequency analysis and ML
 */

import * as tf from '@tensorflow/tfjs';
import { INSTRUMENT_FREQUENCY_RANGES } from '../../shared/constants';
import { AudioAnalysisData, DetectedInstrument, DetectionMode } from '../../shared/types';
import { ModelLoader } from './model-loader';

/**
 * Class for detecting instruments in audio using both frequency analysis and ML
 */
export class InstrumentDetector {
  private previousDetections: Map<string, DetectedInstrument> = new Map();
  private smoothingFactor: number = 0.8;
  private detectionThreshold: number = 0.3;
  private modelLoader: ModelLoader;
  private detectionMode: DetectionMode = DetectionMode.HYBRID;
  private isModelInitialized: boolean = false;

  constructor() {
    // Initialize the previous detections map with all possible instruments
    for (const instrument of Object.keys(INSTRUMENT_FREQUENCY_RANGES)) {
      this.previousDetections.set(instrument, {
        type: instrument,
        confidence: 0,
        amplitude: 0,
      });
    }
    
    // Initialize ML model loader
    this.modelLoader = new ModelLoader();
    
    // Initialize the TensorFlow.js models asynchronously
    this.initializeModels();
  }
  
  /**
   * Initialize TensorFlow.js models asynchronously
   */
  private async initializeModels(): Promise<void> {
    try {
      await this.modelLoader.loadModels();
      this.isModelInitialized = true;
      console.log('Instrument detection models initialized successfully');
    } catch (error) {
      console.error('Failed to initialize instrument detection models:', error);
      // Fallback to frequency-based detection if model initialization fails
      this.detectionMode = DetectionMode.FREQUENCY;
    }
  }

  /**
   * Detect instruments in the current audio frame
   * @param audioData Audio analysis data
   * @returns Array of detected instruments
   */
  detectInstruments(audioData: AudioAnalysisData): DetectedInstrument[] {
    // Choose detection method based on mode and model availability
    switch (this.detectionMode) {
      case DetectionMode.ML:
        return this.isModelInitialized ? 
          this.detectInstrumentsWithML(audioData) : 
          this.detectInstrumentsWithFrequency(audioData);
      
      case DetectionMode.HYBRID:
        return this.isModelInitialized ? 
          this.detectInstrumentsHybrid(audioData) : 
          this.detectInstrumentsWithFrequency(audioData);
      
      case DetectionMode.FREQUENCY:
      default:
        return this.detectInstrumentsWithFrequency(audioData);
    }
  }

  /**
   * Detect instruments using frequency analysis only
   * @param audioData Audio analysis data
   * @returns Array of detected instruments
   */
  private detectInstrumentsWithFrequency(audioData: AudioAnalysisData): DetectedInstrument[] {
    const instruments: DetectedInstrument[] = [];
    const frequencyData = audioData.frequencyData;
    const sampleRate = 44100; // Assumption, in a real app we'd get this from the audio context
    
    // Helper function to calculate energy in a frequency range
    const calculateEnergy = (minFreq: number, maxFreq: number): number => {
      const minBin = Math.floor(minFreq / (sampleRate / 2048));
      const maxBin = Math.ceil(maxFreq / (sampleRate / 2048));
      
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
      const rawConfidence = Math.min(1, Math.max(0, (energy - 0.001) / 0.01));
      
      // Get previous detection for this instrument
      const prevDetection = this.previousDetections.get(instrument);
      
      // Apply temporal smoothing
      const confidence = prevDetection 
        ? prevDetection.confidence * this.smoothingFactor + rawConfidence * (1 - this.smoothingFactor)
        : rawConfidence;
      
      // Update previous detection
      this.previousDetections.set(instrument, {
        type: instrument,
        confidence,
        amplitude: confidence, // For now, just use confidence as dominance
      });
      
      // Only include instruments with confidence above threshold
      if (confidence > this.detectionThreshold) {
        instruments.push({
          type: instrument,
          confidence,
          amplitude: confidence,
        });
      }
    }
    
    // Apply some domain-specific logic to improve detection
    this.applyDetectionHeuristics(instruments, audioData);
    
    // Sort by dominance
    instruments.sort((a, b) => b.confidence - a.confidence);
    
    return instruments;
  }

  /**
   * Detect instruments using ML model only
   * @param audioData Audio analysis data
   * @returns Array of detected instruments
   */
  private detectInstrumentsWithML(audioData: AudioAnalysisData): DetectedInstrument[] {
    if (!this.isModelInitialized || !this.modelLoader.areModelsLoaded()) {
      console.warn('ML models not initialized, falling back to frequency analysis');
      return this.detectInstrumentsWithFrequency(audioData);
    }

    const instruments: DetectedInstrument[] = [];
    const frequencyData = audioData.frequencyData;
    
    try {
      // Get the instrument classifier model
      const model = this.modelLoader.getModel('instrumentClassifier');
      if (!model) {
        throw new Error('Instrument classifier model not found');
      }
      
      // Preprocess audio features for the model
      const inputTensor = this.modelLoader.preprocessAudioFeatures(frequencyData);
      
      // Run inference
      const predictions = model.predict(inputTensor) as tf.Tensor;
      
      // Convert predictions to DetectedInstrument objects
      const predictionValues = predictions.dataSync();
      const instrumentNames = Object.keys(INSTRUMENT_FREQUENCY_RANGES);
      
      // Clean up tensors to prevent memory leaks
      inputTensor.dispose();
      predictions.dispose();
      
      // Process each instrument prediction
      instrumentNames.forEach((instrument, index) => {
        const rawConfidence = predictionValues[index];
        
        // Get previous detection for this instrument
        const prevDetection = this.previousDetections.get(instrument);
        
        // Apply temporal smoothing
        const confidence = prevDetection 
          ? prevDetection.confidence * this.smoothingFactor + rawConfidence * (1 - this.smoothingFactor)
          : rawConfidence;
        
        // Update previous detection
        this.previousDetections.set(instrument, {
          type: instrument,
          confidence,
          amplitude: confidence, // For simplicity, use confidence as dominance initially
        });
        
        // Only include instruments with confidence above threshold
        if (confidence > this.detectionThreshold) {
          instruments.push({
            type: instrument,
            confidence,
            amplitude: confidence,
          });
        }
      });
      
      // Apply detection heuristics
      this.applyDetectionHeuristics(instruments, audioData);
      
      // Sort by dominance
      instruments.sort((a, b) => b.confidence - a.confidence);
      
      return instruments;
    } catch (error) {
      console.error('Error in ML-based instrument detection:', error);
      // Fallback to frequency-based detection
      return this.detectInstrumentsWithFrequency(audioData);
    }
  }

  /**
   * Detect instruments using a hybrid approach combining ML and frequency analysis
   * @param audioData Audio analysis data
   * @returns Array of detected instruments
   */
  private detectInstrumentsHybrid(audioData: AudioAnalysisData): DetectedInstrument[] {
    if (!this.isModelInitialized || !this.modelLoader.areModelsLoaded()) {
      return this.detectInstrumentsWithFrequency(audioData);
    }
    
    // Get detections from both methods
    const mlDetections = this.detectInstrumentsWithML(audioData);
    const frequencyDetections = this.detectInstrumentsWithFrequency(audioData);
    
    // Create a map of ML detections for easier lookup
    const mlDetectionMap = new Map<string, DetectedInstrument>();
    mlDetections.forEach(detection => {
      mlDetectionMap.set(detection.type, detection);
    });
    
    // Create a map of frequency detections for easier lookup
    const freqDetectionMap = new Map<string, DetectedInstrument>();
    frequencyDetections.forEach(detection => {
      freqDetectionMap.set(detection.type, detection);
    });
    
    // Combine the detections with a weighted approach
    const combinedDetections: DetectedInstrument[] = [];
    const instruments = Object.keys(INSTRUMENT_FREQUENCY_RANGES);
    
    // The weight given to ML predictions vs frequency analysis
    // Higher values favor ML predictions
    const mlWeight = 0.7;
    
    for (const instrument of instruments) {
      const mlDetection = mlDetectionMap.get(instrument);
      const freqDetection = freqDetectionMap.get(instrument);
      
      // Skip if neither method detected this instrument
      if (!mlDetection && !freqDetection) continue;
      
      // Calculate weighted confidence
      let confidence: number;
      if (mlDetection && freqDetection) {
        confidence = mlDetection.confidence * mlWeight + freqDetection.confidence * (1 - mlWeight);
      } else if (mlDetection) {
        confidence = mlDetection.confidence * mlWeight;
      } else {
        confidence = freqDetection!.confidence * (1 - mlWeight);
      }
      
      // Only include instruments with combined confidence above threshold
      if (confidence > this.detectionThreshold) {
        combinedDetections.push({
          type: instrument,
          confidence,
          amplitude: confidence, // Initialize dominance with confidence
        });
      }
    }
    
    // Apply detection heuristics
    this.applyDetectionHeuristics(combinedDetections, audioData);
    
    // Sort by dominance
    combinedDetections.sort((a, b) => b.confidence - a.confidence);
    
    return combinedDetections;
  }

  /**
   * Apply heuristics to improve instrument detection
   * @param instruments Detected instruments array
   * @param audioData Audio analysis data
   */
  private applyDetectionHeuristics(instruments: DetectedInstrument[], audioData: AudioAnalysisData): void {
    // If a beat is detected with high confidence, boost the drums confidence
    if (audioData.beat.detected && audioData.beat.confidence > 0.7) {
      const drumsInstrument = instruments.find(i => i.type === 'drums');
      if (drumsInstrument) {
        drumsInstrument.confidence = Math.min(1, drumsInstrument.confidence + 0.2);
        drumsInstrument.amplitude = Math.min(1, (drumsInstrument.amplitude || 0) + 0.3);
      }
    }
    
    // If volume is very low, reduce all confidences
    if (audioData.volume < 0.01) {
      instruments.forEach(instrument => {
        instrument.confidence *= 0.5;
        instrument.amplitude = (instrument.amplitude || 0) * 0.5;
      });
    }
    
    // If multiple instruments have high confidence, prioritize based on typical dominance patterns
    // For example, bass and drums often provide the foundation, while other instruments layer on top
    if (instruments.length > 2) {
      const bassInstrument = instruments.find(i => i.type === 'bass');
      if (bassInstrument && bassInstrument.confidence > 0.6) {
        bassInstrument.amplitude = Math.min(1, (bassInstrument.amplitude || 0) + 0.1);
      }
    }
  }

  /**
   * Set the confidence threshold for instrument detection
   * @param threshold New threshold value (0-1)
   */
  setDetectionThreshold(threshold: number): void {
    this.detectionThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Set the temporal smoothing factor for confidence values
   * @param factor Smoothing factor (0-1)
   */
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }
  
  /**
   * Set the detection mode (ML, Frequency, or Hybrid)
   * @param mode Detection mode to use
   */
  setDetectionMode(mode: DetectionMode): void {
    this.detectionMode = mode;
  }
  
  /**
   * Get the current detection mode
   * @returns Current detection mode
   */
  getDetectionMode(): DetectionMode {
    return this.detectionMode;
  }
  
  /**
   * Check if ML models are initialized and available
   * @returns True if ML models are available, false otherwise
   */
  areMLModelsAvailable(): boolean {
    return this.isModelInitialized && this.modelLoader.areModelsLoaded();
  }
  
  /**
   * Clean up resources when the detector is no longer needed
   */
  dispose(): void {
    if (this.modelLoader) {
      this.modelLoader.dispose();
    }
  }
}