"""Halo shade steps for the client picker: negative = darker, positive = lighter.
One step = 7% of the way to white (lighter) or 7% towards black (darker);
lighter steps also soften the colour, darker steps deepen it slightly."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_erosion
from skimage.color import rgb2lab, lab2rgb
STEP_L, STEP_C_LIGHT, STEP_C_DARK = 0.11, 0.12, 0.06
YELLOW_SHIFT = {"august": 2.0}   # degrees per lighter step (peridot turns yellower when small)

def shade(img, halo_mask, metal_lab, stone, t):
    if t == 0: return img
    lab = rgb2lab(np.asarray(img).astype(np.float64) / 255)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); H = np.arctan2(b, a)
    if t > 0:
        L2 = L + STEP_L * t * (100 - L); C2 = C * max(0, 1 - STEP_C_LIGHT * t)
        H = H + np.radians(YELLOW_SHIFT.get(stone, 0) * t) * np.sign(np.radians(90) - H)
    else:
        L2 = L * (1 + STEP_L * t); C2 = C * (1 + STEP_C_DARK * -t)
    new = np.stack([L2, C2 * np.cos(H), C2 * np.sin(H)], -1)
    m = binary_erosion(halo_mask, iterations=3).astype(np.float64)
    dE = np.linalg.norm(lab - metal_lab, axis=-1)
    w = gaussian_filter(m * np.clip((dE - 10) / 12, 0, 1), 1.5)[..., None]
    return Image.fromarray((np.clip(lab2rgb(lab * (1 - w) + new * w), 0, 1) * 255).round().astype(np.uint8))
