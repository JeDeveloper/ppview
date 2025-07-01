/**
 * File Type Detector - Identifies file types based on content analysis
 * rather than just file extensions
 */

/**
 * Analyzes file content to determine its type
 * @param {File} file - The file to analyze
 * @returns {Promise<string>} - The detected file type
 */
export async function detectFileType(file) {
  try {
    // Read the first few KB of the file to analyze structure
    const chunkSize = Math.min(file.size, 8192); // Read first 8KB
    const chunk = file.slice(0, chunkSize);
    const text = await chunk.text();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return 'unknown';
    }

    // Check for trajectory file pattern
    if (isTrajectoryFile(lines)) {
      return 'trajectory';
    }

    // Check for topology file patterns
    const topologyType = analyzeTopologyFile(lines);
    if (topologyType) {
      return topologyType;
    }

    // Check for particle information files
    const particleFileType = analyzeParticleFile(lines, file.name);
    if (particleFileType) {
      return particleFileType;
    }

    // Check for patch files
    if (isPatchFile(lines)) {
      return 'patch';
    }

    return 'unknown';
  } catch (error) {
    console.warn(`Error detecting file type for ${file.name}:`, error);
    return 'unknown';
  }
}

/**
 * Detects trajectory files by looking for the characteristic format
 * @param {string[]} lines - Lines from the file
 * @returns {boolean}
 */
function isTrajectoryFile(lines) {
  // Trajectory files start with "t = <number>" followed by "b = <box dimensions>" and "E = <energy>"
  if (lines.length < 3) return false;

  const timePattern = /^t\s*=\s*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/;
  const boxPattern = /^b\s*=\s*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?\s+[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?\s+[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/;
  const energyPattern = /^E\s*=\s*/;

  // Check if first line is time, second is box dimensions, third is energy
  if (timePattern.test(lines[0]) && boxPattern.test(lines[1]) && energyPattern.test(lines[2])) {
    // Additional check: look for particle position data (should have 9+ numeric columns)
    for (let i = 3; i < Math.min(lines.length, 10); i++) {
      const tokens = lines[i].split(/\s+/);
      if (tokens.length >= 9 && tokens.every(token => !isNaN(parseFloat(token)))) {
        return true;
      }
    }
  }

  // Alternative check: look for multiple "t =" entries (multi-configuration trajectory)
  let timeEntries = 0;
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    if (timePattern.test(lines[i])) {
      timeEntries++;
      if (timeEntries >= 2) return true;
    }
  }

  return false;
}

/**
 * Analyzes topology file structure to determine type (Lorenzo vs Flavio format)
 * @param {string[]} lines - Lines from the file
 * @returns {string|null} - 'topology-lorenzo' or 'topology-flavio' or null
 */
function analyzeTopologyFile(lines) {
  if (lines.length < 2) return null;

  // Check first line: should be two numbers (particle count and type count)
  const headerTokens = lines[0].split(/\s+/);
  if (headerTokens.length !== 2 || headerTokens.some(token => isNaN(parseInt(token)))) {
    return null;
  }

  const totalParticles = parseInt(headerTokens[0]);
  const typeCount = parseInt(headerTokens[1]);

  if (totalParticles <= 0 || typeCount <= 0) return null;

  // Check second line to distinguish formats
  const secondLineTokens = lines[1].split(/\s+/);

  // Flavio format: second line contains particle types (all integers)
  if (secondLineTokens.length === totalParticles && 
      secondLineTokens.every(token => !isNaN(parseInt(token)) && !token.includes('.'))) {
    return 'topology-flavio';
  }

  // Lorenzo format: subsequent lines describe particle types
  // Format: count patchCount patches filename
  if (secondLineTokens.length >= 2) {
    const count = parseInt(secondLineTokens[0]);
    const patchCount = parseInt(secondLineTokens[1]);
    
    if (!isNaN(count) && !isNaN(patchCount) && count > 0 && patchCount >= 0) {
      return 'topology-lorenzo';
    }
  }

  return null;
}

/**
 * Analyzes particle information files (particles.txt, patches.txt)
 * @param {string[]} lines - Lines from the file
 * @param {string} filename - The filename for additional context
 * @returns {string|null}
 */
function analyzeParticleFile(lines, filename) {
  // Check for particles.txt format
  if (hasParticleFormat(lines)) {
    return 'particles-info';
  }

  // Check for patches.txt format
  if (hasPatchesFormat(lines)) {
    return 'patches-info';
  }

  // Fallback to filename-based detection for these specific files
  // Only accept exact filenames (case-insensitive)
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename === 'particles.txt') {
    return 'particles-info';
  }
  if (lowerFilename === 'patches.txt' || lowerFilename.endsWith('.patch.txt')) {
    return 'patches-info';
  }

  return null;
}

/**
 * Checks if the content matches particles.txt format
 * @param {string[]} lines - Lines from the file
 * @returns {boolean}
 */
function hasParticleFormat(lines) {
  // Look for particle_X entries and type/patches definitions
  let hasParticleEntry = false;
  let hasTypeEntry = false;
  let hasPatchesEntry = false;

  for (const line of lines.slice(0, 20)) { // Check first 20 lines
    if (/^particle_\d+/.test(line)) {
      hasParticleEntry = true;
    }
    if (/^type\s*=/.test(line)) {
      hasTypeEntry = true;
    }
    if (/^patches\s*=/.test(line)) {
      hasPatchesEntry = true;
    }
  }

  return hasParticleEntry && hasTypeEntry;
}

/**
 * Checks if the content matches patches.txt format
 * @param {string[]} lines - Lines from the file
 * @returns {boolean}
 */
function hasPatchesFormat(lines) {
  // Look for patch_X entries and position/orientation definitions
  let hasPatchEntry = false;
  let hasIdEntry = false;
  let hasPositionEntry = false;
  let hasColorEntry = false;
  let hasStrengthEntry = false;
  let hasA1Entry = false;
  let hasA2Entry = false;

  for (const line of lines.slice(0, 30)) { // Check first 30 lines to find extended format
    if (/^patch_\d+/.test(line)) {
      hasPatchEntry = true;
    }
    if (/^id\s*=/.test(line)) {
      hasIdEntry = true;
    }
    if (/^position\s*=/.test(line)) {
      hasPositionEntry = true;
    }
    if (/^color\s*=/.test(line)) {
      hasColorEntry = true;
    }
    if (/^strength\s*=/.test(line)) {
      hasStrengthEntry = true;
    }
    if (/^a1\s*=/.test(line)) {
      hasA1Entry = true;
    }
    if (/^a2\s*=/.test(line)) {
      hasA2Entry = true;
    }
  }

  // Standard flavio format: patch_X blocks with id and position
  const isStandardFlavio = hasPatchEntry && hasIdEntry && hasPositionEntry;
  
  // Extended flavio format: patch_X blocks with additional fields like color, strength, a1, a2
  const isExtendedFlavio = hasPatchEntry && hasIdEntry && (hasColorEntry || hasStrengthEntry || hasA1Entry || hasA2Entry);
  
  return isStandardFlavio || isExtendedFlavio;
}

/**
 * Checks if the file contains patch position data (for Lorenzo format)
 * @param {string[]} lines - Lines from the file
 * @returns {boolean}
 */
function isPatchFile(lines) {
  // Patch files should contain lines with 3 numeric values (x, y, z coordinates)
  let numericLineCount = 0;
  
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    const tokens = line.split(/\s+/);
    if (tokens.length === 3 && tokens.every(token => !isNaN(parseFloat(token)))) {
      numericLineCount++;
    }
  }

  // If most lines are 3D coordinates, it's likely a patch file
  return numericLineCount >= Math.min(3, lines.length * 0.7);
}

/**
 * Categorizes files based on detected types for easier processing
 * @param {Array} filesWithTypes - Array of {file, type} objects
 * @returns {Object} - Categorized files
 */
export function categorizeFiles(filesWithTypes) {
  const categorized = {
    topology: null,
    trajectory: null,
    particlesInfo: null,
    patchesInfo: null,
    patchFiles: [],
    unknown: []
  };

  // Collect all trajectory files for prioritization
  const trajectoryFiles = [];

  filesWithTypes.forEach(({file, type}) => {
    switch (type) {
      case 'topology-lorenzo':
      case 'topology-flavio':
        categorized.topology = {file, format: type.split('-')[1]};
        break;
      case 'trajectory':
        trajectoryFiles.push(file);
        break;
      case 'particles-info':
        categorized.particlesInfo = file;
        break;
      case 'patches-info':
        categorized.patchesInfo = file;
        break;
      case 'patch':
        categorized.patchFiles.push(file);
        break;
      default:
        categorized.unknown.push(file);
    }
  });

  // Apply trajectory file prioritization: trajectory > last > init
  if (trajectoryFiles.length > 0) {
    categorized.trajectory = selectBestTrajectoryFile(trajectoryFiles);
  }

  return categorized;
}

/**
 * Selects the best trajectory file when multiple are available
 * Priority: trajectory > last > init > others
 * @param {File[]} trajectoryFiles - Array of trajectory files
 * @returns {File} - The selected trajectory file
 */
function selectBestTrajectoryFile(trajectoryFiles) {
  if (trajectoryFiles.length === 1) {
    return trajectoryFiles[0];
  }

  console.log(`Found ${trajectoryFiles.length} trajectory files, applying prioritization...`);
  
  // Define priority keywords in order of preference
  const priorityKeywords = [
    { keywords: ['traj'], priority: 1, name: 'trajectory' },
    { keywords: ['last'], priority: 2, name: 'last configuration' },
    { keywords: ['init'], priority: 3, name: 'initial configuration' }
  ];

  // Score each file based on filename
  const scoredFiles = trajectoryFiles.map(file => {
    const fileName = file.name.toLowerCase();
    let priority = 999; // Default low priority
    let matchedType = 'other';
    
    // Check for priority keywords
    for (const { keywords, priority: keywordPriority, name } of priorityKeywords) {
      if (keywords.some(keyword => fileName.includes(keyword))) {
        priority = keywordPriority;
        matchedType = name;
        break;
      }
    }
    
    return {
      file,
      priority,
      matchedType,
      fileName
    };
  });

  // Sort by priority (lower number = higher priority)
  scoredFiles.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // If same priority, prefer alphabetically first
    return a.fileName.localeCompare(b.fileName);
  });

  const selectedFile = scoredFiles[0];
  console.log(`Selected trajectory file: ${selectedFile.fileName} (type: ${selectedFile.matchedType})`);
  
  // Log the prioritization results
  console.log('Trajectory file prioritization:');
  scoredFiles.forEach((scored, index) => {
    const status = index === 0 ? '✓ SELECTED' : '  skipped';
    console.log(`  ${status}: ${scored.fileName} (${scored.matchedType}, priority: ${scored.priority})`);
  });

  return selectedFile.file;
}

/**
 * Analyzes all files and returns their detected types
 * @param {File[]} files - Array of files to analyze
 * @returns {Promise<Array>} - Array of {file, type} objects
 */
export async function analyzeFiles(files) {
  const results = [];
  
  for (const file of files) {
    const type = await detectFileType(file);
    results.push({ file, type });
    console.log(`Detected file type for ${file.name}: ${type}`);
  }
  
  return results;
}
