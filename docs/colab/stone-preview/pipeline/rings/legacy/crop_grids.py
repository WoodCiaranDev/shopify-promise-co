"""Cut each ring out of the client's 2x2 Legacy grids into renders/{metal}_c-{centre}_h-{halo}.png."""
import os, numpy as np
from PIL import Image
from scipy.ndimage import binary_opening, label

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "renders", "source")
OUT = os.path.join(HERE, "renders")

GRIDS = {
    "grid_a.png": [("gold", "october", "april"), ("silver", "march", "april"),
                   ("gold", "june", "april"), ("gold", "december", "march")],
    "grid_b.png": [("gold", "july", "april"), ("gold", "june", "october"),
                   ("silver", "september", "april"), ("gold", "april", "april")],
}

def ring_box(tile, bg):
    a = np.asarray(tile).astype(np.int16)
    a = a[: round(a.shape[0] * 0.72)]
    fg = binary_opening(np.abs(a - bg).max(-1) > 6, iterations=2)
    lab, _ = label(fg)
    sizes = np.bincount(lab.ravel())[1:]
    keep = np.isin(lab, 1 + np.nonzero(sizes > 0.01 * sizes.max())[0])
    ys, xs = np.nonzero(keep)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def main():
    for grid, tiles in GRIDS.items():
        im = Image.open(os.path.join(SRC, grid)).convert("RGB")
        w, h = im.size
        bg = np.median(np.asarray(im)[:8].reshape(-1, 3), axis=0)
        for i, (metal, centre, halo) in enumerate(tiles):
            x0, y0 = (i % 2) * w // 2, (i // 2) * h // 2
            tile = im.crop((x0, y0, x0 + w // 2, y0 + h // 2))
            l, t, r, b = ring_box(tile, bg)
            side = round(max(r - l, b - t) * 1.12)
            canvas = Image.new("RGB", (side, side), tuple(int(v) for v in bg))
            canvas.paste(tile.crop((l, t, r, b)), ((side - (r - l)) // 2, (side - (b - t)) // 2))
            name = f"{metal}_c-{centre}_h-{halo}.png"
            canvas.save(os.path.join(OUT, name))
            print(f"{name}: ring {r - l}x{b - t}px, saved {side}px square")

if __name__ == "__main__":
    main()
