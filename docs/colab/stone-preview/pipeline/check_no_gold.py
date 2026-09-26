"""Verify silver images: count gold-hued pixels outside stone cores (should be ~0)."""
import sys, glob, json, numpy as np
from PIL import Image
from oklab import rgb_to_oklab
from halo_v2 import disc_mask
sm = json.load(open("slots_matched.json"))["gold"]
cores = np.load("photo/mask_centre_stone.npy").copy()
for x, y, r, a in sm: cores |= disc_mask((1600, 1600), x, y, r, 0.8) > 0
bad = []
for f in sys.argv[1:]:
    lab = rgb_to_oklab(np.asarray(Image.open(f).convert("RGB")) / 255.)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    n = int(((h > 45) & (h < 106) & (C > 0.035) & ~cores).sum())
    bad.append((n, f.split("/")[-1]))
bad.sort()
print(f"{len(bad)} checked; gold pixels outside stones: max {bad[-1][0]} ({bad[-1][1]}), median {bad[len(bad)//2][0]}")
