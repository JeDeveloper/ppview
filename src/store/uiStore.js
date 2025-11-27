import { create } from 'zustand';
import { getCurrentColorScheme } from '../colors';

export const useUIStore = create((set) => ({
  // Legend visibility
  showPatchLegend: false,
  showParticleLegend: false,
  
  // 3D scene toggles
  showSimulationBox: false,
  showBackdropPlanes: false,
  showCoordinateAxis: true,
  
  // UI visibility
  isControlsVisible: true,
  showClusteringPane: false,
  
  // File loading state
  filesDropped: false,
  isLoading: false,
  
  // Selection state
  selectedParticles: [],
  
  // Scene reference
  sceneRef: null,
  
  // Iframe and drag-drop
  isIframeMode: false,
  isDragDropEnabled: true,
  
  // Color scheme
  currentColorScheme: getCurrentColorScheme(),
  
  // Playback state
  isPlaying: false,
  playbackSpeed: 500,
  isSpeedPopupVisible: false,
  
  // Pathtracer state
  isPathtracerEnabled: false,
  isPathtracerConfigModalOpen: false,
  pathtracerConfig: {
    samples: 500,
    minSamples: 1,
    bounces: 5,
    tiles: 2,
    denoise: true,
  },
  
  // Actions
  setShowPatchLegend: (show) => set({ showPatchLegend: show }),
  setShowParticleLegend: (show) => set({ showParticleLegend: show }),
  setShowSimulationBox: (show) => set({ showSimulationBox: show }),
  setShowBackdropPlanes: (show) => set({ showBackdropPlanes: show }),
  setShowCoordinateAxis: (show) => set({ showCoordinateAxis: show }),
  setIsControlsVisible: (visible) => set({ isControlsVisible: visible }),
  setShowClusteringPane: (show) => set({ showClusteringPane: show }),
  setFilesDropped: (dropped) => set({ filesDropped: dropped }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSelectedParticles: (particles) => set({ selectedParticles: particles }),
  setSceneRef: (ref) => set({ sceneRef: ref }),
  setIsIframeMode: (isIframe) => set({ isIframeMode: isIframe }),
  setIsDragDropEnabled: (enabled) => set({ isDragDropEnabled: enabled }),
  setCurrentColorScheme: (scheme) => set({ currentColorScheme: scheme }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIsSpeedPopupVisible: (visible) => set({ isSpeedPopupVisible: visible }),
  setIsPathtracerEnabled: (enabled) => set({ isPathtracerEnabled: enabled }),
  setIsPathtracerConfigModalOpen: (open) => set({ isPathtracerConfigModalOpen: open }),
  setPathtracerConfig: (config) => set({ pathtracerConfig: config }),
}));
