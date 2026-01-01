#!/usr/bin/env python3
"""
Logo Preparation Script for H10 Thermal Printer
Converts any logo to optimized black & white for receipt printing
"""

import sys
from PIL import Image, ImageOps, ImageEnhance

def prepare_logo_for_printing(input_path, output_path, width=200):
    """
    Prepare logo for thermal receipt printing:
    - Resize to specified width (maintaining aspect ratio)
    - Convert to grayscale
    - Increase contrast
    - Save as PNG
    """
    try:
        print(f"📷 Loading logo from: {input_path}")
        img = Image.open(input_path)
        
        # Calculate height maintaining aspect ratio
        aspect_ratio = img.height / img.width
        height = int(width * aspect_ratio)
        
        print(f"📐 Original size: {img.width}x{img.height}")
        print(f"📐 Target size: {width}x{height}")
        
        # Resize
        img = img.resize((width, height), Image.Resampling.LANCZOS)
        
        # Convert to grayscale
        img = img.convert('L')
        
        # Increase contrast for better thermal printing
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.8)  # Increase contrast by 80%
        
        # Increase sharpness
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)
        
        # Optional: Convert to pure black & white (threshold)
        # Uncomment next line for pure B&W (no grays)
        # img = img.point(lambda x: 0 if x < 128 else 255, '1')
        
        # Save
        img.save(output_path, 'PNG', optimize=True)
        print(f"✅ Logo saved to: {output_path}")
        print(f"✅ Size: {width}x{height}px")
        print(f"✅ Ready for thermal printing!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 prepare_logo.py <input_logo.png>")
        print("Example: python3 prepare_logo.py ~/Desktop/luqma_logo.png")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = "poswebview/src/main/res/drawable/receipt_logo.png"
    
    prepare_logo_for_printing(input_file, output_file, width=200)














