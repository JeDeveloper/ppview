import React, { useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import FileDropZone from "./components/FileDropZone";
import ParticleScene from "./components/ParticleScene";
import PatchLegend from "./components/PatchLegend";
import ParticleLegend from "./components/ParticleLegend";
import SelectedParticlesDisplay from "./components/SelectedParticlesDisplay";
import ColorSchemeSelector from "./components/ColorSchemeSelector";
import ClusteringPane from "./components/ClusteringPane";
import { analyzeFiles, categorizeFiles } from "./utils/fileTypeDetector";
import { getParticleColors } from "./colors";
import { readMGL, readMGLTrajectory, convertMGLToPPViewFormat } from "./utils/mglParser";
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
    if (!sceneRef || !sceneRef.gl || !sceneRef.scene || !sceneRef.camera) {
      alert('Scene not ready for screenshot');
      return;
    }

    try {
      // Force invalidate to ensure scene is rendered
      if (sceneRef.invalidate) {
        sceneRef.invalidate();
      }
      
      // Wait a brief moment then force a render and capture
      setTimeout(() => {
        try {
          // Force a fresh render
          sceneRef.gl.render(sceneRef.scene, sceneRef.camera);
          
          // Get the canvas element
          const canvas = sceneRef.gl.domElement;
          if (!canvas) {
            alert('Canvas not found');
            return;
          }
          
          // Capture the screenshot
          const dataURL = canvas.toDataURL('image/png');
          
          // Create a download link for the screenshot
          const link = document.createElement('a');
          link.href = dataURL;
          link.download = `ppview_screenshot_config_${currentConfigIndex + 1}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
        } catch (error) {
          console.error('Error capturing screenshot:', error);
          alert('Failed to capture screenshot - try again');
        }
      }, 150);
      
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Failed to take screenshot');
    }
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

  // Build the trajectory index
  const buildTrajIndex = async (file) => {
    const decoder = new TextDecoder("utf-8");
    const reader = file.stream().getReader();
    let result;
    let offset = 0;
    let index = [];
    let partialLine = "";
    const decoderOptions = { stream: true };

    while (!(result = await reader.read()).done) {
      const chunk = result.value;
      const textChunk = decoder.decode(chunk, decoderOptions);
      const lines = (partialLine + textChunk).split(/\r?\n/);
      partialLine = lines.pop(); // Save the last line in case it's incomplete

      for (const line of lines) {
        if (line.startsWith("t =")) {
          index.push(offset);
        }
        offset += new TextEncoder().encode(line + "\n").length;
      }
    }

    // Handle the last partial line
    if (partialLine.startsWith("t =")) {
      index.push(offset);
    }

    return index;
  };

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

  // Function to parse a configuration from lines
  const parseConfiguration = (lines) => {
    let i = 0;
    const timeLine = lines[i++].trim();
    const time = parseFloat(timeLine.split("=")[1].trim());

    const bLine = lines[i++].trim();
    const bTokens = bLine.split("=");
    const boxSize = bTokens[1].trim().split(/\s+/).map(Number);

    const eLine = lines[i++].trim();
    const energyTokens = eLine.split("=");
    const energy = energyTokens[1].trim().split(/\s+/).map(Number);

    const positions = [];
    while (i < lines.length) {
      const line = lines[i++].trim();
      if (line === "") continue;
      const tokens = line.split(/\s+/).map(Number);

      // Updated to parse the additional columns
      if (tokens.length >= 9) {
        const [x, y, z, a1x, a1y, a1z, a3x, a3y, a3z, ...rest] = tokens;
        positions.push({
          x,
          y,
          z,
          a1: { x: a1x, y: a1y, z: a1z },
          a3: { x: a3x, y: a3y, z: a3z },
        });
      } else if (tokens.length >= 3) {
        // Handle case where orientation data is missing
        const [x, y, z] = tokens;
        positions.push({ x, y, z });
      }
    }

    return {
      time,
      boxSize,
      energy,
      positions,
    };
  };

  // Function to parse the .top file (supports both Lorenzo's and Flavio's formats)
  const parseTopFile = async (content, fileMap, detectedFormat = null) => {
    const lines = content.trim().split("\n");

    // Use detected format if provided, otherwise fall back to original detection logic
    let isFlavioFormat;
    if (detectedFormat) {
      isFlavioFormat = detectedFormat === 'flavio';
      console.log(`Using detected topology format: ${detectedFormat}`);
    } else {
      // Original detection logic as fallback
      isFlavioFormat = !lines[1].includes(".");
      console.log(`Using fallback topology format detection: ${isFlavioFormat ? 'flavio' : 'lorenzo'}`);
    }

    if (isFlavioFormat) {
      // Parse Flavio's topology
      return await parseFlavioTopology(content, fileMap);
    } else {
      // Parse Lorenzo's topology
      return await parseLorenzoTopology(lines, fileMap);
    }
  };

  // Function to parse Lorenzo's topology (following initLoroSpecies logic)
  const parseLorenzoTopology = async (lines, fileMap) => {
    const headerTokens = lines[0].trim().split(/\s+/).map(Number);
    const totalParticles = headerTokens[0];
    const typeCount = headerTokens[1];
    
    // Create particles array with types following initLoroSpecies pattern
    const particles = [];
    const patchSpecs = [];
    const patchFileCache = new Map();
    
    // Parse topology lines to build particle type assignments
    let particleIndex = 0;
    for (let i = 1; i <= typeCount; i++) {
      const line = lines[i];
      const tokens = line.trim().split(/\s+/);
      const count = Number(tokens[0]);
      const patchCount = Number(tokens[1]);
      const patches = tokens[2] ? tokens[2].split(",").map(Number) : [];
      const fileName = tokens[3] ? tokens[3].trim() : "";
      
      // Create particles for this type following initLoroSpecies pattern
      for (let j = 0; j < count; j++) {
        particles.push({
          type: (i - 1).toString(), // Convert to string to match initLoroSpecies
          patchSpec: fileName || '' // Store patchSpec (filename) for each particle
        });
        particleIndex++;
      }
      
      // Store patchSpec for this type
      patchSpecs[i - 1] = fileName || '';
    }
    
    // Following initLoroSpecies: const types = this.particles.map(p=>parseInt(p.type))
    const types = particles.map(p => parseInt(p.type));
    
    // Following initLoroSpecies: count instances of each type
    const instanceCounts = [];
    types.forEach((s, i) => {
      if (instanceCounts[s] === undefined) {
        instanceCounts[s] = 1;
      } else {
        instanceCounts[s]++;
      }
    });
    
    // Create patchStrMap equivalent by loading patch files
    const patchStrMap = new Map();
    
    // Load all unique patch files
    const uniquePatchSpecs = [...new Set(patchSpecs)].filter(spec => spec && spec.trim() !== '');
    
    for (const patchSpec of uniquePatchSpecs) {
      if (fileMap.has(patchSpec)) {
        try {
          const patchFile = fileMap.get(patchSpec);
          const patchContent = await patchFile.text();
          patchStrMap.set(patchSpec, patchContent.trim());
        } catch (error) {
          console.warn(`Error reading patch file '${patchSpec}':`, error);
          patchStrMap.set(patchSpec, '');
        }
      } else {
        console.warn(`Patch file '${patchSpec}' not found`);
        patchStrMap.set(patchSpec, '');
      }
    }
    
    // Following initLoroSpecies: create species array
    const particleTypes = [...new Set(types)].map(s => {
      const patchSpec = patchSpecs[s];
      let patchPositions = [];
      let patches = [];
      
      if (patchSpec && patchStrMap.has(patchSpec)) {
        const patchStrs = patchStrMap.get(patchSpec);
        if (patchStrs && patchStrs.trim() !== '') {
          // Following initLoroSpecies: parse patch strings
          const patchLines = patchStrs.split('\n').filter(line => line.trim() !== '');
          patchPositions = patchLines.map((vs, index) => {
            const coords = vs.trim().split(/ +/g).map(v => parseFloat(v));
            if (coords.length >= 3 && !coords.some(isNaN)) {
              const pos = new THREE.Vector3().fromArray(coords);
              return {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                // Following initLoroSpecies: a1 and a2 are normalized position vectors
                a1: { 
                  x: pos.clone().normalize().x,
                  y: pos.clone().normalize().y,
                  z: pos.clone().normalize().z
                },
                a2: {
                  x: pos.clone().normalize().x,
                  y: pos.clone().normalize().y,
                  z: pos.clone().normalize().z
                },
                patchId: index // Assign sequential patch IDs
              };
            }
            return null;
          }).filter(Boolean);
          
          // Create patches array with sequential IDs
          patches = patchPositions.map((_, index) => index);
        }
      }
      
      return {
        typeIndex: s,
        count: instanceCounts[s] || 0,
        patches: patches,
        patchPositions: patchPositions
      };
    });

    return { totalParticles, typeCount, particleTypes };
  };

  // Function to parse Flavio's topology
  const parseFlavioTopology = async (content, fileMap) => {
    const lines = content.trim().split("\n");
    const headerTokens = lines[0].trim().split(/\s+/).map(Number);
    const totalParticles = headerTokens[0];
    const typeCount = headerTokens[1];

    // Second line contains particle types per particle
    const typeLine = lines[1].trim();
    const particleTypesList = typeLine.split(/\s+/).map(Number);

    // Build particle types and counts
    const particleTypes = [];
    const typeCounts = {};

    particleTypesList.forEach((typeIndex) => {
      if (!typeCounts[typeIndex]) {
        typeCounts[typeIndex] = 0;
      }
      typeCounts[typeIndex]++;
    });

    let particlesData = null;
    let patchesData = null;

    // Check for particles.txt file
    const particleTxtFile = fileMap.get("particles.txt");
    if (particleTxtFile) {
      const particleTxtContent = await particleTxtFile.text();
      particlesData = parseParticleTxt(particleTxtContent);
    } else {
      console.warn("particles.txt file is missing for Flavio format.");
      // Proceed without particlesData
    }

    // Check for patches.txt file or .patch.txt files
    let patchesTxtFile = fileMap.get("patches.txt");
    
    // If patches.txt not found, look for .patch.txt files
    if (!patchesTxtFile) {
      // Find any file with .patch.txt extension
      for (const [fileName, file] of fileMap.entries()) {
        if (fileName.toLowerCase().endsWith('.patch.txt')) {
          patchesTxtFile = file;
          console.log(`Using ${fileName} as patches file for Flavio format`);
          break;
        }
      }
    }
    
    if (patchesTxtFile) {
      const patchesTxtContent = await patchesTxtFile.text();
      patchesData = parsePatchesTxt(patchesTxtContent);
    } else {
      console.warn("patches.txt or .patch.txt file is missing for Flavio format.");
      // Proceed without patchesData
    }

    // Build particle types array (following initSpecies pattern)
    // Sort the type keys to ensure consistent ordering regardless of input order
    Object.keys(typeCounts).sort((a, b) => Number(a) - Number(b)).forEach((typeIndex) => {
      const count = typeCounts[typeIndex];
      let patches = [];
      let patchPositions = [];

      if (particlesData && patchesData) {
        const particlesOfType = particlesData.filter(
          (p) => p.type === Number(typeIndex),
        );

        // Get unique patch IDs for this particle type
        const uniquePatchIds = new Set();
        particlesOfType.forEach((p) => {
          if (p.patches && Array.isArray(p.patches)) {
            p.patches.forEach(patchId => uniquePatchIds.add(patchId));
          }
        });

        // Map patch IDs to patch objects following initSpecies pattern
        patches = Array.from(uniquePatchIds);
        
        // Create patch positions array with the patch data
        // Following initSpecies logic: particle['patches'] = particle['patches'].map(id=>patches.get(id))
        patchPositions = patches
          .map((patchId) => {
            const patchData = patchesData[patchId];
            if (patchData && patchData.position) {
              return {
                x: patchData.position.x,
                y: patchData.position.y,
                z: patchData.position.z,
                // Include additional patch data for compatibility
                patchId: patchId,
                color: patchData.color,
                a1: patchData.a1,
                a2: patchData.a2
              };
            }
            return null;
          })
          .filter(Boolean);

        console.log(`Type ${typeIndex}: Found ${patches.length} unique patches, ${patchPositions.length} valid positions`);
      }

      const particleType = {
        count,
        typeIndex: Number(typeIndex),
        patches: patches || [], // Ensure patches is always an array
        patchPositions: patchPositions || [], // Ensure patchPositions is always an array
      };
      
      console.log(`Particle type ${typeIndex} summary:`, {
        count: particleType.count,
        typeIndex: particleType.typeIndex,
        patchCount: particleType.patches.length,
        patchPositionCount: particleType.patchPositions.length,
        patches: particleType.patches.slice(0, 3), // Show first 3 patch IDs
        firstPatchPosition: particleType.patchPositions[0]
      });
      
      particleTypes.push(particleType);
    });

    // For Flavio format, we need to create a mapping from particle index to type
    // because particles are not grouped by type like in Lorenzo format
    const particleTypeMapping = particleTypesList.map(typeIndex => {
      // Find the particle type object for this type index
      const particleType = particleTypes.find(pt => pt.typeIndex === typeIndex);
      return {
        typeIndex,
        particleType: particleType || particleTypes[0] // fallback to first type if not found
      };
    });

    return { 
      totalParticles, 
      typeCount, 
      particleTypes,
      particleTypeMapping // Add this for Flavio format
    };
  };

  // Helper functions for Flavio format parsing (following initSpecies pattern)
  const getScalar = (name, s) => {
    const m = s.match(new RegExp(`${name}=(-?\\d+)`));
    if (m) {
      return parseFloat(m[1]);
    }
    return false;
  };

  const getArray = (name, s) => {
    const m = s.match(new RegExp(`${name}=([\\,\\d\\.\\-\\+]+)`));
    if (m) {
      return m[1].split(',').map((v) => parseFloat(v));
    }
    return false;
  };

  // Function to parse particle.txt (following initSpecies logic)
  const parseParticleTxt = (content) => {
    // Remove whitespace following initSpecies pattern
    const particlesStr = content.replaceAll(' ', '');
    const particles = [];
    let currentParticle = null;

    for (const line of particlesStr.split('\n')) {
      const particleID = line.match(/particle_(\d+)/);
      if (particleID) {
        if (currentParticle) {
          particles.push(currentParticle);
        }
        currentParticle = { 'id': parseInt(particleID[1]) };
      }
      
      const type = getScalar('type', line);
      if (type !== false) {
        currentParticle['type'] = type;
      }
      
      const patches = getArray('patches', line);
      if (patches !== false) {
        currentParticle['patches'] = patches;
      }
    }
    
    if (currentParticle) {
      particles.push(currentParticle);
    }

    return particles;
  };

  // Function to parse patches.txt (following initSpecies logic)
  const parsePatchesTxt = (content) => {
    // Remove whitespace following initSpecies pattern
    const patchesStr = content.replaceAll(' ', '');
    const patches = new Map();
    let currentId;

    for (const line of patchesStr.split('\n')) {
      const patchID = line.match(/patch_(\d+)/);
      if (patchID) {
        currentId = parseInt(patchID[1]);
        patches.set(currentId, {});
      }
      
      const color = getScalar('color', line);
      if (color !== false) {
        patches.get(currentId)['color'] = color;
      }
      
      // Handle position, a1, and a2 arrays
      for (const k of ['position', 'a1', 'a2']) {
        const a = getArray(k, line);
        if (a) {
          // Convert to THREE.Vector3 following initSpecies pattern
          const v = new THREE.Vector3().fromArray(a);
          
          // Apply abs() to a1 and a2 vectors for Flavio format orientation handling
          //if (k === 'a1' || k === 'a2') {
          // if (k === 'a2') {
          
          //   v.x = Math.abs(v.x);
          //   v.y = Math.abs(v.y);
          //   v.z = Math.abs(v.z);
          // }
          
          patches.get(currentId)[k] = v;
        }
      }
    }

    // Convert Map to object for compatibility with existing code
    const patchesData = {};
    patches.forEach((patch, id) => {
      patchesData[id] = {
        id: id,
        color: patch.color || 0,
        position: patch.position ? {
          x: patch.position.x,
          y: patch.position.y,
          z: patch.position.z
        } : null,
        a1: patch.a1 ? {
          x: patch.a1.x,
          y: patch.a1.y,
          z: patch.a1.z
        } : null,
        a2: patch.a2 ? {
          x: patch.a2.x,
          y: patch.a2.y,
          z: patch.a2.z
        } : null
      };
    });

    return patchesData;
  };

  // Function to get particle type based on index
  const getParticleType = (particleIndex, topologyData) => {
    // Check if this is Flavio format (has particleTypeMapping)
    if (topologyData.particleTypeMapping) {
      // Flavio format: direct particle index to type mapping
      if (particleIndex < topologyData.particleTypeMapping.length) {
        return topologyData.particleTypeMapping[particleIndex];
      } else {
        // Fallback to first type if index is out of range
        const firstType = topologyData.particleTypes[0];
        return {
          typeIndex: firstType.typeIndex,
          particleType: firstType,
        };
      }
    } else {
      // Lorenzo format: use cumulative counts
      const particleTypes = topologyData.particleTypes;
      let cumulativeCount = 0;
      for (let i = 0; i < particleTypes.length; i++) {
        cumulativeCount += particleTypes[i].count;
        if (particleIndex < cumulativeCount) {
          return {
            typeIndex: particleTypes[i].typeIndex, // Use the assigned typeIndex
            particleType: particleTypes[i],
          };
        }
      }

      // Default to the last type if not found
      const lastType = particleTypes[particleTypes.length - 1];
      return {
        typeIndex: lastType.typeIndex,
        particleType: lastType,
      };
    }
  };

  // Function to parse patch files (for Lorenzo's format)
  const parsePatchFile = (content) => {
    try {
      if (!content || content.trim() === '') {
        return [];
      }
      
      const lines = content.trim().split("\n").filter(line => line.trim() !== '');
      const positions = lines.map((line) => {
        const tokens = line.trim().split(/\s+/).map(Number);
        if (tokens.length >= 3 && !tokens.some(isNaN)) {
          const [x, y, z] = tokens;
          return { x, y, z };
        }
        return null;
      }).filter(pos => pos !== null);
      
      return positions;
    } catch (error) {
      console.error('Error parsing patch file:', error);
      return [];
    }
  };

  // Calculate center of mass taking periodic boundary conditions into account
  // Based on: https://doi.org/10.1080/2151237X.2008.10129266
  // https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
  const calcCOM = (positions, boxSize) => {
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the
    // bounding box side length)
    let cm_x = { x: 0, y: 0 }; // Vector2-like object
    let cm_y = { x: 0, y: 0 };
    let cm_z = { x: 0, y: 0 };
    
    positions.forEach((pos) => {
      // Calculate positions on unit circle for each dimension and add to the sum
      const angle_x = (pos.x * 2 * Math.PI) / boxSize[0];
      const angle_y = (pos.y * 2 * Math.PI) / boxSize[1];
      const angle_z = (pos.z * 2 * Math.PI) / boxSize[2];
      
      cm_x.x += Math.cos(angle_x);
      cm_x.y += Math.sin(angle_x);
      cm_y.x += Math.cos(angle_y);
      cm_y.y += Math.sin(angle_y);
      cm_z.x += Math.cos(angle_z);
      cm_z.y += Math.sin(angle_z);
    });
    
    // Divide center of mass sums to get the averages
    const numPositions = positions.length;
    cm_x.x /= numPositions;
    cm_x.y /= numPositions;
    cm_y.x /= numPositions;
    cm_y.y /= numPositions;
    cm_z.x /= numPositions;
    cm_z.y /= numPositions;
    
    // Convert back from unit circle coordinates into x,y,z
    const cms = {
      x: boxSize[0] / (2 * Math.PI) * (Math.atan2(-cm_x.y, -cm_x.x) + Math.PI),
      y: boxSize[1] / (2 * Math.PI) * (Math.atan2(-cm_y.y, -cm_y.x) + Math.PI),
      z: boxSize[2] / (2 * Math.PI) * (Math.atan2(-cm_z.y, -cm_z.x) + Math.PI)
    };
    
    return cms;
  };
  
  // Helper function to apply periodic boundary conditions using oxview logic
  const applyPeriodicBoundary = (positions, boxSize) => {
    // We need actual modulus (handles negative numbers correctly)
    const realMod = (n, m) => ((n % m) + m) % m;
    
    // Calculate center of mass using periodic boundary conditions
    const com = calcCOM(positions, boxSize);
    
    // Use box center as the centering goal
    const centeringGoal = {
      x: boxSize[0] / 2,
      y: boxSize[1] / 2,
      z: boxSize[2] / 2
    };
    
    // Calculate translation needed to center the system
    const translation = {
      x: centeringGoal.x - com.x,
      y: centeringGoal.y - com.y,
      z: centeringGoal.z - com.z
    };
    
    // Define function to calculate a coordinate's position within periodic boundaries
    const coordInBox = (coord) => {
      const p = { ...coord };
      const shift = {
        x: boxSize[0] / 2 - centeringGoal.x,
        y: boxSize[1] / 2 - centeringGoal.y,
        z: boxSize[2] / 2 - centeringGoal.z
      };
      
      // Add shift
      p.x += shift.x;
      p.y += shift.y;
      p.z += shift.z;
      
      // Apply periodic boundaries using real modulus
      p.x = realMod(p.x, boxSize[0]);
      p.y = realMod(p.y, boxSize[1]);
      p.z = realMod(p.z, boxSize[2]);
      
      // Subtract shift
      p.x -= shift.x;
      p.y -= shift.y;
      p.z -= shift.z;
      
      return p;
    };
    
    // Apply "Monomer" boxing option with centering - treat each particle individually
    return positions.map((pos) => {
      const { x, y, z, ...rest } = pos;
      
      // First apply the centering translation
      const centeredPos = {
        x: x + translation.x,
        y: y + translation.y,
        z: z + translation.z
      };
      
      // Then apply periodic boundaries
      const newPos = coordInBox(centeredPos);
      
      return {
        x: newPos.x,
        y: newPos.y,
        z: newPos.z,
        ...rest,
      };
    });
  };

  // Function to apply only periodic wrapping without re-centering
  const applyPeriodicWrapping = (positions, boxSize) => {
    const coordInBox = (coord, boxDim) => {
      // Wrap coordinate to be within [0, boxDim]
      while (coord < 0) coord += boxDim;
      while (coord >= boxDim) coord -= boxDim;
      return coord;
    };

    return positions.map(({ x, y, z, ...rest }) => {
      return {
        x: coordInBox(x, boxSize[0]),
        y: coordInBox(y, boxSize[1]),
        z: coordInBox(z, boxSize[2]),
        ...rest,
      };
    });
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
      setPositions((prevPositions) => {
        const shiftedPositions = prevPositions.map((pos) => {
          const newPos = { ...pos };
          newPos[axis] = pos[axis] + delta;
          return newPos;
        });
        // Apply only periodic wrapping without re-centering
        const adjustedPositions = applyPeriodicWrapping(
          shiftedPositions,
          currentBoxSize,
        );
        return adjustedPositions;
      });
      // Trigger re-render when translation happens
      setTimeout(invalidateScene, 0);
    },
    [currentBoxSize, invalidateScene],
  );

  // Function to export the scene as GLTF
  const exportGLTF = useCallback(() => {
    if (!positions || positions.length === 0) {
      alert('No particles to export');
      return;
    }

    // Import particle colors and patch color utility
    // Calculate the number of unique particle types for dynamic color generation
    const uniqueTypes = new Set(positions.map(pos => pos.typeIndex).filter(type => type !== undefined));
    const particleTypeCount = uniqueTypes.size;
    const particleColors = getParticleColors(currentColorScheme, particleTypeCount);
    const { getColorForPatchID } = require('./utils/colorUtils');

    // Create a new scene for export
    const exportScene = new THREE.Scene();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight('#f0f0f0', 0.15);
    exportScene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight('#ffffff', 2.0);
    directionalLight.position.set(15, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.0001;
    exportScene.add(directionalLight);
    
    // Add camera following light if available
    if (sceneRef && sceneRef.camera) {
      const cameraLight = new THREE.SpotLight('#ffffff', 2.5);
      cameraLight.angle = Math.PI / 3;
      cameraLight.penumbra = 0.2;
      cameraLight.distance = 100;
      cameraLight.decay = 2;
      cameraLight.castShadow = true;
      cameraLight.shadow.mapSize.width = 1024;
      cameraLight.shadow.mapSize.height = 1024;
      cameraLight.shadow.camera.near = 0.1;
      cameraLight.shadow.camera.far = 100;
      cameraLight.shadow.bias = -0.0001;
      
      // Position and redirect the light following the camera
      const cameraDirection = new THREE.Vector3();
      sceneRef.camera.getWorldDirection(cameraDirection);
      cameraLight.position.copy(sceneRef.camera.position.clone().add(cameraDirection.clone().multiplyScalar(-5)).add(new THREE.Vector3(0, 3, 0)));
      const target = sceneRef.camera.position.clone().add(cameraDirection.multiplyScalar(10));
      cameraLight.target.position.copy(target);
      cameraLight.target.updateMatrixWorld();
      exportScene.add(cameraLight);
      exportScene.add(cameraLight.target);
    }
    
    // Add simulation box only if visible
    if (showSimulationBox) {
      const boxGeometry = new THREE.BoxGeometry(...currentBoxSize);
      const boxMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x808080, 
        wireframe: true 
      });
      const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
      boxMesh.name = 'SimulationBox';
      exportScene.add(boxMesh);
    }
    
    // Add backdrop planes only if visible
    if (showBackdropPlanes) {
      // Create material for backdrop planes (same as in ParticleScene)
      const backdropMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        metalness: 0.2,
        roughness: 0.1
      });
      
      // XY plane at z=0 (back)
      const xyPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[0], currentBoxSize[1]);
      const xyPlaneMesh = new THREE.Mesh(xyPlaneGeometry, backdropMaterial.clone());
      xyPlaneMesh.position.set(0, 0, -currentBoxSize[2] / 2);
      xyPlaneMesh.rotation.set(0, 0, 0);
      xyPlaneMesh.name = 'BackdropPlane_XY';
      exportScene.add(xyPlaneMesh);
      
      // XZ plane at y=0 (bottom)
      const xzPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[0], currentBoxSize[2]);
      const xzPlaneMesh = new THREE.Mesh(xzPlaneGeometry, backdropMaterial.clone());
      xzPlaneMesh.position.set(0, -currentBoxSize[1] / 2, 0);
      xzPlaneMesh.rotation.set(-Math.PI / 2, 0, 0);
      xzPlaneMesh.name = 'BackdropPlane_XZ';
      exportScene.add(xzPlaneMesh);
      
      // YZ plane at x=0 (left)
      const yzPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[2], currentBoxSize[1]);
      const yzPlaneMesh = new THREE.Mesh(yzPlaneGeometry, backdropMaterial.clone());
      yzPlaneMesh.position.set(-currentBoxSize[0] / 2, 0, 0);
      yzPlaneMesh.rotation.set(0, Math.PI / 2, 0);
      yzPlaneMesh.name = 'BackdropPlane_YZ';
      exportScene.add(yzPlaneMesh);
    }
    
    // Separate particles into highlighted (selected clusters) and hidden (others)
    const highlightedParticles = new Map(); // typeIndex -> particles
    const hiddenParticles = new Map(); // typeIndex -> particles
    
    positions.forEach((pos, index) => {
      const typeIndex = pos.typeIndex;
      const isHighlighted = highlightedClusters.has(index);
      
      const particleData = {
        position: {
          x: pos.x - currentBoxSize[0] / 2,
          y: pos.y - currentBoxSize[1] / 2,
          z: pos.z - currentBoxSize[2] / 2
        },
        index
      };
      
      if (isHighlighted) {
        if (!highlightedParticles.has(typeIndex)) {
          highlightedParticles.set(typeIndex, []);
        }
        highlightedParticles.get(typeIndex).push(particleData);
      } else {
        if (!hiddenParticles.has(typeIndex)) {
          hiddenParticles.set(typeIndex, []);
        }
        hiddenParticles.get(typeIndex).push(particleData);
      }
    });
    
    // Create sphere geometries for different representations
    const fullSphereGeometry = new THREE.SphereGeometry(0.5, 8, 6); // Full detail for highlighted
    const hiddenSphereGeometry = new THREE.SphereGeometry(0.15, 4, 3); // Smaller, lower detail for hidden
    
    // Create highlighted particles with full representation
    highlightedParticles.forEach((particles, typeIndex) => {
      const colorIndex = typeIndex % particleColors.length;
      const particleColor = new THREE.Color(particleColors[colorIndex]);
      
      // Full material for highlighted particles
      const material = new THREE.MeshStandardMaterial({
        color: particleColor,
        metalness: 0.0,
        roughness: 0.8,
      });
      
      // Create instanced mesh for this type
      const instancedMesh = new THREE.InstancedMesh(
        fullSphereGeometry, 
        material, 
        particles.length
      );
      
      // Set up instances
      const dummy = new THREE.Object3D();
      particles.forEach((particle, i) => {
        dummy.position.set(
          particle.position.x,
          particle.position.y,
          particle.position.z
        );
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      });
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.name = `HighlightedParticles_Type_${typeIndex}`;
      
      exportScene.add(instancedMesh);
    });
    
    // Create hidden particles with dimmed representation
    hiddenParticles.forEach((particles, typeIndex) => {
      // Create dimmed material for hidden particles
      const dimmedMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, // Dark gray color
        metalness: 0.0,
        roughness: 0.9,
        transparent: true,
        opacity: 0.3
      });
      
      // Create instanced mesh for hidden particles
      const instancedMesh = new THREE.InstancedMesh(
        hiddenSphereGeometry, 
        dimmedMaterial, 
        particles.length
      );
      
      // Set up instances
      const dummy = new THREE.Object3D();
      particles.forEach((particle, i) => {
        dummy.position.set(
          particle.position.x,
          particle.position.y,
          particle.position.z
        );
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      });
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.name = `HiddenParticles_Type_${typeIndex}`;
      
      exportScene.add(instancedMesh);
    });

    // Add patches to the export
    if (topData && topData.particleTypes) {
      // Group particles by type for patch processing
      const particlesByType = new Map();
      
      positions.forEach((pos, index) => {
        const typeIndex = pos.typeIndex;
        if (!particlesByType.has(typeIndex)) {
          particlesByType.set(typeIndex, []);
        }
        particlesByType.get(typeIndex).push({
          particle: pos,
          index
        });
      });
      
      // Process patches for each particle type
      topData.particleTypes.forEach((particleType) => {
        if (particleType.patchPositions && particleType.patchPositions.length > 0) {
          const particlesOfThisType = particlesByType.get(particleType.typeIndex) || [];
          
          if (particlesOfThisType.length > 0) {
            // Group patches by patch ID for efficient instancing
            const patchesByID = new Map();
            
            particlesOfThisType.forEach(({ particle, index }) => {
              // Only include patches for highlighted particles
              if (!highlightedClusters.has(index)) {
                return; // Skip patches for hidden particles
              }
              
              const particlePosition = new THREE.Vector3(
                particle.x - currentBoxSize[0] / 2,
                particle.y - currentBoxSize[1] / 2,
                particle.z - currentBoxSize[2] / 2
              );
              
              // Get rotation matrix if available
              let rotationMatrix = null;
              if (particle.rotationMatrix) {
                rotationMatrix = new THREE.Matrix3().fromArray(particle.rotationMatrix.elements);
              }
              
              particleType.patchPositions.forEach((patchOffset, patchIndex) => {
                const patchID = particleType.patches[patchIndex];
                
                if (!patchesByID.has(patchID)) {
                  patchesByID.set(patchID, []);
                }
                
                // Compute patch position and direction
                const localPatchPosition = new THREE.Vector3(
                  patchOffset.x,
                  patchOffset.y,
                  patchOffset.z
                ).multiplyScalar(0.5);
                
                // Create the outward-pointing direction vector
                const patchDirection = new THREE.Vector3(
                  patchOffset.x,
                  patchOffset.y,
                  patchOffset.z
                ).normalize();
                
                // Apply rotation if available
                let rotatedPatchPosition = localPatchPosition.clone();
                let rotatedPatchDirection = patchDirection.clone();
                if (rotationMatrix) {
                  rotatedPatchPosition.applyMatrix3(rotationMatrix);
                  rotatedPatchDirection.applyMatrix3(rotationMatrix);
                }
                
                // Translate to particle's global position
                const finalPatchPosition = rotatedPatchPosition.add(particlePosition);
                
                patchesByID.get(patchID).push({
                  position: finalPatchPosition,
                  direction: rotatedPatchDirection,
                  particleIndex: particle.index
                });
              });
            });
            
            // Create instanced meshes for each patch ID
            // Use cone geometry for patches - same as in Patches component
            const patchGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
            patchGeometry.translate(0, -0.2, 0); // Move cone so tip is at origin (inverted)
            
            patchesByID.forEach((patches, patchID) => {
              const patchColor = getColorForPatchID(patchID, currentColorScheme);
              
              const patchMaterial = new THREE.MeshStandardMaterial({
                color: patchColor,
                metalness: 0.2,
                roughness: 0.8,
              });
              
              const patchInstancedMesh = new THREE.InstancedMesh(
                patchGeometry,
                patchMaterial,
                patches.length
              );
              
              // Set up patch instances with proper cone orientation
              const dummy = new THREE.Object3D();
              patches.forEach((patch, i) => {
                dummy.position.copy(patch.position);
                
                // Orient cone to point inward (same logic as in Patches component)
                if (patch.direction) {
                  const upVector = new THREE.Vector3(0, 1, 0);
                  const inwardDirection = patch.direction.clone().negate(); // Invert direction
                  const quaternion = new THREE.Quaternion();
                  quaternion.setFromUnitVectors(upVector, inwardDirection);
                  dummy.setRotationFromQuaternion(quaternion);
                }
                
                dummy.updateMatrix();
                patchInstancedMesh.setMatrixAt(i, dummy.matrix);
              });
              
              patchInstancedMesh.instanceMatrix.needsUpdate = true;
              patchInstancedMesh.name = `Patches_ID_${patchID}_Type_${particleType.typeIndex}`;
              
              exportScene.add(patchInstancedMesh);
            });
          }
        }
      });
    }

    // Add camera to the export if available
    if (sceneRef && sceneRef.camera) {
      // Clone the current camera with its current position and rotation
      const camera = sceneRef.camera.clone();
      camera.name = 'ppview_camera';
      exportScene.add(camera);
      
      // Make this camera the default camera for the GLTF scene
      exportScene.userData.defaultCamera = camera;
    }

    // Export with optimized settings
    const exporter = new GLTFExporter();
    
    exporter.parse(
      exportScene,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `ppview_scene_config_${currentConfigIndex + 1}.gltf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
      },
      (error) => {
        console.error('Error exporting GLTF:', error);
        alert('Failed to export GLTF file');
      },
      {
        binary: false,
        includeCustomExtensions: false,
        maxTextureSize: 1024,
        embedImages: false
      }
    );
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
