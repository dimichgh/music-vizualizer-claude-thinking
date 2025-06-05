import React, { useState, useEffect } from 'react';
import { AudioFile } from '../../shared/types';
import { formatTime } from '../../shared/utils/helpers';

interface PlaylistManagerProps {
  currentFile: AudioFile | null;
  onFileSelect: (file: AudioFile) => void;
  onFileOpen: () => void;
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  currentFile,
  onFileSelect,
  onFileOpen,
}) => {
  const [playlist, setPlaylist] = useState<AudioFile[]>([]);
  
  // Load playlist from local storage on mount
  useEffect(() => {
    try {
      const savedPlaylist = localStorage.getItem('musicVisualizerPlaylist');
      if (savedPlaylist) {
        setPlaylist(JSON.parse(savedPlaylist));
      }
    } catch (error) {
      console.error('Error loading playlist from storage:', error);
    }
  }, []);
  
  // Save playlist to local storage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('musicVisualizerPlaylist', JSON.stringify(playlist));
    } catch (error) {
      console.error('Error saving playlist to storage:', error);
    }
  }, [playlist]);
  
  // Add file to playlist if it's new
  useEffect(() => {
    if (currentFile && !playlist.some(file => file.path === currentFile.path)) {
      setPlaylist([...playlist, currentFile]);
    }
  }, [currentFile]);
  
  // Handle file selection
  const handleFileSelect = (file: AudioFile) => {
    onFileSelect(file);
  };
  
  // Remove file from playlist
  const handleRemoveFile = (e: React.MouseEvent, file: AudioFile) => {
    e.stopPropagation();
    const newPlaylist = playlist.filter(item => item.path !== file.path);
    setPlaylist(newPlaylist);
  };
  
  // Clear entire playlist
  const handleClearPlaylist = () => {
    setPlaylist([]);
  };
  
  return (
    <div className="playlist-manager">
      <div className="playlist-header">
        <h3>Playlist</h3>
        <div className="playlist-controls">
          <button onClick={onFileOpen}>Add File</button>
          <button onClick={handleClearPlaylist} disabled={playlist.length === 0}>
            Clear All
          </button>
        </div>
      </div>
      
      <div className="playlist-items">
        {playlist.length === 0 ? (
          <div className="playlist-empty">No files added. Click "Add File" to add music.</div>
        ) : (
          <ul>
            {playlist.map((file, index) => (
              <li 
                key={file.path}
                className={file.path === currentFile?.path ? 'active' : ''}
                onClick={() => handleFileSelect(file)}
              >
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  {file.duration && (
                    <span className="file-duration">{formatTime(file.duration)}</span>
                  )}
                </div>
                <button 
                  className="remove-file"
                  onClick={(e) => handleRemoveFile(e, file)}
                  title="Remove from playlist"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <style>
        {`
        .playlist-manager {
          background-color: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
          width: 100%;
        }
        
        .playlist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .playlist-header h3 {
          margin: 0;
          font-size: 18px;
        }
        
        .playlist-controls {
          display: flex;
          gap: 8px;
        }
        
        .playlist-controls button {
          padding: 4px 8px;
          font-size: 12px;
        }
        
        .playlist-items ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .playlist-items li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          border-radius: 4px;
          background-color: rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .playlist-items li:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .playlist-items li.active {
          background-color: var(--primary-color);
        }
        
        .file-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .file-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .file-duration {
          font-size: 12px;
          opacity: 0.7;
        }
        
        .remove-file {
          background: none;
          border: none;
          color: var(--on-surface-color);
          opacity: 0.6;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
        }
        
        .remove-file:hover {
          opacity: 1;
        }
        
        .playlist-empty {
          padding: 16px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
        }
        `}
      </style>
    </div>
  );
};

export default PlaylistManager;