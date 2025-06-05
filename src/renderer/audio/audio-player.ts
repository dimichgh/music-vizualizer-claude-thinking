/**
 * Audio Player
 * Handles audio playback and provides control interface
 */

import { FFT_SIZE, SMOOTHING_TIME_CONSTANT } from '../../shared/constants';
import { AudioAnalysisData, PlaybackState } from '../../shared/types';

/**
 * Audio Player class for controlling audio playback and analysis
 */
export class AudioPlayer {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private state: PlaybackState = PlaybackState.STOPPED;
  private timeDataArray: Float32Array;
  private frequencyDataArray: Float32Array;
  private onTimeUpdate: ((time: number) => void) | null = null;
  private onEnded: (() => void) | null = null;
  private animationFrameId: number | null = null;

  constructor(audioContext: AudioContext) {
    console.log("Creating AudioPlayer instance");
    this.audioContext = audioContext;
    
    // Create analyser node
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect nodes
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    // Create data arrays for analysis
    this.timeDataArray = new Float32Array(this.analyserNode.fftSize);
    this.frequencyDataArray = new Float32Array(this.analyserNode.frequencyBinCount);
    
    console.log("AudioPlayer instance created");
  }

  /**
   * Load audio buffer
   * @param buffer AudioBuffer to load
   */
  loadBuffer(buffer: AudioBuffer): void {
    console.log("Loading buffer with duration:", buffer.duration);
    this.audioBuffer = buffer;
    this.reset();
  }

  /**
   * Play audio
   * Starts playback from current position or beginning
   */
  play(): void {
    console.log("Play called, current state:", this.state);
    if (this.state === PlaybackState.PLAYING) {
      console.log("Already playing, ignoring play request");
      return;
    }
    
    if (this.audioBuffer) {
      console.log("Audio buffer exists, starting playback");
      
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        console.log("Resuming suspended audio context");
        this.audioContext.resume().then(() => {
          console.log("Audio context resumed");
          this.startPlayback();
        });
      } else {
        this.startPlayback();
      }
    } else {
      console.log("No audio buffer to play");
    }
  }
  
  /**
   * Start actual playback with the buffer
   */
  private startPlayback(): void {
    if (!this.audioBuffer) return;
    
    try {
      console.log("Creating source node");
      // Create new source node
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      
      // Connect the source to the analyzer
      this.sourceNode.connect(this.analyserNode);
      
      // Set up ended event
      this.sourceNode.onended = () => {
        console.log("Source ended event triggered");
        if (this.state === PlaybackState.PLAYING) {
          this.stop();
          if (this.onEnded) this.onEnded();
        }
      };
      
      // Calculate start offset
      let offset = 0;
      if (this.state === PlaybackState.PAUSED) {
        offset = this.pausedTime;
      }
      
      console.log("Starting playback from offset:", offset);
      // Start playback
      this.sourceNode.start(0, offset);
      this.startTime = this.audioContext.currentTime - offset;
      this.state = PlaybackState.PLAYING;
      
      // Start update loop
      this.startUpdateLoop();
      
      console.log("Playback started");
    } catch (error) {
      console.error("Error starting playback:", error);
    }
  }

  /**
   * Pause audio playback
   */
  pause(): void {
    console.log("Pause called, current state:", this.state);
    if (this.state !== PlaybackState.PLAYING) {
      console.log("Not playing, ignoring pause request");
      return;
    }
    
    try {
      // Store current position
      this.pausedTime = this.getCurrentTime();
      console.log("Pausing at time:", this.pausedTime);
      
      // Stop source node
      if (this.sourceNode) {
        this.sourceNode.stop();
        this.sourceNode = null;
      }
      
      this.state = PlaybackState.PAUSED;
      this.stopUpdateLoop();
      console.log("Playback paused");
    } catch (error) {
      console.error("Error pausing playback:", error);
    }
  }

  /**
   * Stop audio playback and reset position
   */
  stop(): void {
    console.log("Stop called, current state:", this.state);
    if (this.state === PlaybackState.STOPPED) {
      console.log("Already stopped, ignoring stop request");
      return;
    }
    
    try {
      // Stop source node
      if (this.sourceNode) {
        this.sourceNode.stop();
        this.sourceNode = null;
      }
      
      this.state = PlaybackState.STOPPED;
      this.pausedTime = 0;
      this.stopUpdateLoop();
      console.log("Playback stopped");
    } catch (error) {
      console.error("Error stopping playback:", error);
    }
  }

  /**
   * Reset player state
   */
  reset(): void {
    console.log("Resetting player state");
    this.stop();
    this.pausedTime = 0;
  }

  /**
   * Get current playback position
   * @returns Current time in seconds
   */
  getCurrentTime(): number {
    if (!this.audioBuffer) return 0;
    
    if (this.state === PlaybackState.PLAYING) {
      return this.audioContext.currentTime - this.startTime;
    }
    
    return this.pausedTime;
  }

  /**
   * Get audio duration
   * @returns Duration in seconds
   */
  getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  /**
   * Seek to specific time
   * @param time Time in seconds
   */
  seek(time: number): void {
    console.log("Seeking to time:", time);
    if (!this.audioBuffer) return;
    
    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(time, this.getDuration()));
    
    const wasPlaying = this.state === PlaybackState.PLAYING;
    
    // Stop current playback
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }
    
    // Update time
    this.pausedTime = clampedTime;
    
    // Resume playback if was playing
    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Set volume
   * @param volume Volume level (0-1)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(volume, 1));
    this.gainNode.gain.value = clampedVolume;
  }

  /**
   * Get current audio analysis data
   * @returns Audio analysis data for visualization
   */
  getAnalysisData(): AudioAnalysisData {
    // Get time domain data
    this.analyserNode.getFloatTimeDomainData(this.timeDataArray);
    
    // Get frequency data
    this.analyserNode.getFloatFrequencyData(this.frequencyDataArray);
    
    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < this.timeDataArray.length; i++) {
      sum += this.timeDataArray[i] * this.timeDataArray[i];
    }
    const rms = Math.sqrt(sum / this.timeDataArray.length);
    
    // Simple beat detection
    const bassSum = this.frequencyDataArray.slice(0, 10).reduce((acc, val) => acc + val, 0);
    const beatDetected = bassSum > -600; // Threshold value, may need adjustment
    
    // Calculate simple energy distribution
    const energyDistribution = {
      low: Math.min(1, Math.max(0, (this.frequencyDataArray.slice(0, 10).reduce((sum, val) => sum + (val + 140)/140, 0) / 10))),
      mid: Math.min(1, Math.max(0, (this.frequencyDataArray.slice(10, 100).reduce((sum, val) => sum + (val + 140)/140, 0) / 90))),
      high: Math.min(1, Math.max(0, (this.frequencyDataArray.slice(100).reduce((sum, val) => sum + (val + 140)/140, 0) / (this.frequencyDataArray.length - 100))))
    };
    
    return {
      timeData: this.timeDataArray,
      frequencyData: this.frequencyDataArray,
      volume: rms,
      beat: {
        detected: beatDetected,
        confidence: (bassSum + 700) / 100, // Normalize to 0-1 range approximately
        bpm: 0 // Add default bpm value
      },
      // Add backward compatibility fields
      timeDomainData: this.timeDataArray,
      energyDistribution
    };
  }

  /**
   * Set callback for time update events
   * @param callback Function to call with current time
   */
  setOnTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdate = callback;
  }

  /**
   * Set callback for ended events
   * @param callback Function to call when playback ends
   */
  setOnEnded(callback: () => void): void {
    this.onEnded = callback;
  }

  /**
   * Get current playback state
   * @returns Current state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Start the update loop for time tracking and analysis
   */
  private startUpdateLoop(): void {
    console.log("Starting update loop");
    this.stopUpdateLoop();
    
    const update = () => {
      if (this.state === PlaybackState.PLAYING) {
        const currentTime = this.getCurrentTime();
        
        if (this.onTimeUpdate) {
          this.onTimeUpdate(currentTime);
        }
        
        // Check if we've reached the end
        if (currentTime >= this.getDuration()) {
          console.log("Reached end of audio");
          this.stop();
          if (this.onEnded) this.onEnded();
          return;
        }
        
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}