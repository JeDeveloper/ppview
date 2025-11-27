import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
    WebGLPathTracer,
} from 'three-gpu-pathtracer';
import { useUIStore } from '../store/uiStore';
import { useParticleStore } from '../store/particleStore';
import { useClusteringStore } from '../store/clusteringStore';
import { getParticleColors } from '../colors';
import { getColorForPatchID } from '../utils/colorUtils';

function PathTracerRenderer() {
    const { gl, scene, camera, invalidate } = useThree();
    const pathTracerRef = useRef(null);
    const isInitialized = useRef(false);

    const {
        pathTracerEnabled,
        pathTracerSettings,
        setPathTracerSettings,
        currentColorScheme,
        showBackdropPlanes,
        showPatchLegend,
    } = useUIStore();

    const positions = useParticleStore(state => state.positions);
    const topData = useParticleStore(state => state.topData);
    const highlightedClusters = useClusteringStore(state => state.highlightedClusters);
    const showOnlyHighlightedClusters = useClusteringStore(state => state.showOnlyHighlightedClusters);

    // Build a path-tracing compatible scene
    const buildPathTracingScene = useCallback(() => {
        if (!positions || positions.length === 0) return;
        if (!pathTracerRef.current) return;
        
        console.log('Building path tracing scene with', positions.length, 'particles...');
        console.log('Scene options - Patches:', showPatchLegend, 'Backdrop:', showBackdropPlanes, 'Show only highlighted:', showOnlyHighlightedClusters);

        const pathTracer = pathTracerRef.current;
        const ptScene = new THREE.Scene();
        const boxSize = useParticleStore.getState().currentBoxSize;
        
        // Get particle colors
        const particleTypeCount = new Set(positions.map(pos => pos.typeIndex).filter(type => type !== undefined)).size;
        const particleColors = getParticleColors(currentColorScheme, particleTypeCount);

        // Create individual sphere meshes for each particle (path tracer doesn't support instanced meshes well)
        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        
        let renderedParticleCount = 0;
        positions.forEach((pos, i) => {
            // Check if particle should be shown based on clustering
            const isInHighlightedCluster = highlightedClusters.has(i);
            const shouldShow = !showOnlyHighlightedClusters || isInHighlightedCluster;
            
            if (!shouldShow) return; // Skip particles not in highlighted clusters
            // Get particle color
            let particleColor;
            if (pos.mglColor) {
                particleColor = new THREE.Color(pos.mglColor.r, pos.mglColor.g, pos.mglColor.b);
            } else {
                particleColor = new THREE.Color(particleColors[pos.typeIndex % particleColors.length]);
            }

            // Create material with PhysicalPathTracingMaterial for better path tracing
            const material = new THREE.MeshPhysicalMaterial({
                color: particleColor,
                metalness: 0.2,
                roughness: 0.6,
                clearcoat: 0.3,
                clearcoatRoughness: 0.2,
            });

            const mesh = new THREE.Mesh(sphereGeometry, material);
            mesh.position.set(
                pos.x - boxSize[0] / 2,
                pos.y - boxSize[1] / 2,
                pos.z - boxSize[2] / 2
            );
            ptScene.add(mesh);
            renderedParticleCount++;
        });
        
        console.log('Rendered', renderedParticleCount, 'of', positions.length, 'particles');

        // Add patches if enabled and available
        if (showPatchLegend && topData && topData.patchPositions && topData.patchIDs) {
            console.log('Adding patches to path tracer scene...');
            const coneRadius = 0.2;
            const coneHeight = 0.4;
            const coneGeometry = new THREE.ConeGeometry(coneRadius, 8, 8);
            coneGeometry.translate(0, -coneHeight / 2, 0);
            let patchCount = 0;

            positions.forEach((particle, i) => {
                // Check if particle should be shown based on clustering
                const isInHighlightedCluster = highlightedClusters.has(i);
                const shouldShow = !showOnlyHighlightedClusters || isInHighlightedCluster;
                if (!shouldShow) return; // Skip patches for hidden particles
                
                const particlePosition = new THREE.Vector3(
                    particle.x - boxSize[0] / 2,
                    particle.y - boxSize[1] / 2,
                    particle.z - boxSize[2] / 2
                );

                let rotationMatrix = null;
                if (particle.rotationMatrix) {
                    rotationMatrix = new THREE.Matrix3().fromArray(particle.rotationMatrix.elements);
                }

                topData.patchPositions.forEach((patchOffset, j) => {
                    const patchID = topData.patchIDs[j];
                    if (!patchOffset || patchID === undefined) return;

                    const patchVectorLength = Math.sqrt(
                        patchOffset.x * patchOffset.x +
                        patchOffset.y * patchOffset.y +
                        patchOffset.z * patchOffset.z
                    );
                    const scaleFactor = patchVectorLength < 1.5 ? 0.5 : 0.5 / patchVectorLength;

                    const localPatchPosition = new THREE.Vector3(
                        patchOffset.x,
                        patchOffset.y,
                        patchOffset.z
                    ).multiplyScalar(scaleFactor);

                    const patchDirection = new THREE.Vector3(
                        patchOffset.x,
                        patchOffset.y,
                        patchOffset.z
                    ).normalize();

                    let rotatedPatchPosition = localPatchPosition.clone();
                    let rotatedPatchDirection = patchDirection.clone();

                    if (rotationMatrix) {
                        rotatedPatchPosition.applyMatrix3(rotationMatrix);
                        rotatedPatchDirection.applyMatrix3(rotationMatrix);
                    }

                    const patchPosition = rotatedPatchPosition.add(particlePosition);

                    const color = getColorForPatchID(patchID, currentColorScheme);
                    const patchMaterial = new THREE.MeshPhysicalMaterial({
                        color: color,
                        metalness: 0.3,
                        roughness: 0.7,
                        side: THREE.DoubleSide,
                    });

                    const patchMesh = new THREE.Mesh(coneGeometry, patchMaterial);
                    patchMesh.position.copy(patchPosition);

                    const upVector = new THREE.Vector3(0, 1, 0);
                    const inwardDirection = rotatedPatchDirection.clone().negate();
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromUnitVectors(upVector, inwardDirection);
                    patchMesh.setRotationFromQuaternion(quaternion);

                    ptScene.add(patchMesh);
                    patchCount++;
                });
            });
            console.log('Added', patchCount, 'patches to path tracer scene');
        }

        // Add backdrop planes if enabled
        if (showBackdropPlanes) {
            console.log('Adding backdrop planes to path tracer scene...');
            // XY plane at z=-boxSize[2]/2 (back)
            const xyPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(boxSize[0], boxSize[1]),
                new THREE.MeshPhysicalMaterial({
                    color: 0x808080,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    metalness: 0.2,
                    roughness: 0.1,
                })
            );
            xyPlane.position.set(0, 0, -boxSize[2] / 2);
            ptScene.add(xyPlane);

            // XZ plane at y=-boxSize[1]/2 (bottom)
            const xzPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(boxSize[0], boxSize[2]),
                new THREE.MeshPhysicalMaterial({
                    color: 0x808080,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    metalness: 0.2,
                    roughness: 0.1,
                })
            );
            xzPlane.position.set(0, -boxSize[1] / 2, 0);
            xzPlane.rotation.x = -Math.PI / 2;
            ptScene.add(xzPlane);

            // YZ plane at x=-boxSize[0]/2 (left)
            const yzPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(boxSize[2], boxSize[1]),
                new THREE.MeshPhysicalMaterial({
                    color: 0x808080,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    metalness: 0.2,
                    roughness: 0.1,
                })
            );
            yzPlane.position.set(-boxSize[0] / 2, 0, 0);
            yzPlane.rotation.y = Math.PI / 2;
            ptScene.add(yzPlane);
        }

        // Add lights from the original scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        ptScene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight1.position.set(10, 10, 10);
        ptScene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xfff8e6, 0.4);
        dirLight2.position.set(-15, 10, -10);
        ptScene.add(dirLight2);

        // Add environment
        ptScene.background = new THREE.Color(0x222222);

        // Set up the path tracer with the scene
        try {
            pathTracer.setScene(ptScene, camera);

            // Apply settings
            pathTracer.bounces = pathTracerSettings.bounces;
            pathTracer.filterGlossyFactor = pathTracerSettings.filterGlossyFactor;
            pathTracer.tiles.set(pathTracerSettings.tiles.x, pathTracerSettings.tiles.y);

            console.log('Path tracer scene built successfully');
            console.log('Total objects in scene:', ptScene.children.length);
        } catch (error) {
            console.error('Error setting up path tracer:', error);
        }
    }, [positions, camera, pathTracerSettings.bounces, pathTracerSettings.filterGlossyFactor, pathTracerSettings.tiles.x, pathTracerSettings.tiles.y, currentColorScheme, showBackdropPlanes, showPatchLegend, topData, highlightedClusters, showOnlyHighlightedClusters]);

    // Initialize path tracer
    useEffect(() => {
        if (!pathTracerEnabled || !gl || !scene || !camera) return;

        try {
            // Create path tracer if it doesn't exist
            if (!pathTracerRef.current) {
                const pathTracer = new WebGLPathTracer(gl);
                pathTracer.tiles.set(pathTracerSettings.tiles.x, pathTracerSettings.tiles.y);
                pathTracerRef.current = pathTracer;
                console.log('Path tracer initialized');
            }

            // Always rebuild the scene when dependencies change
            console.log('Rebuilding path tracer scene - Patches:', showPatchLegend, 'Backdrops:', showBackdropPlanes);
            buildPathTracingScene();
            isInitialized.current = true;
        } catch (error) {
            console.error('Error initializing path tracer:', error);
        }

        return () => {
            // Cleanup when disabled
            if (!pathTracerEnabled && pathTracerRef.current) {
                // Don't dispose the renderer as it's shared, but we can reset internal state if needed
                // pathTracerRef.current.dispose(); 
                pathTracerRef.current = null;
                isInitialized.current = false;
            }
        };
    }, [pathTracerEnabled, gl, scene, camera, pathTracerSettings.tiles.x, pathTracerSettings.tiles.y, buildPathTracingScene, showPatchLegend, showBackdropPlanes]);

    // Update path tracer settings when they change
    useEffect(() => {
        if (!pathTracerRef.current || !pathTracerEnabled) return;

        const pathTracer = pathTracerRef.current;

        // Update settings
        pathTracer.bounces = pathTracerSettings.bounces;
        pathTracer.filterGlossyFactor = pathTracerSettings.filterGlossyFactor;
        pathTracer.tiles.set(pathTracerSettings.tiles.x, pathTracerSettings.tiles.y);

        // Reset when settings change
        pathTracer.reset();
        setPathTracerSettings({ ...pathTracerSettings, currentSamples: 0 });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        pathTracerSettings.bounces,
        pathTracerSettings.filterGlossyFactor,
        pathTracerSettings.tiles.x,
        pathTracerSettings.tiles.y,
        pathTracerEnabled,
        setPathTracerSettings,
    ]);

    // Render loop for path tracing - render AFTER default render (priority -1)
    useFrame(({ clock }) => {
        if (!pathTracerEnabled || !pathTracerRef.current) return;

        const pathTracer = pathTracerRef.current;

        try {
            // Explicitly update camera
            pathTracer.updateCamera();

            // Update path tracer
            pathTracer.renderSample();

            // Update sample count
            const samples = pathTracer.samples;
            if (samples !== pathTracerSettings.currentSamples) {
                setPathTracerSettings({ ...pathTracerSettings, currentSamples: samples });
            }

            // Log every 60 frames to confirm it's running
            if (clock.elapsedTime % 1 < 0.02) {
                console.log('Path tracer running (priority -1), samples:', samples);
            }

            // Keep invalidating to ensure continuous rendering
            invalidate();

        } catch (error) {
            console.error('Error during path tracing:', error);
        }
    }, -1);

    return null;
}

export default PathTracerRenderer;
