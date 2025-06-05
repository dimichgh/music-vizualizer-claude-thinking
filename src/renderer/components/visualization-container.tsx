import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { AudioFile, VisualizationType, AudioAnalysisData } from '../../shared/types';
import { PostProcessingConfig } from '../visualization/post-processing';
import { AudioLoader } from '../audio/audio-loader';
import { AudioPlayer } from '../audio/audio-player';
import { AudioAnalyzer } from '../audio/audio-analyzer';
import { VisualizationManager } from '../visualization/visualization-manager';
import { InstrumentDetector } from '../instrument/instrument-detector';

interface VisualizationContainerProps {
  audioFile: AudioFile | null;
  isPlaying: boolean;
  visualizationType: VisualizationType;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  instrumentDetector?: InstrumentDetector | null;
  showInstruments?: boolean;
  colorPalette?: string;
  intensity?: number;
  postProcessingConfig?: PostProcessingConfig;
}

const VisualizationContainer: React.FC<VisualizationContainerProps> = ({
  audioFile,
  isPlaying,
  visualizationType,
  onTimeUpdate,
  onDurationChange,
  instrumentDetector = null,
  showInstruments = true,
  colorPalette = 'cosmic',
  intensity = 0.8,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioLoaderRef = useRef<AudioLoader | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const visualizationManagerRef = useRef<VisualizationManager | null>(null);
  const loadedFilePath = useRef<string | null>(null);

  // Debug state for monitoring
  const [debugInfo, setDebugInfo] = useState({ loaded: false, playing: false });
  
  // Initialize everything
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log("Initializing visualization container");
    
    // Create audio loader
    audioLoaderRef.current = new AudioLoader();
    
    // Create audio context
    const audioContext = audioLoaderRef.current.getAudioContext();
    
    // Create audio analyzer
    audioAnalyzerRef.current = new AudioAnalyzer(audioContext);
    
    // Create audio player
    audioPlayerRef.current = new AudioPlayer(audioContext);
    
    // Set up audio player events
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setOnTimeUpdate((time) => {
        onTimeUpdate(time);
      });
      
      audioPlayerRef.current.setOnEnded(() => {
        console.log("Audio playback ended");
        onTimeUpdate(0);
      });
    }
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;
    
    // Create visualization manager
    visualizationManagerRef.current = new VisualizationManager(scene);
    visualizationManagerRef.current.init();
    
    // Set initial visualization type
    if (visualizationManagerRef.current) {
      visualizationManagerRef.current.setVisualizationType(visualizationType);
      
      // Pass the instrument detector to the visualization manager
      if (instrumentDetector) {
        visualizationManagerRef.current.setInstrumentDetector(instrumentDetector);
      }
      
      // Set visualization options
      visualizationManagerRef.current.setVisualizationOptions({
        type: visualizationType,
        colorPalette,
        intensity,
        showInstruments
      });
    }
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Start animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
      
      // Get audio analysis data
      let audioData: AudioAnalysisData = {
        timeData: new Float32Array(),
        frequencyData: new Float32Array(),
        volume: 0,
        beat: {
          detected: false,
          confidence: 0,
          bpm: 0
        },
        // Add backward compatibility fields
        timeDomainData: new Float32Array(),
        energyDistribution: {
          low: 0,
          mid: 0,
          high: 0
        }
      };
      
      if (audioPlayerRef.current && isPlaying) {
        audioData = audioPlayerRef.current.getAnalysisData();
      } else if (audioAnalyzerRef.current) {
        audioData = audioAnalyzerRef.current.getAnalysisData();
      }
      
      // Update visualizations
      if (visualizationManagerRef.current) {
        visualizationManagerRef.current.update(audioData);
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      console.log("Cleaning up visualization container");
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (visualizationManagerRef.current) {
        visualizationManagerRef.current.dispose();
      }
      
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
    };
  }, []);
  
  // Handle audio file changes
  useEffect(() => {
    // Skip if no file or already loaded this file
    if (!audioFile || (loadedFilePath.current === audioFile.path)) return;
    
    const loadAudio = async () => {
      if (!audioLoaderRef.current || !audioPlayerRef.current) return;
      
      try {
        console.log("Loading audio file:", audioFile.path);
        loadedFilePath.current = audioFile.path;
        
        // Load audio file
        const { buffer } = await audioLoaderRef.current.loadFile(audioFile.path);
        
        // Update audio player
        audioPlayerRef.current.loadBuffer(buffer);
        
        // Update duration
        onDurationChange(buffer.duration);
        
        setDebugInfo(prev => ({ ...prev, loaded: true }));
        console.log("Audio file loaded successfully");
      } catch (error) {
        console.error('Error loading audio:', error);
        loadedFilePath.current = null;
      }
    };
    
    loadAudio();
  }, [audioFile]);
  
  // Handle play/pause changes
  useEffect(() => {
    if (!audioPlayerRef.current) return;
    
    console.log("Play state changed:", isPlaying);
    
    if (isPlaying) {
      console.log("Attempting to play audio");
      
      // Ensure audio context is resumed (needed for browser autoplay policies)
      if (audioLoaderRef.current) {
        audioLoaderRef.current.resumeAudioContext().then(() => {
          audioPlayerRef.current?.play();
          setDebugInfo(prev => ({ ...prev, playing: true }));
        });
      } else {
        audioPlayerRef.current.play();
        setDebugInfo(prev => ({ ...prev, playing: true }));
      }
    } else {
      console.log("Pausing audio");
      audioPlayerRef.current.pause();
      setDebugInfo(prev => ({ ...prev, playing: false }));
    }
  }, [isPlaying]);
  
  // Handle visualization type changes
  useEffect(() => {
    if (!visualizationManagerRef.current) return;
    
    visualizationManagerRef.current.setVisualizationType(visualizationType);
    
    // Update visualization options
    visualizationManagerRef.current.setVisualizationOptions({
      type: visualizationType,
      colorPalette,
      intensity,
      showInstruments
    });
  }, [visualizationType, colorPalette, intensity, showInstruments]);
  
  // Update instrument detector when it changes
  useEffect(() => {
    if (!visualizationManagerRef.current || !instrumentDetector) return;
    
    visualizationManagerRef.current.setInstrumentDetector(instrumentDetector);
  }, [instrumentDetector]);
  
  return (
    <div ref={containerRef} className="visualizer-container">
      <div className="debug-info">
        <p>File loaded: {debugInfo.loaded ? 'Yes' : 'No'}</p>
        <p>Playing: {debugInfo.playing ? 'Yes' : 'No'}</p>
        <p>File: {loadedFilePath.current?.split('/').pop() || 'None'}</p>
      </div>
    </div>
  );
};

export default VisualizationContainer;