# Music Visualizer Application Architecture Plan

## Overview
This document outlines the architecture for an Electron-based music visualizer application. The application will:
- Load and play WAV audio files
- Analyze audio for visualization
- Create ethereal, psychedelic, cosmic visualizations synchronized to music
- Display transparent figures/shadows representing instruments being played

## Technology Stack
- **Electron**: Application framework
- **TypeScript**: Programming language
- **Web Audio API**: Core audio processing
- **Tone.js**: High-level audio library
- **Meyda.js**: Audio feature extraction
- **Three.js**: 3D visualization rendering
- **TensorFlow.js**: Machine learning for instrument detection
- **React**: UI components

## Core Components

### 1. Application Layer
- **Main Process**:
  - Application lifecycle management
  - Window management
  - Inter-process communication
  - File system access
  - Configuration management

- **Renderer Process**:
  - UI rendering
  - Audio processing
  - Visualization rendering
  - Event handling

### 2. Audio Engine
- **AudioLoader**: Handles loading and decoding audio files
- **AudioPlayer**: Controls audio playback (play, pause, seek, etc.)
- **AudioAnalyzer**: Extracts audio features:
  - Time domain data (waveform)
  - Frequency domain data (spectrum)
  - Beat detection
  - Tempo analysis
  - Instrument detection features

### 3. Visualization Engine
- **VisualizationManager**: Coordinates different visualization types
- **BaseVisualization**: Abstract class for all visualizations
- **Visualization Implementations**:
  - Frequency Spectrum Visualization
  - Waveform Visualization
  - Particle System
  - Cosmic Background
  - Instrument Visualizations

### 4. Instrument Detection Engine
- **ModelLoader**: Loads pre-trained machine learning models
- **InstrumentDetector**: Analyzes audio to identify instruments
- **InstrumentVisualizer**: Renders instrument visualizations

### 5. UI Layer
- **MainWindow**: Main application window
- **AudioControls**: Play, pause, volume, etc.
- **VisualizationControls**: Control visualization parameters
- **PlaylistManager**: Manage multiple audio files

## Data Flow
1. User loads WAV file via UI
2. AudioLoader processes file and passes to AudioPlayer
3. AudioPlayer begins playback and sends audio data to AudioAnalyzer
4. AudioAnalyzer extracts features and passes to:
   - VisualizationManager for visual rendering
   - InstrumentDetector for instrument analysis
5. VisualizationManager updates visuals based on audio features
6. InstrumentDetector identifies instruments and triggers InstrumentVisualizer
7. UI updates reflect current state (playback position, visualization options)

## Folder Structure
```
music-visualizer/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── main.ts                # Entry point
│   │   ├── ipc/                   # IPC handlers
│   │   └── services/              # Main process services
│   │
│   ├── renderer/                  # Electron renderer process
│   │   ├── index.html             # HTML entry
│   │   ├── renderer.ts            # Renderer entry point
│   │   ├── components/            # UI components
│   │   │   ├── app.tsx            # Main app component
│   │   │   ├── controls/          # Playback controls
│   │   │   ├── playlist/          # Playlist management
│   │   │   └── settings/          # Application settings
│   │   │
│   │   ├── audio/                 # Audio processing
│   │   │   ├── audio-loader.ts    # Audio file loading
│   │   │   ├── audio-player.ts    # Audio playback
│   │   │   └── audio-analyzer.ts  # Audio analysis
│   │   │
│   │   ├── visualization/         # Visualization engine
│   │   │   ├── visualization-manager.ts
│   │   │   ├── base-visualization.ts
│   │   │   ├── frequency-visualization.ts
│   │   │   ├── waveform-visualization.ts
│   │   │   ├── particle-visualization.ts
│   │   │   └── cosmic-visualization.ts
│   │   │
│   │   └── instrument/            # Instrument detection
│   │       ├── instrument-detector.ts
│   │       ├── models/            # ML models
│   │       └── instrument-visualizer.ts
│   │
│   ├── shared/                    # Shared between processes
│   │   ├── types/                 # TypeScript types
│   │   ├── constants.ts           # Shared constants
│   │   └── utils/                 # Utility functions
│   │
│   └── assets/                    # Static assets
│       ├── images/                # Image assets
│       ├── models/                # ML models
│       └── shaders/               # GLSL shaders
│
├── public/                        # Static files
├── build/                         # Build output
├── dist/                          # Distribution packages
├── tests/                         # Tests
│   ├── unit/                      # Unit tests
│   └── e2e/                       # End-to-end tests
│
├── .eslintrc.js                   # ESLint configuration
├── .prettierrc                    # Prettier configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Project dependencies
└── README.md                      # Project documentation
```

## Technical Approach for Requirements

### WAV File Loading, Analysis, and Playback
- Use Electron's file dialog API to allow user selection of WAV files
- Use Node.js fs module to read file data
- Decode audio with Web Audio API's AudioContext
- Use AudioBufferSourceNode for playback
- Implement real-time analysis using AnalyserNode for basic features
- Use Meyda.js for more advanced feature extraction:
  - RMS (loudness)
  - Spectral centroid (brightness)
  - Spectral flatness (tonality)
  - Chroma (harmonic content)

### Ethereal, Psychedelic, Cosmic Visualizations
- Use Three.js for WebGL-based 3D rendering
- Implement visualization types:
  1. Frequency spectrum visualization with flowing, organic forms
  2. Particle systems reacting to beats and frequency bands
  3. Cosmic background with starfield and nebula effects
  4. Waveform-based geometric patterns
- Map audio features to visual properties:
  - Bass frequencies: Base movements and pulses
  - Mid frequencies: Geometric transformations
  - High frequencies: Particle effects and highlights
- Use GLSL shaders for:
  - Color gradients and transitions
  - Bloom and glow effects
  - Distortion and wave effects
- Apply post-processing effects:
  - Bloom for ethereal glow
  - Film grain for texture
  - Chromatic aberration for psychedelic effect

### Instrument Visualization
- Use a combination of frequency analysis and machine learning models:
  1. Frequency band energy for basic instrument family detection
  2. TensorFlow.js with pre-trained models for specific instrument detection
- Create abstract representations of instruments:
  - String instruments: Flowing lines/strings that vibrate
  - Percussion: Pulsing circular forms
  - Wind instruments: Swirling, vapor-like forms
  - Vocals: Human-like silhouettes with ethereal glow
- Implement transparency and particle effects:
  - Use alpha blending for transparency
  - Particle systems emanating from instrument forms
  - Glow effects around instrument silhouettes
- Scale visibility and prominence based on:
  - Detection confidence
  - Instrument volume in mix
  - Current musical prominence

## Implementation Phases

### Phase 1: Project Setup and Basic Audio
- Set up Electron with TypeScript
- Implement basic file loading
- Create audio playback functionality
- Implement basic audio analysis

### Phase 2: Core Visualization
- Create visualization framework
- Implement frequency visualization
- Add waveform visualization
- Develop cosmic background

### Phase 3: Advanced Features
- Implement instrument detection
- Create instrument visualizations
- Add particle systems
- Develop post-processing effects

### Phase 4: UI and Polish
- Design and implement user interface
- Add playlist functionality
- Create settings for visualization control
- Performance optimization

### Phase 5: Testing and Packaging
- Unit testing
- Performance testing
- Package application for distribution

## Dependencies

### Production Dependencies
- electron
- typescript
- react
- react-dom
- tone
- meyda
- three.js
- @tensorflow/tfjs
- essentia.js (optional for advanced audio analysis)

### Development Dependencies
- electron-builder
- electron-forge
- typescript
- eslint
- prettier
- jest
- spectron (for Electron testing)

## Conclusion
This architecture provides a solid foundation for building an advanced music visualization application. The modular design allows for progressive implementation of features and easy extension with new visualization types and audio analysis capabilities.