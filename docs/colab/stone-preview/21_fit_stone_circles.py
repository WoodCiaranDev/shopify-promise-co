"""Fit each halo stone's exact visible circle: where the stone meets its bezel.

Scores candidate circles by the strength of the image edge along the circle and keeps the
best per stone. Used for our own slots and for the client's donor stones, so both sides are
measured the same way and each stone can be scaled individually onto its slot.
"""
import numpy as np
from PIL import Image
from skimage.color import rgb2gray
from skimage.filters import sobel
from scipy.ndimage import gaussian_filter, map_coordinates

def edge_map(img):
    return gaussian_filter(sobel(rgb2gray(np.asarray(img.convert("RGB")))), 1.0)

def refine(img, stones, shift=14, rmin=0.8, rmax=1.2):
    E = edge_map(img); th = np.linspace(0, 2 * np.pi, 120, endpoint=False)
    out = []
    for s in stones:
        x, y, r = s[0], s[1], s[2]
        best = None
        for rr in np.arange(r * rmin, r * rmax, 0.75):
            ct, st = rr * np.cos(th), rr * np.sin(th)
            for dx in range(-shift, shift + 1, 2):
                for dy in range(-shift, shift + 1, 2):
                    v = map_coordinates(E, [y + dy + st, x + dx + ct], order=1).mean()
                    if best is None or v > best[0]: best = (v, x + dx, y + dy, rr)
        # second, finer pass around the winner
        _, bx, by, br = best
        for rr in np.arange(br - 1.5, br + 1.6, 0.25):
            ct, st = rr * np.cos(th), rr * np.sin(th)
            for dx in np.arange(-2, 2.1, 0.5):
                for dy in np.arange(-2, 2.1, 0.5):
                    v = map_coordinates(E, [by + dy + st, bx + dx + ct], order=1).mean()
                    if v > best[0]: best = (v, bx + dx, by + dy, rr)
        _, bx, by, br = best
        out.append((float(bx), float(by), float(br)) + tuple(s[3:]))
    return out
