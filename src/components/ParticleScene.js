import React, { useRef, forwardRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Stats } from "@react-three/drei";
import Particles from "./Particles";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import * as THREE from "three";

const ParticleScene = ({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
  onSceneReady,
  showSimulationBox,
}) => {
  return (
    <Canvas 
      camera={{ position: [0, 0, Math.max(...boxSize) * 1.5], fov: 75 }}
      frameloop="demand" // Only render when needed
      dpr={[1, 2]} // Adaptive pixel ratio for performance
    >
      <SceneContent
        positions={positions}
        boxSize={boxSize}
        selectedParticles={selectedParticles}
        setSelectedParticles={setSelectedParticles}
        onSceneReady={onSceneReady}
        showSimulationBox={showSimulationBox}
      />
    </Canvas>
  );
};

function SceneContent({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
  onSceneReady,
  showSimulationBox,
}) {
  const controlsRef = useRef();
  const { scene, camera, invalidate } = useThree();
  const isAnimating = useRef(false);

  // Provide scene reference to parent component
  useEffect(() => {
    if (onSceneReady && scene) {
      onSceneReady(scene);
    }
  }, [onSceneReady, scene]);

  // Function to handle double-click on a particle
  const handleParticleDoubleClick = (particlePosition) => {
    // Animate camera position towards the particle
    const duration = 1; // Duration in seconds
    const startTime = performance.now();
    const startPosition = camera.position.clone();
    const targetPosition = particlePosition
      .clone()
      .add(new THREE.Vector3(0, 0, 5)); // Adjust the offset as needed

    isAnimating.current = true;
    
    const animate = (time) => {
      const elapsed = (time - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);

      camera.position.lerpVectors(startPosition, targetPosition, t);
      controlsRef.current.target.lerpVectors(
        controlsRef.current.target,
        particlePosition,
        t,
      );
      controlsRef.current.update();
      invalidate(); // Request a render

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        isAnimating.current = false;
      }
    };

    requestAnimationFrame(animate);
  };

  // Handle controls changes to trigger re-render
  useFrame(() => {
    if (controlsRef.current && (controlsRef.current.enabled && !isAnimating.current)) {
      // Only invalidate if controls have actually changed
      const controls = controlsRef.current;
      if (controls._hasChanged) {
        invalidate();
        controls._hasChanged = false;
      }
    }
  });

  return (
    <>
      <OrbitControls 
        ref={controlsRef} 
        onChange={() => invalidate()} // Trigger re-render on camera changes
        enableDamping={true}
        dampingFactor={0.05}
      />
      <ambientLight intensity={0.5} />
      <Environment preset="sunset" />

      {/* Render the simulation box conditionally */}
      {showSimulationBox && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={boxSize} />
          <meshBasicMaterial color="gray" wireframe />
        </mesh>
      )}

      <Particles
        positions={positions}
        boxSize={boxSize}
        selectedParticles={selectedParticles}
        setSelectedParticles={setSelectedParticles}
        onParticleDoubleClick={handleParticleDoubleClick} // Pass the callback
      />

      {/* Add SSAO for ambient occlusion effect */}
      <EffectComposer enableNormalPass>
        <SSAO
          samples={31}
          radius={0.5}
          intensity={20}
          luminanceInfluence={0.9}
          color="#000000"
        />
      </EffectComposer>

      {/* Add Stats component for performance monitoring */}
      <Stats />
    </>
  );
}

export default ParticleScene;
