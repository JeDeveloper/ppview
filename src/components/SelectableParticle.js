import React, { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";

function SelectableParticle({ particle, boxSize, updateParticlePosition }) {
  const meshRef = useRef();
  const transformRef = useRef();
  const { camera, gl, scene } = useThree();

  // Attach the mesh to TransformControls
  useEffect(() => {
    if (transformRef.current) {
      transformRef.current.attach(meshRef.current);
    }
    return () => {
      if (transformRef.current) {
        transformRef.current.detach();
      }
    };
  }, []);

  // Update mesh position when particle position changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(
        particle.x - boxSize[0] / 2,
        particle.y - boxSize[1] / 2,
        particle.z - boxSize[2] / 2,
      );
    }
  }, [particle.x, particle.y, particle.z, boxSize]);

  // Store mesh reference in particle for raycasting
  useEffect(() => {
    particle.meshRef = meshRef;
    // Clean up on unmount
    return () => {
      delete particle.meshRef;
    };
  }, [particle]);

  return (
    <TransformControls
      ref={transformRef}
      mode="translate"
      onObjectChange={() => {
        const newPos = meshRef.current.position;
        updateParticlePosition(particle.index, {
          x: newPos.x + boxSize[0] / 2,
          y: newPos.y + boxSize[1] / 2,
          z: newPos.z + boxSize[2] / 2,
        });
      }}
      // Prevent transform controls from interfering with orbit controls
      onPointerDown={() => controlsEnabled(false)}
      onPointerUp={() => controlsEnabled(true)}
    >
      <mesh
        ref={meshRef}
        position={[
          particle.x - boxSize[0] / 2,
          particle.y - boxSize[1] / 2,
          particle.z - boxSize[2] / 2,
        ]}
        castShadow
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
    </TransformControls>
  );

  // Function to enable or disable OrbitControls
  function controlsEnabled(enabled) {
    // Access the OrbitControls instance via the controlsRef
    const controls = camera.controls;
    if (controls) {
      controls.enabled = enabled;
    }
  }
}

export default SelectableParticle;
