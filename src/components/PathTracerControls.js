import React, { useState } from 'react';
import './PathTracerControls.css';

const PathTracerControls = ({ enabled, onEnableChange, settings, onSettingsChange, onClose }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 });

    const handleMouseDown = (e) => {
        if (e.target.closest('.pathtracer-control') || e.target.closest('.enable-toggle')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };

    const handleMouseMove = React.useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            });
        }
    }, [isDragging, dragOffset]);

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            className="pathtracer-controls-window"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="pathtracer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3>GPU Path Tracer</h3>
                    <label className="enable-toggle" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => onEnableChange(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#4CAF50' }}
                        />
                    </label>
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="pathtracer-content">
                <div className="pathtracer-control">
                    <label>
                        Bounces
                        <span className="value">{settings.bounces}</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={settings.bounces}
                        onChange={(e) => onSettingsChange({ ...settings, bounces: parseInt(e.target.value) })}
                    />
                </div>

                <div className="pathtracer-control">
                    <label>
                        Samples Per Frame
                        <span className="value">{settings.samplesPerFrame}</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={settings.samplesPerFrame}
                        onChange={(e) => onSettingsChange({ ...settings, samplesPerFrame: parseInt(e.target.value) })}
                    />
                </div>

                <div className="pathtracer-control">
                    <label>
                        Tiles
                        <span className="value">{settings.tiles.x} × {settings.tiles.y}</span>
                    </label>
                    <select
                        value={`${settings.tiles.x}x${settings.tiles.y}`}
                        onChange={(e) => {
                            const [x, y] = e.target.value.split('x').map(Number);
                            onSettingsChange({ ...settings, tiles: { x, y } });
                        }}
                    >
                        <option value="2x2">2 × 2</option>
                        <option value="3x3">3 × 3</option>
                        <option value="4x4">4 × 4</option>
                        <option value="5x5">5 × 5</option>
                    </select>
                </div>

                <div className="pathtracer-control">
                    <label>
                        Filter Glossy Factor
                        <span className="value">{settings.filterGlossyFactor.toFixed(2)}</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.filterGlossyFactor}
                        onChange={(e) => onSettingsChange({ ...settings, filterGlossyFactor: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="pathtracer-control checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={settings.enableDenoise}
                            onChange={(e) => onSettingsChange({ ...settings, enableDenoise: e.target.checked })}
                        />
                        Enable Denoising
                    </label>
                </div>

                <div className="pathtracer-control checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={settings.multipleImportanceSampling}
                            onChange={(e) => onSettingsChange({ ...settings, multipleImportanceSampling: e.target.checked })}
                        />
                        Multiple Importance Sampling
                    </label>
                </div>

                <div className="pathtracer-info">
                    <p>Samples: <strong>{settings.currentSamples || 0}</strong></p>
                </div>
            </div>
        </div>
    );
};

export default PathTracerControls;
