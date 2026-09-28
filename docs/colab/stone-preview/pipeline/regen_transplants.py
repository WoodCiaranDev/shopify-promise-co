"""Rebuild transplants_ps/gold_*.jpg: the client's real halo stones set into a CLEAN gold base.

The base is the gold packshot with every original halo stone filled from the surrounding bezel
(base_openings.clean_base), so nothing of the packshot's olive stones can show round the edge of
a transplanted stone. Five halos use the client's photos directly; the other seven are the same
real stones recoloured to the picker colour. Silver is derived from gold later (gold_to_silver).
"""
import json, numpy as np
from PIL import Image
from skimage.color import rgb2lab
from transplant import transplant
from base_openings import clean_base
import halo_v2
from build import load

DONOR = {"august": 3, "march": 4, "june": 7, "july": 8, "september": 9}
EXCLUDE = {4: {6, 13}}   # donor stones that carry a prong/bezel inside their core (checked by eye)
CORE = 0.88   # share of the setting radius taken from each donor stone; the clean gold cup forms the rim
REC = {"january": "july", "february": "july", "may": "september", "december": "september",
       "october": "june", "november": "june", "april": "march"}

def icon_target(k, lift=True):
    im = np.asarray(Image.open(f"icons_full/{k}.png").convert("RGBA")).astype(np.float64) / 255
    lab = rgb2lab(im[..., :3])[im[..., 3] > 0.95]
    if lift: lab[:, 0] = np.clip(lab[:, 0] + (np.percentile(lab[:, 0], 75) - np.median(lab[:, 0])), 0, 100)
    return lab

def _metal_mask(img, metal):
    from oklab import rgb_to_oklab
    lab = rgb_to_oklab(np.asarray(img.convert("RGB")) / 255.)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2]); L = lab[..., 0]
    return ((h > 60) & (h < 95) & (C > 0.06)) if metal == "gold" else ((C < 0.018) & (L > 0.80))

def recentre_donors(img, stones, metal, core=CORE, search=14):
    """Nudge each donor stone's circle so the pasted core (radius core*r) holds as little bezel
    metal as possible, weighting the outer ring of the core most (where crescents show)."""
    mm = _metal_mask(img, metal).astype(np.float64)
    out = []
    for x, y, r, a in stones:
        R = core * r
        best = None
        yy, xx = np.mgrid[-int(R) - search - 2:int(R) + search + 3, -int(R) - search - 2:int(R) + search + 3]
        for dx in range(-search, search + 1):
            for dy in range(-search, search + 1):
                cx, cy = x + dx, y + dy
                d = np.hypot(xx + (int(x) - cx), yy + (int(y) - cy))
                ring = (d > 0.6 * R) & (d < R)
                ys, xs = yy[ring] + int(y), xx[ring] + int(x)
                ok = (ys >= 0) & (xs >= 0) & (ys < mm.shape[0]) & (xs < mm.shape[1])
                v = mm[ys[ok], xs[ok]].mean() + 0.002 * (dx * dx + dy * dy) ** 0.5
                if best is None or v < best[0]: best = (v, cx, cy)
        out.append((float(best[1]), float(best[2]), r, a))
    return out

def clean_donors(img, stones, metal, core=CORE, limit=0.08):
    """Drop donor stones whose pasted core would include their own bezel (the stone sits off-centre
    in its circle). Metal = gold hue band on gold rings, bright near-neutral on silver rings."""
    from oklab import rgb_to_oklab
    lab = rgb_to_oklab(np.asarray(img.convert("RGB")) / 255.)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2]); L = lab[..., 0]
    metal_px = ((h > 60) & (h < 95) & (C > 0.06)) if metal == "gold" else ((C < 0.025) & (L > 0.82))
    yy, xx = np.mgrid[0:img.height, 0:img.width]
    keep, scores = [], []
    for x, y, r, a in stones:
        d = np.hypot(xx - x, yy - y); ring = (d > 0.72 * core * r) & (d < core * r)
        sc = float(metal_px[ring].mean()); scores.append(sc)
    # pale stones (aquamarine) score on their own light facets, so rank relatively as well
    cut = max(limit, float(np.percentile(scores, 60)))
    keep = [s for s, sc in zip(stones, scores) if sc <= cut]
    return (keep if len(keep) >= 8 else stones), scores

def main():
    ours = [tuple(s) for s in json.load(open("slots_matched.json"))["gold"]]
    # recolouring (match_distribution) must touch only the pasted stone core, never the gold cup:
    # its disc is stored_r * 1.08 * 0.97, so store CORE * r / 1.0476
    halo_v2._STONES["gold"] = [(x, y, CORE * r / 1.0476) for x, y, r, a in ours]
    base = clean_base(load("client/real07.jpg"), ours)
    base.save("photo/gold_clean_base.jpg", quality=95)
    kept = {}
    for k, n in DONOR.items():
        donor = Image.open(f"refs/{n}.png").convert("RGB")
        dm = "silver" if n == 4 else "gold"
        raw = [tuple(t) for t in json.load(open(f"donor_matched_{n}.json"))]
        if n in EXCLUDE:
            # silver-ring donor: pale aquamarine facets read as silver, so the automatic metal
            # checks don't work; use the matched positions and the hand-checked stone list.
            theirs = [t for i, t in enumerate(raw) if i not in EXCLUDE[n]]; sc = [0.0] * len(raw)
        else:
            cand = recentre_donors(donor, raw, dm)
            theirs, sc = clean_donors(donor, cand, dm)
        kept[k] = theirs
        print(k, "donor stones kept", len(theirs), "of", len(sc), "rim-metal scores", [round(v, 2) for v in sc])
        transplant(base, donor, ours, theirs,
                   inner=CORE, feather=1.0, neutralise_gold=False).save(f"transplants_ps/gold_{k}.jpg", quality=95)
    # Recoloured halos: recolour the DONOR's stones in the donor photo first, then set them into
    # the clean base like any other transplant. Recolouring after pasting also recoloured the
    # soft blend where stone meets gold, leaving a pale ring round each stone.
    donor_of = {v: k for k, v in DONOR.items()}
    for k, dk in REC.items():
        n = DONOR[dk]
        donor = Image.open(f"refs/{n}.png").convert("RGB")
        theirs = kept[dk]
        halo_v2._STONES["donor"] = [(x, y, 0.97 * r / 1.0476) for x, y, r, a in theirs]
        recoloured = halo_v2.match_distribution(donor, "donor", icon_target(k, lift=(k != "april")))
        transplant(base, recoloured, ours, theirs, inner=CORE, feather=1.0,
                   neutralise_gold=False).save(f"transplants_ps/gold_{k}.jpg", quality=95)
    print("12 gold halo layers rebuilt on the clean base")

if __name__ == "__main__":
    main()
