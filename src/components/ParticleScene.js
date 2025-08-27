import React, { useRef, forwardRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Stats } from "@react-three/drei";
import Particles from "./Particles";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import * as THREE from "three";

// Coordinate Axis component using ArrowHelper - positioned at box corner
function CoordinateAxis({ boxSize }) {
  const groupRef = useRef();
  const { scene } = useThree();
  
  useEffect(() => {
    if (!groupRef.current) return;
    
    // Clear existing arrows
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    
    // Arrow length scaled based on box size
    const arrowLength = Math.min(...boxSize) * 0.15; // 15% of smallest box dimension
    const arrowHeadLength = arrowLength * 0.2;
    const arrowHeadWidth = arrowLength * 0.1;
    
    // Position at the bottom-left-back corner of the box
    const origin = new THREE.Vector3(
      -boxSize[0] / 2,  // Left edge
      -boxSize[1] / 2,  // Bottom edge  
      -boxSize[2] / 2   // Back edge
    );
    
    // Create X-axis arrow (Dark Red - matching oxDNA reference 0x800000)
    const xDirection = new THREE.Vector3(1, 0, 0);
    const xArrow = new THREE.ArrowHelper(
      xDirection,
      origin,
      arrowLength,
      0x800000, // Dark Red
      arrowHeadLength,
      arrowHeadWidth
    );
    xArrow.name = 'x-axis';
    groupRef.current.add(xArrow);
    
    // Create Y-axis arrow (Dark Green - matching oxDNA reference 0x008000)
    const yDirection = new THREE.Vector3(0, 1, 0);
    const yArrow = new THREE.ArrowHelper(
      yDirection,
      origin,
      arrowLength,
      0x008000, // Dark Green
      arrowHeadLength,
      arrowHeadWidth
    );
    yArrow.name = 'y-axis';
    groupRef.current.add(yArrow);
    
    // Create Z-axis arrow (Dark Blue - matching oxDNA reference 0x000080)
    const zDirection = new THREE.Vector3(0, 0, 1);
    const zArrow = new THREE.ArrowHelper(
      zDirection,
      origin,
      arrowLength,
      0x000080, // Dark Blue
      arrowHeadLength,
      arrowHeadWidth
    );
    zArrow.name = 'z-axis';
    groupRef.current.add(zArrow);
    
  }, [boxSize]); // Update when boxSize changes
  
  return <group ref={groupRef} />;
}

// Camera-following area light component for molecular render look
function CameraFollowingLight() {
  const lightRef = useRef();
  const { camera } = useThree();
  
  useFrame(() => {
    if (lightRef.current && camera) {
      // Position the light behind and above the camera
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      
      // Calculate position behind and above camera
      const lightPosition = camera.position.clone()
        .add(cameraDirection.clone().multiplyScalar(-5)) // Behind camera
        .add(new THREE.Vector3(0, 3, 0)); // Above camera
      
      lightRef.current.position.copy(lightPosition);
      
      // Make the light point towards where the camera is looking
      const target = camera.position.clone().add(cameraDirection.multiplyScalar(10));
      lightRef.current.target.position.copy(target);
      lightRef.current.target.updateMatrixWorld();
    }
  });
  
  return (
    <>
      <spotLight
        ref={lightRef}
        intensity={2.5}
        angle={Math.PI / 3} // 60 degree cone
        penumbra={0.2} // Soft edges
        distance={100}
        decay={2}
        color="#ffffff"
        castShadow={true}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.0001}
      />
      {/* Helper to visualize light target */}
      <object3D ref={(ref) => {
        if (ref && lightRef.current) {
          lightRef.current.target = ref;
        }
      }} />
    </>
  );
}

const ParticleScene = ({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
  onSceneReady,
  showSimulationBox,
  showBackdropPlanes,
  showCoordinateAxis,
  showPatches,
  colorScheme,
  highlightedClusters,
  showOnlyHighlightedClusters,
}) => {
  return (
    <Canvas 
      camera={{ position: [100, 0, 0], fov: 45 }}
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
        showBackdropPlanes={showBackdropPlanes}
        showCoordinateAxis={showCoordinateAxis}
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
  showBackdropPlanes,
  showCoordinateAxis,
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
      {/* Molecular render lighting setup */}
      
      {/* Very low ambient light for dramatic shadows */}
      <ambientLight intensity={0.15} color="#f0f0f0" />
      
      {/* Camera-following area light */}
      <CameraFollowingLight />
      
      {/* Strong key light for primary illumination and shadows */}
      <directionalLight 
        position={[15, 15, 10]} 
        intensity={2.0} 
        color="#ffffff"
        castShadow={true}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0001}
      />
      
      {/* Secondary rim light for edge definition */}
      <directionalLight 
        position={[-8, 5, -12]} 
        intensity={0.8} 
        color="#e6f3ff"
        castShadow={false}
      />
      
      {/* Subtle fill light to prevent complete darkness in shadows */}
      <directionalLight 
        position={[-5, -8, 5]} 
        intensity={0.3} 
        color="#fff8e6"
        castShadow={false}
      />

      {/* Render the simulation box conditionally */}
      {showSimulationBox && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={boxSize} />
          <meshBasicMaterial color="gray" wireframe />
        </mesh>
      )}

      {/* Render backdrop planes conditionally */}
      {showBackdropPlanes && (
        <>
          {/* XY plane at z=0 (back) */}
          <mesh position={[0, 0, -boxSize[2] / 2]} rotation={[0, 0, 0]}>
            <planeGeometry args={[boxSize[0], boxSize[1]]} />
            <meshStandardMaterial 
              color="#808080" 
              transparent 
              opacity={0.7} 
              side={THREE.DoubleSide}
              depthWrite={false}
              metalness={0.2}
              roughness={0.1}
              envMapIntensity={1.0}
            />
          </mesh>
          
          {/* XZ plane at y=0 (bottom) */}
          <mesh position={[0, -boxSize[1] / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[boxSize[0], boxSize[2]]} />
            <meshStandardMaterial 
              color="#808080" 
              transparent 
              opacity={0.7} 
              side={THREE.DoubleSide}
              depthWrite={false}
              metalness={0.2}
              roughness={0.1}
              envMapIntensity={1.0}
            />
          </mesh>
          
          {/* YZ plane at x=0 (left) */}
          <mesh position={[-boxSize[0] / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boxSize[2], boxSize[1]]} />
            <meshStandardMaterial 
              color="#808080" 
              transparent 
              opacity={0.7} 
              side={THREE.DoubleSide}
              depthWrite={false}
              metalness={0.2}
              roughness={0.1}
              envMapIntensity={1.0}
            />
          </mesh>
        </>
      )}

      {/* Render coordinate axes conditionally */}
      {showCoordinateAxis && (
        <CoordinateAxis boxSize={boxSize} />
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
