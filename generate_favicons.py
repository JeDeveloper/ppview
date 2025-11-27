#!/usr/bin/env python3
"""
Generate favicon files from SVG using Python.
Requires: pip install pillow cairosvg
"""

import os
import sys

try:
    from PIL import Image
    import cairosvg
except ImportError:
    print("Error: Required packages not installed")
    print("Install with: pip3 install pillow cairosvg")
    sys.exit(1)

def svg_to_png(svg_path, output_path, size):
    """Convert SVG to PNG at specified size."""
    print(f"Generating {output_path} ({size}x{size})...")
    cairosvg.svg2png(
        url=svg_path,
        write_to=output_path,
        output_width=size,
        output_height=size
    )

def png_to_ico(png_path, ico_path, sizes=[16, 32, 48]):
    """Convert PNG to ICO with multiple sizes."""
    print(f"Generating {ico_path}...")
    img = Image.open(png_path)
    
    # Create images at different sizes
    icon_sizes = [(s, s) for s in sizes]
    img.save(ico_path, format='ICO', sizes=icon_sizes)

def main():
    # Paths
    svg_path = 'public/favicon.svg'
    output_dir = 'public'
    
    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found!")
        sys.exit(1)
    
    # Generate PNGs
    sizes = [
        (16, 'favicon-16x16.png'),
        (32, 'favicon-32x32.png'),
        (192, 'logo192.png'),
        (512, 'logo512.png')
    ]
    
    for size, filename in sizes:
        output_path = os.path.join(output_dir, filename)
        svg_to_png(svg_path, output_path, size)
    
    # Generate ICO from the 32x32 PNG
    png_32_path = os.path.join(output_dir, 'favicon-32x32.png')
    ico_path = os.path.join(output_dir, 'favicon.ico')
    
    # Generate multi-resolution ICO
    svg_to_png(svg_path, png_32_path, 32)
    png_to_ico(png_32_path, ico_path, sizes=[16, 32, 48, 64])
    
    print("\n✅ All favicon files generated successfully!")
    print(f"\nGenerated files in {output_dir}/:")
    print("  - favicon.ico")
    print("  - favicon-16x16.png")
    print("  - favicon-32x32.png")
    print("  - logo192.png")
    print("  - logo512.png")
    print("\nRun 'npm run deploy' to update the site.")

if __name__ == '__main__':
    main()
