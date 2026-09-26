"""Turn a finished gold image into silver: only the metal changes, stones stay untouched.

Gold metal is found by hue: in OKLab it sits in a narrow 70-106 deg band, and no stone does
(champagne peaks at ~53, apple green at ~116). That includes the thin gold bezel lip inside
each stone's circle, which a geometric mask misses (the "neon yellow edge" the client saw).
Halo stone cores and the centre stone are also protected outright. Metal lightness is
quantile-mapped onto the real silver packshot's metal, and its colour set to that packshot's
faint cool tint, so it reads as polished sterling silver rather than grey gold.
"""
import json, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, binary_erosion
from oklab import rgb_to_oklab, oklab_to_rgb
from halo_v2 import disc_mask

BAND = (70, 106)   # gold hue band (deg); ramps 6 deg either side
def _ramp(x, lo, hi, w):
    return np.clip((x - (lo - w)) / w, 0, 1) * np.clip(((hi + w) - x) / w, 0, 1)

def _protect(metal="gold"):
    sm = json.load(open("slots_matched.json"))[metal]
    p = np.zeros((1600, 1600), bool)
    for x, y, r, a in sm:
        p |= disc_mask((1600, 1600), x, y, r, 0.78) > 0          # halo stone cores
    p |= binary_erosion(np.load("photo/mask_centre_stone.npy"), iterations=6)   # centre stone
    return p

def _gold_metal_weight(lab, protect):
    """Two zones.
    Metal away from any stone (the 'base ring'): convert every warm pixel (hue 25-125, any
    chroma above near-neutral). Nothing here can be a stone, so this guarantees no gold is left,
    including orange-shifted gold in shadow and tiny beads.
    Around halo stones and the centre stone: only the gold hue band, so stone colour is never touched."""
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    near_stone = _near_stone()
    broad = _ramp(h, 25, 125, 8) * np.clip((C - 0.008) / 0.012, 0, 1)
    narrow = _ramp(h, 45, 100, 5) * np.clip((C - 0.02) / 0.02, 0, 1)
    w = np.where(near_stone, narrow, broad)
    w[protect] = 0
    return gaussian_filter(w, 0.8)

_NEAR = None
def _near_stone(metal="gold"):
    global _NEAR
    if _NEAR is None:
        sm = json.load(open("slots_matched.json"))[metal]
        m = binary_dilation(np.load("photo/mask_centre_stone.npy"), iterations=4)
        for x, y, r, a in sm: m |= disc_mask((1600, 1600), x, y, r, 1.12) > 0
        _NEAR = m
    return _NEAR

_REF = None
def silver_reference():
    """Silver packshot metal: L quantiles and mean a/b tint (over polished metal, not stones/background)."""
    global _REF
    if _REF is None:
        im = np.asarray(Image.open("packshots/silver.jpg").convert("RGB").resize((1600, 1600), Image.LANCZOS)) / 255.
        lab = rgb_to_oklab(im)
        sm = json.load(open("slots_matched.json"))["silver"]
        stones = np.load("photo/silver_mask_centre_stone.npy").copy()
        for x, y, r, a in sm: stones |= disc_mask((1600, 1600), x, y, r, 1.0) > 0
        yy, xx = np.mgrid[0:1600, 0:1600]
        near = ((xx - 800) / 560) ** 2 + ((yy - 820) / 420) ** 2 < 1
        C = np.hypot(lab[..., 1], lab[..., 2])
        metal = near & ~binary_dilation(stones, iterations=4) & (lab[..., 0] < 0.97) & (C < 0.03)
        _REF = (np.percentile(lab[..., 0][metal], np.linspace(0, 100, 101)), lab[..., 1][metal].mean(), lab[..., 2][metal].mean())
    return _REF

def to_silver(gold_img, protect=None, detect_from=None):
    """detect_from: the same combination rendered WITHOUT client colour settings. Gold is found
    there, because a halo hue shift (e.g. pink +16 deg) can push the bezel lip out of the gold band."""
    A = np.asarray(gold_img.convert("RGB")).astype(np.float64) / 255
    lab = rgb_to_oklab(A)
    if protect is None: protect = _protect()
    ref = rgb_to_oklab(np.asarray(detect_from.convert("RGB")).astype(np.float64) / 255) if detect_from is not None else lab
    w = _gold_metal_weight(ref, protect)
    qs, ta, tb = silver_reference()
    gm = w > 0.5
    src_q = np.percentile(lab[..., 0][gm], np.linspace(0, 100, 101))
    L2 = np.interp(lab[..., 0], src_q, qs)
    new = np.stack([L2, np.full_like(L2, ta), np.full_like(L2, tb)], -1)
    out = oklab_to_rgb(lab * (1 - w[..., None]) + new * w[..., None])
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8)), w

# Recoloured halos are made from a donor birthstone's real stones (same pixel geometry), so the
# donor's own transplant still shows the bezel lip in true gold. Detect gold there.
DONOR = {"january": "july", "february": "july", "may": "september", "december": "september",
         "october": "june", "november": "june", "april": "march"}

def detection_image(raw_gold_combo, halo_key, metal="gold"):
    """Uncoloured gold render, with the halo stone discs swapped for the donor's own transplant."""
    donor = DONOR.get(halo_key, halo_key)
    d = Image.open(f"transplants_ps/{metal}_{donor}.jpg").convert("RGB")
    sm = json.load(open("slots_matched.json"))[metal]
    m = np.zeros((1600, 1600))
    for x, y, r, a in sm: m = np.maximum(m, disc_mask((1600, 1600), x, y, r, 1.12))
    A = np.asarray(raw_gold_combo).astype(np.float64); B = np.asarray(d).astype(np.float64)
    return Image.fromarray((A * (1 - m[..., None]) + B * m[..., None]).astype(np.uint8))
