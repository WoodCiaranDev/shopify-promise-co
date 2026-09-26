"""Rebuild everything for the Heirloom ring stone preview.

    python rebuild.py                       # 288 site images, no client colour settings
    python rebuild.py client_colours.json   # 288 site images with the client's tuner settings
    python rebuild.py --tuner               # also refresh the tuner page's images and base.json

Run from this folder. Writes the site images into the theme's assets/ folder (../../../../assets)
and, with --tuner, the tuner assets into ../tuner/. Derived weight files are created on first run.
"""
import sys, os, json, hashlib, itertools, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation
from skimage.morphology import convex_hull_image

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, HERE)
ASSETS = os.path.join(HERE, "..", "..", "..", "..", "assets")
TUNER = os.path.join(HERE, "..", "tuner")

def prepare():
    """Soft weight maps (derived, not committed): centre from the stone-opening mask, halo from the
    16 template-matched stone positions in slots_matched.json."""
    from halo_v2 import disc_mask
    sm = json.load(open("slots_matched.json"))
    for metal, pre in (("gold", "photo/mask_centre"), ("silver", "photo/silver_mask_centre")):
        if os.path.exists(f"weight_halo_{metal}.npy"): continue
        hull = np.load(pre + "_stone.npy")
        wc = gaussian_filter(hull.astype(np.float64), 1.2)
        wh = np.zeros(hull.shape)
        for x, y, r, a in sm[metal]:
            wh = np.maximum(wh, disc_mask(hull.shape, x, y, r, 0.96, feather=1.2))
        np.save(f"weight_centre_{metal}.npy", wc); np.save(f"weight_halo_{metal}.npy", wh * (1 - wc))
        print("prepared weights for", metal)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    prepare()
    import build
    from cream_bg import to_cream
    if args:
        import importlib.util
        spec = importlib.util.spec_from_file_location("apply", "19_apply_client_colours.py")
        ap = importlib.util.module_from_spec(spec); spec.loader.exec_module(ap)
        build.CLIENT_COLOURS = ap.validate(json.load(open(args[0])), json.load(open("tuner_base.json"))["baseImageHash"])
        print("applying client colours from", args[0])
    # Gold is built from the gold photo. Silver is the finished gold image with only the metal
    # converted to silver (client's request: "the gold rings turned silver"), see gold_to_silver.py.
    from gold_to_silver import to_silver, detection_image
    _, _, mcf, mhf = build.CFG["gold"]
    prot = binary_dilation(np.load(mcf.replace(".npy", "_stone.npy")) | np.load(mhf), iterations=40)
    cc = build.CLIENT_COLOURS
    build.CLIENT_COLOURS = None; build._cache.clear()
    Cr, Hr, a, _ = build.parts("gold", "medium", "none"); Cr, Hr = dict(Cr), dict(Hr)
    build.CLIENT_COLOURS = cc; build._cache.clear()
    Cc, Hc, a, _ = build.parts("gold", "medium", "none")
    img = lambda C, H, c, h: Image.fromarray((C[c] * (1 - a) + H[h] * a).clip(0, 255).astype(np.uint8))
    for c, h in itertools.product(build.K, build.K):
        gold = to_cream(img(Cc, Hc, c, h), prot)
        gold.save(f"{ASSETS}/colab-heirloom-gold-{c}-{h}.jpg", quality=84, optimize=True, progressive=True)
        det = detection_image(to_cream(img(Cr, Hr, c, h), prot), h)
        to_silver(gold, detect_from=det)[0].save(f"{ASSETS}/colab-heirloom-silver-{c}-{h}.jpg", quality=84, optimize=True, progressive=True)
    print("288 images written (silver = gold converted)")
    if "--tuner" in sys.argv:
        export_tuner(build, to_cream)

def export_tuner(build, to_cream):
    """Tuner images use the base colours (no client settings), since the tuner applies them live."""
    from oklab import rgb_to_oklab
    build.CLIENT_COLOURS = None; build._cache.clear()
    base = json.load(open("tuner_base.json")); BOX = base["box"]; W, H = base["size"]; hasher = hashlib.sha256()
    from gold_to_silver import to_silver, detection_image
    _, _, mcf, mhf = build.CFG["gold"]
    prot = binary_dilation(np.load(mcf.replace(".npy", "_stone.npy")) | np.load(mhf), iterations=40)
    C, Hh, a, mc = build.parts("gold", "medium", "none")
    wc = np.load("weight_centre_gold.npy"); wh = np.load("weight_halo_gold.npy")
    os.makedirs(f"{TUNER}/img", exist_ok=True); os.makedirs(f"{TUNER}/masks", exist_ok=True)
    for metal in ("gold", "silver"):   # same geometry for both now: silver is converted gold
        for name, mm in (("centre", wc), ("halo", wh), ("pair", a[..., 0])):
            Image.fromarray((np.clip(mm, 0, 1) * 255).round().astype(np.uint8)).crop(BOX).resize((W, H), Image.LANCZOS).save(f"{TUNER}/masks/{metal}-{name}.png", optimize=True)
    for k in build.K:
        gold = to_cream(Image.fromarray(np.clip(C[k] * (1 - a) + Hh[k] * a, 0, 255).astype(np.uint8)), prot)
        silver = to_silver(gold, detect_from=detection_image(gold, k))[0]
        for metal, im in (("gold", gold), ("silver", silver)):
            full = np.asarray(im); hasher.update(full.tobytes())
            Image.fromarray(full).crop(BOX).resize((W, H), Image.LANCZOS).save(f"{TUNER}/img/{metal}-{k}.webp", lossless=True, quality=100, method=6)
            lab = rgb_to_oklab(full.astype(np.float64) / 255)
            base["metals"][metal][k] = {"centre": {"lmed": float(np.median(lab[..., 0][wc > 0.5]))}, "halo": {"lmed": float(np.median(lab[..., 0][wh > 0.5]))}}
    base["baseImageHash"] = hasher.hexdigest()[:16]
    json.dump(base, open("tuner_base.json", "w"), indent=1); json.dump(base, open(f"{TUNER}/base.json", "w"), indent=1)
    print("tuner assets refreshed; republish the tuner page (see HANDOVER.md)")

if __name__ == "__main__":
    main()
