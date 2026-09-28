"""Match each AI centre stone's colour to the stone picker icon (Reinhard transfer in Lab).

Stats come from the icon's opaque pixels and the AI stone inside the centre mask (eroded off
the bezel). Mean and spread of L, a and b are matched, so the stone keeps its own facets but
takes the icon's colour and contrast. Applied through a feathered mask; metal is untouched.
"""
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, gaussian_filter
from skimage.color import rgb2lab, lab2rgb

def icon_stats(path):
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float64) / 255
    m = binary_erosion(im[..., 3] > 0.95, iterations=4)
    lab = rgb2lab(im[..., :3])[m]
    return lab.mean(0), lab.std(0)

# Cap how far contrast may change, so a high-contrast icon can't blow out the facets (emerald).
RATIO_LIMITS = np.array([[0.8, 1.25], [0.6, 1.6], [0.6, 1.6]])

def match(img, mask, target, strength=1.0, erode=10, colour_gate=0, hue_lock=0.0):
    mu_t, sd_t = target
    A = np.asarray(img).astype(np.float64) / 255
    lab = rgb2lab(A)
    core = binary_erosion(mask, iterations=erode)
    px = lab[core]; mu_s, sd_s = px.mean(0), px.std(0)
    ratio = np.clip(sd_t / np.maximum(sd_s, 1e-3), RATIO_LIMITS[:, 0], RATIO_LIMITS[:, 1])
    new = (lab - mu_s) * ratio + mu_t
    new[..., 0] = np.clip(new[..., 0], 0, 100)
    if hue_lock:
        # Uniform hue like real calibrated stones: keep each pixel's chroma, take the target hue.
        Cn = np.hypot(new[..., 1], new[..., 2])
        ht = np.arctan2(mu_t[2], mu_t[1])
        new[..., 1] = new[..., 1] * (1 - hue_lock) + Cn * np.cos(ht) * hue_lock
        new[..., 2] = new[..., 2] * (1 - hue_lock) + Cn * np.sin(ht) * hue_lock
    new = lab + (new - lab) * strength
    w = binary_erosion(mask, iterations=3).astype(np.float64)
    if colour_gate:
        # Only move pixels already coloured like this stone, so metal or background caught by
        # a loose mask (the halo discs) is never tinted.
        d = np.linalg.norm(lab[..., 1:] - mu_s[1:], axis=-1)
        near = np.clip((colour_gate - d) / (colour_gate * 0.5), 0, 1)
        w = w * near if np.hypot(*mu_s[1:]) > 8 else w * (np.hypot(lab[..., 1], lab[..., 2]) < 12)
    w = gaussian_filter(w, 2)[..., None]
    out = lab2rgb(lab * (1 - w) + new * w)
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8))


def light_part_stats(img, centre_mask):
    """Colour of the lightest coloured facets of the centre stone (used as the halo colour
    for birthstones the client hasn't supplied a halo reference for). Ignores dull pixels and
    the near-white glints at the very top."""
    lab = rgb2lab(np.asarray(img).astype(np.float64) / 255)
    core = binary_erosion(centre_mask, iterations=10)
    L = lab[..., 0]; C = np.hypot(lab[..., 1], lab[..., 2])
    sel = core & (C >= 0.5 * np.median(C[core]))
    lo, hi = np.percentile(L[sel], [70, 97])
    px = lab[sel & (L >= lo) & (L <= hi)]
    return px.mean(0), px.std(0)
