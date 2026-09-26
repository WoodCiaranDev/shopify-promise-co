"""Lighten small halo stones the way real melee reads.

Light passes through a 2.7 mm halo stone about half as far as through the
8 x 6 mm centre, so pale materials lose visible body colour (Beer-Lambert).
Figures are the per-stone halo adjustments from the research note: lightness
lift (share of the remaining headroom to white), chroma reduction, and a small
hue shift for peridot. Deep stones barely move. Metal is protected by the halo
mask and by skipping pixels close to the ring's own metal colour.
"""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_erosion
from skimage.color import rgb2lab, lab2rgb

#            lightness  chroma  hue(deg, +=towards yellow)
RESEARCH = {
    "january":  (0.04, +0.05, 0), "february": (0.07, -0.08, 0), "march":   (0.18, -0.28, 0),
    "april":    (0.00,  0.00, 0), "may":      (0.05, -0.05, 0), "june":    (0.15, -0.25, 0),
    "july":     (0.03,  0.00, 0), "august":   (0.12, -0.15, 5), "september": (0.045, 0.0, 0),
    "october":  (0.13, -0.20, 0), "november": (0.10, -0.15, 0), "december": (0.08, -0.10, 0),
}
LEVELS = {"none": 0.0, "half": 0.5, "research": 1.0}

def adjust(img, halo_mask, metal_lab, stone, level):
    k = LEVELS[level]; dl, dc, dh = RESEARCH[stone]
    if k == 0 or (dl, dc, dh) == (0, 0, 0): return img
    A = np.asarray(img).astype(np.float64) / 255
    lab = rgb2lab(A); L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); H = np.arctan2(b, a)
    # hue shift towards yellow (+b axis, 90deg in Lab)
    H = H + np.radians(dh * k) * np.sign(np.radians(90) - H)
    L2 = L + dl * k * (100 - L)
    C2 = C * (1 + dc * k)
    new = np.stack([L2, C2 * np.cos(H), C2 * np.sin(H)], -1)
    # weight: inside the (slightly eroded) halo discs, away from metal colour
    m = binary_erosion(halo_mask, iterations=3).astype(np.float64)
    dE = np.linalg.norm(lab - metal_lab, axis=-1)
    stoneish = np.clip((dE - 10) / 12, 0, 1)
    w = gaussian_filter(m * stoneish, 1.5)[..., None]
    out = lab2rgb(lab * (1 - w) + new * w)
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8))

def metal_colour(img, centre_mask, halo_mask):
    """Median Lab of the ring's metal: saturated or mid-tone pixels near the head, outside stones."""
    lab = rgb2lab(np.asarray(img).astype(np.float64) / 255)
    ys, xs = np.where(centre_mask); cy, cx = ys.mean(), xs.mean()
    yy, xx = np.mgrid[:img.height, :img.width]
    near = ((yy - cy) ** 2 + (xx - cx) ** 2) < 380 ** 2
    sel = near & ~centre_mask & ~halo_mask & (lab[..., 0] < 92) & (lab[..., 0] > 40)
    return np.median(lab[sel], axis=0)
