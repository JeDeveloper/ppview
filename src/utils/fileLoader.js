// File loading and selection utilities

/**
 * Selects the best trajectory file from a list of candidates based on priority keywords
 * @param {File[]} trajectoryFiles - Array of potential trajectory files
 * @returns {File} The selected trajectory file
 */
export function selectFallbackTrajectoryFile(trajectoryFiles) {
  if (trajectoryFiles.length === 1) {
    return trajectoryFiles[0];
  }

  console.log(`Found ${trajectoryFiles.length} potential trajectory files in fallback, applying prioritization...`);
  
  // Define priority keywords in order of preference (same as in fileTypeDetector)
  const priorityKeywords = [
    { keywords: ['traj'], priority: 1, name: 'trajectory' },
    { keywords: ['last'], priority: 2, name: 'last configuration' },
    { keywords: ['init'], priority: 3, name: 'initial configuration' },
    { keywords: ['conf'], priority: 4, name: 'configuration' }
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
  console.log(`Selected fallback trajectory file: ${selectedFile.fileName} (type: ${selectedFile.matchedType})`);
  
  // Log the prioritization results
  console.log('Fallback trajectory file prioritization:');
  scoredFiles.forEach((scored, index) => {
    const status = index === 0 ? '✓ SELECTED' : '  skipped';
    console.log(`  ${status}: ${scored.fileName} (${scored.matchedType}, priority: ${scored.priority})`);
  });

  return selectedFile.file;
}

/**
 * Creates a Map of files indexed by their trimmed names
 * @param {File[]} files - Array of files
 * @returns {Map<string, File>} Map of filename to File object
 */
export function createFileMap(files) {
  const fileMap = new Map();
  files.forEach((file) => {
    fileMap.set(file.name.trim(), file);
  });
  return fileMap;
}
