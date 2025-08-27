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
//
//   function colorFromInt(number) {
//    const hue = number * 137.508; // use golden angle approximation
//    return new THREE.Color(`hsl(${hue},50%,65%)`);
// }
  oxview: {
    name: 'oxView Golden Angle',
    // Use golden angle formula for distinct colors
    generateColor: (number) => {
      //let cnumber = number + 0
      const hue = number * 137.508; // use golden angle approximation
      // Convert HSL to hex for consistency with other schemes
      const hslToHex = (h, s, l) => {
        h = h % 360;
        s = s / 100;
        l = l / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        if (0 <= h && h < 60) {
          r = c; g = x; b = 0;
        } else if (60 <= h && h < 120) {
          r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
          r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
          r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
          r = x; g = 0; b = c;
        } else {
          r = c; g = 0; b = x;
        }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      };
      return hslToHex(hue, 50, 65);
    },
    colors: [] // Will be populated dynamically
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

// Get colors for current scheme with optional count parameter
export const getParticleColors = (schemeName = null, particleTypeCount = null) => {
  const scheme = schemeName || getCurrentColorScheme();
  const colorScheme = colorSchemes[scheme] || colorSchemes[DEFAULT_SCHEME];
  
  // Handle dynamic color generation (like oxview golden angle)
  if (colorScheme.generateColor && typeof colorScheme.generateColor === 'function') {
    // For dynamic schemes, use the actual number of particle types if provided
    // Otherwise fall back to a reasonable default
    const numColors = particleTypeCount || 50;
    const generatedColors = [];
    for (let i = 0; i < numColors; i++) {
      generatedColors.push(colorScheme.generateColor(i));
    }
    return generatedColors;
  }
  
  // For static color schemes, return the colors array
  return colorScheme.colors;
};

// Backward compatibility - this will use the current selected scheme
export const mutedParticleColors = getParticleColors();

