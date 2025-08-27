import React, { useState, useEffect } from 'react';
import { colorSchemes, getCurrentColorScheme, saveColorScheme, getParticleColors } from '../colors';
import './ColorSchemeSelector.css';

function ColorSchemeSelector({ onSchemeChange, particleTypeCount = 10 }) {
  const [currentScheme, setCurrentScheme] = useState(getCurrentColorScheme());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Notify parent component of initial scheme
    if (onSchemeChange) {
      onSchemeChange(currentScheme);
    }
  }, []);

  const handleSchemeChange = (schemeName) => {
    setCurrentScheme(schemeName);
    saveColorScheme(schemeName);
    setIsOpen(false);
    
    if (onSchemeChange) {
      onSchemeChange(schemeName);
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
            {colorSchemes[currentScheme]?.name || 'Unknown'}
          </span>
          <ColorPreview schemeName={currentScheme} size={10} />
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>
      
      {isOpen && (
        <div className="scheme-dropdown">
          <div className="scheme-dropdown-content">
            {Object.entries(colorSchemes).map(([key, scheme]) => (
              <button
                key={key}
                className={`scheme-option ${currentScheme === key ? 'selected' : ''}`}
                onClick={() => handleSchemeChange(key)}
              >
                <div className="scheme-option-content">
                  <div className="scheme-info">
                    <span className="scheme-option-name">{scheme.name}</span>
                    <ColorPreview schemeName={key} size={14} />
                  </div>
                  {currentScheme === key && (
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
