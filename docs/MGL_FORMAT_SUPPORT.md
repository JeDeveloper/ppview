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
x y z @ r C[color] [type-specific-data]
```

### Header Lines
- `.Box:Lx,Ly,Lz` - Box dimensions (comma-separated)
- `.Vol:TOT_VOLUME` - Cubic box volume

### Color Formats
- Named colors: `C[red]`, `C[blue]`, `C[green]`, etc.
- Hexadecimal: `C[#aaaaaa]`
- RGBA: `C[0,1,0,1]` (last value is opacity)

### Particle Types

#### Basic Sphere
```
1 3 5 @ 0.8 C[red]
```
- Position: (1, 3, 5)
- Radius: 0.8
- Color: Red

#### Cylinder
```
7 3 5 @ 0.5 C[green] C 2 2 2
```
- Position: (7, 3, 5)
- Radius: 0.5
- Color: Green
- Axis vector: (2, 2, 2)
- Length: sqrt(2² + 2² + 2²) = ~3.46

#### Dipolar Sphere
```
5 7 5 @ 0.3 C[0,0,1,0.5] D 1 0 0 C[black]
```
- Position: (5, 7, 5)
- Radius: 0.3
- Color: Blue with 50% opacity
- Dipole vector: (1, 0, 0)
- Arrow color: Black

#### Patchy Particle
```
3 5 5 @ 0.5 C[magenta] M 0 0 0.6 0.8 C[0,0,0.5] 0.3 0.5 0 0.55 C[1,0.5,0.3]
```
- Position: (3, 5, 5)
- Radius: 0.5
- Color: Magenta
- Patch 1: Position (0, 0, 0.6), Half-width 0.8 rad, Color dark blue
- Patch 2: Position (0.3, 0.5, 0), Half-width 0.55 rad, Color orange

#### Icosahedron
```
1 1 1 @ 0.8 C[cyan] I x1 x2 x3 z1 z2 z3
```
- Position: (1, 1, 1)
- Radius: 0.8
- Color: Cyan
- X-axis: (x1, x2, x3)
- Z-axis: (z1, z2, z3)

#### Ellipsoid
```
2 2 2 @ 1.0 C[yellow] E sa1 sa2 sa3 a11 a12 a13 a21 a22 a23
```
- Position: (2, 2, 2)
- Radius: 1.0 (scale factor)
- Color: Yellow
- Semi-axes: (sa1, sa2, sa3)
- Axis 1: (a11, a12, a13)
- Axis 2: (a21, a22, a23)

### Grouped Shapes
```
1 1 1 @ 0.8 C[red] G 1 2 1 @ 0.8 C[blue] G 1 3 1 @ 0.8 C[green]
```
Three spheres grouped together with the same ID, separated by 'G'.

### Trajectory Format
```
.Box:8,8,8
1 3 5 @ 0.8 C[red]
7 3 5 @ 0.5 C[green] C 2 2 2

.Box:8,8,8
1 3 6 @ 0.8 C[red]
7 3 6 @ 0.5 C[green] C 2 2 2
```

### Complete Example
```
.Box:8,8,8
1 3 5 @ 0.8 C[red]
7 3 5 @ 0.5 C[green] C 2 2 2
5 7 5 @ 0.3 C[0,0,1,0.5] D 1 0 0 C[black]
3 5 5 @ 0.5 C[magenta] M 0 0 0.6 0.8 C[0,0,0.5] 0.3 0.5 0 0.55 C[1,0.5,0.3]
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
