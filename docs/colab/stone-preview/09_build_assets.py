import numpy as np, os, sys, itertools
from PIL import Image, ImageFilter
from importlib import import_module
fix = import_module('07_rim_fix').fix; SZ = import_module('07_rim_fix').SZ
# fix, SZ
_h = import_module('08_halo_tone'); adjust, metal_colour = _h.adjust, _h.metal_colour
DL="/Users/ciaranwood/Downloads/promise-co-birthstones"
K=["january","february","march","april","may","june","july","august","september","october","november","december"]
CFG={"gold":(f"{DL}/per-slot-source","client/real07.jpg","photo/mask_centre.npy","photo/mask_halo.npy"),
     "silver":(f"{DL}/silver/per-slot-source","packshots/silver.jpg","photo/silver_mask_centre.npy","photo/silver_mask_halo.npy")}
def load(p): return Image.open(p).convert("RGB").resize((SZ,SZ),Image.LANCZOS)
_cache={}
def parts(metal, rim="medium", halo="none"):
    key=(metal,rim,halo)
    if key in _cache: return _cache[key]
    d,src,mcf,mhf=CFG[metal]; mc=np.load(mcf); mh=np.load(mhf)
    ml=metal_colour(load(src),mc,mh)
    a=Image.fromarray(mh.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(45)).filter(ImageFilter.GaussianBlur(7))
    a=np.asarray(a).astype(np.float32)[...,None]/255
    C={k:(fix(load(f"{d}/centre__{k}.jpg"),mc,rim) if rim!="none" else load(f"{d}/centre__{k}.jpg")) for k in K}
    H={k:adjust(load(f"{d}/halo__{k}.jpg"),mh,ml,k,halo) for k in K}
    C={k:np.asarray(v).astype(np.float32) for k,v in C.items()}; H={k:np.asarray(v).astype(np.float32) for k,v in H.items()}
    _cache[key]=(C,H,a,mc); return _cache[key]
def combo(metal,c,h,rim="medium",halo="none"):
    C,H,a,_=parts(metal,rim,halo)
    return Image.fromarray((C[c]*(1-a)+H[h]*a).clip(0,255).astype(np.uint8))

if __name__ == "__main__":
    # Rebuild the 288 shipped assets. Usage: python 09_build_assets.py [rim preset] [halo level]
    import itertools
    rim = sys.argv[1] if len(sys.argv) > 1 else "medium"
    halo = sys.argv[2] if len(sys.argv) > 2 else "none"
    OUT = sys.argv[3] if len(sys.argv) > 3 else "../../../assets"
    for metal in ("gold", "silver"):
        for c, h in itertools.product(K, K):
            combo(metal, c, h, rim, halo).resize((1000, 1000), Image.LANCZOS).save(
                f"{OUT}/colab-heirloom-{metal}-{c}-{h}.jpg", quality=86, optimize=True, progressive=True)
