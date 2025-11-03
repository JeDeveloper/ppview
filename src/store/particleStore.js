import { create } from 'zustand';

export const useParticleStore = create((set, get) => ({
  // Particle and trajectory data
  positions: [],
  currentBoxSize: [34.199520111084, 34.199520111084, 34.199520111084],
  topData: null,
  trajFile: null,
  configIndex: [],
  currentConfigIndex: 0,
  currentTime: 0,
  currentEnergy: [],
  totalConfigs: 0,
  
  // Actions
  setPositions: (positions) => set({ positions }),
  setCurrentBoxSize: (boxSize) => set({ currentBoxSize: boxSize }),
  setTopData: (topData) => set({ topData }),
  setTrajFile: (trajFile) => set({ trajFile }),
  setConfigIndex: (index) => set({ configIndex: index }),
  setCurrentConfigIndex: (index) => set({ currentConfigIndex: index }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setCurrentEnergy: (energy) => set({ currentEnergy: energy }),
  setTotalConfigs: (total) => set({ totalConfigs: total }),
  
  // Computed values
  getUniqueParticleTypes: () => {
    const { positions } = get();
    return new Set(positions.map(pos => pos.typeIndex).filter(type => type !== undefined));
  },
}));
