# MGL Format Support in ppview

## Overview

ppview now supports MGL (Molecular Graphics Library) format files for visualizing 3D molecular and particle systems. This includes support for both single MGL files and MGL trajectory files with multiple frames.

## Supported MGL Features

### Particle Types

- **S (Sphere)**: Basic spherical particles with position, radius, and color
- **M (Patchy Particles)**: Spherical particles with attached patches
- **C (Cylinder)**: Cylindrical particles with axis vectors
- **D (Dipolar Spheres)**: Spherical particles with dipole vectors

### File Formats

#### Single MGL Files
- Contains particle definitions in MGL format
- Each line can contain multiple shapes separated by 'G'
- Automatically detected and processed

#### MGL Trajectory Files
- Files containing `.Box:` or `.Vol:` headers are treated as trajectory files
- Each `.Box:` line represents a separate configuration/frame
- Even single `.Box:` files are treated as single-frame trajectories
- Supports frame-by-frame navigation in ppview

## MGL Format Specification

### Basic Syntax
```
TYPE X Y Z RADIUS [type-specific-data] R G B [OPACITY]
```

### Examples

#### Sphere (S)
```
S 0.0 0.0 0.0 1.0 1.0 0.0 0.0 1.0
```
- Position: (0, 0, 0)
- Radius: 1.0
- Color: Red (RGB: 1.0, 0.0, 0.0)
- Opacity: 1.0

#### Patchy Particle (M)
```
M 0.0 2.0 0.0 1.0 2 1.0 0.0 0.0 1.0 0.0 0.0 -1.0 0.0 0.0 0.5 0.5 0.5 1.0
```
- Position: (0, 2, 0)
- Radius: 1.0
- Patch count: 2
- Patch 1: Position (1.0, 0.0, 0.0), Color (1.0, 0.0, 0.0)
- Patch 2: Position (-1.0, 0.0, 0.0), Color (0.0, 0.0, 0.0)
- Particle color: Gray (0.5, 0.5, 0.5)

#### Cylinder (C)
```
C 0.0 4.0 0.0 1.0 0.0 0.0 1.0 1.0 1.0 0.0 1.0
```
- Position: (0, 4, 0)
- Radius: 1.0
- Axis vector: (0, 0, 1)
- Color: Yellow (1.0, 1.0, 0.0)

#### Dipolar Sphere (D)
```
D 2.0 2.0 0.0 1.0 1.0 0.0 0.0 0.0 1.0 1.0 1.0
```
- Position: (2, 2, 0)
- Radius: 1.0
- Dipole vector: (1.0, 0.0, 0.0)
- Color: White (1.0, 1.0, 1.0)

### Multiple Shapes per Line
```
S 0.0 0.0 0.0 1.0 1.0 0.0 0.0 1.0 G S 2.0 0.0 0.0 1.0 0.0 1.0 0.0 1.0
```
Two spheres separated by 'G' on the same line.

### Trajectory Format
```
.Box: 10.0 10.0 10.0
S 0.0 0.0 0.0 1.0 1.0 0.0 0.0 1.0
S 2.0 0.0 0.0 1.0 0.0 1.0 0.0 1.0

.Box: 10.0 10.0 10.0  
S 0.0 1.0 0.0 1.0 1.0 0.0 0.0 1.0
S 2.0 1.0 0.0 1.0 0.0 1.0 0.0 1.0
```

## Usage in ppview

1. **File Upload**: Drag and drop MGL files (`.mgl` extension) into ppview
2. **Automatic Detection**: Files are automatically detected as `mgl` or `mgl-trajectory`
3. **Visualization**: Particles are rendered with appropriate colors and shapes
4. **Navigation**: For trajectory files, use the trajectory slider to navigate between frames
5. **Controls**: All standard ppview controls work with MGL data (zoom, pan, rotate, etc.)

## Implementation Details

### File Detection
- Content-based detection looks for MGL particle format with '@' separator
- Trajectory detection looks for any `.Box:` or `.Vol:` headers
- Files with `.Box:` headers are always treated as trajectory files
- Each `.Box:` line represents a separate configuration/frame
- Supports both single-frame and multi-frame trajectories

### Data Conversion
- MGL particles are converted to ppview's internal format without requiring topology files
- Particle types are automatically generated based on patch count
- Colors from MGL `C[colorname]` format are preserved
- Bounding boxes are calculated from particle positions or box dimensions
- Self-contained format - no external files needed

### Patch Support
- All particles are treated as patchy particles with MGL format
- Patches are parsed from consecutive data after 'M' token
- Format: `M x1 y1 z1 radius1 C[color1] x2 y2 z2 radius2 C[color2] ...`
- Patch positions are relative to particle center
- Individual patch colors with named color support
- Patches rendered as colored cones pointing toward particle center

### Frame Navigation
- Trajectory files support frame-by-frame navigation
- Each frame can have different particle positions
- Box dimensions parsed from comma-separated values in `.Box:` headers
- Smooth trajectory playback supported

## Testing

Test files are included:
- `test_mgl_example.mgl`: Single MGL file with various particle types
- `test_mgl_trajectory.mgl`: Multi-frame trajectory example

## Limitations

- Currently processes the first frame for initial display in trajectory files
- Frame switching loads individual frames (not pre-cached)
- Color values should be in range [0.0, 1.0]
- Large trajectory files may take time to process

## Future Enhancements

- Pre-caching of trajectory frames for faster navigation
- Support for additional MGL extensions
- Enhanced patch visualization options
- Export capabilities for modified MGL data
