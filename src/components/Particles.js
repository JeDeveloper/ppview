import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getParticleColors } from "../colors";
import { useParticleStore } from "../store/particleStore";
import { useUIStore } from "../store/uiStore";
import { useClusteringStore } from "../store/clusteringStore";
import Patches from "./Patches";

function Particles({
  onParticleDoubleClick,
}) {
  // Get data from Zustand stores
  const positions = useParticleStore(state => state.positions);
  const boxSize = useParticleStore(state => state.currentBoxSize);
  const { selectedParticles, setSelectedParticles } = useUIStore();
  const colorScheme = useUIStore(state => state.currentColorScheme);
  const showPatches = useUIStore(state => state.showPatchLegend);
  const { highlightedClusters, showOnlyHighlightedClusters } = useClusteringStore();
  const meshRef = useRef();
  const count = Math.max(1, positions?.length || 0); // Ensure minimum count of 1
  const { gl, camera } = useThree(); // For raycasting

  // Create geometry and material once
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.0,
        roughness: 0.8,
      }),
    [],
  );

  // Get current particle colors based on the selected scheme
  // Calculate the number of unique particle types for dynamic color generation
  const particleTypeCount = useMemo(() => {
    if (!positions || positions.length === 0) return 0;
    const uniqueTypes = new Set(positions.map(pos => pos.typeIndex).filter(type => type !== undefined));
    return uniqueTypes.size;
  }, [positions]);
  
  const particleColors = useMemo(() => 
    getParticleColors(colorScheme, particleTypeCount), 
    [colorScheme, particleTypeCount]
  );

  // Memoize particle data to avoid recalculation
  const particleData = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    return positions.map((pos, i) => {
      const isInHighlightedCluster = highlightedClusters.has(i);
      const shouldShow = !showOnlyHighlightedClusters || isInHighlightedCluster;
      
      // Use MGL color if available, otherwise fall back to ppview color scheme
      let particleColor;
      if (pos.mglColor) {
        // Use the original MGL color
        particleColor = new THREE.Color(pos.mglColor.r, pos.mglColor.g, pos.mglColor.b);
      } else {
        // Fall back to ppview color scheme
        particleColor = new THREE.Color(particleColors[pos.typeIndex % particleColors.length]);
      }
      
      return {
        position: {
          x: pos.x - boxSize[0] / 2,
          y: pos.y - boxSize[1] / 2,
          z: pos.z - boxSize[2] / 2,
        },
        colorIndex: pos.typeIndex % particleColors.length,
        typeColor: particleColor,
        isInHighlightedCluster,
        shouldShow,
        hasMGLColor: !!pos.mglColor
      };
    });
  }, [positions, boxSize, particleColors, highlightedClusters, showOnlyHighlightedClusters]);

  // Create colors array for the particles
  const colors = useMemo(() => {
    if (particleData.length === 0) return new Float32Array(0);
    
    const colorArray = new Float32Array(particleData.length * 3);
    for (let i = 0; i < particleData.length; i++) {
      const data = particleData[i];
      if (data && data.typeColor) {
        const offset = i * 3;
        if (offset + 2 < colorArray.length) {
          colorArray[offset] = data.typeColor.r;
          colorArray[offset + 1] = data.typeColor.g;
          colorArray[offset + 2] = data.typeColor.b;
        }
      }
    }
    return colorArray;
  }, [particleData]);

  // Update colors when color scheme changes
  useEffect(() => {
    if (meshRef.current && particleData.length > 0) {
      const mesh = meshRef.current;
      
      // Ensure we don't exceed the actual instance count
      const instanceCount = Math.min(mesh.count, particleData.length);
      
      // Safety check: ensure instanceColor exists and has the right length
      if (!mesh.instanceColor || mesh.instanceColor.count !== instanceCount) {
        console.warn('Instance color buffer mismatch in color scheme update, skipping');
        return;
      }
      
      // Update instance colors with new color scheme
      for (let i = 0; i < instanceCount; i++) {
        const data = particleData[i];
        if (!data || !data.typeColor) continue; // Skip if data is undefined or incomplete
        
        if (!Array.isArray(selectedParticles) || !selectedParticles.includes(i)) {
          try {
            mesh.setColorAt(i, data.typeColor);
          } catch (error) {
            console.warn(`Error updating color for particle ${i}:`, error);
          }
        }
      }
      
      mesh.instanceColor.needsUpdate = true;
    }
  }, [particleData, selectedParticles]);

  // Set positions and colors for instanced particles (optimized)
  useEffect(() => {
    if (meshRef.current && particleData.length > 0 && colors.length > 0) {
      const mesh = meshRef.current;
      const dummy = new THREE.Object3D();

      // Use mesh.count as the source of truth - it should match the number of instances we're working with
      const instanceCount = mesh.count;
      
      // Create color array that exactly matches instance count
      const instanceColorArray = new Float32Array(instanceCount * 3);
      
      // Set positions and populate color array
      for (let i = 0; i < instanceCount; i++) {
        if (i < particleData.length) {
          const data = particleData[i];
          if (data && data.position) {
            try {
              dummy.position.set(
                data.position.x,
                data.position.y,
                data.position.z,
              );
              dummy.updateMatrix();
              mesh.setMatrixAt(i, dummy.matrix);
              
              // Set color from colors array if available
              const colorOffset = i * 3;
              if (colorOffset + 2 < colors.length) {
                instanceColorArray[colorOffset] = colors[colorOffset];
                instanceColorArray[colorOffset + 1] = colors[colorOffset + 1];
                instanceColorArray[colorOffset + 2] = colors[colorOffset + 2];
              }
            } catch (error) {
              console.warn(`Error setting particle ${i} position:`, error);
            }
          }
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Set instance colors - create new attribute that matches mesh count exactly
      try {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(instanceColorArray, 3);
      } catch (error) {
        console.warn('Error setting instance colors:', error);
      }
    }
  }, [particleData, colors]);

  // Helper function to get normalized mouse coordinates relative to canvas
  const getNormalizedMouseCoords = useCallback((event) => {
    if (!gl?.domElement) return null;
    
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    
    // Check if canvas has valid dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('Canvas has invalid dimensions for mouse coordinate calculation');
      return null;
    }
    
    // Calculate mouse position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is within canvas bounds
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      return null; // Click is outside canvas
    }
    
    // Convert to normalized device coordinates (-1 to +1)
    const pointer = new THREE.Vector2();
    pointer.x = (x / rect.width) * 2 - 1;
    pointer.y = -(y / rect.height) * 2 + 1;
    
    return pointer;
  }, [gl]);

  // Memoize event handlers to prevent unnecessary re-creation
  const handleClick = useCallback((event) => {
    if (!meshRef.current || !camera) return;
    
    const pointer = getNormalizedMouseCoords(event);
    if (!pointer) return; // Invalid coordinates or click outside canvas
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    
    try {
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        
        // Validate instanceId is within valid range
        if (instanceId >= 0 && instanceId < particleData.length) {
          if (event.ctrlKey || event.metaKey) {
            // If Ctrl or Command key is pressed, toggle selection of the particle
            if (Array.isArray(selectedParticles) && selectedParticles.includes(instanceId)) {
              // Deselect particle
              setSelectedParticles(selectedParticles.filter((id) => id !== instanceId));
            } else {
              // Select particle
              const current = Array.isArray(selectedParticles) ? selectedParticles : [];
              setSelectedParticles([...current, instanceId]);
            }
          } else {
            // If Ctrl is not pressed, select only this particle
            setSelectedParticles([instanceId]);
          }
        }
      } else {
        if (!event.ctrlKey && !event.metaKey) {
          // If Ctrl is not pressed, clear selection
          setSelectedParticles([]);
        }
      }
    } catch (error) {
      console.warn('Error during particle selection:', error);
    }
  }, [camera, setSelectedParticles, getNormalizedMouseCoords, particleData.length]);

  const handleDoubleClick = useCallback((event) => {
    if (!meshRef.current || !camera) return;
    
    const pointer = getNormalizedMouseCoords(event);
    if (!pointer) return; // Invalid coordinates or click outside canvas
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    
    try {
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        
        // Validate instanceId and get particle position
        if (instanceId >= 0 && instanceId < particleData.length) {
          const particlePosition = particleData[instanceId]?.position;
          
          if (particlePosition && onParticleDoubleClick) {
            onParticleDoubleClick(new THREE.Vector3(
              particlePosition.x,
              particlePosition.y,
              particlePosition.z
            ));
          }
        }
      }
    } catch (error) {
      console.warn('Error during particle double-click:', error);
    }
  }, [camera, particleData, onParticleDoubleClick, getNormalizedMouseCoords]);

  // Raycaster for detecting clicks and double-clicks
  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    gl.domElement.addEventListener("dblclick", handleDoubleClick);
    return () => {
      gl.domElement.removeEventListener("click", handleClick);
      gl.domElement.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [gl, handleClick, handleDoubleClick]);

  // Apply selection effect and cluster highlighting to particles (optimized)
  useEffect(() => {
    if (meshRef.current && particleData.length > 0) {
      const mesh = meshRef.current;
      const yellowColor = new THREE.Color("yellow");
      const dimmedColor = new THREE.Color(0.3, 0.3, 0.3); // Dimmed color for non-highlighted particles
      const dummy = new THREE.Object3D();

      // Ensure we don't exceed the actual instance count
      const instanceCount = Math.min(mesh.count, particleData.length);

      // Safety check: ensure instanceColor exists and has the right length
      if (!mesh.instanceColor || mesh.instanceColor.count !== instanceCount) {
        console.warn('Instance color buffer mismatch, skipping update');
        return;
      }

      for (let i = 0; i < instanceCount; i++) {
        const data = particleData[i];
        if (!data || !data.position) continue; // Skip if data is undefined or incomplete
        
        let color;
        let scale = 1.0;
        
        // Determine color based on selection and cluster highlighting
        if (Array.isArray(selectedParticles) && selectedParticles.includes(i)) {
          color = yellowColor; // Selected particles are yellow
        } else if (data.isInHighlightedCluster && highlightedClusters.size > 0) {
          color = data.typeColor; // Keep original particle color for highlighted clusters
          scale = 1.3; // Make highlighted cluster particles larger
        } else if (showOnlyHighlightedClusters && !data.shouldShow) {
          color = dimmedColor; // Dimmed particles when showing only clusters
          scale = 0.3; // Much smaller to make them less visible
        } else {
          color = data.typeColor; // Normal particle color
        }
        
        // Safely set color and matrix
        try {
          mesh.setColorAt(i, color);
          
          // Update scale for cluster highlighting
          dummy.position.set(
            data.position.x,
            data.position.y,
            data.position.z
          );
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        } catch (error) {
          console.warn(`Error setting particle ${i} properties:`, error);
        }
      }

      mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [selectedParticles, particleData, highlightedClusters, showOnlyHighlightedClusters]);

  // Group particles by type
  const particlesByType = useMemo(() => {
    const map = new Map();
    if (positions && positions.length > 0) {
      positions.forEach((pos) => {
        const typeIndex = pos.typeIndex;
        if (!map.has(typeIndex)) {
          map.set(typeIndex, { particleType: pos.particleType, particles: [] });
        }
        map.get(typeIndex).particles.push(pos);
      });
    }
    return map;
  }, [positions]);
  
  // Early return if no positions (after all hooks)
  if (!positions || positions.length === 0) {
    return null;
  }

  return (
    <>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow receiveShadow>
        {/* This instancedMesh renders the particles */}
      </instancedMesh>

      {showPatches && Array.from(particlesByType.values()).map(
        ({ particleType, particles }, idx) => {
          // Check if this particle type has valid patch data
          if (
            particleType &&
            particleType.patchPositions &&
            particleType.patchPositions.length > 0 &&
            particleType.patches &&
            particleType.patches.length > 0 &&
            particleType.patches.length === particleType.patchPositions.length
          ) {
            // Filter particles based on cluster visibility
            let filteredParticles = particles;
            if (showOnlyHighlightedClusters) {
              if (highlightedClusters.size > 0) {
                // Only show patches for particles that are in highlighted clusters
                filteredParticles = particles.filter((particle, index) => {
                  // Find the global index of this particle
                  const globalIndex = positions.findIndex(p => 
                    p.x === particle.x && p.y === particle.y && p.z === particle.z
                  );
                  return highlightedClusters.has(globalIndex);
                });
              } else {
                // If "show only selected" is enabled but no clusters are selected, show no patches
                filteredParticles = [];
              }
            }
            
            // Only render patches if there are visible particles
            if (filteredParticles.length > 0) {
              return (
                <Patches
                  key={`patches-${particleType.typeIndex}-${idx}`}
                  particles={filteredParticles}
                  patchPositions={particleType.patchPositions}
                  patchIDs={particleType.patches}
                  boxSize={boxSize}
                  colorScheme={colorScheme}
                />
              );
            }
          }
          return null;
        },
      )}
    </>
  );
}

export default Particles;
