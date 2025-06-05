/**
 * Audio Loader
 * Handles loading audio files from the file system via Electron IPC
 */

import { AudioFile } from '../../shared/types';
import { getFilenameFromPath } from '../../shared/utils/helpers';

/**
 * Class for loading audio files
 */
export class AudioLoader {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log("AudioLoader created with audio context state:", this.audioContext.state);
  }

  /**
   * Open file dialog and load selected audio file
   * @returns Promise with the loaded audio file and buffer
   */
  async openAndLoadFile(): Promise<{ file: AudioFile; buffer: AudioBuffer } | null> {
    try {
      console.log("Opening file dialog");
      // Open file dialog
      const result = await window.electronAPI.openFile();
      
      if (result.canceled || !result.filePath) {
        console.log("File dialog canceled or no file selected");
        return null;
      }
      
      console.log("File selected:", result.filePath);
      // Load file data
      return await this.loadFile(result.filePath);
      
    } catch (error) {
      console.error('Error opening audio file:', error);
      throw error;
    }
  }

  /**
   * Load audio file from the given path
   * @param filePath Path to the audio file
   * @returns Promise with the loaded audio file and buffer
   */
  async loadFile(filePath: string): Promise<{ file: AudioFile; buffer: AudioBuffer }> {
    try {
      console.log("Loading audio file from path:", filePath);
      
      // Request file data from main process
      const response = await window.electronAPI.loadAudioFile(filePath);
      
      if (!response.success || !response.data) {
        console.error("Failed to load audio file:", response.error);
        throw new Error(response.error || 'Failed to load audio file');
      }
      
      console.log("Audio file data received, size:", response.data.byteLength);
      
      // Ensure we have an ArrayBuffer
      const arrayBuffer = response.data;
      
      // Decode audio data
      console.log("Decoding audio data");
      const audioBuffer = await this.decodeAudioData(arrayBuffer);
      console.log("Audio data decoded, duration:", audioBuffer.duration);
      
      // Create audio file object
      const file: AudioFile = {
        path: filePath,
        name: getFilenameFromPath(filePath),
        duration: audioBuffer.duration,
      };
      
      return { file, buffer: audioBuffer };
      
    } catch (error) {
      console.error('Error loading audio file:', error);
      throw error;
    }
  }

  /**
   * Decode audio data from ArrayBuffer
   * @param arrayBuffer Audio data as ArrayBuffer
   * @returns Promise with the decoded AudioBuffer
   */
  private async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    try {
      // Ensure the audio context is running
      if (this.audioContext.state === 'suspended') {
        console.log("Resuming audio context before decoding");
        await this.audioContext.resume();
      }
      
      return new Promise<AudioBuffer>((resolve, reject) => {
        this.audioContext.decodeAudioData(
          arrayBuffer,
          (buffer) => {
            console.log("Audio successfully decoded");
            resolve(buffer);
          },
          (err) => {
            console.error("Error decoding audio data:", err);
            reject(err);
          }
        );
      });
    } catch (error) {
      console.error('Error in decodeAudioData:', error);
      throw error;
    }
  }

  /**
   * Get audio context
   * @returns The audio context
   */
  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Resume audio context if suspended
   * Required by browsers to enable audio after user interaction
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      console.log("Resuming suspended audio context");
      try {
        await this.audioContext.resume();
        console.log("Audio context resumed");
      } catch (error) {
        console.error("Error resuming audio context:", error);
        throw error;
      }
    }
    return Promise.resolve();
  }
}