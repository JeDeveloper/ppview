// Test script to verify color scheme consistency between particles and patches
// This can be run in the browser console to test color consistency

import { getParticleColors, colorSchemes } from './colors.js';
import { getColorForPatchID } from './utils/colorUtils.js';

// Test function to verify color consistency
export function testColorConsistency() {
  console.log('🎨 Testing Color Scheme Consistency...\n');
  
  // Test each color scheme
  Object.keys(colorSchemes).forEach(schemeName => {
    console.log(`Testing scheme: "${schemeName}"`);
    
    // Get colors from both systems
    const particleColors = getParticleColors(schemeName);
    
    // Test first 5 colors for consistency
    for (let i = 0; i < Math.min(5, particleColors.length); i++) {
      const particleColor = particleColors[i];
      const patchColor = getColorForPatchID(i, schemeName);
      const patchColorHex = patchColor.getHexString();
      
      // Convert particle color to same format for comparison
      const particleColorHex = particleColor.replace('#', '').toLowerCase();
      const patchColorHexNormalized = patchColorHex.toLowerCase();
      
      const isConsistent = particleColorHex === patchColorHexNormalized;
      
      console.log(`  Index ${i}: Particle(${particleColor}) vs Patch(#${patchColorHex}) - ${isConsistent ? '✅' : '❌'}`);
    }
    console.log('');
  });
  
  console.log('✨ Color consistency test completed!');
}

// Test fallback behavior
export function testFallbackBehavior() {
  console.log('🔄 Testing Fallback Behavior...\n');
  
  try {
    // Test with null scheme (should use default)
    const color1 = getColorForPatchID(0, null);
    console.log(`Null scheme test: ${color1.getHexString()} ✅`);
    
    // Test with undefined scheme (should use default)
    const color2 = getColorForPatchID(0, undefined);
    console.log(`Undefined scheme test: ${color2.getHexString()} ✅`);
    
    // Test with invalid scheme (should use fallback)
    const color3 = getColorForPatchID(0, 'nonexistent-scheme');
    console.log(`Invalid scheme test: ${color3.getHexString()} ✅`);
    
  } catch (error) {
    console.error('❌ Fallback test failed:', error);
  }
  
  console.log('✨ Fallback behavior test completed!');
}

// Export test function for use in console
if (typeof window !== 'undefined') {
  window.testColorConsistency = testColorConsistency;
  window.testFallbackBehavior = testFallbackBehavior;
}
