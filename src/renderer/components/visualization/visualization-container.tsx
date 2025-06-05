import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VisualizationManager } from '../../visualization/visualization-manager';
import { AudioAnalysisData, VisualizationType } from '../../../shared/types';
import { PostProcessingConfig } from '../../visualization/post-processing';

interface VisualizationContainerProps {
  audioFile: string | null;
  isPlaying: boolean;
  audioData?: AudioAnalysisData;
  visualizationType?: VisualizationType;
  postProcessingConfig?: PostProcessingConfig;
}

const VisualizationContainer: React.FC<VisualizationContainerProps> = ({
  audioFile,
  isPlaying,
  audioData,
  visualizationType,
  postProcessingConfig
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualizationManagerRef = useRef<VisualizationManager | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Create visualization manager
    const visualizationManager = new VisualizationManager(scene);
    visualizationManager.setRenderingContext(renderer, camera);
    visualizationManager.init();
    visualizationManagerRef.current = visualizationManager;
    
    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Update and render using visualization manager
      if (visualizationManager) {
        visualizationManager.render();
      }
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Update visualization manager
      if (visualizationManager) {
        visualizationManager.handleResize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Dispose visualization manager
      if (visualizationManagerRef.current) {
        visualizationManagerRef.current.dispose();
        visualizationManagerRef.current = null;
      }
      
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  // Effect for handling audio file changes
  useEffect(() => {
    if (audioFile) {
      console.log('Audio file changed, update visualization');
      // In the future, this will handle audio loading and analysis
    }
  }, [audioFile]);
  
  // Effect for handling audio data updates
  useEffect(() => {
    if (audioData && visualizationManagerRef.current) {
      visualizationManagerRef.current.update(audioData);
    }
  }, [audioData]);
  
  // Effect for handling visualization type changes
  useEffect(() => {
    if (visualizationType && visualizationManagerRef.current) {
      visualizationManagerRef.current.setVisualizationType(visualizationType);
    }
  }, [visualizationType]);
  
  // Effect for handling post-processing configuration changes
  useEffect(() => {
    if (postProcessingConfig && visualizationManagerRef.current) {
      visualizationManagerRef.current.setPostProcessingConfig(postProcessingConfig);
    }
  }, [postProcessingConfig]);

  // Effect for handling play/pause
  useEffect(() => {
    console.log(`Playback state: ${isPlaying ? 'playing' : 'paused'}`);
    // In the future, this will control audio playback
  }, [isPlaying]);

  return (
    <div className="visualization-container" ref={containerRef}>
      {!audioFile && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <h2>No audio file loaded</h2>
          <p>Click "Open File" to select a WAV file for visualization</p>
        </div>
      )}
    </div>
  );
};

export default VisualizationContainer;