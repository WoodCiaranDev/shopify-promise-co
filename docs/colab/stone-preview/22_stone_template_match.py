"""Locate halo stone centres by template matching: every stone is the same round brilliant,
so an average-stone template (refined over a few passes) finds each true centre far more
reliably than an edge fit, which can lock onto the bezel instead of the stone."""
import numpy as np
from PIL import Image
from skimage.color import rgb2gray
from skimage.feature import match_template
from transplant import spacing

def locate(img, stones, ratio=0.475, search=18, passes=3):
    g = rgb2gray(np.asarray(img.convert("RGB")))
    st = [tuple(s) for s in stones]
    if len(st[0]) == 3:
        mx = np.mean([s[0] for s in st]); my = np.mean([s[1] for s in st])
        st = [(x, y, r, float(np.arctan2(y - my, x - mx))) for x, y, r in st]
    R = int(round(ratio * spacing(st)))
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1]; disc = (xx ** 2 + yy ** 2) <= R ** 2
    cs = [(s[0], s[1]) for s in st]
    for _ in range(passes):
        crops = [g[int(round(y)) - R:int(round(y)) + R + 1, int(round(x)) - R:int(round(x)) + R + 1] for x, y in cs]
        tmpl = np.mean([c for c in crops if c.shape == disc.shape], axis=0)
        tmpl = np.where(disc, tmpl, tmpl[disc].mean())
        new = []
        for x, y in cs:
            x0, y0 = int(round(x)) - R - search, int(round(y)) - R - search
            win = g[y0:y0 + 2 * (R + search) + 1, x0:x0 + 2 * (R + search) + 1]
            res = match_template(win, tmpl)
            iy, ix = np.unravel_index(np.argmax(res), res.shape)
            new.append((x0 + ix + R, y0 + iy + R))
        cs = new
    return [(float(x), float(y), float(R), s[3]) for (x, y), s in zip(cs, st)]
