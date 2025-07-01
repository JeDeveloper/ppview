# Clustering Pane Feature Documentation

## Overview

The Clustering Pane is a comprehensive particle analysis tool that implements DBSCAN (Density-Based Spatial Clustering of Applications with Noise) clustering algorithm to identify and visualize particle clusters in molecular dynamics simulations.

## Features

### 🔬 **DBSCAN Clustering Algorithm**
- **Epsilon Distance**: Controls the maximum distance between particles to be considered neighbors
- **Minimum Points**: Sets the minimum number of particles required to form a cluster
- **Real-time computation**: Clusters are recalculated automatically when parameters change
- **Noise detection**: Particles that don't belong to any cluster are identified as noise

### 📊 **Statistics Dashboard**
- **Total Clusters**: Number of clusters found
- **Clustered Particles**: Number of particles belonging to clusters
- **Noise Particles**: Number of particles not belonging to any cluster
- **Average Cluster Size**: Mean number of particles per cluster
- **Min/Max Cluster Size**: Smallest and largest cluster sizes

### 📈 **Histogram Visualization**
- **X-axis**: Cluster size (number of particles)
- **Y-axis**: Count of clusters with that size
- **Logarithmic scaling**: Better visibility of differences between counts
- **Minimum bar height**: Ensures all bars are visible even with small differences
- **Interactive bars**: Hover to see detailed information
- **Example**: "3 clusters with 5 particles each" appears as a bar at X=5 with height=3

### 🎯 **Selective Highlighting**
- **Size-Ordered List**: Clusters are ordered by size (largest first) for easy analysis
- **Individual Selection**: Check/uncheck clusters from the list
- **Bulk Operations**: Select all or clear all clusters
- **Visual Enhancement**: Selected clusters are enlarged (1.3x scale) while maintaining original colors
- **Focus Mode**: "Show only selected clusters" dims and shrinks non-selected particles
- **Patch Filtering**: When "show only selected" is enabled, patches are only shown for visible particles
- **Clear All Behavior**: When no clusters are selected with "show only" enabled, all patches are hidden

## User Interface

### 🎛️ **Controls**
1. **Epsilon Slider**: Range 0.5-10.0 with 0.1 increments
2. **Min Points Slider**: Range 2-20 with integer steps
3. **Select All/Clear All**: Bulk cluster selection buttons
4. **Show Only Selected**: Toggle to focus on selected clusters
5. **Collapsible Panel**: Can be hidden/shown via toggle button

### 🎨 **Visual Feedback**
- **Normal Particles**: Original type-based colors
- **Selected Particles**: Yellow highlighting (existing selection system)
- **Highlighted Clusters**: Original colors but enlarged (1.3x scale)
- **Dimmed Particles**: Gray and small (0.3x scale) when not in selected clusters
- **Patches**: Only shown for visible particles when cluster filtering is active

## Technical Implementation

### 📁 **Files Created/Modified**
- `src/components/ClusteringPane.js` - Main clustering component
- `src/components/ClusteringPane.css` - Styling for the clustering pane
- `src/components/ClusteringPane.test.js` - Comprehensive test suite
- `src/App.js` - Integration with main application
- `src/components/ParticleScene.js` - Props passing for cluster data
- `src/components/Particles.js` - Visual rendering of clusters and patch filtering

### ⚡ **Performance Optimizations**
- **Memoized calculations**: Clustering computation only when parameters change
- **Efficient rendering**: Uses React optimization patterns
- **Instanced rendering**: Leverages existing Three.js instanced mesh system
- **Smart updates**: Only updates what's necessary during interactions
- **Logarithmic histogram scaling**: Improved visual representation without performance impact
- **Smart cluster ordering**: Size-based sorting for better user experience

### 🧪 **Algorithm Details**
```javascript
// DBSCAN Parameters
epsilon: 2.0,        // Default distance threshold
minPoints: 3,        // Default minimum cluster size

// Distance calculation (Euclidean)
distance = sqrt((x1-x2)² + (y1-y2)² + (z1-z2)²)

// Clustering process
1. For each particle, find neighbors within epsilon distance
2. If neighbors >= minPoints, start new cluster
3. Expand cluster by adding neighbors of neighbors
4. Continue until no new particles can be added
5. Remaining particles are marked as noise
```

## Usage Workflow

### 🚀 **Getting Started**
1. Load your simulation data (topology + trajectory)
2. Click the 📊 clustering icon in the control panel
3. Adjust epsilon and min points parameters
4. View real-time statistics and histogram

### 🔍 **Analysis Workflow**
1. **Parameter Tuning**: Adjust epsilon to find optimal cluster detection
2. **Size Analysis**: Use histogram to understand cluster size distribution
3. **Selection**: Choose interesting clusters from the list
4. **Focus**: Enable "show only selected" to isolate specific clusters
5. **Visualization**: Highlighted clusters are enlarged while maintaining colors

### 💡 **Tips for Effective Use**
- **Start with epsilon=2.0**: Good default for most systems
- **Adjust min points**: Lower values (2-3) find smaller clusters
- **Use histogram**: Identify dominant cluster sizes
- **Focus mode**: Great for analyzing specific cluster types
- **Patches**: Automatically filtered to match visible particles

## Integration with Existing Features

### 🔗 **Seamless Integration**
- **Color Schemes**: Respects current color scheme selection
- **Particle Selection**: Works alongside existing selection system
- **Patches**: Automatically filters patches based on cluster visibility
- **Screenshots**: Captures current clustering state
- **GLTF Export**: Includes clustering information in exported models

### 🎮 **Keyboard Shortcuts**
All existing shortcuts remain functional:
- `P`: Screenshot (includes clustering state)
- `Q/A/W/S/E/D`: Position shifting (clusters update automatically)

## Advanced Features

### 🔬 **Research Applications**
- **Aggregation Analysis**: Study particle aggregation patterns
- **Size Distribution**: Quantify cluster size distributions
- **Temporal Analysis**: Study clustering across trajectory frames
- **Selective Visualization**: Focus on specific cluster sizes or regions

### 📊 **Data Export**
- Statistics are displayed in real-time
- Cluster information is preserved in GLTF exports
- Screenshots capture current clustering visualization
- Compatible with existing data export workflows

## Future Enhancements

### 🌟 **Potential Improvements**
- **Export cluster data**: CSV/JSON export of cluster information
- **Multiple algorithms**: K-means, hierarchical clustering options
- **Temporal tracking**: Track cluster evolution across frames
- **Advanced filtering**: Filter by cluster properties (size, density, etc.)
- **3D convex hulls**: Visual cluster boundaries
- **Cluster comparison**: Compare clusters across different frames

This feature provides researchers with powerful tools to analyze particle clustering patterns, making it easier to understand complex molecular dynamics simulations and identify interesting structural features.
