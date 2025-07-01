import React, { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import FileDropZone from "./components/FileDropZone";
import ParticleScene from "./components/ParticleScene";
import PatchLegend from "./components/PatchLegend";
import ParticleLegend from "./components/ParticleLegend";
import SelectedParticlesDisplay from "./components/SelectedParticlesDisplay"; // Import the new component
import ColorSchemeSelector from "./components/ColorSchemeSelector"; // Import the new color scheme selector
import { analyzeFiles, categorizeFiles } from "./utils/fileTypeDetector";
import { getCurrentColorScheme, getParticleColors } from "./colors";
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
  const [positions, setPositions] = useState([]);
  const [currentBoxSize, setCurrentBoxSize] = useState([
    34.199520111084, 34.199520111084, 34.199520111084,
  ]);
  const [topData, setTopData] = useState(null);

  const [trajFile, setTrajFile] = useState(null);
  const [configIndex, setConfigIndex] = useState([]);
  const [currentConfigIndex, setCurrentConfigIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentEnergy, setCurrentEnergy] = useState([]);
  const [totalConfigs, setTotalConfigs] = useState(0);

  // State variables for toggling Patch legend visibility and loading
  const [showPatchLegend, setShowPatchLegend] = useState(false);
  const [filesDropped, setFilesDropped] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [showParticleLegend, setShowParticleLegend] = useState(false);
  const [showSimulationBox, setShowSimulationBox] = useState(true);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // New state for selected particles
  const [selectedParticles, setSelectedParticles] = useState([]);

  // State to store the scene reference for GLTF export
  const [sceneRef, setSceneRef] = useState(null);
  
  // State for color scheme
  const [currentColorScheme, setCurrentColorScheme] = useState(getCurrentColorScheme());
  
  // State for trajectory playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(500); // milliseconds between frames
  const [isSpeedPopupVisible, setIsSpeedPopupVisible] = useState(false);
  const playbackIntervalRef = useRef(null);
  const speedPopupRef = useRef(null);
  
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

      // Create file map for compatibility with existing code
      const fileMap = new Map();
      files.forEach((file) => {
        fileMap.set(file.name.trim(), file);
      });

      // Process topology file
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
          topData.particleTypes,
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

  // Function to parse Lorenzo's topology
  const parseLorenzoTopology = async (lines, fileMap) => {
    const headerTokens = lines[0].trim().split(/\s+/).map(Number);
    const totalParticles = headerTokens[0];
    const typeCount = headerTokens[1];
    const particleTypes = [];

    let cumulativeCount = 0;
    const patchFileCache = new Map();

    for (let i = 1; i <= typeCount; i++) {
      const line = lines[i];
      const tokens = line.trim().split(/\s+/);
      const count = Number(tokens[0]);
      const patchCount = Number(tokens[1]);
      const patches = tokens[2] ? tokens[2].split(",").map(Number) : [];
      const fileName = tokens[3] ? tokens[3].trim() : "";
      cumulativeCount += count;

      const particleType = {
        typeIndex: i - 1, // Assign typeIndex starting from 0
        count: count,
        cumulativeCount: cumulativeCount,
        patchCount: patchCount,
        patches: patches || [], // Ensure patches is always an array
        fileName,
        patchPositions: [],
      };


      // Read the patch file if provided and if patches are specified
      if (fileName && patchCount > 0 && patches.length > 0) {
        if (patchFileCache.has(fileName)) {
          // Use cached patch positions
          particleType.patchPositions = patchFileCache.get(fileName);
        } else if (fileMap.has(fileName)) {
          try {
            const patchFile = fileMap.get(fileName);
            const patchContent = await patchFile.text();
            const patchPositions = parsePatchFile(patchContent);
            if (patchPositions && patchPositions.length > 0) {
              particleType.patchPositions = patchPositions;
              patchFileCache.set(fileName, patchPositions);
            }
          } catch (error) {
            console.warn(`Error reading patch file '${fileName}':`, error);
            particleType.patchPositions = [];
          }
        } else {
          console.warn(
            `Patch file '${fileName}' not found for particle type ${i}`,
          );
        }
      }

      particleTypes.push(particleType);
    }

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

    // Build particle types array
    Object.keys(typeCounts).forEach((typeIndex) => {
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

        // Convert to arrays and get positions
        patches = Array.from(uniquePatchIds);
        patchPositions = patches
          .map((patchId) => patchesData[patchId]?.position)
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

    return { totalParticles, typeCount, particleTypes };
  };

  // Function to parse particle.txt
  const parseParticleTxt = (content) => {
    const lines = content.trim().split("\n");
    const particlesData = [];

    let currentParticle = null;

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("particle_")) {
        if (currentParticle) {
          particlesData.push(currentParticle);
        }
        currentParticle = { patches: [] };
      } else if (line.startsWith("type =")) {
        currentParticle.type = Number(line.split("=")[1].trim());
      } else if (line.startsWith("patches =")) {
        const patchesStr = line.split("=")[1].trim();
        currentParticle.patches = patchesStr.split(",").map(Number);
      }
    });

    if (currentParticle) {
      particlesData.push(currentParticle);
    }

    return particlesData;
  };

  // Function to parse patches.txt
  const parsePatchesTxt = (content) => {
    const lines = content.trim().split("\n");
    const patchesData = {};

    let currentPatch = null;
    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("patch_")) {
        if (currentPatch) {
          patchesData[currentPatch.id] = currentPatch;
        }
        currentPatch = {};
      } else if (line.startsWith("id =")) {
        currentPatch.id = Number(line.split("=")[1].trim());
      } else if (line.startsWith("color =")) {
        currentPatch.color = Number(line.split("=")[1].trim());
      } else if (line.startsWith("strength =")) {
        currentPatch.strength = Number(line.split("=")[1].trim());
      } else if (line.startsWith("position =")) {
        const positionStr = line.split("=")[1].trim();
        // Handle both comma-separated and space-separated coordinates
        const coords = positionStr.includes(",") 
          ? positionStr.split(",").map(s => s.trim()).map(Number)
          : positionStr.split(/\s+/).map(Number);
        const [x, y, z] = coords;
        currentPatch.position = { x, y, z };
      } else if (line.startsWith("a1=") || line.startsWith("a1 =")) {
        const a1Str = line.split("=")[1].trim();
        // Handle both comma-separated and space-separated coordinates
        const coords = a1Str.includes(",") 
          ? a1Str.split(",").map(s => s.trim()).map(Number)
          : a1Str.split(/\s+/).map(Number);
        const [x, y, z] = coords;
        currentPatch.a1 = { x, y, z };
      } else if (line.startsWith("a2=") || line.startsWith("a2 =")) {
        const a2Str = line.split("=")[1].trim();
        // Handle both comma-separated and space-separated coordinates
        const coords = a2Str.includes(",") 
          ? a2Str.split(",").map(s => s.trim()).map(Number)
          : a2Str.split(/\s+/).map(Number);
        const [x, y, z] = coords;
        currentPatch.a2 = { x, y, z };
      }
    });

    if (currentPatch) {
      patchesData[currentPatch.id] = currentPatch;
    }

    return patchesData;
  };

  // Function to get particle type based on index
  const getParticleType = (particleIndex, particleTypes) => {
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
        setCurrentConfigIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= totalConfigs) {
            // Reached the end, stop playback
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current);
              playbackIntervalRef.current = null;
            }
            setIsPlaying(false);
            return prevIndex; // Stay at the last frame
          }
          return nextIndex;
        });
      }, playbackSpeed);
    }
  }, [isPlaying, playbackSpeed, totalConfigs]);

  // Function to reset trajectory to beginning
  const resetTrajectory = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentConfigIndex(0);
  }, []);

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
        // Apply periodic boundaries
        const adjustedPositions = applyPeriodicBoundary(
          shiftedPositions,
          currentBoxSize,
        );
        return adjustedPositions;
      });
    },
    [currentBoxSize],
  );

  // Function to export the scene as GLTF
  const exportGLTF = useCallback(() => {
    if (!positions || positions.length === 0) {
      alert('No particles to export');
      return;
    }

    // Import particle colors and patch color utility
    const particleColors = getParticleColors(currentColorScheme);
    const { getColorForPatchID } = require('./utils/colorUtils');

    // Create a new scene for export
    const exportScene = new THREE.Scene();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    exportScene.add(ambientLight);
    
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
    
    // Group particles by type for efficiency
    const particlesByType = new Map();
    
    positions.forEach((pos, index) => {
      const typeIndex = pos.typeIndex;
      if (!particlesByType.has(typeIndex)) {
        particlesByType.set(typeIndex, []);
      }
      particlesByType.get(typeIndex).push({
        position: {
          x: pos.x - currentBoxSize[0] / 2,
          y: pos.y - currentBoxSize[1] / 2,
          z: pos.z - currentBoxSize[2] / 2
        },
        index
      });
    });
    
    // Create optimized sphere geometry (lower poly for better performance)
    const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 6);
    
    // Create instanced mesh for each particle type
    particlesByType.forEach((particles, typeIndex) => {
      const colorIndex = typeIndex % particleColors.length;
      const particleColor = new THREE.Color(particleColors[colorIndex]);
      
      // Create material for this particle type
      const material = new THREE.MeshStandardMaterial({
        color: particleColor,
        metalness: 0.3,
        roughness: 0.7,
      });
      
      // Create instanced mesh for this type
      const instancedMesh = new THREE.InstancedMesh(
        sphereGeometry, 
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
      instancedMesh.name = `ParticleType_${typeIndex}`;
      
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
            
            particlesOfThisType.forEach(({ particle }) => {
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
  }, [positions, currentBoxSize, currentConfigIndex, showSimulationBox, currentColorScheme, topData]);

  // useEffect to handle key presses
  useEffect(() => {
    const handleKeyDown = (event) => {
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      // Cleanup event listener on unmount
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shiftPositions, takeScreenshot]);

  return (
    <div className="App">
      {!filesDropped && <FileDropZone onFilesReceived={handleFilesReceived} />}
      {positions.length > 0 && (
        <ParticleScene
          positions={positions}
          boxSize={currentBoxSize}
          selectedParticles={selectedParticles} // Pass as prop
          setSelectedParticles={setSelectedParticles} // Pass as prop
          onSceneReady={setSceneRef} // Pass callback to get scene reference
          showSimulationBox={showSimulationBox} // Pass simulation box visibility
          showPatches={showPatchLegend} // Control patch visibility with patch legend button
          colorScheme={currentColorScheme} // Pass current color scheme
        />
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
                  <label className="icon-toggle" title="Show Simulation Box">
                    <input
                      type="checkbox"
                      checked={showSimulationBox}
                      onChange={(e) => setShowSimulationBox(e.target.checked)}
                    />
                    <span className="toggle-icon">📦</span>
                  </label>
                </div>
                
                {/* Color scheme selector */}
                <div className="color-scheme-section">
                  <ColorSchemeSelector onSchemeChange={setCurrentColorScheme} />
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
      {selectedParticles.length > 0 && (
        <SelectedParticlesDisplay selectedParticles={selectedParticles} />
      )}
      {/* Conditionally render the PatchLegend component */}
      {topData && showPatchLegend && !isLoading && (
        <PatchLegend
          patchIDs={topData.particleTypes.flatMap((type) => type.patches)}
          colorScheme={currentColorScheme}
        />
      )}
      {/* Conditionally render the ParticleLegend component */}
      {topData && showParticleLegend && !isLoading && (
        <ParticleLegend 
          particleTypes={topData.particleTypes} 
          colorScheme={currentColorScheme}
        />
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
