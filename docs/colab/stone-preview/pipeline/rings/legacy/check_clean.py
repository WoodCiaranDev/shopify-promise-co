"""Per-stone cleanliness check of the built Legacy halos, measured against Heirloom's own images.

    python check_clean.py

For every month and metal it measures each of the 16 halo stones in the Legacy image and in the matching
Heirloom image: gold-hued pixels inside the stone core (a bezel sliver or crescent), a pale leftover ring
between the stone and its cup (the base's original white stone), and, on silver, gold-hued pixels
anywhere on the metal. Prints the worst stones where Legacy is clearly worse than Heirloom.
"""
import os, sys, json, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.join(HERE, "..", "..")
ASSETS = os.path.join(PIPE, "..", "..", "..", "..", "assets")
sys.path.insert(0, PIPE)
from oklab import rgb_to_oklab

K = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
LEG = json.load(open(os.path.join(HERE, "slots_matched.json")))["gold"]
HEI = json.load(open(os.path.join(PIPE, "slots_matched.json")))["gold"]

def lab_of(path):
    return rgb_to_oklab(np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255)

def stone_metrics(lab, slots, metal):
    H, W = lab.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2]); L = lab[..., 0]
    gold = (h > 60) & (h < 100) & (C > 0.06)
    pale = (C < 0.025) & (L > 0.82)
    out = []
    for x, y, r, _ in slots:
        d = np.hypot(xx - x, yy - y) / r
        core = d < 0.80
        ring = (d > 0.90) & (d < 1.0)
        out.append((gold[core].mean(), pale[ring].mean() if metal == "gold" else 0.0))
    return np.array(out)

def silver_gold_pixels(lab, slots):
    H, W = lab.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    warm = (h > 45) & (h < 105) & (C > 0.04)
    ring = (np.abs(xx - 800) < 560) & (np.abs(yy - 820) < 430)
    return int((warm & ring).sum())

def main():
    worst = []
    for metal in ("gold", "silver"):
        print(f"\n== {metal}")
        print(f"{'halo':10s} {'core-gold L/H':>16s} {'pale-ring L/H':>16s} {'warm px L/H':>14s}")
        for k in K:
            leg = lab_of(f"{ASSETS}/colab-legacy-{metal}-april-{k}.jpg")
            hei = lab_of(f"{ASSETS}/colab-heirloom-{metal}-april-{k}.jpg")
            ml, mh = stone_metrics(leg, LEG, metal), stone_metrics(hei, HEI, metal)
            wl = silver_gold_pixels(leg, LEG) if metal == "silver" else 0
            wh = silver_gold_pixels(hei, HEI) if metal == "silver" else 0
            print(f"{k:10s} {ml[:, 0].max():7.3f}/{mh[:, 0].max():6.3f} {ml[:, 1].max():8.3f}/{mh[:, 1].max():6.3f} {wl:7d}/{wh:6d}")
            for i in range(16):
                worst.append((ml[i, 0] - mh[:, 0].max(), ml[i, 1] - mh[:, 1].max(), metal, k, i, LEG[i][:2]))
    print("\nstones where Legacy is worse than Heirloom's worst stone (core gold fraction):")
    for dg, dp, metal, k, i, xy in sorted(worst, key=lambda t: -t[0])[:12]:
        if dg > 0.02: print(f"  {metal} {k} stone {i} at ({xy[0]:.0f},{xy[1]:.0f}): +{dg:.3f} gold in core")
    print("stones with a pale leftover ring worse than Heirloom's worst:")
    for dg, dp, metal, k, i, xy in sorted(worst, key=lambda t: -t[1])[:12]:
        if dp > 0.05: print(f"  {metal} {k} stone {i} at ({xy[0]:.0f},{xy[1]:.0f}): +{dp:.3f} pale ring")

if __name__ == "__main__":
    main()
