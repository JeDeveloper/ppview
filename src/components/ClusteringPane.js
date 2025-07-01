import React, { useState, useEffect, useMemo } from 'react';
import './ClusteringPane.css';

// DBSCAN clustering algorithm implementation
function dbscan(points, epsilon, minPoints) {
  const clusters = [];
  const visited = new Set();
  const clustered = new Set();

  function regionQuery(pointIndex) {
    const neighbors = [];
    const point = points[pointIndex];
    
    for (let i = 0; i < points.length; i++) {
      if (i === pointIndex) continue;
      const neighbor = points[i];
      const distance = Math.sqrt(
        Math.pow(point.x - neighbor.x, 2) +
        Math.pow(point.y - neighbor.y, 2) +
        Math.pow(point.z - neighbor.z, 2)
      );
      
      if (distance <= epsilon) {
        neighbors.push(i);
      }
    }
    
    return neighbors;
  }

  function expandCluster(pointIndex, neighbors, cluster) {
    cluster.push(pointIndex);
    clustered.add(pointIndex);
    
    let i = 0;
    while (i < neighbors.length) {
      const neighborIndex = neighbors[i];
      
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex);
        const neighborNeighbors = regionQuery(neighborIndex);
        
        if (neighborNeighbors.length >= minPoints) {
          // Merge neighbors
          for (const newNeighbor of neighborNeighbors) {
            if (!neighbors.includes(newNeighbor)) {
              neighbors.push(newNeighbor);
            }
          }
        }
      }
      
      if (!clustered.has(neighborIndex)) {
        cluster.push(neighborIndex);
        clustered.add(neighborIndex);
      }
      
      i++;
    }
  }

  // Main DBSCAN algorithm
  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    
    visited.add(i);
    const neighbors = regionQuery(i);
    
    if (neighbors.length < minPoints) {
      // Point is noise
      continue;
    } else {
      // Start a new cluster
      const cluster = [];
      expandCluster(i, neighbors, cluster);
      clusters.push(cluster);
    }
  }

  return clusters;
}

// Generate histogram data - shows how many clusters have each size
function generateHistogram(clusterSizes) {
  if (clusterSizes.length === 0) return [];
  
  // Create a frequency map of cluster sizes
  const sizeFrequency = new Map();
  clusterSizes.forEach(size => {
    sizeFrequency.set(size, (sizeFrequency.get(size) || 0) + 1);
  });
  
  // Convert to array format for visualization
  const bins = Array.from(sizeFrequency.entries())
    .map(([size, count]) => ({
      size: size,
      count: count,
      label: `${size} particles`
    }))
    .sort((a, b) => a.size - b.size); // Sort by cluster size
  
  return bins;
}

function ClusteringPane({ 
  positions, 
  boxSize, 
  onHighlightClusters = () => {}, 
  colorScheme = null 
}) {
  const [epsilon, setEpsilon] = useState(2.0);
  const [minPoints, setMinPoints] = useState(3);
  const [selectedClusters, setSelectedClusters] = useState(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Compute clusters when parameters change
  const clusters = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    try {
      return dbscan(positions, epsilon, minPoints);
    } catch (error) {
      console.error('Error computing clusters:', error);
      return [];
    }
  }, [positions, epsilon, minPoints]);

  // Compute statistics
  const statistics = useMemo(() => {
    const clusterSizes = clusters.map(cluster => cluster.length);
    const totalClustered = clusterSizes.reduce((sum, size) => sum + size, 0);
    const noise = positions ? positions.length - totalClustered : 0;
    
    return {
      totalClusters: clusters.length,
      totalParticles: positions ? positions.length : 0,
      clusteredParticles: totalClustered,
      noiseParticles: noise,
      clusterSizes,
      avgClusterSize: clusters.length > 0 ? totalClustered / clusters.length : 0,
      maxClusterSize: clusterSizes.length > 0 ? Math.max(...clusterSizes) : 0,
      minClusterSize: clusterSizes.length > 0 ? Math.min(...clusterSizes) : 0
    };
  }, [clusters, positions]);

  // Generate histogram data
  const histogramData = useMemo(() => {
    return generateHistogram(statistics.clusterSizes);
  }, [statistics.clusterSizes]);

  // Handle cluster selection
  const handleClusterToggle = (clusterIndex) => {
    const newSelected = new Set(selectedClusters);
    if (newSelected.has(clusterIndex)) {
      newSelected.delete(clusterIndex);
    } else {
      newSelected.add(clusterIndex);
    }
    setSelectedClusters(newSelected);
  };

  // Select all clusters
  const selectAllClusters = () => {
    setSelectedClusters(new Set(clusters.map((_, index) => index)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedClusters(new Set());
  };

  // Notify parent about highlighted clusters
  useEffect(() => {
    const highlightedParticleIndices = new Set();
    
    if (showOnlySelected && selectedClusters.size > 0) {
      selectedClusters.forEach(clusterIndex => {
        if (clusters[clusterIndex]) {
          clusters[clusterIndex].forEach(particleIndex => {
            highlightedParticleIndices.add(particleIndex);
          });
        }
      });
    }
    
    onHighlightClusters(highlightedParticleIndices, showOnlySelected);
  }, [clusters, selectedClusters, showOnlySelected, onHighlightClusters]);

  if (!isVisible) {
    return (
      <div className="clustering-pane-toggle">
        <button 
          className="toggle-clustering-button"
          onClick={() => setIsVisible(true)}
          title="Show Clustering Panel"
        >
          📊 Clustering
        </button>
      </div>
    );
  }

  return (
    <div className="clustering-pane">
      <div className="clustering-header">
        <h3>Particle Clustering</h3>
        <button 
          className="close-button"
          onClick={() => setIsVisible(false)}
          title="Hide Clustering Panel"
        >
          ✕
        </button>
      </div>

      {/* Clustering Parameters */}
      <div className="clustering-controls">
        <div className="parameter-control">
          <label htmlFor="epsilon-slider">
            Epsilon Distance: {epsilon.toFixed(2)}
          </label>
          <input
            id="epsilon-slider"
            type="range"
            min="0.5"
            max="10.0"
            step="0.1"
            value={epsilon}
            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            className="parameter-slider"
          />
        </div>

        <div className="parameter-control">
          <label htmlFor="minpoints-slider">
            Min Points: {minPoints}
          </label>
          <input
            id="minpoints-slider"
            type="range"
            min="2"
            max="20"
            step="1"
            value={minPoints}
            onChange={(e) => setMinPoints(parseInt(e.target.value))}
            className="parameter-slider"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="clustering-statistics">
        <h4>Statistics</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Clusters:</span>
            <span className="stat-value">{statistics.totalClusters}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Clustered Particles:</span>
            <span className="stat-value">{statistics.clusteredParticles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Noise Particles:</span>
            <span className="stat-value">{statistics.noiseParticles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Cluster Size:</span>
            <span className="stat-value">{statistics.avgClusterSize.toFixed(1)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max Cluster Size:</span>
            <span className="stat-value">{statistics.maxClusterSize}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Min Cluster Size:</span>
            <span className="stat-value">{statistics.minClusterSize}</span>
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div className="clustering-histogram">
        <h4>Cluster Size Distribution</h4>
        <div className="histogram-container">
          {histogramData.length > 0 ? (
            <>
              <div style={{ position: 'relative' }}>
                <div className="histogram-y-axis">Count</div>
                <div className="histogram-bars">
                  {histogramData.map((bin, index) => {
                    const maxCount = Math.max(...histogramData.map(b => b.count));
                    
                    // Simple linear scaling with minimum height for visibility
                    const linearHeight = maxCount > 0 ? (bin.count / maxCount) * 85 : 0; // Use 85% max to leave room for labels
                    const minHeight = 3; // Minimum 3% height for any bar
                    const finalHeight = Math.max(linearHeight, bin.count > 0 ? minHeight : 0);
                    
                    return (
                      <div key={`size-${bin.size}`} className="histogram-bar-container">
                        <div 
                          className="histogram-bar"
                          style={{ 
                            height: `${finalHeight}%`
                          }}
                          title={`${bin.count} clusters with ${bin.size} particles`}
                        />
                        <div className="histogram-labels">
                          <span className="histogram-label-count">{bin.count}</span>
                          <span className="histogram-label-size">{bin.size}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="histogram-axis-labels">
                <span>Cluster Size (particles)</span>
              </div>
            </>
          ) : (
            <div className="histogram-empty">
              <span>No clusters found</span>
            </div>
          )}
        </div>
      </div>

      {/* Cluster Selection */}
      <div className="cluster-selection">
        <div className="selection-controls">
          <h4>Cluster Highlighting</h4>
          <div className="selection-buttons">
            <button onClick={selectAllClusters} className="select-button">
              Select All
            </button>
            <button onClick={clearSelection} className="select-button">
              Clear All
            </button>
          </div>
          <label className="highlight-checkbox">
            <input
              type="checkbox"
              checked={showOnlySelected}
              onChange={(e) => setShowOnlySelected(e.target.checked)}
            />
            <span>Show only selected clusters</span>
          </label>
        </div>

        {clusters.length > 0 && (
          <div className="cluster-list">
            <div className="cluster-list-header">
              <span>Cluster (Size)</span>
              <span>Selected</span>
            </div>
            <div className="cluster-items">
              {clusters
                .map((cluster, index) => ({ cluster, originalIndex: index }))
                .sort((a, b) => b.cluster.length - a.cluster.length) // Sort by size (largest first)
                .map(({ cluster, originalIndex }, sortedIndex) => (
                  <div key={originalIndex} className="cluster-item">
                    <span className="cluster-info">
                      Cluster {originalIndex + 1} ({cluster.length} particles)
                    </span>
                    <label className="cluster-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedClusters.has(originalIndex)}
                        onChange={() => handleClusterToggle(originalIndex)}
                      />
                    </label>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClusteringPane;
