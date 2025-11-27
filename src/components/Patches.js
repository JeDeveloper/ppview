// src/components/Patches.js

import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from 'three';
import { getColorForPatchID } from '../utils/colorUtils';

function Patches({ particles, patchPositions, patchIDs, boxSize, colorScheme = null, isPathtracerEnabled = false }) {
  const meshRef = useRef();
  
  // Patch cone dimensions
  const coneRadius = 0.2;  // Base radius of the cone
  const coneHeight = 0.4;  // Height of the cone
  // Use moderate quality geometry for path tracing (not too high to avoid memory issues)
  const coneSegments = isPathtracerEnabled ? 16 : 8;  // Number of segments for cone base

  // Create cone geometry and material for patches
  // Cone points in +Y direction by default, we'll rotate it to point inward
  const geometry = useMemo(() => {
    const cone = new THREE.ConeGeometry(coneRadius, coneHeight, coneSegments);
    // Translate the cone so its tip is at the origin and base points outward
    // This ensures the tip of the cone is at the patch position
    cone.translate(0, -coneHeight / 2, 0);
    return cone;
  }, [coneRadius, coneHeight, coneSegments]);
  
  // Use MeshPhysicalMaterial for better path tracing results
  const material = useMemo(() => {
    if (isPathtracerEnabled) {
      return new THREE.MeshPhysicalMaterial({
        color: 'white',
        metalness: 0.3,
        roughness: 0.7,
        clearcoat: 0.2,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      });
    } else {
      return new THREE.MeshStandardMaterial({
        color: 'white',
        metalness: 0.3,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
    }
  }, [isPathtracerEnabled]);
  
  // Check if we have valid patch data
  const hasValidPatchData = particles && patchPositions && patchIDs && 
      particles.length > 0 && patchPositions.length > 0 && 
      patchIDs.length > 0 && patchPositions.length === patchIDs.length;
      
  const totalPatches = hasValidPatchData ? particles.length * patchPositions.length : 0;

  useEffect(() => {
    if (meshRef.current && hasValidPatchData) {
      const mesh = meshRef.current;
      const dummy = new THREE.Object3D();
      const colors = [];

      let index = 0;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const particlePosition = new THREE.Vector3(
          particle.x - boxSize[0] / 2,
          particle.y - boxSize[1] / 2,
          particle.z - boxSize[2] / 2
        );

        // Use the rotation matrix if available
        let rotationMatrix = null;
        if (particle.rotationMatrix) {
          rotationMatrix = new THREE.Matrix3().fromArray(particle.rotationMatrix.elements);
        }

        for (let j = 0; j < patchPositions.length; j++) {
          const patchOffset = patchPositions[j];
          const patchID = patchIDs[j]; // Get patch ID
          
          // Skip if patch data is invalid
          if (!patchOffset || patchID === undefined || patchID === null) {
            continue;
          }

          // Compute the patch position and orientation
          // Check if this is a unit vector (Flavio format) or larger value (Lorenzo format)
          const patchVectorLength = Math.sqrt(
            patchOffset.x * patchOffset.x + 
            patchOffset.y * patchOffset.y + 
            patchOffset.z * patchOffset.z
          );
          
          // If patch vector is approximately unit length (Flavio format), use 0.5 scaling
          // If it's larger (Lorenzo format), use smaller scaling factor
          const scaleFactor = patchVectorLength < 1.5 ? 0.5 : 0.5 / patchVectorLength;
          
          const localPatchPosition = new THREE.Vector3(
            patchOffset.x,
            patchOffset.y,
            patchOffset.z
          ).multiplyScalar(scaleFactor);

          // Create the outward-pointing direction vector (normalized patch offset)
          const patchDirection = new THREE.Vector3(
            patchOffset.x,
            patchOffset.y,
            patchOffset.z
          ).normalize();

          // Rotate the local patch position and direction using the rotation matrix
          let rotatedPatchPosition = localPatchPosition.clone();
          let rotatedPatchDirection = patchDirection.clone();
          
          if (rotationMatrix) {
            rotatedPatchPosition.applyMatrix3(rotationMatrix);
            rotatedPatchDirection.applyMatrix3(rotationMatrix);
          }

          // Translate to the particle's global position
          const patchPosition = rotatedPatchPosition.add(particlePosition);

          // Set up the cone transformation
          dummy.position.copy(patchPosition);
          
          // Orient the cone to point inward toward the particle
          // Default cone points in +Y direction, we need it to point inward (opposite to patch direction)
          const upVector = new THREE.Vector3(0, 1, 0);
          const inwardDirection = rotatedPatchDirection.clone().negate(); // Invert direction
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(upVector, inwardDirection);
          dummy.setRotationFromQuaternion(quaternion);
          
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);

          // Assign color based on patch ID
          const color = getColorForPatchID(patchID, colorScheme);
          colors.push(color.r, color.g, color.b);

      // Remove debugging logs for better performance
      // console.log(`Processing Patch ${index}:`);
      // console.log(`Patch ID: ${patchID}, Color: ${color.getStyle()}`);
      // console.log(`Patch Position: ${patchPosition.toArray()}`);
      // console.log(`Rotation Matrix:`, rotationMatrix);

          index++;
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Assign or update the instanceColor attribute
      const colorArray = new Float32Array(colors);
      if (!mesh.geometry.attributes.instanceColor || mesh.geometry.attributes.instanceColor.array.length !== colorArray.length) {
        // Create new attribute if it doesn't exist or size changed
        mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
      } else {
        // Only set if arrays are the same length
        if (mesh.geometry.attributes.instanceColor.array.length === colorArray.length) {
          mesh.geometry.attributes.instanceColor.array.set(colorArray);
          mesh.geometry.attributes.instanceColor.needsUpdate = true;
        } else {
          // Recreate if lengths don't match
          mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
        }
      }

      // Update material to use instanceColor
      // IMPORTANT: Skip custom shader injection when path tracing is enabled
      // Path tracers don't support custom shaders
      if (!isPathtracerEnabled && !mesh.material.userData.instanceColorInjected) {
        mesh.material.userData.instanceColorInjected = true;

        mesh.material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            attribute vec3 instanceColor;
            varying vec3 vInstanceColor;
            `
          ).replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            vInstanceColor = instanceColor;
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec3 vInstanceColor;
            `
          ).replace(
            'vec4 diffuseColor = vec4( diffuse, opacity );',
            'vec4 diffuseColor = vec4( vInstanceColor, opacity );'
          );
        };
        mesh.material.needsUpdate = true;
      }
      
      // For path tracing, we need to update the material color directly
      // since custom shaders don't work. We'll use a uniform color per instance.
      if (isPathtracerEnabled && mesh.instanceColor) {
        // Path tracer will use the instanceColor attribute if available
        // Note: This may not work perfectly with all path tracers
      }
    }
  }, [particles, patchPositions, patchIDs, boxSize, hasValidPatchData, colorScheme]);

  // Return null if no valid patch data
  if (!hasValidPatchData) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, totalPatches]} castShadow receiveShadow />
  );
}

export default Patches;