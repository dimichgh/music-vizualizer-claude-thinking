import * as React from 'react';

interface AudioControlsProps {
  onOpenFile: () => void;
  onTogglePlayback: () => void;
  isPlaying: boolean;
  hasAudioFile: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  onOpenFile,
  onTogglePlayback,
  isPlaying,
  hasAudioFile
}) => {
  return (
    <div className="audio-controls">
      <button onClick={onOpenFile}>
        Open File
      </button>
      
      <button 
        onClick={onTogglePlayback} 
        disabled={!hasAudioFile}
        style={{ opacity: hasAudioFile ? 1 : 0.5 }}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      
      {/* Additional controls can be added here */}
    </div>
  );
};

export default AudioControls;