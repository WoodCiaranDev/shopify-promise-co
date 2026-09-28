"""Restore a crisp girdle edge on AI-generated centre stones.

Gemini renders the middle of the stone well but softens the outer ~1 mm where
the stone meets the bezel. This works only inside a band just within the centre
stone mask: an unsharp mask to restore facet edges, a local-contrast lift, and
a slight darkening towards the girdle to bring back the dark extinction rim a
real faceted stone shows against its bezel. Hue is preserved; nothing outside
the stone is touched.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter

SZ = 1600
PRESETS = {  # band_px, usm_amount, usm_radius, contrast, edge_darken
    "subtle": (60, 0.8, 2.0, 0.10, 0.10),
    "medium": (75, 1.4, 2.5, 0.18, 0.18),
    "strong": (90, 2.0, 3.0, 0.26, 0.26),
}

def band_weight(mask, band):
    d = distance_transform_edt(mask)              # px from the stone's edge, inside only
    w = np.clip(1 - d / band, 0, 1) ** 0.8        # 1 at the edge, 0 at `band` px in
    w[~mask] = 0
    return gaussian_filter(w, 2)[..., None], gaussian_filter(np.clip(1 - d / (band * .45), 0, 1) * mask, 2)[..., None]

def fix(img, mask, preset):
    band, amt, rad, con, dark = PRESETS[preset]
    w, edge = band_weight(mask, band)
    A = np.asarray(img).astype(np.float32)
    blur = np.asarray(img.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32)
    sharp = A + amt * (A - blur)
    # local contrast around a wider mean, so facet boundaries separate again
    mean = np.asarray(img.filter(ImageFilter.GaussianBlur(12))).astype(np.float32)
    sharp = sharp + con * (sharp - mean)
    sharp = sharp * (1 - dark * edge)             # darker towards the girdle, hue kept
    out = A * (1 - w) + sharp * w
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

if __name__ == "__main__":
    import sys, os
    src, maskf, dst, preset = sys.argv[1:5]
    m = np.load(maskf)
    img = Image.open(src).convert("RGB").resize((SZ, SZ), Image.LANCZOS)
    fix(img, m, preset).save(dst, quality=95)
