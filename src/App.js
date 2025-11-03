import React, { useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import FileDropZone from "./components/FileDropZone";
import ParticleScene from "./components/ParticleScene";
import PatchLegend from "./components/PatchLegend";
import ParticleLegend from "./components/ParticleLegend";
import SelectedParticlesDisplay from "./components/SelectedParticlesDisplay";
import ColorSchemeSelector from "./components/ColorSchemeSelector";
import ClusteringPane from "./components/ClusteringPane";
import { analyzeFiles, categorizeFiles } from "./utils/fileTypeDetector";
import { readMGL, readMGLTrajectory, convertMGLToPPViewFormat } from "./utils/mglParser";
import { parseTopFile, getParticleType, parseLorenzoTopology, parseFlavioTopology, parseParticleTxt, parsePatchesTxt } from "./utils/topologyParser";
import { buildTrajIndex, parseConfiguration } from "./utils/trajectoryLoader";
import { applyPeriodicBoundary, calcCOM, applyPeriodicWrapping } from "./utils/geometryUtils";
import { captureScreenshot, exportSceneAsGLTF } from "./utils/exportUtils";
import { useParticleStore } from "./store/particleStore";
import { useUIStore } from "./store/uiStore";
import { useClusteringStore } from "./store/clusteringStore";
import "./styles.css";

// Helper function for fallback trajectory file prioritization
function selectFallbackTrajectoryFile(trajectoryFiles) {
  if (trajectoryFiles.length === 1) {
    return trajectoryFiles[0];
  }

  console.log(`Found ${trajectoryFiles.length} potential trajectory files in fallback, applying prioritization...`);
  
  // Define priority keywords in order of preference (same as in fileTypeDetector)
  const priorityKeywords = [
    { keywords: ['traj'], priority: 1, name: 'trajectory' },
    { keywords: ['last'], priority: 2, name: 'last configuration' },
    { keywords: ['init'], priority: 3, name: 'initial configuration' },
    { keywords: ['conf'], priority: 4, name: 'configuration' }
  ];

  // Score each file based on filename
  const scoredFiles = trajectoryFiles.map(file => {
    const fileName = file.name.toLowerCase();
    let priority = 999; // Default low priority
    let matchedType = 'other';
    
    // Check for priority keywords
    for (const { keywords, priority: keywordPriority, name } of priorityKeywords) {
      if (keywords.some(keyword => fileName.includes(keyword))) {
        priority = keywordPriority;
        matchedType = name;
        break;
      }
    }
    
    return {
      file,
      priority,
      matchedType,
      fileName
    };
  });

  // Sort by priority (lower number = higher priority)
  scoredFiles.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // If same priority, prefer alphabetically first
    return a.fileName.localeCompare(b.fileName);
  });

  const selectedFile = scoredFiles[0];
  console.log(`Selected fallback trajectory file: ${selectedFile.fileName} (type: ${selectedFile.matchedType})`);
  
  // Log the prioritization results
  console.log('Fallback trajectory file prioritization:');
  scoredFiles.forEach((scored, index) => {
    const status = index === 0 ? '✓ SELECTED' : '  skipped';
    console.log(`  ${status}: ${scored.fileName} (${scored.matchedType}, priority: ${scored.priority})`);
  });

  return selectedFile.file;
}

function App() {
  // Zustand stores
  const {
    positions,
    currentBoxSize,
    topData,
    trajFile,
    configIndex,
    currentConfigIndex,
    currentTime,
    totalConfigs,
    setPositions,
    setCurrentBoxSize,
    setTopData,
    setTrajFile,
    setConfigIndex,
    setCurrentConfigIndex,
    setCurrentTime,
    setCurrentEnergy,
    setTotalConfigs,
  } = useParticleStore();
  
  const {
    showPatchLegend,
    showParticleLegend,
    showSimulationBox,
    showBackdropPlanes,
    showCoordinateAxis,
    isControlsVisible,
    showClusteringPane,
    filesDropped,
    isLoading,
    sceneRef,
    isIframeMode,
    isDragDropEnabled,
    currentColorScheme,
    isPlaying,
    playbackSpeed,
    isSpeedPopupVisible,
    setShowPatchLegend,
    setShowParticleLegend,
    setShowSimulationBox,
    setShowBackdropPlanes,
    setShowCoordinateAxis,
    setIsControlsVisible,
    setShowClusteringPane,
    setFilesDropped,
    setIsLoading,
    setIsIframeMode,
    setIsDragDropEnabled,
    setIsPlaying,
    setPlaybackSpeed,
    setIsSpeedPopupVisible,
  } = useUIStore();
  
  const highlightedClusters = useClusteringStore(state => state.highlightedClusters);
  
  // Refs
  const playbackIntervalRef = useRef(null);
  const speedPopupRef = useRef(null);
  
  // Function to show notification (for iframe mode)
  const notify = useCallback((message) => {
    console.warn('PPView Notification:', message);
    // In iframe mode, we just log notifications since alert() might be blocked
    if (!isIframeMode) {
      alert(message);
    }
  }, [isIframeMode]);
  
  // Function to trigger scene re-render when needed
  const invalidateScene = useCallback(() => {
    if (sceneRef && sceneRef.invalidate) {
      sceneRef.invalidate();
    }
  }, [sceneRef]);

  // Function to take a screenshot
  const takeScreenshot = useCallback(() => {
    captureScreenshot(sceneRef, currentConfigIndex);
  }, [sceneRef, currentConfigIndex]);


  const handleFilesReceived = async (files) => {
    if (!files || files.length === 0) {
      // No files selected or operation cancelled
      return;
    }

    // Set filesDropped to true to hide the drop zone immediately
    setFilesDropped(true);

    // Set loading state to true before indexing
    setIsLoading(true);

    try {
      // Analyze file types dynamically based on content
      console.log("Analyzing file types...");
      const filesWithTypes = await analyzeFiles(files);
      const categorizedFiles = categorizeFiles(filesWithTypes);
      
      console.log("File analysis results:", categorizedFiles);

      // Process MGL files first (they don't need topology)
      if (categorizedFiles.mglFile || categorizedFiles.mglTrajectory) {
        try {
          let mglData, ppviewData;
          
          if (categorizedFiles.mglFile) {
            const mglContent = await categorizedFiles.mglFile.text();
            console.log(`Processing MGL file: ${categorizedFiles.mglFile.name}`);
            
            mglData = readMGL(mglContent);
            ppviewData = convertMGLToPPViewFormat(mglData);
            
            // Set up data for ppview
            setTopData(ppviewData.topData);
            setPositions(ppviewData.positions);
            setCurrentBoxSize(ppviewData.boxSize);
            setCurrentTime(0);
            setCurrentEnergy([0]);
            setConfigIndex([0]); // Single frame
            setTotalConfigs(1);
            
            console.log(`Loaded MGL file with ${ppviewData.positions.length} particles`);
          } else {
            const mglTrajectoryContent = await categorizedFiles.mglTrajectory.text();
            console.log(`Processing MGL Trajectory file: ${categorizedFiles.mglTrajectory.name}`);
            
            mglData = readMGLTrajectory(mglTrajectoryContent);
            ppviewData = convertMGLToPPViewFormat(mglData);
            
            // Set up data for ppview
            setTopData(ppviewData.topData);
            setPositions(ppviewData.positions);
            setCurrentBoxSize(ppviewData.boxSize);
            setCurrentTime(0);
            setCurrentEnergy([0]);
            
            // Create trajectory index for frame navigation if multiple frames
            if (mglData.frameCount > 1) {
              const fakeIndex = Array.from({ length: mglData.frameCount }, (_, i) => i);
              setConfigIndex(fakeIndex);
              setTotalConfigs(mglData.frameCount);
              
              // Store trajectory data for frame switching
              setTrajFile({
                ...categorizedFiles.mglTrajectory,
                mglTrajectoryData: mglData
              });
            } else {
              setConfigIndex([0]);
              setTotalConfigs(1);
            }
            
            console.log(`Loaded MGL trajectory with ${mglData.frameCount} frames and ${mglData.totalParticles} total particles`);
          }
          
          setIsLoading(false);
          return; // Exit early since MGL is self-contained
        } catch (error) {
          console.error('Error processing MGL file:', error);
          alert('Error processing MGL file. Please check the console for details.');
          setFilesDropped(false);
          setIsLoading(false);
          return;
        }
      }

      // Create file map for compatibility with existing code
      const fileMap = new Map();
      files.forEach((file) => {
        fileMap.set(file.name.trim(), file);
      });

      // Process topology file (only for non-MGL files)
      if (categorizedFiles.topology) {
        const topFile = categorizedFiles.topology.file;
        const topContent = await topFile.text();
        const parsedTopData = await parseTopFile(topContent, fileMap, categorizedFiles.topology.format);
        setTopData(parsedTopData);
        console.log(`Loaded ${categorizedFiles.topology.format} topology from ${topFile.name}`);
      } else {
        // Fallback: look for .top extension
        const topFile = files.find((file) => file.name.endsWith(".top"));
        if (topFile) {
          const topContent = await topFile.text();
          const parsedTopData = await parseTopFile(topContent, fileMap);
          setTopData(parsedTopData);
          console.log(`Loaded topology from ${topFile.name} (fallback detection)`);
        } else {
          alert("No topology file detected! Please ensure you have a valid topology file.");
          setFilesDropped(false);
          setIsLoading(false);
          return;
        }
      }

      // Process trajectory file
      if (categorizedFiles.trajectory) {
        setTrajFile(categorizedFiles.trajectory);
        console.log(`Detected trajectory file: ${categorizedFiles.trajectory.name}`);
      } else {
        // Fallback: look for common trajectory file patterns with prioritization
        const fallbackTrajectoryFiles = files.filter(
          (file) =>
            file.name.includes("traj") ||
            file.name.includes("conf") ||
            file.name.includes("last") ||
            file.name.includes("init") ||
            file.name.endsWith(".dat")
        );
        
        if (fallbackTrajectoryFiles.length > 0) {
          // Apply same prioritization logic for fallback files
          const selectedFile = selectFallbackTrajectoryFile(fallbackTrajectoryFiles);
          setTrajFile(selectedFile);
          console.log(`Using trajectory file: ${selectedFile.name} (fallback detection with prioritization)`);
        } else {
          alert("No trajectory file detected! Please ensure you have a valid trajectory file.");
          setFilesDropped(false);
          setIsLoading(false);
          return;
        }
      }

      // Build the trajectory index
      const trajectoryFileToUse = categorizedFiles.trajectory || files.find(
        (file) =>
          file.name.includes("traj") ||
          file.name.includes("conf") ||
          file.name.includes("last") ||
          file.name.endsWith(".dat")
      );
      
      if (trajectoryFileToUse) {
        const index = await buildTrajIndex(trajectoryFileToUse);
        setConfigIndex(index);
        setTotalConfigs(index.length);
      }


      // Report unknown files
      if (categorizedFiles.unknown.length > 0) {
        console.warn("Unknown file types detected:", categorizedFiles.unknown.map(f => f.name));
      }

      // Set loading state to false after indexing
      setIsLoading(false);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Error processing files. Please check the console for details.");
      setFilesDropped(false);
      setIsLoading(false);
    }
  };

  // Load configuration when topData, trajFile, and configIndex are available
  useEffect(() => {
    if (topData && trajFile && configIndex.length > 0) {
      loadConfiguration(trajFile, configIndex, currentConfigIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topData, trajFile, configIndex, currentConfigIndex]);


  const loadConfiguration = async (file, index, configNumber) => {
    if (configNumber < 0 || configNumber >= index.length) {
      alert("Configuration number out of range");
      return false;
    }

    // Ensure topData is available
    if (!topData) {
      alert("Topology data not available.");
      return false;
    }

    // Handle MGL trajectory data
    if (file.mglTrajectoryData) {
      const mglData = file.mglTrajectoryData;
      if (configNumber >= mglData.frameCount) {
        alert("MGL frame number out of range");
        return false;
      }

      const frame = mglData.frames[configNumber];
      const ppviewData = convertMGLToPPViewFormat({ frames: [frame] });
      
      setPositions(ppviewData.positions);
      setCurrentBoxSize(ppviewData.boxSize);
      setCurrentTime(configNumber); // Use frame index as time
      setCurrentEnergy([0]); // Default energy for MGL
      return true;
    }

    const start = index[configNumber];
    const end =
      configNumber + 1 < index.length ? index[configNumber + 1] : file.size;
    const slice = file.slice(start, end);

    const content = await slice.text();
    const lines = content.split(/\r?\n/);

    const config = parseConfiguration(lines);
    if (config) {
      // Apply periodic boundaries
      const adjustedPositions = applyPeriodicBoundary(
        config.positions,
        config.boxSize,
      );

      // Associate particle types and compute rotation matrices
      const positionsWithTypes = adjustedPositions.map((pos, index) => {
        const { typeIndex, particleType } = getParticleType(
          index,
          topData,
        );

        let rotationMatrix = null;
        if (pos.a1 && pos.a3) {
          // Compute a2 as cross product of a3 and a1
          const a1 = new THREE.Vector3(
            pos.a1.x,
            pos.a1.y,
            pos.a1.z,
          ).normalize();
          const a3 = new THREE.Vector3(
            pos.a3.x,
            pos.a3.y,
            pos.a3.z,
          ).normalize();
          const a2 = new THREE.Vector3().crossVectors(a3, a1).normalize();

          // Recompute a3 to ensure orthogonality
          a3.crossVectors(a1, a2).normalize();

          // Create the rotation matrix
          const matrix = new THREE.Matrix3().set(
            a1.x,
            a2.x,
            a3.x,
            a1.y,
            a2.y,
            a3.y,
            a1.z,
            a2.z,
            a3.z,
          );

          // Store matrix elements
          rotationMatrix = {
            elements: matrix.elements.slice(), // Clone the elements array
          };
        }

        return {
          ...pos,
          typeIndex,
          particleType,
          rotationMatrix,
        };
      });

      setPositions(positionsWithTypes);
      setCurrentBoxSize(config.boxSize);
      setCurrentTime(config.time);
      setCurrentEnergy(config.energy);
      return true;
    } else {
      alert("Failed to parse configuration");
      return false;
    }
  };





  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentConfigIndex(newIndex);
    // Trigger re-render when configuration changes
    setTimeout(invalidateScene, 0);
  };

  // Function to toggle trajectory playback
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      // Stop playback
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Start playback
      setIsPlaying(true);
      playbackIntervalRef.current = setInterval(() => {
        const currentIndex = useParticleStore.getState().currentConfigIndex;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalConfigs) {
          // Reached the end, stop playback
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
          }
          setIsPlaying(false);
        } else {
          setCurrentConfigIndex(nextIndex);
        }
      }, playbackSpeed);
    }
  }, [isPlaying, playbackSpeed, totalConfigs, setIsPlaying, setCurrentConfigIndex]);

  // Function to reset trajectory to beginning
  const resetTrajectory = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentConfigIndex(0);
  }, [setIsPlaying, setCurrentConfigIndex]);

  // Cleanup playback interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Handle click outside speed popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isSpeedPopupVisible && speedPopupRef.current && !speedPopupRef.current.contains(event.target)) {
        setIsSpeedPopupVisible(false);
      }
    };

    if (isSpeedPopupVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedPopupVisible]);

  // Function to shift positions along an axis
  const shiftPositions = useCallback(
    (axis, delta) => {
      // Get current positions from store (Zustand doesn't support function updaters)
      const currentPositions = useParticleStore.getState().positions;
      
      // Safeguard: ensure currentPositions is an array
      if (!Array.isArray(currentPositions)) {
        console.error('shiftPositions: currentPositions is not an array:', currentPositions);
        return;
      }
      
      const shiftedPositions = currentPositions.map((pos) => {
        const newPos = { ...pos };
        newPos[axis] = pos[axis] + delta;
        return newPos;
      });
      
      // Apply only periodic wrapping without re-centering
      const adjustedPositions = applyPeriodicWrapping(
        shiftedPositions,
        currentBoxSize,
      );
      
      setPositions(adjustedPositions);
      
      // Trigger re-render when translation happens
      setTimeout(invalidateScene, 0);
    },
    [currentBoxSize, invalidateScene, setPositions],
  );

  // Function to export the scene as GLTF
  const exportGLTF = useCallback(() => {
    exportSceneAsGLTF({
      positions,
      currentBoxSize,
      currentConfigIndex,
      showSimulationBox,
      showBackdropPlanes,
      currentColorScheme,
      topData,
      highlightedClusters,
      sceneRef
    });
  }, [positions, currentBoxSize, currentConfigIndex, showSimulationBox, showBackdropPlanes, currentColorScheme, topData, highlightedClusters, sceneRef]);

  // Function to create output files for download
  const makeOutputFiles = useCallback(() => {
    try {
      // Export GLTF
      exportGLTF();
      
      // Take screenshot
      takeScreenshot();
      
      console.log('Output files generated successfully');
    } catch (error) {
      console.error('Error generating output files:', error);
    }
  }, [exportGLTF, takeScreenshot]);

  // Message handler for iframe communication
  const handleMessage = useCallback((data) => {
    console.log('PPView received message:', data);
    
    if (data.message === 'drop') {
      handleFilesReceived(data.files);
    }
    else if (data.message === 'download') {
      makeOutputFiles();
    }
    else if (data.message === 'remove-event') {
      // Disable drag-drop on the FileDropZone and show notification on drop attempts
      setIsDragDropEnabled(false);
      notify("Dragging onto embedded viewer does not allow form completion");
    }
    else if (data.message === 'iframe_drop') {
      let files = data.files;
      let ext = data.ext;
      let view_settings = data.view_settings;
      
      if (files.length !== ext.length) {
        notify("Make sure you pass all files with extensions");
        return;
      }
      
      // Apply view settings if present
      if (view_settings) {
        if ("Box" in view_settings) {
          setShowSimulationBox(view_settings["Box"]);
        }
        if ("BackdropPlanes" in view_settings) {
          setShowBackdropPlanes(view_settings["BackdropPlanes"]);
        }
        if ("CoordinateAxis" in view_settings) {
          setShowCoordinateAxis(view_settings["CoordinateAxis"]);
        }
        if ("PatchLegend" in view_settings) {
          setShowPatchLegend(view_settings["PatchLegend"]);
        }
        if ("ParticleLegend" in view_settings) {
          setShowParticleLegend(view_settings["ParticleLegend"]);
        }
        if ("ClusteringPane" in view_settings) {
          setShowClusteringPane(view_settings["ClusteringPane"]);
        }
        if ("Controls" in view_settings) {
          setIsControlsVisible(view_settings["Controls"]);
        }
      }
      
      // Set the names and extensions for every passed file
      for (let i = 0; i < files.length; i++) {
        files[i].name = `${i}.${ext[i]}`;
      }
      
      handleFilesReceived(files);
      return;
    }
    else {
      console.log(data.message, "is not a recognized message");
      return;
    }
  }, [handleFilesReceived, makeOutputFiles, notify]);

  // useEffect to detect iframe mode (run only once on mount)
  useEffect(() => {
    // Check if running in iframe
    const isInIframe = window.self !== window.top;
    setIsIframeMode(isInIframe);
    
    if (isInIframe) {
      console.log('PPView: Running in iframe mode');
      // Hide controls by default in iframe mode
      setIsControlsVisible(false);
    }
  }, []); // Empty dependency array - run only once on mount

  // useEffect to set up message listener
  useEffect(() => {
    // Set up message listener for iframe communication
    const messageListener = (event) => {
      try {
        handleMessage(event.data);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
    
    window.addEventListener('message', messageListener);
    
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, [handleMessage]);

  // useEffect to handle key presses
  useEffect(() => {
    const handleKeyDown = (event) => {
      try {
        switch (event.key) {
          case "q":
            shiftPositions("x", 1);
            break;
          case "a":
            shiftPositions("x", -1);
            break;
          case "w":
            shiftPositions("y", 1);
            break;
          case "s":
            shiftPositions("y", -1);
            break;
          case "e":
            shiftPositions("z", 1);
            break;
          case "d":
            shiftPositions("z", -1);
            break;
          case "p":
          case "P":
            takeScreenshot();
            break;
          default:
            break;
        }
      } catch (error) {
        console.warn('Error in key handler:', error);
        // Don't propagate the error to avoid blocking the application
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      // Cleanup event listener on unmount
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shiftPositions, takeScreenshot]);

  return (
    <div className="App">
      {!filesDropped && (
        <FileDropZone 
          onFilesReceived={handleFilesReceived} 
          isDragDropEnabled={isDragDropEnabled}
          onDisabledDrop={() => notify("Dragging onto embedded viewer does not allow form completion")}
        />
      )}
      {positions.length > 0 && (
        <ParticleScene />
      )}
      {positions.length > 0 && !isLoading && (
        <>
          <div className="controls-toggle">
            <button 
              className="toggle-button" 
              onClick={() => setIsControlsVisible(!isControlsVisible)}
            >
              {isControlsVisible ? '▼ Hide Controls' : '▲ Show Controls'}
            </button>
          </div>
          {isControlsVisible && (
            <div className="controls">
              {/* First row: Trajectory controls and buttons */}
              <div className="controls-top-row">
                <div className="playback-controls">
                  <button 
                    className="playback-button" 
                    onClick={togglePlayback}
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "⏸️" : "▶️"}
                  </button>
                  <button 
                    className="playback-button" 
                    onClick={resetTrajectory}
                    title="Reset to beginning"
                  >
                    ⏮️
                  </button>
                  <div className="speed-control">
                    <button 
                      className="speed-button"
                      onClick={() => setIsSpeedPopupVisible(!isSpeedPopupVisible)}
                      title="Adjust playback speed"
                    >
                      ⚡ {(1000/playbackSpeed).toFixed(1)} fps
                    </button>
                    {isSpeedPopupVisible && (
                      <div className="speed-popup" ref={speedPopupRef}>
                        <div className="speed-popup-content">
                          <label htmlFor="speed-slider" className="speed-label">Speed:</label>
                          <input
                            id="speed-slider"
                            type="range"
                            min="50"
                            max="2000"
                            step="50"
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                            className="speed-slider"
                          />
                          <span className="speed-display">{(1000/playbackSpeed).toFixed(1)} fps</span>
                          <button 
                            className="speed-close"
                            onClick={() => setIsSpeedPopupVisible(false)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Icon toggles section */}
                <div className="icon-toggles">
                  {/* Checkbox to toggle Patch legend */}
                  <label className="icon-toggle" title="Show Patch Legend">
                    <input
                      type="checkbox"
                      checked={showPatchLegend}
                      onChange={(e) => setShowPatchLegend(e.target.checked)}
                    />
                    <span className="toggle-icon">🏷️</span>
                  </label>
                  {/* Checkbox to toggle Particle legend */}
                  <label className="icon-toggle" title="Show Particle Legend">
                    <input
                      type="checkbox"
                      checked={showParticleLegend}
                      onChange={(e) => setShowParticleLegend(e.target.checked)}
                    />
                    <span className="toggle-icon">⚫</span>
                  </label>
                  {/* Checkbox to toggle Simulation Box */}
                  <label className="icon-toggle" title="Show Backdrop Planes">
                    <input
                      type="checkbox"
                      checked={showBackdropPlanes}
                      onChange={(e) => setShowBackdropPlanes(e.target.checked)}
                    />
                    <span className="toggle-icon">🗂️</span>
                  </label>
                  <label className="icon-toggle" title="Show Simulation Box">
                    <input
                      type="checkbox"
                      checked={showSimulationBox}
                      onChange={(e) => setShowSimulationBox(e.target.checked)}
                    />
                    <span className="toggle-icon">📦</span>
                  </label>
                  {/* Checkbox to toggle Coordinate Axis */}
                  <label className="icon-toggle" title="Show Coordinate Axis">
                    <input
                      type="checkbox"
                      checked={showCoordinateAxis}
                      onChange={(e) => setShowCoordinateAxis(e.target.checked)}
                    />
                    <span className="toggle-icon">📐</span>
                  </label>
                  {/* Checkbox to toggle Clustering Pane */}
                  <label className="icon-toggle" title="Show Clustering Pane">
                    <input
                      type="checkbox"
                      checked={showClusteringPane}
                      onChange={(e) => setShowClusteringPane(e.target.checked)}
                    />
                    <span className="toggle-icon">📊</span>
                  </label>
                </div>
                
                {/* Color scheme selector */}
                <div className="color-scheme-section">
                  <ColorSchemeSelector />
                </div>
                
                {/* Action buttons */}
                <div className="action-buttons">
                  <button className="screenshot-button" onClick={takeScreenshot}>
                    📸 Take Screenshot (P)
                  </button>
                  <button className="export-button" onClick={exportGLTF}>
                    📁 Export GLTF
                  </button>
                </div>
              </div>
              
              {/* Second row: Trajectory slider and info */}
              <div className="controls-bottom-row">
                <input
                  type="range"
                  min="0"
                  max={totalConfigs - 1}
                  value={currentConfigIndex}
                  onChange={handleSliderChange}
                  className="trajectory-slider"
                />
                <div className="config-time-info">
                  <div className="config-text">
                    Configuration: {currentConfigIndex + 1} / {totalConfigs}
                  </div>
                  <div className="time-text">Time: {currentTime.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Conditionally render the SelectedParticlesDisplay component */}
      <SelectedParticlesDisplay />
      
      {/* Conditionally render the PatchLegend component */}
      {topData && showPatchLegend && !isLoading && (
        <PatchLegend />
      )}
      
      {/* Conditionally render the ParticleLegend component */}
      {topData && showParticleLegend && !isLoading && (
        <ParticleLegend />
      )}
      {/* Conditionally render the ClusteringPane component */}
      {positions.length > 0 && showClusteringPane && !isLoading && (
        <ClusteringPane />
      )}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading trajectory data...</p>
        </div>
      )}
    </div>
  );
}

export default App;
