import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from 'three';
import { useUIStore } from "../store/uiStore";

// Renders repulsion site beads for raspberry particles.
// Click/double-click handling is delegated to Particles.js via onRegister —
// this component just manages transforms and colors.
function RepulsionSites({ particles, repulsionSiteData, boxSize, particleScale = 1.0, typeColor, globalIndices, typeIndex, onRegister }) {
  const meshRef = useRef();
  const { selectedParticles } = useUIStore();

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    metalness: 0.1,
    roughness: 0.7,
  }), []);

  const hasValidData = particles?.length > 0 && repulsionSiteData?.length > 0;
  const numBeads = repulsionSiteData?.length ?? 0;
  const totalBeads = hasValidData ? particles.length * numBeads : 0;

  // Particle center positions in scene space (used by parent for double-click navigation)
  const particlePositions = useMemo(() => {
    if (!hasValidData) return [];
    return particles.map(p => new THREE.Vector3(
      p.x - boxSize[0] / 2,
      p.y - boxSize[1] / 2,
      p.z - boxSize[2] / 2,
    ));
  }, [particles, boxSize, hasValidData]);

  // Register mesh + metadata with parent for centralized raycasting
  useEffect(() => {
    if (onRegister && meshRef.current && hasValidData) {
      onRegister(typeIndex, { mesh: meshRef.current, numBeads, globalIndices, particlePositions });
    }
    return () => {
      if (onRegister) onRegister(typeIndex, null);
    };
  }, [onRegister, typeIndex, hasValidData, numBeads, globalIndices, particlePositions]);

  // Set bead transforms (positions + scales)
  useEffect(() => {
    if (!meshRef.current || !hasValidData) return;

    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    let index = 0;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const particlePosition = particlePositions[i];

      let rotationMatrix = null;
      if (particle.rotationMatrix) {
        rotationMatrix = new THREE.Matrix3().fromArray(particle.rotationMatrix.elements);
      }

      for (let j = 0; j < repulsionSiteData.length; j++) {
        const site = repulsionSiteData[j];
        const localPos = new THREE.Vector3(
          site.position.x * particleScale,
          site.position.y * particleScale,
          site.position.z * particleScale,
        );
        if (rotationMatrix) localPos.applyMatrix3(rotationMatrix);

        dummy.position.copy(localPos).add(particlePosition);
        dummy.scale.setScalar(site.radius * particleScale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [particles, repulsionSiteData, particleScale, hasValidData, particlePositions]);

  // Update bead colors: yellow for selected particles, typeColor otherwise
  useEffect(() => {
    if (!meshRef.current || !hasValidData) return;

    const mesh = meshRef.current;
    const yellowColor = new THREE.Color("yellow");
    const colorArray = new Float32Array(totalBeads * 3);

    for (let i = 0; i < particles.length; i++) {
      const globalIndex = globalIndices ? globalIndices[i] : i;
      const isSelected = Array.isArray(selectedParticles) && selectedParticles.includes(globalIndex);
      const color = isSelected ? yellowColor : typeColor;

      if (color) {
        for (let j = 0; j < numBeads; j++) {
          const base = (i * numBeads + j) * 3;
          colorArray[base]     = color.r;
          colorArray[base + 1] = color.g;
          colorArray[base + 2] = color.b;
        }
      }
    }

    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.instanceColor.needsUpdate = true;
  }, [particles, typeColor, selectedParticles, globalIndices, hasValidData, totalBeads, numBeads]);

  if (!hasValidData) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, totalBeads]} castShadow receiveShadow />
  );
}

export default RepulsionSites;
