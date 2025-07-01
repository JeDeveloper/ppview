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
}) {
  const meshRef = useRef();
  const count = positions.length;
  const { gl, camera } = useThree(); // For raycasting

  // Create geometry and material once
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.5,
        roughness: 0.5,
      }),
    [],
  );

  // Get current particle colors based on the selected scheme
  const particleColors = useMemo(() => getParticleColors(colorScheme), [colorScheme]);

  // Memoize particle data to avoid recalculation
  const particleData = useMemo(() => {
    return positions.map((pos, i) => ({
      position: {
        x: pos.x - boxSize[0] / 2,
        y: pos.y - boxSize[1] / 2,
        z: pos.z - boxSize[2] / 2,
      },
      colorIndex: pos.typeIndex % particleColors.length,
      typeColor: new THREE.Color(particleColors[pos.typeIndex % particleColors.length])
    }));
  }, [positions, boxSize, particleColors]);

  // Create colors array for the particles
  const colors = useMemo(() => {
    const colorArray = new Float32Array(count * 3);
    particleData.forEach((data, i) => {
      colorArray.set([data.typeColor.r, data.typeColor.g, data.typeColor.b], i * 3);
    });
    return colorArray;
  }, [particleData, count]);

  // Update colors when color scheme changes
  useEffect(() => {
    if (meshRef.current && particleData.length > 0) {
      const mesh = meshRef.current;
      
      // Update instance colors with new color scheme
      particleData.forEach((data, i) => {
        if (!selectedParticles.includes(i)) {
          mesh.setColorAt(i, data.typeColor);
        }
      });
      
      mesh.instanceColor.needsUpdate = true;
    }
  }, [particleData, selectedParticles]);

  // Set positions and colors for instanced particles (optimized)
  useEffect(() => {
    if (meshRef.current && particleData.length > 0) {
      const mesh = meshRef.current;
      const dummy = new THREE.Object3D();

      particleData.forEach((data, i) => {
        // Set position
        dummy.position.set(
          data.position.x,
          data.position.y,
          data.position.z,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;

      // Set initial colors
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
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

  // Apply selection effect to selected particles (optimized)
  useEffect(() => {
    if (meshRef.current && particleData.length > 0) {
      const mesh = meshRef.current;
      const yellowColor = new THREE.Color("yellow");

      particleData.forEach((data, i) => {
        const color = selectedParticles.includes(i) ? yellowColor : data.typeColor;
        mesh.setColorAt(i, color);
      });

      mesh.instanceColor.needsUpdate = true;
    }
  }, [selectedParticles, particleData]);

  // Group particles by type
  const particlesByType = useMemo(() => {
    const map = new Map();
    positions.forEach((pos) => {
      const typeIndex = pos.typeIndex;
      if (!map.has(typeIndex)) {
        map.set(typeIndex, { particleType: pos.particleType, particles: [] });
      }
      map.get(typeIndex).particles.push(pos);
    });
    return map;
  }, [positions]);

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
            return (
              <Patches
                key={`patches-${particleType.typeIndex}-${idx}`}
                particles={particles}
                patchPositions={particleType.patchPositions}
                patchIDs={particleType.patches}
                boxSize={boxSize}
              />
            );
          }
          return null;
        },
      )}
    </>
  );
}

export default Particles;
