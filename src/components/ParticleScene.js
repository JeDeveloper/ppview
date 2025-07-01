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
  showPatches,
  colorScheme,
  highlightedClusters,
  showOnlyHighlightedClusters,
}) => {
  return (
    <Canvas 
      camera={{ position: [0, 0, Math.max(...boxSize) * 1.5], fov: 75 }}
      frameloop="demand" // Only render when needed
      dpr={[1, 2]} // Adaptive pixel ratio for performance
      gl={{ preserveDrawingBuffer: true }} // Enable screenshot capability
    >
      <SceneContent
        positions={positions}
        boxSize={boxSize}
        selectedParticles={selectedParticles}
        setSelectedParticles={setSelectedParticles}
        onSceneReady={onSceneReady}
        showSimulationBox={showSimulationBox}
        showPatches={showPatches}
        colorScheme={colorScheme}
        highlightedClusters={highlightedClusters}
        showOnlyHighlightedClusters={showOnlyHighlightedClusters}
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
  showPatches,
  colorScheme,
  highlightedClusters,
  showOnlyHighlightedClusters,
}) {
  const controlsRef = useRef();
  const { scene, camera, invalidate, gl } = useThree();
  const isAnimating = useRef(false);

  // Provide complete scene data to parent component
  useEffect(() => {
    if (onSceneReady && scene && camera && gl) {
      onSceneReady({ scene, camera, gl, invalidate });
    }
  }, [onSceneReady, scene, camera, gl, invalidate]);

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
      {/* Main ambient light - reduced intensity for better contrast */}
      <ambientLight intensity={0.3} />
      
      {/* Key light - main directional light for primary illumination */}
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1.2} 
        color="#ffffff"
        castShadow={false}
      />
      
      {/* Fill light - softer directional light from opposite side */}
      <directionalLight 
        position={[-5, -5, -3]} 
        intensity={0.4} 
        color="#ffffff"
        castShadow={false}
      />
      
      {/* Rim light - creates edge definition and separation */}
      <directionalLight 
        position={[0, 0, -10]} 
        intensity={0.6} 
        color="#e6f3ff"
        castShadow={false}
      />
      
      {/* Top light - subtle illumination from above */}
      <directionalLight 
        position={[0, 15, 0]} 
        intensity={0.3} 
        color="#fff5e6"
        castShadow={false}
      />

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
        showPatches={showPatches}
        colorScheme={colorScheme}
        highlightedClusters={highlightedClusters}
        showOnlyHighlightedClusters={showOnlyHighlightedClusters}
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
