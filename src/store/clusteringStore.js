import { create } from 'zustand';

export const useClusteringStore = create((set) => ({
  // Clustering state
  highlightedClusters: new Set(),
  showOnlyHighlightedClusters: false,
  
  // Actions
  setHighlightedClusters: (clusters) => set({ highlightedClusters: clusters }),
  setShowOnlyHighlightedClusters: (show) => set({ showOnlyHighlightedClusters: show }),
  
  // Combined action for cluster highlighting
  highlightClusters: (clusterIndices, showOnlySelected) => set({
    highlightedClusters: clusterIndices,
    showOnlyHighlightedClusters: showOnlySelected,
  }),
  
  // Clear highlighting
  clearHighlighting: () => set({
    highlightedClusters: new Set(),
    showOnlyHighlightedClusters: false,
  }),
}));
