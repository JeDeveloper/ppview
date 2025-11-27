# Favicon Generation

The PPView favicon shows a patchy particle with colored patches, representing the molecular dynamics systems visualized by this application.

## Files

- `public/favicon.svg` - Vector SVG favicon (modern browsers)
- `public/favicon.ico` - Legacy ICO format (for older browsers)
- `public/logo192.png` - 192x192 PNG for PWA
- `public/logo512.png` - 512x512 PNG for PWA

## Generating PNG/ICO from SVG

### Option 1: Using Node.js script (requires canvas package)

```bash
npm install canvas
node generate-favicons.js
```

### Option 2: Using online tools

1. Go to https://realfavicongenerator.net/ or https://favicon.io/
2. Upload `public/favicon.svg`
3. Generate and download all sizes
4. Replace the files in the `public/` directory

### Option 3: Using ImageMagick (if installed)

```bash
# Install ImageMagick (macOS)
brew install imagemagick

# Generate PNGs
magick public/favicon.svg -resize 16x16 public/favicon-16x16.png
magick public/favicon.svg -resize 32x32 public/favicon-32x32.png
magick public/favicon.svg -resize 192x192 public/logo192.png
magick public/favicon.svg -resize 512x512 public/logo512.png

# Generate ICO (combine multiple sizes)
magick public/favicon.svg -define icon:auto-resize=16,32,48,64 public/favicon.ico
```

## Design

The favicon features:
- A gray central particle (sphere with 3D gradient)
- Four colored patches representing different interaction sites:
  - Yellow patch (top-left)
  - Red patch (bottom-right)
  - Blue patch (top-right)
  - Green patch (left side)
- Dark background (#2a2a2a) matching the app theme
- Subtle shadows for depth

This design represents the core concept of patchy particles used in molecular dynamics simulations of colloids and soft matter.
