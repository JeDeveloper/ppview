import React, { useState, useEffect } from 'react';
import { CloseIcon } from './Icons';
import { useUIStore } from '../store/uiStore';
import { lightingPresets, saveLightingPreset } from '../lighting';
import DraggablePanel from './DraggablePanel';
import '../styles/LightingControlsModal.css';

function LightingControlsModal({ isOpen, onClose }) {
  const { currentLightingPreset, setCurrentLightingPreset, lightingSettings, setLightingSettings, isPathtracerEnabled, resetPathtracer } = useUIStore();
  
  // Local state for editing
  const [settings, setSettings] = useState(lightingSettings);

  // Update local state when modal opens or preset changes
  useEffect(() => {
    if (isOpen) {
      setSettings(lightingSettings);
    }
  }, [isOpen, lightingSettings]);

  if (!isOpen) return null;

  const handlePresetChange = (presetName) => {
    const preset = lightingPresets[presetName];
    setCurrentLightingPreset(presetName);
    setLightingSettings(preset);
    setSettings(preset);
    saveLightingPreset(presetName);
    // Reset pathtracer to apply new lighting
    if (isPathtracerEnabled) {
      resetPathtracer();
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setLightingSettings(newSettings);
    // Clear preset selection when manually adjusting
    setCurrentLightingPreset('custom');
    // Reset pathtracer to apply new lighting (debounced by user stopping interaction)
    if (isPathtracerEnabled) {
      resetPathtracer();
    }
  };

  const handlePositionChange = (lightKey, axis, value) => {
    const positionKey = `${lightKey}Position`;
    const currentPosition = [...settings[positionKey]];
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    currentPosition[axisIndex] = parseFloat(value);
    handleSettingChange(positionKey, currentPosition);
  };

  const handleColorChange = (key, value) => {
    handleSettingChange(key, value);
  };

  return (
    <DraggablePanel initialX={20} initialY={20} className="lighting-panel">
      <div className="lighting-modal">
        <div className="lighting-modal-header drag-handle">
          <h2>Scene Lighting Controls</h2>
          <button className="close-btn" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="lighting-modal-body">
          {/* Presets Section */}
          <div className="lighting-section">
            <h3>Presets</h3>
            <div className="preset-buttons">
              {Object.entries(lightingPresets).map(([key, preset]) => (
                <button
                  key={key}
                  className={`preset-btn ${currentLightingPreset === key ? 'active' : ''}`}
                  onClick={() => handlePresetChange(key)}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ambient Lights */}
          <div className="lighting-section">
            <h3>Ambient Lighting</h3>
            
            <div className="control-group">
              <label>Ambient Light Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.ambientIntensity}
                onChange={(e) => handleSettingChange('ambientIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.ambientIntensity.toFixed(2)}</span>
            </div>

            <div className="control-group">
              <label>Hemisphere Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.hemisphereIntensity}
                onChange={(e) => handleSettingChange('hemisphereIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.hemisphereIntensity.toFixed(2)}</span>
            </div>

            <div className="control-row">
              <div className="control-group">
                <label>Sky Color</label>
                <input
                  type="color"
                  value={settings.hemisphereSkyColor}
                  onChange={(e) => handleColorChange('hemisphereSkyColor', e.target.value)}
                />
              </div>
              <div className="control-group">
                <label>Ground Color</label>
                <input
                  type="color"
                  value={settings.hemisphereGroundColor}
                  onChange={(e) => handleColorChange('hemisphereGroundColor', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Key Light */}
          <div className="lighting-section">
            <h3>Key Light (Main)</h3>
            
            <div className="control-group">
              <label>Intensity</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={settings.keyLightIntensity}
                onChange={(e) => handleSettingChange('keyLightIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.keyLightIntensity.toFixed(1)}</span>
            </div>

            <div className="position-controls">
              <label>Position</label>
              <div className="axis-controls">
                {['x', 'y', 'z'].map((axis) => (
                  <div key={axis} className="axis-control">
                    <span className="axis-label">{axis.toUpperCase()}</span>
                    <input
                      type="number"
                      value={settings.keyLightPosition[{ x: 0, y: 1, z: 2 }[axis]]}
                      onChange={(e) => handlePositionChange('keyLight', axis, e.target.value)}
                      step="1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fill Light */}
          <div className="lighting-section">
            <h3>Fill Light</h3>
            
            <div className="control-group">
              <label>Intensity</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.fillLightIntensity}
                onChange={(e) => handleSettingChange('fillLightIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.fillLightIntensity.toFixed(1)}</span>
            </div>

            <div className="position-controls">
              <label>Position</label>
              <div className="axis-controls">
                {['x', 'y', 'z'].map((axis) => (
                  <div key={axis} className="axis-control">
                    <span className="axis-label">{axis.toUpperCase()}</span>
                    <input
                      type="number"
                      value={settings.fillLightPosition[{ x: 0, y: 1, z: 2 }[axis]]}
                      onChange={(e) => handlePositionChange('fillLight', axis, e.target.value)}
                      step="1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rim Light */}
          <div className="lighting-section">
            <h3>Rim Light</h3>
            
            <div className="control-group">
              <label>Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.rimLightIntensity}
                onChange={(e) => handleSettingChange('rimLightIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.rimLightIntensity.toFixed(2)}</span>
            </div>

            <div className="position-controls">
              <label>Position</label>
              <div className="axis-controls">
                {['x', 'y', 'z'].map((axis) => (
                  <div key={axis} className="axis-control">
                    <span className="axis-label">{axis.toUpperCase()}</span>
                    <input
                      type="number"
                      value={settings.rimLightPosition[{ x: 0, y: 1, z: 2 }[axis]]}
                      onChange={(e) => handlePositionChange('rimLight', axis, e.target.value)}
                      step="1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Environment & Post-Processing */}
          <div className="lighting-section">
            <h3>Environment & Effects</h3>
            
            <div className="control-group">
              <label>Environment Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.environmentIntensity}
                onChange={(e) => handleSettingChange('environmentIntensity', parseFloat(e.target.value))}
              />
              <span className="value-display">{settings.environmentIntensity.toFixed(2)}</span>
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.ssaoEnabled}
                  onChange={(e) => handleSettingChange('ssaoEnabled', e.target.checked)}
                />
                <span>Enable SSAO (Ambient Occlusion)</span>
              </label>
            </div>

            {settings.ssaoEnabled && (
              <div className="control-group indented">
                <label>SSAO Intensity</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={settings.ssaoIntensity}
                  onChange={(e) => handleSettingChange('ssaoIntensity', parseFloat(e.target.value))}
                />
                <span className="value-display">{settings.ssaoIntensity.toFixed(0)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="lighting-modal-footer">
          <button className="secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}

export default LightingControlsModal;
