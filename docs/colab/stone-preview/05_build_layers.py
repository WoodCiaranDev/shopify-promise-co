"""Web assets: a full centre image per stone, plus a transparent halo overlay.
The browser stacks overlay on base, so 24 files per metal cover all 144 pairings."""
import numpy as np, os
from PIL import Image, ImageFilter
OUT="theme_assets"; os.makedirs(OUT, exist_ok=True)
W=1000
K=["january","february","march","april","may","june","july","august","september","october","november","december"]
CFG=[("gold","slots","photo/mask_halo.npy",True),("silver","slots_silver","photo/silver_mask_halo.npy",False)]
tot=0
for metal, src_dir, maskf, needs_resize in CFG:
    mh=np.load(maskf)
    m=Image.fromarray(mh.astype(np.uint8)*255)
    if needs_resize: m=m.resize((1600,1600),Image.LANCZOS)
    m=m.filter(ImageFilter.MaxFilter(45)).filter(ImageFilter.GaussianBlur(7)).resize((W,W),Image.LANCZOS)
    alpha=np.asarray(m).astype(np.uint8)
    for k in K:
        c=Image.open(f"{src_dir}/centre__{k}.jpg").convert("RGB").resize((W,W),Image.LANCZOS)
        p=f"{OUT}/colab-heirloom-{metal}-centre-{k}.jpg"; c.save(p,quality=86,optimize=True); tot+=os.path.getsize(p)
        h=Image.open(f"{src_dir}/halo__{k}.jpg").convert("RGB").resize((W,W),Image.LANCZOS)
        rgba=np.dstack([np.asarray(h), alpha])
        p=f"{OUT}/colab-heirloom-{metal}-halo-{k}.png"
        Image.fromarray(rgba,"RGBA").save(p,optimize=True); tot+=os.path.getsize(p)
n=len(os.listdir(OUT))
print(f"{n} assets, {tot/1024/1024:.1f} MB total, {tot/n/1024:.0f} KB average")
# prove a browser-style stack reproduces the composite
base=Image.open(f"{OUT}/colab-heirloom-gold-centre-july.jpg").convert("RGBA")
ov=Image.open(f"{OUT}/colab-heirloom-gold-halo-april.png")
Image.alpha_composite(base,ov).convert("RGB").save("stack_proof.jpg",quality=92)
print("stack_proof.jpg = ruby centre + diamond halo, composited the way the browser will")
