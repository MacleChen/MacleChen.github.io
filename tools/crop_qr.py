#!/usr/bin/env python3
"""
Crop QR code region from payment screenshots.
Uses density-analysis-derived coordinates for precise extraction.
Saves result to the same path, overwriting the original.
"""

from PIL import Image
import numpy as np

IMAGES_DIR = '/Users/chenfan/Desktop/works/个人/MacleChen.github.io/images'


def crop_and_save(path, left, top, right, bottom, padding=20):
    """Crop image to given bounds with padding, save as JPEG."""
    img = Image.open(path)
    w, h = img.size
    print(f'\n[{path.split("/")[-1]}]  original: {w}×{h}')

    l = max(0, left - padding)
    t = max(0, top - padding)
    r = min(w, right + padding)
    b = min(h, bottom + padding)

    cropped = img.crop((l, t, r, b)).convert('RGB')
    bg = Image.new('RGB', cropped.size, (255, 255, 255))
    bg.paste(cropped)
    bg.save(path, 'JPEG', quality=95)
    print(f'  Cropped to: {l},{t} → {r},{b}  ({r-l}×{b-t} px)')
    print(f'  Saved: {path}')


# WeChat Pay (828×1124):
#   QR dark region: rows 280–658, cols 230–590
crop_and_save(
    f'{IMAGES_DIR}/wechat-pay.jpg',
    left=230, top=280, right=590, bottom=658,
    padding=18,
)

# Alipay (1708×2560):
#   QR dark region: rows 958–2040, cols 320–1380
crop_and_save(
    f'{IMAGES_DIR}/alipay.jpg',
    left=320, top=958, right=1380, bottom=2040,
    padding=20,
)

print('\nDone.')
