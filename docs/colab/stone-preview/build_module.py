import numpy as np, os, sys, itertools
from PIL import Image, ImageFilter
from rim_fix import fix, SZ
from halo_tone import adjust, metal_colour
from icon_match import icon_stats, match, light_part_stats
from halo_v2 import repair, match_distribution
from ref_px import ref_px
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
    IC={k:icon_stats(f"icons/{k}.png") for k in K}
    C={k:match((fix(load(f"{d}/centre__{k}.jpg"),mc,rim) if rim!="none" else load(f"{d}/centre__{k}.jpg")),mc,IC[k]) for k in K}
    # Halo colour, v2: whole-distribution match (lightness, chroma and hue quantiles) onto the
    # client's reference halo stones where supplied; otherwise onto this stone's own centre,
    # lifted to its lighter facets. Diamond simulant keeps the AI's colourless stones.
    CLIENT={"august":3,"march":4,"june":7,"july":8,"september":9}
    from skimage.color import rgb2lab
    from scipy.ndimage import binary_erosion
    core=binary_erosion(mc,iterations=10)
    def halo_target_px(k):
        if k in CLIENT: return ref_px(CLIENT[k], sat_half=False)
        lab=rgb2lab(np.asarray(C[k]).astype(np.float64)/255)[core]
        L=lab[:,0]; lab[:,0]=np.clip(L+(np.percentile(L,75)-np.median(L)),0,100)
        return lab
    H={}
    for k in K:
        tp=f"transplants/{metal}_{k}.jpg"
        if os.path.exists(tp):
            # real client stones transplanted into our settings (see transplant.py)
            H[k]=adjust(Image.open(tp).convert("RGB"),mh,ml,k,halo); continue
        img,_=repair(load(f"{d}/halo__{k}.jpg"),metal)
        if k!="april": img=match_distribution(img,metal,halo_target_px(k))
        H[k]=adjust(img,mh,ml,k,halo)
    # keep the halo blend off the centre stone entirely
    a=a*(1-np.asarray(Image.fromarray(mc.astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[...,None]/255)
    C={k:np.asarray(v).astype(np.float32) for k,v in C.items()}; H={k:np.asarray(v).astype(np.float32) for k,v in H.items()}
    _cache[key]=(C,H,a,mc); return _cache[key]
def combo(metal,c,h,rim="medium",halo="none"):
    C,H,a,_=parts(metal,rim,halo)
    return Image.fromarray((C[c]*(1-a)+H[h]*a).clip(0,255).astype(np.uint8))
