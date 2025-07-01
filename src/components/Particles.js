import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getParticleColors } from "../colors";
import Patches from "./Patches";
import SelectableParticle from "./SelectableParticle";
function Particles({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
  onParticleDoubleClick,
  showPatches = true, // Default to true for backward compatibility
  colorScheme = null, // Allow color scheme to be passed as prop
  highlightedClusters = new Set(),
  showOnlyHighlightedClusters = false,
}) {
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
  const particleColors = useMemo(() => getParticleColors(colorScheme), [colorScheme]);

  // Memoize particle data to avoid recalculation
  const particleData = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    return positions.map((pos, i) => {
      const isInHighlightedCluster = highlightedClusters.has(i);
      const shouldShow = !showOnlyHighlightedClusters || isInHighlightedCluster;
      
      return {
        position: {
          x: pos.x - boxSize[0] / 2,
          y: pos.y - boxSize[1] / 2,
          z: pos.z - boxSize[2] / 2,
        },
        colorIndex: pos.typeIndex % particleColors.length,
        typeColor: new THREE.Color(particleColors[pos.typeIndex % particleColors.length]),
        isInHighlightedCluster,
        shouldShow
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
      
      // Update instance colors with new color scheme
      for (let i = 0; i < instanceCount; i++) {
        const data = particleData[i];
        if (!data) continue; // Skip if data is undefined
        
        if (!selectedParticles.includes(i)) {
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

      // Ensure we don't exceed the actual instance count and have valid data
      const actualCount = Math.min(mesh.count, particleData.length, colors.length / 3);
      
      // Set positions
      for (let i = 0; i < actualCount; i++) {
        const data = particleData[i];
        if (!data || !data.position) continue;
        
        try {
          dummy.position.set(
            data.position.x,
            data.position.y,
            data.position.z,
          );
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        } catch (error) {
          console.warn(`Error setting particle ${i} position:`, error);
          break; // Stop processing if we hit an error
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Set initial colors with strict bounds checking
      try {
        if (colors.length >= actualCount * 3 && actualCount > 0) {
          const safeColorArray = new Float32Array(actualCount * 3);
          for (let i = 0; i < actualCount * 3; i++) {
            safeColorArray[i] = colors[i] || 0;
          }
          mesh.instanceColor = new THREE.InstancedBufferAttribute(safeColorArray, 3);
        }
      } catch (error) {
        console.warn('Error setting instance colors:', error);
      }
    }
  }, [particleData, colors]);

  // Memoize event handlers to prevent unnecessary re-creation
  const handleClick = useCallback((event) => {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;

      setSelectedParticles((prevSelected) => {
        if (event.ctrlKey || event.metaKey) {
          // If Ctrl or Command key is pressed, toggle selection of the particle
          if (prevSelected.includes(instanceId)) {
            // Deselect particle
            return prevSelected.filter((id) => id !== instanceId);
          } else {
            // Select particle
            return [...prevSelected, instanceId];
          }
        } else {
          // If Ctrl is not pressed, select only this particle
          return [instanceId];
        }
      });
    } else {
      if (!event.ctrlKey && !event.metaKey) {
        // If Ctrl is not pressed, clear selection
        setSelectedParticles([]);
      }
    }
  }, [camera, setSelectedParticles]);

  const handleDoubleClick = useCallback((event) => {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      const particlePosition = particleData[instanceId]?.position;
      
      if (particlePosition && onParticleDoubleClick) {
        onParticleDoubleClick(new THREE.Vector3(
          particlePosition.x,
          particlePosition.y,
          particlePosition.z
        ));
      }
    }
  }, [camera, particleData, onParticleDoubleClick]);

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

      for (let i = 0; i < instanceCount; i++) {
        const data = particleData[i];
        if (!data) continue; // Skip if data is undefined
        
        let color;
        let scale = 1.0;
        
        // Determine color based on selection and cluster highlighting
        if (selectedParticles.includes(i)) {
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
      <instancedMesh ref={meshRef} args={[geometry, material, count]}>
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
