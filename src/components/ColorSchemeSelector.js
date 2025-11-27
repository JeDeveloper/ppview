import React, { useState } from 'react';
import { colorSchemes, saveColorScheme, getParticleColors } from '../colors';
import { useParticleStore } from '../store/particleStore';
import { useUIStore } from '../store/uiStore';
import './ColorSchemeSelector.css';

function ColorSchemeSelector() {
  // Get data from Zustand stores
  const getUniqueParticleTypes = useParticleStore(state => state.getUniqueParticleTypes);
  const { currentColorScheme, setCurrentColorScheme, isPathtracerEnabled, resetPathtracer } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const particleTypeCount = getUniqueParticleTypes().size || 10;

  const handleSchemeChange = (schemeName) => {
    setCurrentColorScheme(schemeName);
    saveColorScheme(schemeName);
    setIsOpen(false);
    // Reset pathtracer to apply new colors
    if (isPathtracerEnabled) {
      resetPathtracer();
    }
  };

  const getColorsForPreview = (schemeName) => {
    // Get colors for the scheme using the actual particle type count
    // This ensures the preview reflects the actual colors used in the system
    return getParticleColors(schemeName, particleTypeCount);
  };

  const ColorPreview = ({ schemeName, size = 12 }) => {
    const colors = getColorsForPreview(schemeName);
    return (
      <div className="color-preview">
        {colors.slice(0, 5).map((color, index) => (
          <div
            key={index}
            className="color-dot"
            style={{
              backgroundColor: color,
              width: size,
              height: size,
            }}
          />
        ))}
        {colors.length > 5 && (
          <span className="color-more">+{colors.length - 5}</span>
        )}
      </div>
    );
  };

  return (
    <div className="color-scheme-selector">
      <div className="scheme-selector-header">
        <label className="scheme-label">Color Scheme:</label>
        <button
          className="current-scheme-button"
          onClick={() => setIsOpen(!isOpen)}
          title="Select particle color scheme"
        >
          <span className="scheme-name">
            {colorSchemes[currentColorScheme]?.name || 'Unknown'}
          </span>
          <ColorPreview schemeName={currentColorScheme} size={10} />
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>
      
      {isOpen && (
        <div className="scheme-dropdown">
          <div className="scheme-dropdown-content">
            {Object.entries(colorSchemes).map(([key, scheme]) => (
              <button
                key={key}
                className={`scheme-option ${currentColorScheme === key ? 'selected' : ''}`}
                onClick={() => handleSchemeChange(key)}
              >
                <div className="scheme-option-content">
                  <div className="scheme-info">
                    <span className="scheme-option-name">{scheme.name}</span>
                    <ColorPreview schemeName={key} size={14} />
                  </div>
                  {currentColorScheme === key && (
                    <span className="selected-indicator">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorSchemeSelector;
