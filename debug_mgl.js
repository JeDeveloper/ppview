import { readMGL } from './src/utils/mglParser.js';
import { readFileSync } from 'fs';

// Read the test MGL file
const mglContent = readFileSync('./test_mgl.mgl', 'utf8');

console.log('Original MGL content:');
console.log(mglContent);
console.log('\n' + '='.repeat(50) + '\n');

// Parse the MGL file
try {
  const parsed = readMGL(mglContent);
  
  console.log('Parsed MGL data:');
  console.log('Number of particles:', parsed.particles.length);
  console.log('Bounding box:', parsed.boundingBox);
  console.log('\nFirst few particles:');
  
  parsed.particles.slice(0, 5).forEach((particle, index) => {
    console.log(`Particle ${index}:`, {
      position: particle.position,
      radius: particle.radius,
      color: particle.color,
      type: particle.type
    });
  });
  
} catch (error) {
  console.error('Error parsing MGL file:', error);
}
