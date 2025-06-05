import React from 'react';
import { AudioFile, VisualizationType } from '../../shared/types';
import { formatTime } from '../../shared/utils/helpers';

interface AudioControlsProps {
  audioFile: AudioFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onFileOpen: () => void;
  onVisualizationChange: (type: VisualizationType) => void;
  currentVisualization: VisualizationType;
  onTogglePlaylist: () => void;
  showPlaylist: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  audioFile,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onFileOpen,
  onVisualizationChange,
  currentVisualization,
  onTogglePlaylist,
  showPlaylist,
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioFile) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = x / progressBar.offsetWidth;
    
    // Seek to the clicked position
    const seekTime = clickPosition * duration;
    onTimeUpdate(seekTime);
  };

  // Handle time update from seekbar click
  const onTimeUpdate = (time: number) => {
    // This would be handled by the parent component
    // The actual seeking logic is in the audio player
  };

  return (
    <div className="controls">
      <div className="main-controls">
        <button 
          className="file-button"
          onClick={onFileOpen}
          title="Open Audio File"
        >
          Open File
        </button>

        <button 
          className="control-button"
          onClick={onPlayPause} 
          disabled={!audioFile}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button 
          className="control-button"
          onClick={onStop} 
          disabled={!audioFile || !isPlaying}
          title="Stop"
        >
          Stop
        </button>
        
        <button
          className="playlist-toggle"
          onClick={onTogglePlaylist}
          title={showPlaylist ? 'Hide Playlist' : 'Show Playlist'}
        >
          {showPlaylist ? 'Hide Playlist' : 'Show Playlist'}
        </button>
      </div>

      <div 
        className="progress"
        onClick={handleProgressClick}
        title={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      >
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="time-and-info">
        <div className="time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {audioFile && (
          <div className="file-info">
            {audioFile.name}
          </div>
        )}

        <select 
          value={currentVisualization}
          onChange={(e) => onVisualizationChange(e.target.value as VisualizationType)}
          disabled={!audioFile}
          className="viz-selector"
          title="Select Visualization"
        >
          <option value={VisualizationType.FREQUENCY}>Frequency</option>
          <option value={VisualizationType.WAVEFORM}>Waveform</option>
          <option value={VisualizationType.PARTICLES}>Particles</option>
          <option value={VisualizationType.COSMIC}>Cosmic</option>
        </select>
      </div>
      
      <style>
        {`
        .controls {
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .main-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
        }
        
        .control-button,
        .file-button,
        .playlist-toggle {
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .file-button {
          background-color: var(--secondary-color);
        }
        
        .control-button {
          min-width: 80px;
        }
        
        .playlist-toggle {
          background-color: var(--surface-color);
          margin-left: auto;
        }
        
        .progress {
          height: 6px;
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
        }
        
        .progress-bar {
          height: 100%;
          background-color: var(--accent-color);
          border-radius: 3px;
          transition: width 0.1s linear;
        }
        
        .time-and-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }
        
        .time {
          font-family: monospace;
          opacity: 0.8;
        }
        
        .file-info {
          flex: 1;
          margin: 0 16px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.8;
        }
        
        .viz-selector {
          background-color: var(--surface-color);
          color: var(--on-surface-color);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 4px 8px;
        }
        `}
      </style>
    </div>
  );
};

export default AudioControls;