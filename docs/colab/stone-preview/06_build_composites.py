import os, glob
from PIL import Image
D=os.path.expanduser("~/Downloads/promise-co-birthstones")
OUT="composites"; os.makedirs(OUT, exist_ok=True)
SRC=[("gold", f"{D}/all-144-combinations"), ("silver", f"{D}/silver/all-144-combinations")]
n=0; tot=0
for metal, d in SRC:
    for p in sorted(glob.glob(f"{d}/*.jpg")):
        base=os.path.basename(p)[:-4]          # centre__halo
        centre, halo = base.split("__")
        im=Image.open(p).convert("RGB")
        if im.size != (1000,1000): im=im.resize((1000,1000), Image.LANCZOS)
        q=f"{OUT}/colab-heirloom-{metal}-{centre}-{halo}.jpg"
        im.save(q, quality=86, optimize=True, progressive=True)
        tot+=os.path.getsize(q); n+=1
print(f"{n} composites, {tot/1024/1024:.1f} MB on disk, {tot/n/1024:.0f} KB average")
