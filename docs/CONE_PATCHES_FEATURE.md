# Cone Patches Feature

This document describes the implementation of patches as outward-facing cones in ppview, replacing the previous sphere-based representation.

## Overview

Patches are now rendered as cones that point outward from the particle surface, providing a more intuitive and accurate representation of patch directionality. This visual enhancement makes it easier to understand the orientation and interaction potential of patches in molecular simulations.

## Visual Changes

### Before (Spheres)
- Patches were rendered as small spheres positioned on particle surfaces
- No clear indication of patch directionality
- Difficult to distinguish patch orientation

### After (Inward-Facing Cones)
- Patches are rendered as cones with tips pointing toward the particle center
- Cone bases face outward, representing the interaction zone
- Clear visual indication of patch directionality and binding sites
- More intuitive understanding of patch geometry

## Technical Implementation

### Cone Geometry Specifications
- **Base Radius**: 0.2 units
- **Height**: 0.4 units  
- **Segments**: 8 (for optimal performance vs. quality)
- **Orientation**: Tips point inward toward particle center, bases face outward

### Cone Positioning and Orientation
1. **Position Calculation**: Same as spheres - patches are positioned on particle surfaces using local patch positions scaled by particle radius
2. **Direction Vector**: Calculated from the patch offset vector (normalized)
3. **Rotation**: Cones are rotated to align their tip (Y+ axis) with the inward patch direction (inverted)
4. **Particle Rotation**: Proper rotation matrix application for oriented particles

### Code Structure

#### Files Modified
- **`/src/components/Patches.js`**: Main patch rendering component
  - Replaced `SphereGeometry` with `ConeGeometry`
  - Added cone orientation calculations
  - Implemented proper cone rotation using quaternions
  
- **`/src/App.js`**: GLTF export functionality
  - Updated export to use cone geometry for patches
  - Maintained orientation consistency in exported files

#### Key Changes in Patches.js
```javascript
// Cone geometry creation
const geometry = useMemo(() => {
  const cone = new THREE.ConeGeometry(coneRadius, coneHeight, coneSegments);
  cone.translate(0, coneHeight / 2, 0); // Position cone base at origin
  return cone;
}, [coneRadius, coneHeight, coneSegments]);

// Cone orientation
const patchDirection = new THREE.Vector3(
  patchOffset.x,
  patchOffset.y,
  patchOffset.z
).normalize();

// Rotation to point inward (inverted)
const upVector = new THREE.Vector3(0, 1, 0);
const inwardDirection = rotatedPatchDirection.clone().negate(); // Invert direction
const quaternion = new THREE.Quaternion();
quaternion.setFromUnitVectors(upVector, inwardDirection);
dummy.setRotationFromQuaternion(quaternion);
```

## Benefits

### Visual Clarity
- **Directional Information**: Cone tips point toward particle center, bases show interaction zones
- **Binding Site Visualization**: Clearer understanding of where particle interactions can occur
- **Scientific Accuracy**: Better representation of patches as binding sites on particle surfaces

### Performance
- **Optimized Geometry**: 8-segment cones provide good visual quality with minimal performance impact
- **Instanced Rendering**: Maintains efficient rendering using THREE.js InstancedMesh
- **Memory Efficiency**: Cone geometry reuse across all patch instances

### Export Compatibility
- **GLTF Export**: Exported models maintain cone patch representation
- **Consistent Visualization**: Same appearance in external 3D software
- **Orientation Preservation**: Exported cones maintain proper directional alignment

## Usage

### Viewing Patches
1. Load particle data with patch information
2. Enable patch visibility using the patch legend toggle (🏷️)
3. Patches will appear as cones pointing outward from particles
4. Each cone's tip indicates the interaction direction

### Understanding Patch Orientation
- **Cone Tip**: Points inward toward the particle center (attached to surface)
- **Cone Base**: Faces outward, representing the interaction/binding zone
- **Cone Color**: Determined by patch ID (same color scheme as before)

### Export Considerations
- GLTF exports now include cone patches with proper orientation
- External 3D software will display patches as cones
- Patch colors and positions are preserved in exports

## Technical Details

### Geometry Specifications
- **Default Cone Dimensions**: Radius 0.2, Height 0.4
- **Positioning**: Tip centered on patch position (pointing inward)
- **Scaling**: Proportional to particle radius (0.5x scale factor)

### Rotation Mathematics
- **Reference Direction**: Cone Y+ axis (default upward)
- **Target Direction**: Inverted (negated) normalized patch offset vector
- **Rotation Method**: Quaternion-based rotation using `setFromUnitVectors`
- **Matrix Application**: Particle rotation matrices properly applied to both position and direction

### Performance Optimizations
- **Geometry Reuse**: Single cone geometry shared across all patch instances
- **Efficient Updates**: Only matrix transformations updated per frame
- **Material Sharing**: Patch materials grouped by ID for better performance

## Future Enhancements

### Potential Improvements
- **Adjustable Cone Size**: UI controls for cone dimensions
- **Patch Strength Visualization**: Cone size based on patch strength
- **Animation Support**: Patch orientation changes during trajectory playback
- **Interaction Visualization**: Visual feedback for patch-patch interactions

### Customization Options
- Easy modification of cone dimensions in `Patches.js`
- Adjustable segment count for quality vs. performance trade-offs
- Material properties can be customized (metalness, roughness, etc.)

## Browser Compatibility

The cone patch feature works in all modern browsers that support:
- WebGL (for Three.js rendering)
- ES6+ JavaScript features
- Modern CSS (for UI components)

No additional dependencies were introduced for this feature.
