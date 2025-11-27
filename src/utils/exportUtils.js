import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getParticleColors } from "../colors";
import { getColorForPatchID } from "./colorUtils";

// Function to take a screenshot of the current scene
export const captureScreenshot = (sceneRef, currentConfigIndex, resolutionScale = 1.0) => {
  if (!sceneRef || !sceneRef.gl || !sceneRef.scene || !sceneRef.camera) {
    alert('Scene not ready for screenshot');
    return;
  }

  try {
    // Force invalidate to ensure scene is rendered with post-processing
    if (sceneRef.invalidate) {
      sceneRef.invalidate();
    }

    // Wait for the render to complete through the EffectComposer pipeline
    setTimeout(() => {
      try {
        // Get the renderer
        const renderer = sceneRef.gl;

        // Get the canvas element directly - it already has the composed output
        const canvas = renderer.domElement;
        if (!canvas) {
          alert('Canvas not found');
          return;
        }

        // If resolution scale is not 1.0, we need to create a scaled version
        let dataURL;
        if (resolutionScale !== 1.0 && resolutionScale < 1.0) {
          // Create a temporary canvas at full resolution
          const tempCanvas = document.createElement('canvas');
          const originalWidth = canvas.width / resolutionScale;
          const originalHeight = canvas.height / resolutionScale;
          tempCanvas.width = originalWidth;
          tempCanvas.height = originalHeight;
          
          const ctx = tempCanvas.getContext('2d');
          // Scale up the rendered image to full resolution
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(canvas, 0, 0, originalWidth, originalHeight);
          dataURL = tempCanvas.toDataURL('image/png');
        } else {
          // Capture the screenshot - the canvas already contains the post-processed output
          // Don't call renderer.render() as it bypasses the EffectComposer
          dataURL = canvas.toDataURL('image/png');
        }

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
    }, 250); // Increased timeout to ensure composed render completes

  } catch (error) {
    console.error('Error taking screenshot:', error);
    alert('Failed to take screenshot');
  }
};

// Function to export the scene as GLTF
export const exportSceneAsGLTF = (options) => {
  const {
    positions,
    currentBoxSize,
    currentConfigIndex,
    showSimulationBox,
    showBackdropPlanes,
    currentColorScheme,
    topData,
    highlightedClusters,
    sceneRef
  } = options;

  if (!positions || positions.length === 0) {
    alert('No particles to export');
    return;
  }

  // Calculate the number of unique particle types for dynamic color generation
  const uniqueTypes = new Set(positions.map(pos => pos.typeIndex).filter(type => type !== undefined));
  const particleTypeCount = uniqueTypes.size;
  const particleColors = getParticleColors(currentColorScheme, particleTypeCount);

  // Create a new scene for export
  const exportScene = new THREE.Scene();

  // Add ambient light
  const ambientLight = new THREE.AmbientLight('#f0f0f0', 0.15);
  exportScene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight('#ffffff', 2.0);
  directionalLight.position.set(15, 15, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  directionalLight.shadow.bias = -0.0001;
  exportScene.add(directionalLight);

  // Add camera following light if available
  if (sceneRef && sceneRef.camera) {
    const cameraLight = new THREE.SpotLight('#ffffff', 2.5);
    cameraLight.angle = Math.PI / 3;
    cameraLight.penumbra = 0.2;
    cameraLight.distance = 100;
    cameraLight.decay = 2;
    cameraLight.castShadow = true;
    cameraLight.shadow.mapSize.width = 1024;
    cameraLight.shadow.mapSize.height = 1024;
    cameraLight.shadow.camera.near = 0.1;
    cameraLight.shadow.camera.far = 100;
    cameraLight.shadow.bias = -0.0001;

    // Position and redirect the light following the camera
    const cameraDirection = new THREE.Vector3();
    sceneRef.camera.getWorldDirection(cameraDirection);
    cameraLight.position.copy(sceneRef.camera.position.clone().add(cameraDirection.clone().multiplyScalar(-5)).add(new THREE.Vector3(0, 3, 0)));
    const target = sceneRef.camera.position.clone().add(cameraDirection.multiplyScalar(10));
    cameraLight.target.position.copy(target);
    cameraLight.target.updateMatrixWorld();
    exportScene.add(cameraLight);
    exportScene.add(cameraLight.target);
  }

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

  // Add backdrop planes only if visible
  if (showBackdropPlanes) {
    // Create material for backdrop planes (same as in ParticleScene)
    const backdropMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      metalness: 0.2,
      roughness: 0.1
    });

    // XY plane at z=0 (back)
    const xyPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[0], currentBoxSize[1]);
    const xyPlaneMesh = new THREE.Mesh(xyPlaneGeometry, backdropMaterial.clone());
    xyPlaneMesh.position.set(0, 0, -currentBoxSize[2] / 2);
    xyPlaneMesh.rotation.set(0, 0, 0);
    xyPlaneMesh.name = 'BackdropPlane_XY';
    exportScene.add(xyPlaneMesh);

    // XZ plane at y=0 (bottom)
    const xzPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[0], currentBoxSize[2]);
    const xzPlaneMesh = new THREE.Mesh(xzPlaneGeometry, backdropMaterial.clone());
    xzPlaneMesh.position.set(0, -currentBoxSize[1] / 2, 0);
    xzPlaneMesh.rotation.set(-Math.PI / 2, 0, 0);
    xzPlaneMesh.name = 'BackdropPlane_XZ';
    exportScene.add(xzPlaneMesh);

    // YZ plane at x=0 (left)
    const yzPlaneGeometry = new THREE.PlaneGeometry(currentBoxSize[2], currentBoxSize[1]);
    const yzPlaneMesh = new THREE.Mesh(yzPlaneGeometry, backdropMaterial.clone());
    yzPlaneMesh.position.set(-currentBoxSize[0] / 2, 0, 0);
    yzPlaneMesh.rotation.set(0, Math.PI / 2, 0);
    yzPlaneMesh.name = 'BackdropPlane_YZ';
    exportScene.add(yzPlaneMesh);
  }

  // Separate particles into highlighted (selected clusters) and hidden (others)
  const highlightedParticles = new Map(); // typeIndex -> particles
  const hiddenParticles = new Map(); // typeIndex -> particles

  positions.forEach((pos, index) => {
    const typeIndex = pos.typeIndex;
    const isHighlighted = highlightedClusters.has(index);

    const particleData = {
      position: {
        x: pos.x - currentBoxSize[0] / 2,
        y: pos.y - currentBoxSize[1] / 2,
        z: pos.z - currentBoxSize[2] / 2
      },
      index
    };

    if (isHighlighted) {
      if (!highlightedParticles.has(typeIndex)) {
        highlightedParticles.set(typeIndex, []);
      }
      highlightedParticles.get(typeIndex).push(particleData);
    } else {
      if (!hiddenParticles.has(typeIndex)) {
        hiddenParticles.set(typeIndex, []);
      }
      hiddenParticles.get(typeIndex).push(particleData);
    }
  });

  // Create sphere geometries for different representations
  const fullSphereGeometry = new THREE.SphereGeometry(0.5, 8, 6); // Full detail for highlighted
  const hiddenSphereGeometry = new THREE.SphereGeometry(0.15, 4, 3); // Smaller, lower detail for hidden

  // Create highlighted particles with full representation
  highlightedParticles.forEach((particles, typeIndex) => {
    const colorIndex = typeIndex % particleColors.length;
    const particleColor = new THREE.Color(particleColors[colorIndex]);

    // Full material for highlighted particles
    const material = new THREE.MeshStandardMaterial({
      color: particleColor,
      metalness: 0.0,
      roughness: 0.8,
    });

    // Create instanced mesh for this type
    const instancedMesh = new THREE.InstancedMesh(
      fullSphereGeometry,
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
    instancedMesh.name = `HighlightedParticles_Type_${typeIndex}`;

    exportScene.add(instancedMesh);
  });

  // Create hidden particles with dimmed representation
  hiddenParticles.forEach((particles, typeIndex) => {
    // Create dimmed material for hidden particles
    const dimmedMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark gray color
      metalness: 0.0,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3
    });

    // Create instanced mesh for hidden particles
    const instancedMesh = new THREE.InstancedMesh(
      hiddenSphereGeometry,
      dimmedMaterial,
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
    instancedMesh.name = `HiddenParticles_Type_${typeIndex}`;

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

          particlesOfThisType.forEach(({ particle, index }) => {
            // Only include patches for highlighted particles
            if (!highlightedClusters.has(index)) {
              return; // Skip patches for hidden particles
            }

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

  // Add camera to the export if available
  if (sceneRef && sceneRef.camera) {
    // Clone the current camera with its current position and rotation
    const camera = sceneRef.camera.clone();
    camera.name = 'ppview_camera';
    exportScene.add(camera);

    // Make this camera the default camera for the GLTF scene
    exportScene.userData.defaultCamera = camera;
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
};
