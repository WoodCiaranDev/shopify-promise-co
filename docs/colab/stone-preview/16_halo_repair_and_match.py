"""Halo stones v2: per-stone repair + full-distribution colour matching.

1. Repair: the AI sometimes leaves one or more halo stones uncoloured. Each of the 16 stones
   is located from the fitted halo geometry; a stone whose colour strength is far below the
   others is replaced with a soft-edged copy of its mirror-image partner (or nearest good one).
2. Match: instead of matching only a mean colour, the whole distribution of lightness, chroma
   and hue across the halo stones is quantile-mapped onto the client's reference stones, so
   dark rims, body colour and sparkle all land where the client's do.
"""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.color import rgb2lab, lab2rgb

GEOM = {  # centre x, centre y, px/mm x, px/mm y, ring radius mm, stone radius mm, phase deg (1600px)
    "gold":   (803, 824, 43.0, 40.5, 5.90, 1.05, 0.0),
    "silver": (805, 816, 45.4, 42.7, 5.65, 1.05, 0.0),
}

import json, os
_STONES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "halo_stones.json")))

def discs(metal):
    """The 16 halo stones as detected on the packshot: (x, y, radius, angle about the halo centre)."""
    st = _STONES[metal]
    mx = np.mean([s[0] for s in st]); my = np.mean([s[1] for s in st])
    return [(x, y, r * 1.08, np.arctan2(y - my, x - mx)) for x, y, r in st]

def disc_mask(shape, x, y, rad, frac=1.0, feather=0):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    m = (((xx - x) ** 2 + (yy - y) ** 2) <= (rad * frac) ** 2).astype(np.float64)
    return gaussian_filter(m, feather) if feather else m

def repair(img, metal, weak_ratio=0.55):
    A = np.asarray(img).astype(np.float64)
    lab = rgb2lab(A / 255)
    C = np.hypot(lab[..., 1], lab[..., 2])
    D = discs(metal)
    strength = []
    for (x, y, rad, t) in D:
        m = disc_mask(A.shape, x, y, rad, 0.7) > 0
        strength.append(np.median(C[m]))
    strength = np.array(strength); med = np.median(strength)
    if med < 8:            # colourless stone (diamond simulant): nothing to repair
        return img, []
    weak = [i for i, s in enumerate(strength) if s < weak_ratio * med]
    good = [i for i in range(16) if i not in weak]
    out = A.copy()
    for i in weak:
        x, y, rad, t = D[i]
        # mirror partner across the horizontal axis (same lighting side), else nearest good
        j = int(np.argmin([abs(np.angle(np.exp(1j * (D[g][3] + t)))) if g in good else 9 for g in range(16)]))
        if j not in good:
            j = min(good, key=lambda g: abs(np.angle(np.exp(1j * (D[g][3] - t)))))
        sx_, sy_ = int(round(D[j][0] - x)), int(round(D[j][1] - y))
        shifted = np.roll(np.roll(A, -sy_, axis=0), -sx_, axis=1)
        w = disc_mask(A.shape, x, y, rad, 1.0, feather=2)[..., None]
        out = out * (1 - w) + shifted * w
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), weak

def _qmap(src, tgt, n=101):
    q = np.linspace(0, 100, n)
    return np.percentile(src, q), np.percentile(tgt, q)

def match_distribution(img, metal, target_px, hue_mode="map"):
    """Quantile-map L, C and hue of the halo stones onto target_px (N x 3 Lab)."""
    A = np.asarray(img).astype(np.float64) / 255
    lab = rgb2lab(A)
    D = discs(metal)
    region = np.zeros(A.shape[:2]); core = np.zeros(A.shape[:2], bool)
    for (x, y, rad, t) in D:
        region = np.maximum(region, disc_mask(A.shape, x, y, rad, 0.97, feather=1.5))
        core |= disc_mask(A.shape, x, y, rad, 0.8) > 0
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); h = np.arctan2(b, a)
    tL, ta, tb = target_px[:, 0], target_px[:, 1], target_px[:, 2]
    tC = np.hypot(ta, tb); th = np.arctan2(tb, ta)
    sL, sC, sh = L[core], C[core], h[core]
    xs, ys = _qmap(sL, tL); L2 = np.interp(L, xs, ys)
    xs, ys = _qmap(sC, tC); C2 = np.interp(C, xs, ys)
    # hue: unwrap each set around its own circular median, map offsets, re-centre on target
    def circ_med(x): return np.arctan2(np.median(np.sin(x)), np.median(np.cos(x)))
    ms, mt = circ_med(sh), circ_med(th)
    ds = np.angle(np.exp(1j * (h - ms))); dt = np.angle(np.exp(1j * (th - mt)))
    # Hue: centre on the client's typical hue and keep only a little of the stone's own natural
    # hue variation. Copying the reference's hue spread adds rainbow speckle on pale stones.
    h2 = mt + 0.3 * ds
    new = np.stack([L2, C2 * np.cos(h2), C2 * np.sin(h2)], -1)
    w = region[..., None]
    out = lab2rgb(lab * (1 - w) + new * w)
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8))
