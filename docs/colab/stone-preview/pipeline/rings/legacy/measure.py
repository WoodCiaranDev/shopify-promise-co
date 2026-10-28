"""Measure the Legacy base: the centre stone opening and the 16 halo stone slots.

    python measure.py

The base's stones are colourless, so stones are found as low-chroma blobs inside the ring rather
than by hue. Writes geometry.json, slots_matched.json, photo/mask_centre_stone.npy and photo/overlay.png. The
slot and mask files mirror the Heirloom layout, so gold_to_silver.py runs unchanged from this folder.
"""
import os, sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_fill_holes, binary_opening, binary_erosion, label
from skimage.color import rgb2lab
from skimage.morphology import convex_hull_image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))
from cream_bg import background_weight
from stone_match import locate

BEZEL_INSET = 4

def stone_blobs(a):
    lab = rgb2lab(a / 255.0)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    ring = binary_fill_holes(background_weight(a.astype(np.float32)) < 0.5)
    stones = binary_opening((chroma < 16) & (lab[..., 0] > 40) & ring, iterations=2)
    lab_, n = label(binary_fill_holes(stones))
    sizes = np.bincount(lab_.ravel()); sizes[0] = 0
    return lab_, sizes

def main():
    base = Image.open(os.path.join(HERE, "photo", "gold_base.png")).convert("RGB")
    a = np.asarray(base).astype(np.float64)
    lab_, sizes = stone_blobs(a)
    order = np.argsort(sizes)[::-1]
    centre = lab_ == order[0]
    hull = convex_hull_image(centre)
    stone = binary_erosion(hull, iterations=BEZEL_INSET)
    halo = []
    for i in order[1:17]:
        ys, xs = np.nonzero(lab_ == i)
        halo.append((float(xs.mean()), float(ys.mean()), float(np.sqrt(sizes[i] / np.pi))))
    slots = locate(base, halo)
    ys, xs = np.nonzero(stone)
    geometry = {
        "size": base.size[0],
        "centre": {"cx": float(xs.mean()), "cy": float(ys.mean()), "w": int(np.ptp(xs) + 1), "h": int(np.ptp(ys) + 1)},
        "slots": sorted(slots, key=lambda s: s[3]),
        "halo_area_ratio": float(sizes[order[16]] / sizes[order[1]]),
    }
    np.save(os.path.join(HERE, "photo", "mask_centre_stone.npy"), stone)
    json.dump(geometry, open(os.path.join(HERE, "geometry.json"), "w"), indent=1)
    json.dump({"gold": geometry["slots"]}, open(os.path.join(HERE, "slots_matched.json"), "w"))

    ov = base.copy(); d = ImageDraw.Draw(ov)
    edge = stone & ~binary_erosion(stone, iterations=2)
    o = np.asarray(ov).copy(); o[edge] = (0, 200, 255); ov = Image.fromarray(o); d = ImageDraw.Draw(ov)
    for n, (x, y, r, _) in enumerate(geometry["slots"]):
        for f, col in ((1.0, (255, 0, 0)), (0.88, (0, 255, 0))):
            d.ellipse((x - r * f, y - r * f, x + r * f, y + r * f), outline=col, width=2)
        d.text((x - 4, y - 6), str(n), fill=(0, 0, 0))
    ov.save(os.path.join(HERE, "photo", "overlay.png"))
    c = geometry["centre"]
    print(f"centre {c['w']}x{c['h']} at ({c['cx']:.0f},{c['cy']:.0f}); {len(slots)} slots, R={slots[0][2]:.1f}; "
          f"smallest/largest halo blob {geometry['halo_area_ratio']:.2f}")

if __name__ == "__main__":
    main()
