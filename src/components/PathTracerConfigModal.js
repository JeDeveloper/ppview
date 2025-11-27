import React, { useState } from 'react';
import { CloseIcon } from './Icons';
import DraggablePanel from './DraggablePanel';
import { useUIStore } from '../store/uiStore';
import '../styles/PathTracerConfigModal.css';

function PathTracerConfigModal({ isOpen, onClose, onStart, currentConfig, currentSamples }) {
  const [config, setConfig] = useState(currentConfig || {
    samples: 500,
    minSamples: 5,
    bounces: 5,
    tiles: 1,
    denoise: true,
    filterGlossyThreshold: 0.5,
    resolutionScale: 1.0,
    enableMIS: true,
    transparentBackground: false,
  });

  const isPathtracerEnabled = useUIStore(state => state.isPathtracerEnabled);
  const resetPathtracer = useUIStore(state => state.resetPathtracer);

  if (!isOpen) return null;

  const handleApply = () => {
    onStart(config);
    // Reset pathtracer to apply new settings
    resetPathtracer();
    // Don't close the modal - keep it open for monitoring
  };

  return (
    <DraggablePanel initialX={window.innerWidth - 420} initialY={20} className="pathtracer-panel">
      <div className="pathtracer-modal">
        <div className="pathtracer-modal-header drag-handle">
          <h2>GPU Pathtracer</h2>
          <button className="close-btn" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="pathtracer-modal-body">
          <div className="config-section">
            <div className="config-item">
              <label htmlFor="samples">
                Max Samples
                <span className="config-hint">Number of samples per pixel (higher = better quality, slower)</span>
              </label>
              <input
                id="samples"
                type="number"
                min="10"
                max="2000"
                step="10"
                value={config.samples}
                onChange={(e) => setConfig({ ...config, samples: parseInt(e.target.value) })}
              />
              <span className="config-value">{config.samples}</span>
            </div>

            <div className="config-item">
              <label htmlFor="bounces">
                Ray Bounces
                <span className="config-hint">Maximum light bounces (higher = more realistic, slower)</span>
              </label>
              <input
                id="bounces"
                type="number"
                min="1"
                max="10"
                step="1"
                value={config.bounces}
                onChange={(e) => setConfig({ ...config, bounces: parseInt(e.target.value) })}
              />
              <span className="config-value">{config.bounces}</span>
            </div>

            <div className="config-item">
              <label htmlFor="tiles">
                Tile Size
                <span className="config-hint">Use 1x1 to avoid visible tile divisions</span>
              </label>
              <select
                id="tiles"
                value={config.tiles}
                onChange={(e) => setConfig({ ...config, tiles: parseInt(e.target.value) })}
              >
                <option value="1">1x1 (No Tiles - Recommended)</option>
                <option value="2">2x2</option>
                <option value="3">3x3</option>
                <option value="4">4x4</option>
              </select>
            </div>

            <div className="config-item">
              <label htmlFor="minSamples">
                Min Samples to Display
                <span className="config-hint">Tiles visible until this threshold (3-10 recommended)</span>
              </label>
              <input
                id="minSamples"
                type="number"
                min="1"
                max="50"
                step="1"
                value={config.minSamples}
                onChange={(e) => setConfig({ ...config, minSamples: parseInt(e.target.value) })}
              />
              <span className="config-value">{config.minSamples}</span>
            </div>

            <div className="config-item config-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.denoise}
                  onChange={(e) => setConfig({ ...config, denoise: e.target.checked })}
                />
                <span className="checkbox-label">
                  Enable Denoising
                  <span className="config-hint">Reduces noise but may blur details</span>
                </span>
              </label>
            </div>

            <div className="config-item">
              <label htmlFor="filterGlossyThreshold">
                Firefly Filter Threshold
                <span className="config-hint">Higher values reduce white dots (0.0-5.0, 0=off)</span>
              </label>
              <input
                id="filterGlossyThreshold"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={config.filterGlossyThreshold}
                onChange={(e) => setConfig({ ...config, filterGlossyThreshold: parseFloat(e.target.value) })}
              />
              <span className="config-value">{config.filterGlossyThreshold.toFixed(1)}</span>
            </div>

            <div className="config-item">
              <label htmlFor="resolutionScale">
                Resolution Scale
                <span className="config-hint">Render scale (lower = faster, less detail)</span>
              </label>
              <input
                id="resolutionScale"
                type="number"
                min="0.25"
                max="1.0"
                step="0.05"
                value={config.resolutionScale}
                onChange={(e) => setConfig({ ...config, resolutionScale: parseFloat(e.target.value) })}
              />
              <span className="config-value">{(config.resolutionScale * 100).toFixed(0)}%</span>
            </div>

            <div className="config-item config-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.enableMIS}
                  onChange={(e) => setConfig({ ...config, enableMIS: e.target.checked })}
                />
                <span className="checkbox-label">
                  Multiple Importance Sampling
                  <span className="config-hint">Better light sampling, reduces noise</span>
                </span>
              </label>
            </div>

            <div className="config-item config-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.transparentBackground}
                  onChange={(e) => setConfig({ ...config, transparentBackground: e.target.checked })}
                />
                <span className="checkbox-label">
                  Transparent Background
                  <span className="config-hint">Export with alpha channel</span>
                </span>
              </label>
            </div>
          </div>

          <div className="config-presets">
            <h3>Presets</h3>
            <div className="preset-buttons">
              <button
                className="preset-btn"
                onClick={() => setConfig({ 
                  samples: 100, 
                  minSamples: 3, 
                  bounces: 3, 
                  tiles: 1, 
                  denoise: true,
                  filterGlossyThreshold: 1.0,
                  resolutionScale: 0.75,
                  enableMIS: true,
                  transparentBackground: false
                })}
              >
                Fast Preview
              </button>
              <button
                className="preset-btn"
                onClick={() => setConfig({ 
                  samples: 500, 
                  minSamples: 5, 
                  bounces: 5, 
                  tiles: 1, 
                  denoise: true,
                  filterGlossyThreshold: 0.5,
                  resolutionScale: 1.0,
                  enableMIS: true,
                  transparentBackground: false
                })}
              >
                Balanced
              </button>
              <button
                className="preset-btn"
                onClick={() => setConfig({ 
                  samples: 2000, 
                  minSamples: 10, 
                  bounces: 10, 
                  tiles: 1, 
                  denoise: true,
                  filterGlossyThreshold: 0.2,
                  resolutionScale: 1.0,
                  enableMIS: true,
                  transparentBackground: false
                })}
              >
                High Quality
              </button>
            </div>
          </div>

          <div className="config-info">
            <strong>Tip:</strong> If you see white dots (fireflies), increase the Firefly Filter Threshold to 1.0-2.0. Enable MIS for better light sampling. Lower Resolution Scale for faster preview, then increase for final render.
          </div>
        </div>

        <div className="pathtracer-modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            Close
          </button>
          <button className="start-btn" onClick={handleApply}>
            {isPathtracerEnabled ? 'Apply Changes' : 'Start Pathtracing'}
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}

export default PathTracerConfigModal;
