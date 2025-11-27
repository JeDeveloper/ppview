const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// If canvas is not available, install with: npm install canvas

async function generateFavicons() {
  try {
    // Read the SVG file
    const svgPath = './public/favicon.svg';
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Create a data URL from the SVG
    const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64');
    
    // Generate different sizes
    const sizes = [
      { size: 16, name: 'favicon-16x16.png' },
      { size: 32, name: 'favicon-32x32.png' },
      { size: 192, name: 'logo192.png' },
      { size: 512, name: 'logo512.png' }
    ];
    
    for (const { size, name } of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Load and draw the SVG
      const img = await loadImage(svgDataUrl);
      ctx.drawImage(img, 0, 0, size, size);
      
      // Save as PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(`./public/${name}`, buffer);
      console.log(`Generated ${name}`);
    }
    
    console.log('All favicons generated successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error);
    console.log('\nNote: This script requires the "canvas" package.');
    console.log('Install it with: npm install canvas');
    console.log('\nAlternatively, you can use online tools like:');
    console.log('- https://realfavicongenerator.net/');
    console.log('- https://favicon.io/');
  }
}

generateFavicons();
