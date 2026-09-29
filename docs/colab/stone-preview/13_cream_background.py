"""Swap the packshots' white studio background for the live site's cream (#F2EDE5).

Multiply-blend only where the pixel is background: near-neutral, bright, and connected to
the image border (plus the enclosed gap inside the shank). Multiply keeps the ring's soft
contact shadow as a slightly darker cream. Stones, which sit inside the metal head, are
never connected to the border, so diamonds stay white.
"""
import numpy as np
from PIL import Image
from scipy.ndimage import label, gaussian_filter, binary_dilation

CREAM = np.array([242, 237, 229], np.float32)

def background_weight(A, protect=None):
    mx, mn = A.max(2), A.min(2)
    L = mx / 255.0
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    soft = np.clip((L - 0.62) / 0.25, 0, 1) * np.clip((0.12 - sat) / 0.07, 0, 1)
    cand = soft > 0.25
    lab, n = label(cand)
    keep = np.zeros(n + 1, bool)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    keep[border] = True
    # enclosed background (inside the shank): large, and not overlapping the stone head
    sizes = np.bincount(lab.ravel())
    big = np.where(sizes > 0.004 * lab.size)[0]
    for i in big:
        if i == 0 or keep[i]: continue
        if protect is not None and (protect & (lab == i)).any(): continue
        keep[i] = True
    keep[0] = False
    region = keep[lab]
    region = binary_dilation(region, iterations=2)
    return gaussian_filter((region * soft).astype(np.float32), 1.2)

def to_cream(img, protect=None):
    A = np.asarray(img.convert("RGB")).astype(np.float32)
    wm = background_weight(A, protect)
    w = wm[..., None]
    # Normalise to the studio white actually in the shot (AI output is rarely pure 255), so
    # open background lands exactly on the cream and shadows scale from there.
    ref = np.percentile(A[wm > 0.9], 90, axis=0) if (wm > 0.9).any() else np.array([255, 255, 255], np.float32)
    # Masked blur of the background only: removes the AI's faint specks/banding (which the
    # zoomed drawer preview exaggerates) while keeping the soft contact shadow, and never
    # smears the ring into the background because only background pixels are averaged.
    wb = (wm > 0.5).astype(np.float32)
    num = np.stack([gaussian_filter(A[..., c] * wb, 6) for c in range(3)], -1)
    den = gaussian_filter(wb, 6)[..., None]
    smooth = np.where(den > 1e-3, num / np.maximum(den, 1e-3), A)
    out = A * (1 - w) + np.minimum(smooth / np.maximum(ref, 1), 1.0) * CREAM * w
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))
