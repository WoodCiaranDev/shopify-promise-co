"""Scale the chosen AI base onto the 1600px canvas so its band spans Heirloom's band width, centred where Heirloom sits.

    python prep_base.py ai/gold_c-april_h-april_2.png
"""
import os, sys, numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, binary_opening, gaussian_filter, grey_closing, label

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))
from cream_bg import background_weight
from oklab import rgb_to_oklab, oklab_to_rgb
SZ, RING_W, CENTRE = 1600, 964, (800, 815)
HUE_SHIFT, CHROMA_SCALE, CHROMA_SCALE_CENTRE = 6.5, 0.95, 0.98
STRAY_SPIKES = [(612, 1092, 676, 1146), (924, 1092, 984, 1146)]
SPIKE_CONTRAST = 2.5

def ring_box(a):
    fg = binary_opening(background_weight(a.astype(np.float32)) < 0.5, iterations=3)
    lab, _ = label(fg)
    sizes = np.bincount(lab.ravel())[1:]
    ys, xs = np.nonzero(np.isin(lab, 1 + np.nonzero(sizes > 0.01 * sizes.max())[0]))
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def flatten(img):
    """Make the AI background a flat studio white: anything within a few percent of white becomes exactly
    white (removing its faint tiles and the padded edges), and only the ring's real contact shadow is kept,
    lightly smoothed."""
    a = np.asarray(img).astype(np.float64)
    w = background_weight(a.astype(np.float32))
    inside = w > 0.5
    white = np.percentile(a[w > 0.9], 75, axis=0)
    den = gaussian_filter(inside.astype(np.float64), 4)
    smooth = np.stack([gaussian_filter(a[..., c] * inside, 4) for c in range(3)], -1) / np.maximum(den, 1e-3)[..., None]
    t = np.clip((smooth.mean(-1) / white.mean() - 0.95) / 0.025, 0, 1)[..., None]
    bg = smooth * (1 - t) + white * t
    out = a * (1 - w[..., None]) + bg * w[..., None]
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))

def yellow_the_gold(img):
    """The AI redraw's gold runs orange. Measured on the client's own screenshot of the two rings, the
    reference gold sits about 6 to 7 degrees more yellow (hue 78.9 against 73.5, 77.5 against 70.9 round the
    middle) with the same brightness and slightly less chroma, so rotate the gold hue and ease the chroma,
    a touch more in the middle. Only gold-hued metal is touched; stones and background are left alone."""
    a = np.asarray(img).astype(np.float64) / 255
    lab = rgb_to_oklab(a)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    ramp = lambda x, lo, hi, w: np.clip((x - (lo - w)) / w, 0, 1) * np.clip(((hi + w) - x) / w, 0, 1)
    w = ramp(h, 40, 110, 8) * np.clip((C - 0.03) / 0.02, 0, 1)
    ys, xs = np.nonzero(w > 0.5)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.hypot(xx - xs.mean(), yy - ys.mean()) / (0.5 * np.ptp(xs))
    scale = CHROMA_SCALE + (CHROMA_SCALE_CENTRE - CHROMA_SCALE) * np.clip(1 - d / 0.55, 0, 1)
    h2 = np.radians(h + HUE_SHIFT); C2 = C * scale
    new = np.stack([lab[..., 0], C2 * np.cos(h2), C2 * np.sin(h2)], -1)
    out = oklab_to_rgb(lab * (1 - w[..., None]) + new * w[..., None])
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8))

def remove_stray_spikes(img, boxes=STRAY_SPIKES):
    """The AI redraw left two grey hairline spikes under the lower corners of the head. In each box, find thin
    dark features that are not gold (a black top-hat, which a smooth shadow gradient cannot trigger) and fill
    them from the background around them."""
    a = np.asarray(img).astype(np.float64)
    lab = rgb_to_oklab(a / 255)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    gold = (h > 40) & (h < 110) & (C > 0.04)
    for x0, y0, x1, y1 in boxes:
        sl = (slice(y0, y1), slice(x0, x1))
        grey = a[sl].mean(-1)
        thin = grey_closing(grey, size=(13, 13)) - grey
        clean = ~binary_dilation(gold[sl], iterations=2)
        spike = binary_dilation((thin > SPIKE_CONTRAST) & clean, iterations=2) & clean
        src = (clean & ~spike).astype(np.float64)
        soft = gaussian_filter(spike.astype(np.float64), 0.8)[..., None]
        den = gaussian_filter(src, 3)[..., None]
        num = np.stack([gaussian_filter(a[sl][..., c] * src, 3) for c in range(3)], -1)
        fill = np.where(den > 0.05, num / np.maximum(den, 1e-6), a[sl])
        a[sl] = a[sl] * (1 - soft) + fill * soft
        print(f"  patched {int(spike.sum())} px of a stray spike in box {(x0, y0, x1, y1)}")
    return Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8))

def main(src):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im)
    l, t, r, b = ring_box(a)
    s = RING_W / (r - l)
    pad = round(SZ / s)
    a = np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
    big = Image.fromarray(a).resize((round(a.shape[1] * s), round(a.shape[0] * s)), Image.LANCZOS)
    cx, cy = ((l + r) / 2 + pad) * s, ((t + b) / 2 + pad) * s
    x0, y0 = round(cx - CENTRE[0]), round(cy - CENTRE[1])
    canvas = remove_stray_spikes(yellow_the_gold(flatten(big.crop((x0, y0, x0 + SZ, y0 + SZ)))))
    os.makedirs(os.path.join(HERE, "photo"), exist_ok=True)
    out = os.path.join(HERE, "photo", "gold_base.png")
    canvas.save(out)
    print(f"ring {r - l}x{b - t}px scaled x{s:.3f} -> {out}")

if __name__ == "__main__":
    main(sys.argv[1])
