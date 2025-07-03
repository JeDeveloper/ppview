/**
 * MGL Parser - Handles parsing of MGL format files
 * Supports both single MGL files and MGL trajectory files
 */

// Scaling factor for MGL geometry
const MGL_SCALE = 1.0;

// Color mapping for MGL color names
const MGL_COLORS = {
  'red': { r: 1.0, g: 0.0, b: 0.0 },
  'green': { r: 0.0, g: 1.0, b: 0.0 },
  'blue': { r: 0.0, g: 0.0, b: 1.0 },
  'yellow': { r: 1.0, g: 1.0, b: 0.0 },
  'cyan': { r: 0.0, g: 1.0, b: 1.0 },
  'magenta': { r: 1.0, g: 0.0, b: 1.0 },
  'violet': { r: 0.5, g: 0.0, b: 1.0 },
  'orange': { r: 1.0, g: 0.5, b: 0.0 },
  'white': { r: 1.0, g: 1.0, b: 1.0 },
  'black': { r: 0.0, g: 0.0, b: 0.0 },
  'grey': { r: 0.5, g: 0.5, b: 0.5 },
  'gray': { r: 0.5, g: 0.5, b: 0.5 },
  'pink': { r: 1.0, g: 0.75, b: 0.8 },
  'brown': { r: 0.6, g: 0.3, b: 0.1 },
  'purple': { r: 0.5, g: 0.0, b: 0.5 }
};

/**
 * Parses MGL color from string format
 * @param {string} colorStr - Color string (e.g., "C[blue]", "red", or RGB values)
 * @returns {object} - Color object with r, g, b, opacity
 */
function materialFromMGLColor(colorStr) {
  if (!colorStr) return { r: 0.5, g: 0.5, b: 0.5, opacity: 1.0 };
  
  // Handle C[colorname] format
  const colorMatch = colorStr.match(/C\[([^\]]+)\]/);
  if (colorMatch) {
    const colorName = colorMatch[1].toLowerCase();
    if (MGL_COLORS[colorName]) {
      return { ...MGL_COLORS[colorName], opacity: 1.0 };
    }
  }
  
  // Handle direct color name
  const directColor = colorStr.toLowerCase();
  if (MGL_COLORS[directColor]) {
    return { ...MGL_COLORS[directColor], opacity: 1.0 };
  }
  
  // Handle RGB values
  const tokens = colorStr.split(/\s+/);
  if (tokens.length >= 3) {
    const r = parseFloat(tokens[0]);
    const g = parseFloat(tokens[1]);
    const b = parseFloat(tokens[2]);
    const opacity = tokens.length >= 4 ? parseFloat(tokens[3]) : 1.0;
    
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return {
        r: Math.max(0, Math.min(1, r)),
        g: Math.max(0, Math.min(1, g)),
        b: Math.max(0, Math.min(1, b)),
        opacity: Math.max(0, Math.min(1, opacity))
      };
    }
  }
  
  // Default color if parsing fails
  return { r: 0.5, g: 0.5, b: 0.5, opacity: 1.0 };
}

/**
 * Parses a single MGL file
 * @param {string} content - File content
 * @returns {object} - Parsed MGL data with particles and metadata
 */
export function readMGL(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
  const particles = [];
  let boundingBox = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  
  lines.forEach(line => {
    // Skip .Box: headers in single MGL files
    if (line.startsWith('.Box:') || line.startsWith('.Vol:')) return;
    
    const particle = parseMGLLine(line);
    if (particle) {
      particles.push(particle);
      updateBoundingBox(boundingBox, particle.position);
    }
  });

  return {
    particles,
    boundingBox,
    frameCount: 1
  };
}

/**
 * Parses MGL trajectory file (multiple concatenated MGL files)
 * @param {string} content - File content
 * @returns {object} - Parsed trajectory data with frames
 */
export function readMGLTrajectory(content) {
  const lines = content.trim().split('\n');
  const frames = [];
  let currentFrame = null;
  let boundingBox = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) continue;
    
    // Check for frame headers (.Box: or .Vol:)
    if (line.startsWith('.Box:') || line.startsWith('.Vol:')) {
      // Save previous frame if exists
      if (currentFrame) {
        frames.push(currentFrame);
      }
      
      // Start new frame
      currentFrame = {
        header: line,
        boxDimensions: null,
        particles: [],
        frameIndex: frames.length
      };
      
      // Parse box dimensions from header (handle both comma and space separated)
      const boxDataStr = line.substring(line.indexOf(':') + 1).trim();
      const dimensionTokens = boxDataStr.includes(',') 
        ? boxDataStr.split(',').map(s => s.trim())
        : boxDataStr.split(/\s+/);
      
      if (dimensionTokens.length >= 3) {
        const dims = dimensionTokens.map(s => parseFloat(s)).filter(n => !isNaN(n));
        if (dims.length >= 3) {
          currentFrame.boxDimensions = [dims[0], dims[1], dims[2]];
        }
      }
      continue;
    }
    
    // If no frame started yet, create a default one
    if (!currentFrame) {
      currentFrame = {
        header: 'Frame 0',
        boxDimensions: [34.199520111084, 34.199520111084, 34.199520111084], // Default box size
        particles: [],
        frameIndex: 0
      };
    }
    
    // Parse particle data
    if (line.length > 0) {
      const particle = parseMGLLine(line);
      if (particle) {
        // Add frame-specific metadata
        particle.frameIndex = currentFrame.frameIndex;
        currentFrame.particles.push(particle);
        
        // Update global bounding box
        updateBoundingBox(boundingBox, particle.position);
      }
    }
  }
  
  // Add the last frame
  if (currentFrame) {
    frames.push(currentFrame);
  }
  
  return {
    frames,
    boundingBox,
    frameCount: frames.length,
    totalParticles: frames.reduce((sum, frame) => sum + frame.particles.length, 0)
  };
}

/**
 * Parses a single MGL line with actual MGL format
 * Format: x y z @ radius C[color] M patch_data...
 * @param {string} line - MGL line string
 * @returns {object|null} - Parsed particle object or null if invalid
 */
function parseMGLLine(line) {
  if (!line || line.trim() === '') return null;
  
  // Split by '@' to separate position from radius/color/patches
  const parts = line.split('@');
  if (parts.length !== 2) return null;
  
  // Parse position (x y z)
  const positionPart = parts[0].trim().split(/\s+/);
  if (positionPart.length !== 3) return null;
  
  const x = parseFloat(positionPart[0]);
  const y = parseFloat(positionPart[1]);
  const z = parseFloat(positionPart[2]);
  
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  
  // Parse radius, color, and patches
  const radiusColorPatchPart = parts[1].trim().split(/\s+/);
  if (radiusColorPatchPart.length < 2) return null;
  
  const radius = parseFloat(radiusColorPatchPart[0]);
  if (isNaN(radius)) return null;
  
  const colorToken = radiusColorPatchPart[1];
  const color = materialFromMGLColor(colorToken);
  
  const particle = {
    type: 'M', // All particles in this format appear to be patchy
    position: { x, y, z },
    radius,
    color,
    patches: [],
    properties: {}
  };
  
  // Parse patches (look for 'M' followed by patch data)
  let i = 2;
  while (i < radiusColorPatchPart.length) {
    if (radiusColorPatchPart[i] === 'M') {
      i++; // Move past 'M'
      // Parse all consecutive patches after 'M'
      while (i + 4 < radiusColorPatchPart.length) {
        // Try to parse patch: x y z radius color
        const patchX = parseFloat(radiusColorPatchPart[i]);
        const patchY = parseFloat(radiusColorPatchPart[i + 1]);
        const patchZ = parseFloat(radiusColorPatchPart[i + 2]);
        const patchRadius = parseFloat(radiusColorPatchPart[i + 3]);
        const patchColorToken = radiusColorPatchPart[i + 4];
        
        // Check if this looks like valid patch data
        if (!isNaN(patchX) && !isNaN(patchY) && !isNaN(patchZ) && !isNaN(patchRadius) && patchColorToken && patchColorToken.startsWith('C[')) {
          const patch = {
            position: { x: patchX, y: patchY, z: patchZ },
            radius: patchRadius,
            color: materialFromMGLColor(patchColorToken),
            patchId: particle.patches.length
          };
          particle.patches.push(patch);
          i += 5; // Move past this patch (x, y, z, radius, color)
        } else {
          // Not valid patch data, stop parsing patches
          break;
        }
      }
    } else {
      i++; // Move to next token
    }
  }
  
  return particle;
}

/**
 * Parses a single MGL shape from a line (legacy format)
 * @param {string} shapeStr - Shape string
 * @returns {object|null} - Parsed particle object or null if invalid
 */
function parseMGLShape(shapeStr) {
  if (!shapeStr || shapeStr.trim() === '') return null;
  
  const tokens = shapeStr.split(/\s+/);
  if (tokens.length < 7) return null; // Minimum required tokens
  
  const type = tokens[0];
  const x = parseFloat(tokens[1]) * MGL_SCALE;
  const y = parseFloat(tokens[2]) * MGL_SCALE;
  const z = parseFloat(tokens[3]) * MGL_SCALE;
  const radius = parseFloat(tokens[4]) * MGL_SCALE;
  
  // Basic validation
  if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(radius)) return null;
  
  const particle = {
    type,
    position: { x, y, z },
    radius,
    color: { r: 0.5, g: 0.5, b: 0.5, opacity: 1.0 }, // Default color
    patches: [],
    properties: {}
  };
  
  let tokenIndex = 5;
  
  // Parse based on particle type
  switch (type.toUpperCase()) {
    case 'S': // Sphere
      particle.color = materialFromMGLColor(tokens.slice(tokenIndex).join(' '));
      break;
      
    case 'M': // Patchy particle
      // Parse patches
      if (tokenIndex < tokens.length) {
        try {
          const patchCount = parseInt(tokens[tokenIndex]);
          tokenIndex++;
          
          for (let i = 0; i < patchCount && tokenIndex + 6 < tokens.length; i++) {
            const patch = {
              position: {
                x: parseFloat(tokens[tokenIndex]) * MGL_SCALE,
                y: parseFloat(tokens[tokenIndex + 1]) * MGL_SCALE,
                z: parseFloat(tokens[tokenIndex + 2]) * MGL_SCALE
              },
              color: materialFromMGLColor(`${tokens[tokenIndex + 3]} ${tokens[tokenIndex + 4]} ${tokens[tokenIndex + 5]}`),
              patchId: i
            };
            particle.patches.push(patch);
            tokenIndex += 6;
          }
        } catch (e) {
          console.warn('Error parsing patches for patchy particle:', e);
        }
      }
      // Remaining tokens are particle color
      if (tokenIndex < tokens.length) {
        particle.color = materialFromMGLColor(tokens.slice(tokenIndex).join(' '));
      }
      break;
      
    case 'C': // Cylinder
      // Parse axis vector (next 3 tokens)
      if (tokenIndex + 2 < tokens.length) {
        particle.axis = {
          x: parseFloat(tokens[tokenIndex]),
          y: parseFloat(tokens[tokenIndex + 1]),
          z: parseFloat(tokens[tokenIndex + 2])
        };
        tokenIndex += 3;
      }
      // Remaining tokens are color
      if (tokenIndex < tokens.length) {
        particle.color = materialFromMGLColor(tokens.slice(tokenIndex).join(' '));
      }
      break;
      
    case 'D': // Dipolar sphere
      // Parse dipole vector (next 3 tokens)
      if (tokenIndex + 2 < tokens.length) {
        particle.dipole = {
          x: parseFloat(tokens[tokenIndex]),
          y: parseFloat(tokens[tokenIndex + 1]),
          z: parseFloat(tokens[tokenIndex + 2])
        };
        tokenIndex += 3;
      }
      // Remaining tokens are color
      if (tokenIndex < tokens.length) {
        particle.color = materialFromMGLColor(tokens.slice(tokenIndex).join(' '));
      }
      break;
      
    default:
      console.warn(`Unknown MGL particle type: ${type}`);
      // Treat as sphere with remaining tokens as color
      if (tokenIndex < tokens.length) {
        particle.color = materialFromMGLColor(tokens.slice(tokenIndex).join(' '));
      }
  }
  
  return particle;
}

/**
 * Updates bounding box with a new position
 * @param {object} boundingBox - Bounding box object
 * @param {object} position - Position object with x, y, z
 */
function updateBoundingBox(boundingBox, position) {
  boundingBox.min.x = Math.min(boundingBox.min.x, position.x);
  boundingBox.min.y = Math.min(boundingBox.min.y, position.y);
  boundingBox.min.z = Math.min(boundingBox.min.z, position.z);
  boundingBox.max.x = Math.max(boundingBox.max.x, position.x);
  boundingBox.max.y = Math.max(boundingBox.max.y, position.y);
  boundingBox.max.z = Math.max(boundingBox.max.z, position.z);
}

/**
 * Converts MGL data to ppview format
 * @param {object} mglData - Parsed MGL data
 * @returns {object} - Data in ppview format
 */
export function convertMGLToPPViewFormat(mglData) {
  const positions = [];
  const particleTypes = new Map();
  let typeIndex = 0;
  
  // Handle single frame or trajectory
  const frames = mglData.frames || [{ particles: mglData.particles }];
  
  // Process first frame for now (ppview expects single configuration)
  const firstFrame = frames[0];
  if (!firstFrame || !firstFrame.particles) {
    throw new Error('No particles found in MGL data');
  }
  
  // Create particle types based on MGL particle colors
  const typeMap = new Map();
  
  firstFrame.particles.forEach((particle, particleIndex) => {
    // Use color as the key for particle type (convert to string for consistent comparison)
    const colorKey = `${particle.color.r}_${particle.color.g}_${particle.color.b}`;
    
    if (!typeMap.has(colorKey)) {
      const particleType = {
        typeIndex: typeIndex++,
        count: 0,
        patchCount: particle.patches.length,
        patches: particle.patches.map((_, i) => i),
        patchPositions: particle.patches.map(patch => patch.position),
        mglType: particle.type,
        mglColor: particle.color, // Store the MGL color for this type
        properties: { ...particle.properties }
      };
      typeMap.set(colorKey, particleType);
      particleTypes.set(particleType.typeIndex, particleType);
    }
    
    typeMap.get(colorKey).count++;
    
    // Convert to ppview position format
    const position = {
      x: particle.position.x,
      y: particle.position.y,
      z: particle.position.z,
      typeIndex: typeMap.get(colorKey).typeIndex,
      particleType: typeMap.get(colorKey),
      mglColor: particle.color,
      mglType: particle.type,
      radius: particle.radius,
      patches: particle.patches
    };
    
    // Add type-specific properties
    if (particle.axis) position.axis = particle.axis;
    if (particle.dipole) position.dipole = particle.dipole;
    
    positions.push(position);
  });
  
  // Calculate box size from bounding box if not provided
  let boxSize = [34.199520111084, 34.199520111084, 34.199520111084]; // Default
  
  if (firstFrame.boxDimensions) {
    boxSize = firstFrame.boxDimensions;
  } else if (mglData.boundingBox) {
    const padding = 2.0;
    boxSize = [
      mglData.boundingBox.max.x - mglData.boundingBox.min.x + padding,
      mglData.boundingBox.max.y - mglData.boundingBox.min.y + padding,
      mglData.boundingBox.max.z - mglData.boundingBox.min.z + padding
    ];
  }
  
  // Create topology data
  const topData = {
    totalParticles: positions.length,
    typeCount: particleTypes.size,
    particleTypes: Array.from(particleTypes.values())
  };
  
  return {
    positions,
    topData,
    boxSize,
    frameData: frames.length > 1 ? frames : null // Include frame data if trajectory
  };
}
