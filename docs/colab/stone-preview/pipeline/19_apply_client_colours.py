"""Apply the client's Heirloom Stone Tuner settings and rebuild the 288 preview images.

Usage: python 19_apply_client_colours.py heirloom-stone-colours.json [assets dir]
The JSON comes from the tuner page (Download or Copy JSON). It is validated first: unknown
keys are rejected, values clamped to the slider ranges, and settings made against different
base images (baseImageHash) are refused, so stale settings can't be applied by mistake.
"""
import json, sys, itertools, numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
import build
from cream_bg import to_cream

K = build.K
RANGES = {"hue": (-30, 30), "saturation": (-0.5, 0.5), "brightness": (-0.2, 0.2), "depth": (-0.4, 0.4)}

def validate(d, base_hash):
    if d.get("version") != 1 or d.get("space") != "OKLCH":
        raise SystemExit("Not a tuner export (version/space mismatch).")
    if d.get("baseImageHash") != base_hash:
        print(f"WARNING: settings were made on earlier base images ({d.get('baseImageHash')} vs {base_hash}); applying them to the current ones.")
    extra = set(d) - {"version", "space", "baseImageHash", "updated", "stones"}
    if extra: raise SystemExit(f"Unknown keys: {sorted(extra)}")
    out = {"stones": {}}
    for k in K:
        s = d["stones"].get(k, {})
        if set(s) - {"centre", "halo"}: raise SystemExit(f"Unknown keys in {k}: {sorted(set(s) - {'centre','halo'})}")
        out["stones"][k] = {}
        for r in ("centre", "halo"):
            v = s.get(r, {})
            if set(v) - set(RANGES) - {"notes"}: raise SystemExit(f"Unknown keys in {k}.{r}")
            out["stones"][k][r] = {key: float(min(hi, max(lo, v.get(key, 0) or 0))) for key, (lo, hi) in RANGES.items()}
            if v.get("notes"): print(f"  note {k} {r}: {v['notes']}")
    return out

if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "../../../assets"
    base = json.load(open("tuner_base.json"))
    build.CLIENT_COLOURS = validate(data, base["baseImageHash"])
    build._cache.clear()
    for metal in ("gold", "silver"):
        _, _, mcf, mhf = build.CFG[metal]
        prot = binary_dilation(np.load(mcf) | np.load(mhf), iterations=40)
        for c, h in itertools.product(K, K):
            to_cream(build.combo(metal, c, h, "medium", "none"), prot).save(
                f"{out_dir}/colab-heirloom-{metal}-{c}-{h}.jpg", quality=84, optimize=True, progressive=True)
    print("288 images rebuilt with the client's colours")
