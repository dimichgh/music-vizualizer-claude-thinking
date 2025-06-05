/**
 * Application-wide constants
 */

// Audio analysis
export const SAMPLE_RATE = 44100;
export const FFT_SIZE = 2048;
export const SMOOTHING_TIME_CONSTANT = 0.8;

// Visualization defaults
export const DEFAULT_VISUALIZATION_TYPE = 'frequency';
export const DEFAULT_COLOR_PALETTE = 'cosmic';

// Color palettes
export const COLOR_PALETTES = {
  cosmic: ['#000000', '#3E1F92', '#4F25BA', '#7B5AC5', '#A495DE', '#FFFFFF'],
  fire: ['#000000', '#340D09', '#7A1C0E', '#D92B17', '#F25C05', '#FFBF00'],
  ocean: ['#000C14', '#01395C', '#005F9E', '#0092CA', '#00CDF9', '#FFFFFF'],
  forest: ['#071820', '#0B3227', '#165E46', '#2E8C5E', '#55BF80', '#CAFFB9'],
  neon: ['#000000', '#0D0221', '#290B5A', '#6C0BA9', '#B12FF3', '#FF00FF'],
};

// Instrument detection frequency ranges (approximate Hz values)
export const INSTRUMENT_FREQUENCY_RANGES = {
  bass: [20, 250],
  drums: [100, 500],
  piano: [28, 4200],
  guitar: [80, 1200],
  strings: [200, 3000],
  woodwinds: [250, 1500],
  brass: [150, 1000],
  vocals: [80, 1200],
};

// UI Constants
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;

// File types
export const SUPPORTED_AUDIO_EXTENSIONS = ['.wav'];