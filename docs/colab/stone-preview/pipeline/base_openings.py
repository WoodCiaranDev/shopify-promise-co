"""Exact footprint of each ORIGINAL halo stone in the gold packshot.

The packshot's own halo stones are pale olive (OKLab hue ~100-103, chroma ~0.04) while the
gold bezel is hue ~80, chroma ~0.08+. Any original-stone pixel left uncovered by a transplanted
stone shows as a green crescent, so each replacement must cover this footprint completely.
"""
import json, numpy as np
from scipy.ndimage import binary_fill_holes, binary_opening, label, binary_closing
from oklab import rgb_to_oklab

def openings(img, slots):
    lab = rgb_to_oklab(np.asarray(img.convert("RGB")) / 255.)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    stone = ~((h > 60) & (h < 92) & (C > 0.055))            # everything that isn't gold metal
    yy, xx = np.mgrid[0:img.height, 0:img.width]
    out = []
    for x, y, r, a in slots:
        win = np.hypot(xx - x, yy - y) < 1.3 * r
        m = binary_opening(stone & win, iterations=1)
        lab_, n = label(m)
        k = lab_[int(round(y)), int(round(x))] or (np.bincount(lab_[win].ravel())[1:].argmax() + 1)
        m = binary_fill_holes(binary_closing(lab_ == k, iterations=2))
        ys, xs = np.nonzero(m)
        cx, cy = xs.mean(), ys.mean()
        rmax = np.percentile(np.hypot(xs - cx, ys - cy), 99.5)
        out.append((float(cx), float(cy), float(rmax), a))
    return out


def clean_base(img, slots, reach=1.12, lip=1.08):
    """Stone-free base ring. Each setting (and any non-gold leftover out to `reach` x radius) is
    refilled by continuing the bezel inward: every pixel takes the colour found just outside the
    setting (at `lip` x radius) along the same angle, smoothed round the circle. The result is a
    clean gold cup lit like the bezel, so any sliver a transplanted stone leaves uncovered reads
    as polished metal - never the packshot's original olive stone and never streaky."""
    from PIL import Image
    from scipy.ndimage import map_coordinates, gaussian_filter1d, gaussian_filter
    A = np.asarray(img.convert("RGB")).astype(np.float64)
    lab = rgb_to_oklab(A / 255.)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    gold = (h > 60) & (h < 92) & (C > 0.055)
    out = A.copy(); wsum = np.zeros(A.shape[:2])
    H, W = A.shape[:2]
    for x, y, r, a in slots:
        x0, x1 = int(max(0, x - reach * r - 3)), int(min(W, x + reach * r + 4))
        y0, y1 = int(max(0, y - reach * r - 3)), int(min(H, y + reach * r + 4))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.hypot(xx - x, yy - y); t = np.arctan2(yy - y, xx - x)
        fill = (d < 0.99 * r) | ((d < reach * r) & ~gold[y0:y1, x0:x1])
        # bezel colour profile round the circle, sampled just outside the setting
        n = 720; th = np.linspace(-np.pi, np.pi, n, endpoint=False)
        R = lip * r
        prof = np.stack([map_coordinates(A[..., c], [y + R * np.sin(th), x + R * np.cos(th)], order=1) for c in range(3)], -1)
        prof = gaussian_filter1d(prof, 6, axis=0, mode="wrap")
        idx = ((t + np.pi) / (2 * np.pi) * n).astype(int) % n
        src = prof[idx]
        m = gaussian_filter(fill.astype(np.float64), 0.8)[..., None]
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - m) + src * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
