// Lighting configuration presets for PPView

export const lightingPresets = {
  default: {
    name: 'Default (Studio)',
    description: 'Balanced studio lighting with SSAO',
    // Ambient and hemisphere
    ambientIntensity: 0.3,
    hemisphereIntensity: 0.25,
    hemisphereSkyColor: '#87CEEB',
    hemisphereGroundColor: '#2C2C2C',
    // Directional lights
    keyLightIntensity: 1.2,
    keyLightPosition: [20, 25, 15],
    fillLightIntensity: 0.4,
    fillLightPosition: [-15, 10, -10],
    rimLightIntensity: 0.3,
    rimLightPosition: [-8, 5, -12],
    bottomFillIntensity: 0.15,
    // Environment
    environmentIntensity: 0.3,
    // Post-processing
    ssaoEnabled: true,
    ssaoIntensity: 12,
  },
  bright: {
    name: 'Bright Laboratory',
    description: 'High-key lighting for clear visibility',
    ambientIntensity: 0.5,
    hemisphereIntensity: 0.4,
    hemisphereSkyColor: '#FFFFFF',
    hemisphereGroundColor: '#444444',
    keyLightIntensity: 1.5,
    keyLightPosition: [20, 25, 15],
    fillLightIntensity: 0.6,
    fillLightPosition: [-15, 10, -10],
    rimLightIntensity: 0.4,
    rimLightPosition: [-8, 5, -12],
    bottomFillIntensity: 0.3,
    environmentIntensity: 0.5,
    ssaoEnabled: true,
    ssaoIntensity: 8,
  },
  dramatic: {
    name: 'Dramatic',
    description: 'High contrast with strong shadows',
    ambientIntensity: 0.1,
    hemisphereIntensity: 0.1,
    hemisphereSkyColor: '#87CEEB',
    hemisphereGroundColor: '#000000',
    keyLightIntensity: 2.0,
    keyLightPosition: [30, 40, 20],
    fillLightIntensity: 0.2,
    fillLightPosition: [-20, 10, -15],
    rimLightIntensity: 0.6,
    rimLightPosition: [-10, 8, -15],
    bottomFillIntensity: 0.05,
    environmentIntensity: 0.2,
    ssaoEnabled: true,
    ssaoIntensity: 18,
  },
  soft: {
    name: 'Soft Ambient',
    description: 'Gentle, diffused lighting',
    ambientIntensity: 0.6,
    hemisphereIntensity: 0.5,
    hemisphereSkyColor: '#E0F0FF',
    hemisphereGroundColor: '#3A3A3A',
    keyLightIntensity: 0.8,
    keyLightPosition: [15, 20, 10],
    fillLightIntensity: 0.5,
    fillLightPosition: [-12, 8, -8],
    rimLightIntensity: 0.2,
    rimLightPosition: [-6, 4, -10],
    bottomFillIntensity: 0.25,
    environmentIntensity: 0.4,
    ssaoEnabled: true,
    ssaoIntensity: 6,
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean lighting with minimal shadows',
    ambientIntensity: 0.7,
    hemisphereIntensity: 0.3,
    hemisphereSkyColor: '#FFFFFF',
    hemisphereGroundColor: '#666666',
    keyLightIntensity: 1.0,
    keyLightPosition: [20, 25, 15],
    fillLightIntensity: 0.8,
    fillLightPosition: [-15, 10, -10],
    rimLightIntensity: 0.5,
    rimLightPosition: [-8, 5, -12],
    bottomFillIntensity: 0.4,
    environmentIntensity: 0.6,
    ssaoEnabled: false,
    ssaoIntensity: 0,
  },
};

// Default preset
const DEFAULT_PRESET = 'default';
const STORAGE_KEY = 'ppview_lighting_preset';
const SETTINGS_STORAGE_KEY = 'ppview_lighting_settings';

// Get current lighting preset from localStorage or default
export const getCurrentLightingPreset = () => {
  try {
    const savedPreset = localStorage.getItem(STORAGE_KEY);
    if (savedPreset && (lightingPresets[savedPreset] || savedPreset === 'custom')) {
      return savedPreset;
    }
  } catch (error) {
    console.warn('Failed to load lighting preset from localStorage:', error);
  }
  return DEFAULT_PRESET;
};

// Save lighting preset to localStorage
export const saveLightingPreset = (presetName) => {
  try {
    localStorage.setItem(STORAGE_KEY, presetName);
    return true;
  } catch (error) {
    console.warn('Failed to save lighting preset to localStorage:', error);
  }
  return false;
};

// Get lighting settings from localStorage
export const getLightingSettings = () => {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
  } catch (error) {
    console.warn('Failed to load lighting settings from localStorage:', error);
  }
  return lightingPresets[DEFAULT_PRESET];
};

// Save lighting settings to localStorage
export const saveLightingSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.warn('Failed to save lighting settings to localStorage:', error);
  }
  return false;
};

// Get lighting configuration for a preset
export const getLightingConfig = (presetName = null) => {
  const preset = presetName || getCurrentLightingPreset();
  return lightingPresets[preset] || lightingPresets[DEFAULT_PRESET];
};
