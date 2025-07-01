# Color Scheme Feature

This document describes the new color scheme selection feature for particle visualization in ppview.

## Overview

The color scheme feature allows users to select from multiple predefined color palettes for particle visualization. The selected scheme is automatically saved to localStorage and restored when the application is reopened.

## Available Color Schemes

1. **Muted Colors** (default) - Dark, professional colors suitable for scientific presentations
2. **Bright Colors** - Vibrant, high-contrast colors for better visibility
3. **Pastel Colors** - Soft, light colors with low saturation
4. **Scientific Palette** - Colors based on common scientific plotting libraries
5. **Colorblind Friendly** - Carefully chosen colors accessible to colorblind users
6. **Viridis** - Perceptually uniform color scale inspired by matplotlib's viridis

## How to Use

### Selecting a Color Scheme

1. Load particle data into the application
2. In the controls panel at the bottom of the screen, locate the "Color Scheme" dropdown
3. Click on the dropdown to see all available schemes with color previews
4. Select your desired scheme - particles will update immediately

### Features

- **Live Preview**: Each scheme shows a preview of the first 5 colors
- **Instant Updates**: Particles change color immediately when a new scheme is selected
- **Persistent Selection**: Your choice is saved and restored when you reload the application
- **Legend Updates**: Both particle and patch legends update to reflect the new colors
- **Export Compatibility**: GLTF exports use the currently selected color scheme

### Technical Details

#### Storage
- Color scheme preference is stored in browser localStorage under the key `ppview_color_scheme`
- Fallback to "muted" scheme if localStorage is unavailable or corrupted

#### Color Assignment
- **Particles** are colored based on their type index: `color = scheme.colors[typeIndex % scheme.colors.length]`
- **Patches** use the same color scheme as particles: `color = scheme.colors[patchID % scheme.colors.length]`
- This ensures consistent visual representation between Lorenzo and Flavio formats
- All particle types and patches get a color even if there are more types than colors in the scheme

#### Accessibility
- The "Colorblind Friendly" scheme uses colors selected specifically for accessibility
- All schemes provide sufficient contrast for readability
- Color names and previews help users identify schemes

## Adding New Color Schemes

To add a new color scheme, edit `/src/colors.js`:

```javascript
export const colorSchemes = {
  // ... existing schemes ...
  
  myNewScheme: {
    name: 'My Custom Scheme',
    colors: [
      '#FF0000', // Red
      '#00FF00', // Green
      '#0000FF', // Blue
      // ... add more colors as needed
    ]
  }
};
```

## Implementation Notes

- The feature uses React hooks for state management
- Color updates are optimized to minimize performance impact
- The UI is responsive and works on mobile devices
- Dark theme support is included for the selector component

## Browser Compatibility

The feature works in all modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- localStorage API
- React 16.8+ (hooks)

## Performance

- Color scheme changes have minimal performance impact
- Particle rendering uses instanced meshes for optimal performance
- Color updates only affect the instanceColor buffer, not geometry
