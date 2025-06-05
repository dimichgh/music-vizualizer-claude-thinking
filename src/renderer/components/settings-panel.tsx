import React, { useState } from 'react';
import { VisualizationType, DetectionMode } from '../../shared/types';
import { PostProcessingConfig } from '../visualization/post-processing';
import { COLOR_PALETTES } from '../../shared/constants';

interface SettingsPanelProps {
  visualizationType: VisualizationType;
  onVisualizationChange: (type: VisualizationType) => void;
  showInstruments: boolean;
  onShowInstrumentsChange: (show: boolean) => void;
  colorPalette: string;
  onColorPaletteChange: (palette: string) => void;
  intensity: number;
  onIntensityChange: (intensity: number) => void;
  detectionMode?: DetectionMode;
  onDetectionModeChange?: (mode: DetectionMode) => void;
  mlModelsAvailable?: boolean;
  postProcessingConfig?: PostProcessingConfig;
  onPostProcessingChange?: (config: Partial<PostProcessingConfig>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  visualizationType,
  onVisualizationChange,
  showInstruments,
  onShowInstrumentsChange,
  colorPalette,
  onColorPaletteChange,
  intensity,
  onIntensityChange,
  detectionMode = DetectionMode.HYBRID,
  onDetectionModeChange,
  mlModelsAvailable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Toggle settings panel
  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  // Handle visualization type change
  const handleVisualizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVisualizationChange(e.target.value as VisualizationType);
  };

  // Handle instruments toggle
  const handleInstrumentsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onShowInstrumentsChange(e.target.checked);
  };

  // Handle color palette change
  const handleColorPaletteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onColorPaletteChange(e.target.value);
  };

  // Handle intensity change
  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onIntensityChange(parseFloat(e.target.value));
  };

  // Handle detection mode change
  const handleDetectionModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onDetectionModeChange) {
      onDetectionModeChange(e.target.value as DetectionMode);
    }
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <button 
        className="toggle-button"
        onClick={togglePanel}
        title={isOpen ? 'Close Settings' : 'Open Settings'}
      >
        {isOpen ? '×' : '⚙️'}
      </button>
      
      <div className="settings-content">
        <h3>Visualization Settings</h3>
        
        <div className="setting-group">
          <label htmlFor="visualization-type">Visualization Type</label>
          <select 
            id="visualization-type"
            value={visualizationType}
            onChange={handleVisualizationChange}
          >
            <option value={VisualizationType.FREQUENCY}>Frequency Spectrum</option>
            <option value={VisualizationType.WAVEFORM}>Waveform</option>
            <option value={VisualizationType.PARTICLES}>Particles</option>
            <option value={VisualizationType.COSMIC}>Cosmic</option>
          </select>
        </div>
        
        <div className="setting-group">
          <label htmlFor="show-instruments">
            <input 
              type="checkbox"
              id="show-instruments"
              checked={showInstruments}
              onChange={handleInstrumentsToggle}
            />
            Show Instruments
          </label>
        </div>
        
        <div className="setting-group">
          <label htmlFor="color-palette">Color Palette</label>
          <select 
            id="color-palette"
            value={colorPalette}
            onChange={handleColorPaletteChange}
          >
            {Object.keys(COLOR_PALETTES).map(palette => (
              <option key={palette} value={palette}>{
                palette.charAt(0).toUpperCase() + palette.slice(1)
              }</option>
            ))}
          </select>
        </div>
        
        <div className="setting-group">
          <label htmlFor="intensity">Intensity</label>
          <input 
            type="range"
            id="intensity"
            min="0"
            max="1"
            step="0.05"
            value={intensity}
            onChange={handleIntensityChange}
          />
          <span className="intensity-value">{Math.round(intensity * 100)}%</span>
        </div>

        {showInstruments && onDetectionModeChange && (
          <div className="setting-group">
            <label htmlFor="detection-mode">Instrument Detection Mode</label>
            <select 
              id="detection-mode"
              value={detectionMode}
              onChange={handleDetectionModeChange}
              disabled={!mlModelsAvailable && detectionMode !== DetectionMode.FREQUENCY}
            >
              <option value={DetectionMode.FREQUENCY}>Frequency Analysis</option>
              <option 
                value={DetectionMode.ML}
                disabled={!mlModelsAvailable}
              >
                Machine Learning {!mlModelsAvailable && '(Unavailable)'}
              </option>
              <option 
                value={DetectionMode.HYBRID}
                disabled={!mlModelsAvailable}
              >
                Hybrid (ML + Frequency) {!mlModelsAvailable && '(Unavailable)'}
              </option>
            </select>
            {!mlModelsAvailable && detectionMode !== DetectionMode.FREQUENCY && (
              <div className="setting-info-message">
                ML models are not available. Using frequency analysis only.
              </div>
            )}
          </div>
        )}
      </div>
      
      <style>
        {`
        .settings-panel {
          position: absolute;
          top: 16px;
          right: 16px;
          background-color: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 8px;
          transition: all 0.3s ease;
          z-index: 100;
          overflow: hidden;
          width: 60px;
          height: 60px;
        }
        
        .settings-panel.open {
          width: 350px;
          height: auto;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .toggle-button {
          position: absolute;
          top: 0;
          right: 0;
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background-color: var(--surface-color);
          color: var(--on-surface-color);
          border: none;
          font-size: 24px;
          cursor: pointer;
          z-index: 101;
        }
        
        .settings-content {
          padding: 70px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.3s ease;
        }
        
        .open .settings-content {
          opacity: 1;
          transform: translateY(0);
        }
        
        .setting-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .setting-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .setting-group select,
        .setting-group input[type="range"] {
          width: 100%;
          padding: 8px;
          background-color: var(--surface-color);
          color: var(--on-surface-color);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        .setting-group input[type="checkbox"] {
          margin: 0;
        }
        
        .intensity-value {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .setting-info-message {
          font-size: 12px;
          color: #ffcc00;
          margin-top: 4px;
        }
        
        .settings-tabs {
          display: flex;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .tab-button {
          background: none;
          border: none;
          color: var(--on-surface-color);
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          opacity: 0.7;
          transition: all 0.2s ease;
        }
        
        .tab-button.active {
          opacity: 1;
          border-bottom: 2px solid var(--primary-color);
        }
        
        .tab-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .tab-content {
          padding-top: 8px;
        }
        
        .effect-section {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .effect-header {
          margin-bottom: 12px;
          font-weight: 500;
        }
        
        .effect-controls {
          padding-left: 16px;
          margin-top: 8px;
        }
        
        .param-value {
          font-size: 12px;
          opacity: 0.8;
          width: 40px;
          text-align: right;
        }
        `}
      </style>
    </div>
  );
};

export default SettingsPanel;