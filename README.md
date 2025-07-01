# PPView - Particle Physics Viewer

A React-based visualization tool for molecular dynamics simulations, specifically designed for oxDNA systems. This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Features

### Core Visualization
- Interactive 3D particle visualization using Three.js and React Three Fiber
- Support for trajectory playback with controls
- Particle and patch rendering with customizable color schemes
- Simulation box visualization
- Screenshot and GLTF export capabilities

### Clustering Analysis
- **DBSCAN Clustering**: Automatically cluster particles based on spatial proximity
- **Interactive Parameters**: 
  - Epsilon distance: Control the maximum distance between particles in a cluster
  - Minimum points: Set the minimum number of particles required to form a cluster
- **Real-time Statistics**: View cluster counts, sizes, and noise particles
- **Size Distribution Histogram**: Shows how many clusters have each particle count (e.g., "3 clusters have 5 particles each")
- **Selective Highlighting**: 
  - Choose which clusters to highlight from the cluster list
  - Option to show only selected clusters (dims non-selected particles)
  - Highlighted clusters maintain their original particle colors but are scaled larger
  - Perfect for focusing analysis on specific cluster sizes or regions

### File Format Support
- Lorenzo's topology format (.top files)
- Flavio's topology format with particles.txt and patches.txt
- Trajectory files (.dat, .traj, .conf, etc.)
- Automatic file type detection and prioritization

### User Interface
- Collapsible control panels
- Particle and patch legends
- Selected particle display
- Responsive design for different screen sizes

## Usage

### Getting Started
1. Start the application using `npm start`
2. Drag and drop your simulation files (topology + trajectory)
3. Use the controls to navigate through the trajectory
4. Enable clustering analysis using the 📊 button in the controls

### Clustering Analysis
1. **Enable Clustering**: Click the 📊 clustering icon in the control panel
2. **Adjust Parameters**: 
   - Use the epsilon slider to control cluster detection sensitivity
   - Adjust minimum points to filter small clusters
3. **View Statistics**: Check the real-time cluster statistics and size distribution
4. **Highlight Clusters**: 
   - Select individual clusters from the list
   - Use "Show only selected clusters" to focus on specific clusters
   - Selected clusters maintain their original colors but are enlarged for visibility
   - Non-selected particles are dimmed and shrunk when "show only" mode is enabled

### Keyboard Shortcuts
- `P`: Take a screenshot
- `Q/A`: Shift particles along X-axis
- `W/S`: Shift particles along Y-axis
- `E/D`: Shift particles along Z-axis

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
