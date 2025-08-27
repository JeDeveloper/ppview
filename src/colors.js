// src/colors.js

// Define multiple color schemes
export const colorSchemes = {
  muted: {
    name: 'Muted Colors',
    colors: [
      '#8B0000', // Dark Red
      '#2F4F4F', // Dark Slate Gray
      '#556B2F', // Dark Olive Green
      '#9932CC', // Dark Orchid
      '#8B008B', // Dark Magenta
      '#FF4500', // Orange Red
      '#00CED1', // Dark Turquoise
      '#9400D3', // Dark Violet
      '#FF1493', // Deep Pink
      '#1E90FF', // Dodger Blue
    ]
  },
  bright: {
    name: 'Bright Colors',
    colors: [
      '#FF0000', // Red
      '#00FF00', // Green
      '#0000FF', // Blue
      '#FFFF00', // Yellow
      '#FF00FF', // Magenta
      '#00FFFF', // Cyan
      '#FFA500', // Orange
      '#800080', // Purple
      '#FFC0CB', // Pink
      '#A52A2A', // Brown
    ]
  },
  pastel: {
    name: 'Pastel Colors',
    colors: [
      '#FFB3BA', // Light Pink
      '#FFDFBA', // Light Orange
      '#FFFFBA', // Light Yellow
      '#BAFFC9', // Light Green
      '#BAE1FF', // Light Blue
      '#E1BAFF', // Light Purple
      '#FFBAE1', // Light Magenta
      '#C9FFBA', // Light Lime
      '#FFBAC9', // Light Rose
      '#BAD7FF', // Light Sky Blue
    ]
  },
  scientific: {
    name: 'Scientific Palette',
    colors: [
      '#1f77b4', // Blue
      '#ff7f0e', // Orange
      '#2ca02c', // Green
      '#d62728', // Red
      '#9467bd', // Purple
      '#8c564b', // Brown
      '#e377c2', // Pink
      '#7f7f7f', // Gray
      '#bcbd22', // Olive
      '#17becf', // Cyan
    ]
  },
  colorblind: {
    name: 'Colorblind Friendly',
    colors: [
      '#000000', // Black
      '#E69F00', // Orange
      '#56B4E9', // Sky Blue
      '#009E73', // Bluish Green
      '#F0E442', // Yellow
      '#0072B2', // Blue
      '#D55E00', // Vermillion
      '#CC79A7', // Reddish Purple
      '#999999', // Gray
      '#FFFFFF', // White
    ]
  },
  viridis: {
    name: 'Viridis',
    colors: [
      '#440154', // Dark Purple
      '#482777', // Purple
      '#3f4a8a', // Blue Purple
      '#31678e', // Blue
      '#26838f', // Teal
      '#1f9d8a', // Green Teal
      '#6cce5a', // Green
      '#b6de2b', // Yellow Green
      '#fee825', // Yellow
      '#f9fb0e', // Bright Yellow
    ]
  },
  oxview: {
    name: 'oxView Nucleosides',
    colors: [
      '#4747B8', // A or K; Royal Blue
      '#FFFF33', // G or C; Medium Yellow
      '#8CFF8C', // C or A; Medium Green
      '#FF3333', // T/U or T; Red
      '#660000', // E; Dark Brown
      '#FF7042', // S; Medium Orange
      '#A00042', // D; Dark Rose
      '#FF7C70', // N; Light Salmon
      '#FF4C4C', // Q; Dark Salmon
      '#7070FF', // H; Medium Blue
      '#EBEBEB', // G; Light Grey
      '#525252', // P; Dark Grey
      '#00007C', // R; Dark Blue
      '#5E005E', // V; Dark Purple
      '#004C00', // I; Dark Green
      '#455E45', // L; Olive Green
      '#B8A042', // M; Light Brown
      '#534C42', // F; Olive Grey
      '#8C704C', // Y; Medium Brown
      '#4F4600', // W; Olive Brown
    ]
  }
};

// Default scheme
const DEFAULT_SCHEME = 'oxview';
const STORAGE_KEY = 'ppview_color_scheme';

// Get current color scheme from localStorage or default
export const getCurrentColorScheme = () => {
  try {
    const savedScheme = localStorage.getItem(STORAGE_KEY);
    if (savedScheme && colorSchemes[savedScheme]) {
      return savedScheme;
    }
  } catch (error) {
    console.warn('Failed to load color scheme from localStorage:', error);
  }
  return DEFAULT_SCHEME;
};

// Save color scheme to localStorage
export const saveColorScheme = (schemeName) => {
  try {
    if (colorSchemes[schemeName]) {
      localStorage.setItem(STORAGE_KEY, schemeName);
      return true;
    }
  } catch (error) {
    console.warn('Failed to save color scheme to localStorage:', error);
  }
  return false;
};

// Get colors for current scheme
export const getParticleColors = (schemeName = null) => {
  const scheme = schemeName || getCurrentColorScheme();
  return colorSchemes[scheme]?.colors || colorSchemes[DEFAULT_SCHEME].colors;
};

// Backward compatibility - this will use the current selected scheme
export const mutedParticleColors = getParticleColors();

