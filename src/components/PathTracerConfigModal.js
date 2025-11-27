import React, { useState } from 'react';
import { CloseIcon } from './Icons';
import '../styles/PathTracerConfigModal.css';

function PathTracerConfigModal({ isOpen, onClose, onStart, currentConfig }) {
  const [config, setConfig] = useState(currentConfig || {
    samples: 500,
    minSamples: 1,
    bounces: 5,
    tiles: 2,
    denoise: true,
  });

  if (!isOpen) return null;

  const handleStart = () => {
    onStart(config);
    onClose();
  };

  return (
    <div className="pathtracer-modal-overlay" onClick={onClose}>
      <div className="pathtracer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pathtracer-modal-header">
          <h2>GPU Pathtracer Configuration</h2>
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
                <span className="config-hint">Rendering tiles (higher = more responsive UI, slower overall)</span>
              </label>
              <select
                id="tiles"
                value={config.tiles}
                onChange={(e) => setConfig({ ...config, tiles: parseInt(e.target.value) })}
              >
                <option value="1">1x1 (Fastest)</option>
                <option value="2">2x2 (Balanced)</option>
                <option value="3">3x3 (Responsive)</option>
                <option value="4">4x4 (Most Responsive)</option>
              </select>
            </div>

            <div className="config-item">
              <label htmlFor="minSamples">
                Min Samples to Display
                <span className="config-hint">Samples before showing result</span>
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
          </div>

          <div className="config-presets">
            <h3>Presets</h3>
            <div className="preset-buttons">
              <button
                className="preset-btn"
                onClick={() => setConfig({ samples: 100, minSamples: 1, bounces: 3, tiles: 3, denoise: true })}
              >
                Fast Preview
              </button>
              <button
                className="preset-btn"
                onClick={() => setConfig({ samples: 500, minSamples: 1, bounces: 5, tiles: 2, denoise: true })}
              >
                Balanced
              </button>
              <button
                className="preset-btn"
                onClick={() => setConfig({ samples: 2000, minSamples: 10, bounces: 10, tiles: 2, denoise: true })}
              >
                High Quality
              </button>
            </div>
          </div>

          <div className="config-info">
            <strong>Note:</strong> Pathtracing is computationally intensive and will appear noisy at first. The image progressively refines as more samples are rendered. Higher sample counts and more bounces reduce noise but take longer. The denoising option can help smooth the result. For best quality, let the pathtracer reach the maximum sample count.
          </div>
        </div>

        <div className="pathtracer-modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="start-btn" onClick={handleStart}>
            Start Pathtracing
          </button>
        </div>
      </div>
    </div>
  );
}

export default PathTracerConfigModal;
