"""Put the live picker's real centre-stone images into our centre opening (no AI).

The picker stones are 200px oval cut-outs with transparency. Each is scaled uniformly (no
stretching, so the cut is untouched) until it just covers our bezel opening, then blended in
through the soft centre mask so our bezel edge stays on top.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter

def centre_geometry(mask):
    ys, xs = np.where(mask)
    return xs.mean(), ys.mean(), np.ptp(xs) + 1, np.ptp(ys) + 1

def place_centre(base, icon_path, mask, weight, cover=1.05, sharpen=True):
    B = np.asarray(base).astype(np.float64)
    cx, cy, ow, oh = centre_geometry(mask)
    icon = Image.open(icon_path).convert("RGBA")
    a = np.asarray(icon)[..., 3] > 128
    ys, xs = np.where(a)
    icon = icon.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    iw, ih = icon.size
    s = max(ow / iw, oh / ih) * cover
    nw, nh = int(round(iw * s)), int(round(ih * s))
    big = icon.resize((nw, nh), Image.LANCZOS)
    if sharpen:
        rgb = big.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
        big = Image.merge("RGBA", (*rgb.split(), big.split()[3]))
    layer = np.zeros_like(B); alpha = np.zeros(B.shape[:2])
    x0, y0 = int(round(cx - nw / 2)), int(round(cy - nh / 2))
    P = np.asarray(big).astype(np.float64)
    layer[y0:y0 + nh, x0:x0 + nw] = P[..., :3]
    alpha[y0:y0 + nh, x0:x0 + nw] = P[..., 3] / 255
    w = (weight * alpha)[..., None]
    return Image.fromarray(np.clip(B * (1 - w) + layer * w, 0, 255).astype(np.uint8))


def cover_scale(icon_path, mask, start=1.0, step=0.01, need=0.999):
    """Smallest uniform enlargement (relative to width-fit) at which the stone covers the
    whole opening, so no original stone shows at the corners and the cut is never stretched."""
    cx, cy, ow, oh = centre_geometry(mask)
    icon = Image.open(icon_path).convert("RGBA")
    a = np.asarray(icon)[..., 3] > 128
    ys, xs = np.where(a)
    icon = icon.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    iw, ih = icon.size
    base = max(ow / iw, oh / ih)
    my, mx = np.where(mask)
    c = start
    while c < 1.6:
        s = base * c
        nw, nh = int(round(iw * s)), int(round(ih * s))
        A = np.asarray(icon.resize((nw, nh), Image.LANCZOS))[..., 3] > 200
        x0, y0 = int(round(cx - nw / 2)), int(round(cy - nh / 2))
        px, py = mx - x0, my - y0
        ok = (px >= 0) & (py >= 0) & (px < nw) & (py < nh)
        cov = np.zeros(len(mx), bool); cov[ok] = A[py[ok], px[ok]]
        if cov.mean() >= need:
            return c
        c += step
    return c
