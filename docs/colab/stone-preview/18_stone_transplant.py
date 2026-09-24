"""Transplant real halo stones from a client photo into our packshot's halo positions.

The client's photos are the same front-on angle at almost the same resolution, so each of
their 16 halo stones is cut out, scaled to our stone's size, and blended inside our gold bezel
at the matching position around the halo (same angle, so the lighting direction agrees).
The result keeps the real stones' cut, dark facets and sparkle exactly.
"""
import numpy as np, json
from PIL import Image
from scipy.ndimage import (binary_opening, binary_fill_holes, distance_transform_edt,
                           maximum_filter, label, center_of_mass, gaussian_filter)
from skimage.color import rgb2lab

def detect_stones(img, hue_range, min_c=18, n=16):
    lab = rgb2lab(np.asarray(img) / 255.)
    C = np.hypot(lab[..., 1], lab[..., 2]); h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1]))
    lo, hi = hue_range
    hm = (h > lo) & (h < hi) if lo < hi else (h > lo) | (h < hi)
    m = binary_fill_holes(binary_opening((C > min_c) & hm, iterations=2))
    # drop blobs far larger than a halo stone (the centre stone when it shares the hue)
    lab_, k0 = label(m)
    if k0:
        sizes = np.bincount(lab_.ravel()); sizes[0] = 0
        typical = np.median(sizes[sizes > 0.2 * np.percentile(sizes[1:], 90)])
        m &= ~np.isin(lab_, np.where(sizes > 3 * typical)[0])
    dt = distance_transform_edt(m)
    pk = (dt == maximum_filter(dt, size=41)) & (dt > 0.55 * dt.max())
    l, k = label(pk)
    cs = np.array([center_of_mass(l == i) for i in range(1, k + 1)])   # (y, x)
    rs = np.array([dt[int(y), int(x)] for y, x in cs])
    # keep the 16 that sit on the halo ring: closest to the median ring radius
    cy, cx = np.median(cs[:, 0]), np.median(cs[:, 1])
    d = np.hypot(cs[:, 0] - cy, cs[:, 1] - cx)
    # ring is an ellipse; normalise by the spread in x and y
    sy, sx = np.ptp(cs[:, 0]) / 2, np.ptp(cs[:, 1]) / 2
    e = np.hypot((cs[:, 0] - cy) / sy, (cs[:, 1] - cx) / sx)
    keep = np.argsort(np.abs(e - np.median(e)))[:n]
    cs, rs = cs[keep], rs[keep]
    cy, cx = cs[:, 0].mean(), cs[:, 1].mean()
    ang = np.arctan2(cs[:, 0] - cy, cs[:, 1] - cx)
    return [(float(x), float(y), float(r), float(a)) for (y, x), r, a in zip(cs, rs, ang)]

def transplant(base, donor, ours, theirs, inner=0.9, feather=2.0, scale=None, neutralise_gold=False):
    """base: our halo image; donor: client photo; ours/theirs: lists of (x, y, r, angle)."""
    B = np.asarray(base).astype(np.float64)
    out = B.copy()
    H, W = B.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for (x, y, r, a) in ours:
        # client stone at the nearest angle around the halo
        j = int(np.argmin([abs(np.angle(np.exp(1j * (t[3] - a)))) for t in theirs]))
        dx, dy, dr, _ = theirs[j]
        s = scale if scale else r / dr
        R = int(np.ceil(dr * 1.3))
        patch = donor.crop((int(dx - R), int(dy - R), int(dx + R), int(dy + R)))
        size = max(1, int(round(2 * R * s)))
        patch = np.asarray(patch.resize((size, size), Image.LANCZOS)).astype(np.float64)
        if neutralise_gold:
            # donor is a gold ring, target is silver: grey out gold-hued pixels (prong tips,
            # bezel slivers) so no yellow metal carries across. Stone hues sit outside this band.
            lab = rgb2lab(patch / 255)
            hh = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); cc = np.hypot(lab[..., 1], lab[..., 2])
            g = ((hh > 62) & (hh < 102) & (cc > 10)).astype(np.float64)
            g = gaussian_filter(g, 1.0)[..., None]
            lab2 = lab.copy(); lab2[..., 1:] = 0
            from skimage.color import lab2rgb
            patch = (lab * (1 - g) + lab2 * g)
            patch = np.clip(lab2rgb(patch), 0, 1) * 255
        x0, y0 = int(round(x - size / 2)), int(round(y - size / 2))
        m = (((xx - x) ** 2 + (yy - y) ** 2) <= (r * inner) ** 2).astype(np.float64)
        m = gaussian_filter(m, feather)[..., None]
        canvas = out.copy()
        ys, xs = slice(max(0, y0), min(H, y0 + size)), slice(max(0, x0), min(W, x0 + size))
        canvas[ys, xs] = patch[ys.start - y0: ys.stop - y0, xs.start - x0: xs.stop - x0]
        out = out * (1 - m) + canvas * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def spacing(stones):
    """Median distance between neighbouring halo stones: a size measure that is the same
    kind of measurement in any photo, regardless of stone colour."""
    st = sorted(stones, key=lambda t: t[3])
    d = [np.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]) for i in range(len(st))]
    return float(np.median(d))
