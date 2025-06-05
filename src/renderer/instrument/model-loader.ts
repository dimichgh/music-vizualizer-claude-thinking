/**
 * Model Loader
 * Handles loading and management of TensorFlow.js models for instrument detection
 */

import * as tf from '@tensorflow/tfjs';
import { INSTRUMENT_FREQUENCY_RANGES } from '../../shared/constants';

// Paths to pre-trained models
const MODEL_PATHS = {
  instrumentClassifier: '/assets/models/instrument-classifier/model.json',
};

/**
 * Class for loading and managing TensorFlow.js models
 */
export class ModelLoader {
  private models: Map<string, tf.LayersModel | tf.GraphModel> = new Map();
  private isModelLoaded: boolean = false;
  private isLoading: boolean = false;
  private modelLoadingPromise: Promise<void> | null = null;

  /**
   * Initialize the model loader
   */
  constructor() {
    // Use existing backends or register them if needed
    try {
      if (!tf.findBackend('webgl')) {
        tf.setBackend('webgl');
      }
      if (!tf.findBackend('cpu')) {
        tf.setBackend('cpu');
      }
    } catch (e) {
      console.error('Failed to set TensorFlow.js backends:', e);
    }
  }

  /**
   * Load all required models
   * @returns Promise that resolves when all models are loaded
   */
  async loadModels(): Promise<void> {
    if (this.isModelLoaded) {
      return Promise.resolve();
    }

    if (this.isLoading && this.modelLoadingPromise) {
      return this.modelLoadingPromise;
    }

    this.isLoading = true;
    
    // Create a promise to load all models
    this.modelLoadingPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Set the preferred backend based on hardware capabilities
        await tf.setBackend('webgl');
        console.log('Using TensorFlow.js backend:', tf.getBackend());

        // Load the instrument classifier model
        try {
          const model = await tf.loadLayersModel(MODEL_PATHS.instrumentClassifier);
          this.models.set('instrumentClassifier', model);
          console.log('Instrument classifier model loaded successfully');
        } catch (error) {
          console.warn('Failed to load real model, creating placeholder model instead');
          // Create a placeholder model for development/testing
          this.createPlaceholderModel();
        }

        this.isModelLoaded = true;
        this.isLoading = false;
        resolve();
      } catch (error) {
        this.isLoading = false;
        console.error('Failed to initialize TensorFlow.js models:', error);
        reject(error);
      }
    });

    return this.modelLoadingPromise;
  }

  /**
   * Create a placeholder model for development/testing
   * This allows the system to work without real pre-trained models
   */
  private createPlaceholderModel(): void {
    // Create a simple model that returns mock predictions
    const input = tf.input({shape: [1024]});
    const dense1 = tf.layers.dense({units: 64, activation: 'relu'}).apply(input);
    const dense2 = tf.layers.dense({units: 32, activation: 'relu'}).apply(dense1);
    const output = tf.layers.dense({
      units: Object.keys(INSTRUMENT_FREQUENCY_RANGES).length,
      activation: 'sigmoid'
    }).apply(dense2);

    const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
    this.models.set('instrumentClassifier', model);
    console.log('Placeholder instrument classifier model created');
  }

  /**
   * Get a loaded model by name
   * @param modelName Name of the model to retrieve
   * @returns TensorFlow.js model
   */
  getModel(modelName: string): tf.LayersModel | tf.GraphModel | null {
    return this.models.get(modelName) || null;
  }

  /**
   * Check if all models are loaded
   * @returns True if models are loaded, false otherwise
   */
  areModelsLoaded(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Preprocess audio features for model input
   * @param frequencyData FFT frequency data
   * @returns Tensor ready for model input
   */
  preprocessAudioFeatures(frequencyData: Float32Array): tf.Tensor {
    // Convert frequency data to the format expected by the model
    const tensor = tf.tensor(Array.from(frequencyData));
    
    // Reshape to match model input shape [batch_size, input_shape]
    const reshapedTensor = tensor.reshape([1, frequencyData.length]);
    
    // Normalize values to the range expected by the model (typically 0-1)
    const normalizedTensor = tf.div(
      tf.sub(reshapedTensor, tf.min(reshapedTensor)),
      tf.sub(tf.max(reshapedTensor), tf.min(reshapedTensor))
    );
    
    return normalizedTensor;
  }
  
  /**
   * Dispose of all loaded models to free memory
   */
  dispose(): void {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.isModelLoaded = false;
  }
}