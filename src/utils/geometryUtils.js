// Geometry utility functions for periodic boundary conditions and center of mass calculations

// Calculate center of mass taking periodic boundary conditions into account
// Based on: https://doi.org/10.1080/2151237X.2008.10129266
// https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
export const calcCOM = (positions, boxSize) => {
  // Create one averaging variable for each dimension, representing that 1D
  // interval as a unit circle in 2D (with the circumference being the
  // bounding box side length)
  let cm_x = { x: 0, y: 0 }; // Vector2-like object
  let cm_y = { x: 0, y: 0 };
  let cm_z = { x: 0, y: 0 };
  
  positions.forEach((pos) => {
    // Calculate positions on unit circle for each dimension and add to the sum
    const angle_x = (pos.x * 2 * Math.PI) / boxSize[0];
    const angle_y = (pos.y * 2 * Math.PI) / boxSize[1];
    const angle_z = (pos.z * 2 * Math.PI) / boxSize[2];
    
    cm_x.x += Math.cos(angle_x);
    cm_x.y += Math.sin(angle_x);
    cm_y.x += Math.cos(angle_y);
    cm_y.y += Math.sin(angle_y);
    cm_z.x += Math.cos(angle_z);
    cm_z.y += Math.sin(angle_z);
  });
  
  // Divide center of mass sums to get the averages
  const numPositions = positions.length;
  cm_x.x /= numPositions;
  cm_x.y /= numPositions;
  cm_y.x /= numPositions;
  cm_y.y /= numPositions;
  cm_z.x /= numPositions;
  cm_z.y /= numPositions;
  
  // Convert back from unit circle coordinates into x,y,z
  const cms = {
    x: boxSize[0] / (2 * Math.PI) * (Math.atan2(-cm_x.y, -cm_x.x) + Math.PI),
    y: boxSize[1] / (2 * Math.PI) * (Math.atan2(-cm_y.y, -cm_y.x) + Math.PI),
    z: boxSize[2] / (2 * Math.PI) * (Math.atan2(-cm_z.y, -cm_z.x) + Math.PI)
  };
  
  return cms;
};

// Helper function to apply periodic boundary conditions using oxview logic
export const applyPeriodicBoundary = (positions, boxSize) => {
  // We need actual modulus (handles negative numbers correctly)
  const realMod = (n, m) => ((n % m) + m) % m;
  
  // Calculate center of mass using periodic boundary conditions
  const com = calcCOM(positions, boxSize);
  
  // Use box center as the centering goal
  const centeringGoal = {
    x: boxSize[0] / 2,
    y: boxSize[1] / 2,
    z: boxSize[2] / 2
  };
  
  // Calculate translation needed to center the system
  const translation = {
    x: centeringGoal.x - com.x,
    y: centeringGoal.y - com.y,
    z: centeringGoal.z - com.z
  };
  
  // Define function to calculate a coordinate's position within periodic boundaries
  const coordInBox = (coord) => {
    const p = { ...coord };
    const shift = {
      x: boxSize[0] / 2 - centeringGoal.x,
      y: boxSize[1] / 2 - centeringGoal.y,
      z: boxSize[2] / 2 - centeringGoal.z
    };
    
    // Add shift
    p.x += shift.x;
    p.y += shift.y;
    p.z += shift.z;
    
    // Apply periodic boundaries using real modulus
    p.x = realMod(p.x, boxSize[0]);
    p.y = realMod(p.y, boxSize[1]);
    p.z = realMod(p.z, boxSize[2]);
    
    // Subtract shift
    p.x -= shift.x;
    p.y -= shift.y;
    p.z -= shift.z;
    
    return p;
  };
  
  // Apply "Monomer" boxing option with centering - treat each particle individually
  return positions.map((pos) => {
    const { x, y, z, ...rest } = pos;
    
    // First apply the centering translation
    const centeredPos = {
      x: x + translation.x,
      y: y + translation.y,
      z: z + translation.z
    };
    
    // Then apply periodic boundaries
    const newPos = coordInBox(centeredPos);
    
    return {
      x: newPos.x,
      y: newPos.y,
      z: newPos.z,
      ...rest,
    };
  });
};

// Function to apply only periodic wrapping without re-centering
export const applyPeriodicWrapping = (positions, boxSize) => {
  const coordInBox = (coord, boxDim) => {
    // Wrap coordinate to be within [0, boxDim]
    while (coord < 0) coord += boxDim;
    while (coord >= boxDim) coord -= boxDim;
    return coord;
  };

  return positions.map(({ x, y, z, ...rest }) => {
    return {
      x: coordInBox(x, boxSize[0]),
      y: coordInBox(y, boxSize[1]),
      z: coordInBox(z, boxSize[2]),
      ...rest,
    };
  });
};

/**
 * Computes a rotation matrix from orientation vectors a1 and a3
 * @param {Object} pos - Position object with a1 and a3 vectors
 * @returns {Object|null} Rotation matrix with elements array, or null if vectors not present
 */
export const computeRotationMatrix = (pos, THREE) => {
  if (!pos.a1 || !pos.a3) {
    return null;
  }

  // Compute a2 as cross product of a3 and a1
  const a1 = new THREE.Vector3(
    pos.a1.x,
    pos.a1.y,
    pos.a1.z,
  ).normalize();
  const a3 = new THREE.Vector3(
    pos.a3.x,
    pos.a3.y,
    pos.a3.z,
  ).normalize();
  const a2 = new THREE.Vector3().crossVectors(a3, a1).normalize();

  // Recompute a3 to ensure orthogonality
  a3.crossVectors(a1, a2).normalize();

  // Create the rotation matrix
  const matrix = new THREE.Matrix3().set(
    a1.x,
    a2.x,
    a3.x,
    a1.y,
    a2.y,
    a3.y,
    a1.z,
    a2.z,
    a3.z,
  );

  // Store matrix elements
  return {
    elements: matrix.elements.slice(), // Clone the elements array
  };
};
