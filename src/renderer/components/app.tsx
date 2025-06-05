import React, { useState, useEffect, useRef } from 'react';
import AudioControls from './audio-controls';
import VisualizationContainer from './visualization-container';
import PlaylistManager from './playlist-manager';
import SettingsPanel from './settings-panel';
import { AudioFile, VisualizationType, DetectionMode } from '../../shared/types';
import { COLOR_PALETTES } from '../../shared/constants';
import { InstrumentDetector } from '../instrument/instrument-detector';
import { PostProcessingConfig, defaultPostProcessingConfig } from '../visualization/post-processing';

declare global {
  interface Window {
    electronAPI: any;
  }
}

const App: React.FC = () => {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [visualizationType, setVisualizationType] = useState<VisualizationType>(
    VisualizationType.FREQUENCY
  );
  const [showInstruments, setShowInstruments] = useState<boolean>(true);
  const [colorPalette, setColorPalette] = useState<string>('cosmic');
  const [intensity, setIntensity] = useState<number>(0.8);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>(DetectionMode.HYBRID);
  const [mlModelsAvailable, setMlModelsAvailable] = useState<boolean>(false);
  const [postProcessingConfig, setPostProcessingConfig] = useState<PostProcessingConfig>(defaultPostProcessingConfig);
  
  // Create a ref for the instrument detector to maintain a single instance
  const instrumentDetectorRef = useRef<InstrumentDetector | null>(null);

  // Handle file open
  const handleFileOpen = async () => {
    try {
      console.log("Opening file dialog");
      const result = await window.electronAPI.openFile();
      
      if (result.canceled || !result.filePath) {
        console.log("File dialog canceled or no file selected");
        return;
      }
      
      console.log("File selected:", result.filePath);
      
      // Extract filename from path
      const pathParts = result.filePath.split(/[/\\]/);
      const fileName = pathParts[pathParts.length - 1];
      
      setAudioFile({
        path: result.filePath,
        name: fileName,
      });
      
      // Reset player state
      setIsPlaying(false);
      setCurrentTime(0);
      
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    console.log("Play/Pause button clicked, current state:", isPlaying);
    setIsPlaying(!isPlaying);
  };

  // Handle stop
  const handleStop = () => {
    console.log("Stop button clicked");
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handle time update
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // Handle duration change
  const handleDurationChange = (newDuration: number) => {
    console.log("Duration changed to:", newDuration);
    setDuration(newDuration);
    
    // Update audio file with duration
    if (audioFile) {
      setAudioFile({
        ...audioFile,
        duration: newDuration,
      });
    }
  };

  // Handle visualization change
  const handleVisualizationChange = (type: VisualizationType) => {
    console.log("Changing visualization to:", type);
    setVisualizationType(type);
  };

  // Handle playlist file select
  const handlePlaylistFileSelect = (file: AudioFile) => {
    console.log("Playlist file selected:", file.name);
    setAudioFile(file);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Toggle playlist display
  const handleTogglePlaylist = () => {
    setShowPlaylist(!showPlaylist);
  };

  // Initialize instrument detector
  useEffect(() => {
    // Create instrument detector instance
    instrumentDetectorRef.current = new InstrumentDetector();
    
    // Check if ML models are available after initialization
    const checkModelsAvailable = async () => {
      // Wait a bit to allow async model loading to start
      setTimeout(() => {
        if (instrumentDetectorRef.current) {
          const available = instrumentDetectorRef.current.areMLModelsAvailable();
          setMlModelsAvailable(available);
          
          // If ML models aren't available, fall back to frequency mode
          if (!available && detectionMode !== DetectionMode.FREQUENCY) {
            setDetectionMode(DetectionMode.FREQUENCY);
          }
        }
      }, 2000); // Check after 2 seconds to give models time to load
    };
    
    checkModelsAvailable();
    
    // Clean up the detector when component unmounts
    return () => {
      if (instrumentDetectorRef.current) {
        instrumentDetectorRef.current.dispose();
        instrumentDetectorRef.current = null;
      }
    };
  }, []);
  
  // Update detector mode when it changes in UI
  useEffect(() => {
    if (instrumentDetectorRef.current) {
      instrumentDetectorRef.current.setDetectionMode(detectionMode);
    }
  }, [detectionMode]);
  
  // Handle detection mode change
  const handleDetectionModeChange = (mode: DetectionMode) => {
    // Only allow ML or Hybrid modes if ML models are available
    if ((mode === DetectionMode.ML || mode === DetectionMode.HYBRID) && !mlModelsAvailable) {
      console.warn("ML models are not available. Using frequency analysis only.");
      setDetectionMode(DetectionMode.FREQUENCY);
    } else {
      setDetectionMode(mode);
    }
  };
  
  // Handle post-processing configuration changes
  const handlePostProcessingChange = (config: Partial<PostProcessingConfig>) => {
    setPostProcessingConfig(prevConfig => ({
      ...prevConfig,
      ...config,
      bloom: { ...prevConfig.bloom, ...(config.bloom || {}) },
      filmGrain: { ...prevConfig.filmGrain, ...(config.filmGrain || {}) },
      chromaticAberration: { ...prevConfig.chromaticAberration, ...(config.chromaticAberration || {}) }
    }));
  };
  
  // Log current state for debugging
  useEffect(() => {
    console.log("Current state:", {
      isPlaying,
      visualizationType,
      audioFile: audioFile ? audioFile.name : "none",
      duration,
      detectionMode,
      mlModelsAvailable
    });
  }, [isPlaying, visualizationType, audioFile, duration, detectionMode, mlModelsAvailable]);

  return (
    <div className="app-container">
      <VisualizationContainer 
        audioFile={audioFile}
        isPlaying={isPlaying}
        visualizationType={visualizationType}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        instrumentDetector={instrumentDetectorRef.current}
        showInstruments={showInstruments}
        colorPalette={colorPalette}
        intensity={intensity}
        postProcessingConfig={postProcessingConfig}
      />
      
      <div className="controls-container">
        <AudioControls
          audioFile={audioFile}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onFileOpen={handleFileOpen}
          onVisualizationChange={handleVisualizationChange}
          currentVisualization={visualizationType}
          onTogglePlaylist={handleTogglePlaylist}
          showPlaylist={showPlaylist}
        />
        
        {showPlaylist && (
          <div className="playlist-container">
            <PlaylistManager
              currentFile={audioFile}
              onFileSelect={handlePlaylistFileSelect}
              onFileOpen={handleFileOpen}
            />
          </div>
        )}
      </div>
      
      <SettingsPanel
        visualizationType={visualizationType}
        onVisualizationChange={handleVisualizationChange}
        showInstruments={showInstruments}
        onShowInstrumentsChange={setShowInstruments}
        colorPalette={colorPalette}
        onColorPaletteChange={setColorPalette}
        intensity={intensity}
        onIntensityChange={setIntensity}
        detectionMode={detectionMode}
        onDetectionModeChange={handleDetectionModeChange}
        mlModelsAvailable={mlModelsAvailable}
        postProcessingConfig={postProcessingConfig}
        onPostProcessingChange={handlePostProcessingChange}
      />
      
      <style>
        {`
        .app-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          position: relative;
        }
        
        .controls-container {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        
        .playlist-container {
          padding: 0 16px 16px;
        }
        `}
      </style>
    </div>
  );
};

export default App;