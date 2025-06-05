# Music Visualizer

An Electron application that creates ethereal, psychedelic, cosmic visualizations based on audio input.

## Features

- Load and play WAV audio files
- Analyze audio for visualization
- Create visually appealing reactive visualizations
- Detect instruments in audio and visualize them
- Multiple visualization modes
- Playlist management for multiple audio files
- Customizable settings (color palettes, intensity, etc.)

## Technologies Used

- **Electron**: Application framework
- **TypeScript**: Type-safe JavaScript
- **React**: UI components
- **Three.js**: 3D visualization
- **Web Audio API**: Audio processing
- **Tone.js**: Audio utility library
- **GLSL Shaders**: Custom visual effects

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/music-visualizer.git
   cd music-visualizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   
3. Run the development version:
   ```bash
   npm start
   ```

### Building for Production

```bash
npm run make
```

This will create distributables for your platform in the `out` folder.

## Usage

1. Launch the application
2. Click "Open File" to select a WAV audio file
3. Use the playback controls to play, pause, and stop the audio
4. Select different visualization types from the dropdown
5. Adjust settings using the settings panel (gear icon)
6. Create a playlist by opening multiple files

## Architecture

The application follows a modular architecture:

- **Main Process**: Handles file operations, window management
- **Renderer Process**: 
  - Audio Engine: Audio loading, playback, and analysis
  - Visualization Engine: Rendering visualizations with Three.js
  - UI Components: React-based user interface

## Visualization Types

- **Frequency**: Visualizes audio frequency spectrum
- **Waveform**: Shows audio waveform in 3D space
- **Particles**: Particle-based visualization reacting to audio
- **Cosmic**: Space-inspired visualization with ethereal effects

## Instrument Detection

The application can detect various instruments in the audio and create visual representations for:

- Bass
- Drums
- Piano
- Guitar
- Strings
- Woodwinds
- Brass
- Vocals

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The Web Audio API community
- Three.js documentation and examples
- Electron documentation