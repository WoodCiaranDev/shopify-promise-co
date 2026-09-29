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
        p |= disc_mask((1600, 1600), x, y, r, 0.855) > 0         # halo stones (pasted at 0.88r, see regen_transplants.CORE)
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
    """Only the centre stone's surroundings get the cautious gold-band-only conversion. Halo stones
    are pasted at exactly 0.88r onto a clean gold cup, so outside 0.855r everything is metal and
    is converted like the rest of the ring (this also catches the stone-meets-gold blend)."""
    global _NEAR
    if _NEAR is None:
        _NEAR = binary_dilation(np.load("photo/mask_centre_stone.npy"), iterations=4)
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

def _halo_cores(metal="gold"):
    sm = json.load(open("slots_matched.json"))[metal]
    m = np.zeros((1600, 1600), bool)
    for x, y, r, a in sm: m |= disc_mask((1600, 1600), x, y, r, 0.855) > 0
    return m

def to_silver(gold_img, protect=None, detect_from=None, halo=None):
    """detect_from: the same combination rendered WITHOUT client colour settings. Gold is found
    there, because a halo hue shift (e.g. pink +16 deg) can push the bezel lip out of the gold band."""
    A = np.asarray(gold_img.convert("RGB")).astype(np.float64) / 255
    lab = rgb_to_oklab(A)
    if protect is None: protect = _protect()
    ref = rgb_to_oklab(np.asarray(detect_from.convert("RGB")).astype(np.float64) / 255) if detect_from is not None else lab
    w = _gold_metal_weight(ref, protect)
    # A donor stone can carry a thin arc of its own gold bezel inside the pasted core: invisible on
    # gold, obvious on silver. Convert strong gold hues inside halo cores too - except champagne,
    # whose (client-shifted) colour overlaps the gold band.
    if halo != "november":
        h = np.degrees(np.arctan2(ref[..., 2], ref[..., 1])); C = np.hypot(ref[..., 1], ref[..., 2])
        inner = _ramp(h, 62, 98, 4) * np.clip((C - 0.05) / 0.02, 0, 1) * _halo_cores()
        w = np.maximum(w, gaussian_filter(inner, 0.6))
    qs, ta, tb = silver_reference()
    gm = w > 0.5
    src_q = np.percentile(lab[..., 0][gm], np.linspace(0, 100, 101))
    L2 = np.interp(lab[..., 0], src_q, qs)
    new = np.stack([L2, np.full_like(L2, ta), np.full_like(L2, tb)], -1)
    out = lab * (1 - w[..., None]) + new * w[..., None]
    if halo == "november":
        out = _champagne_on_silver(out)
    out = oklab_to_rgb(out)
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8)), w

def _halo_radius(metal="gold"):
    """Distance from the nearest halo stone centre, in units of that stone's radius."""
    sm = json.load(open("slots_matched.json"))[metal]
    yy, xx = np.mgrid[0:1600, 0:1600]
    d = np.full((1600, 1600), np.inf)
    for x, y, r, a in sm: d = np.minimum(d, np.hypot(xx - x, yy - y) / r)
    return d

def _champagne_on_silver(lab, hue=62, keep=0.35):
    """Champagne sits in the gold hue band, so on silver its yellow-green facets read as leftover gold
    and its saturated edge stops dead against grey. Pull facet hues towards champagne, cool the brightest
    sparkle, and shade a thin warm girdle where stone meets bezel."""
    d = _halo_radius()
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); h = np.degrees(np.arctan2(b, a))
    h2 = np.where((h > 20) & (h < 140), hue + (h - hue) * keep, h)
    C2 = C * (1 - 0.5 * np.clip((L - 0.88) / 0.08, 0, 1))
    stone = (np.clip((0.90 - d) / 0.10, 0, 1) * np.clip((C - 0.01) / 0.02, 0, 1))[..., None]
    lab = lab * (1 - stone) + np.stack([L, C2 * np.cos(np.radians(h2)), C2 * np.sin(np.radians(h2))], -1) * stone
    g = gaussian_filter(np.clip(np.minimum((d - 0.80) / 0.08, (0.95 - d) / 0.07), 0, 1), 0.7)
    tint = 0.035 * np.array([np.cos(np.radians(hue)), np.sin(np.radians(hue))])
    return np.stack([lab[..., 0] * (1 - 0.14 * g), lab[..., 1] * (1 - g) + tint[0] * g, lab[..., 2] * (1 - g) + tint[1] * g], -1)

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
