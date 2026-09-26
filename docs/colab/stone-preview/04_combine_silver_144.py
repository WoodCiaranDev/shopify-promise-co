import numpy as np, glob, os, itertools
from PIL import Image, ImageFilter, ImageDraw, ImageFont
SZ=1600
src=np.asarray(Image.open("packshots/silver.jpg").convert("RGB").resize((SZ,SZ),Image.LANCZOS)).astype(np.float32)
mc=np.load("photo/silver_mask_centre.npy"); mh=np.load("photo/silver_mask_halo.npy")
st=Image.fromarray(((mc|mh).astype(np.uint8))*255)
far=np.array(st.filter(ImageFilter.MaxFilter(101)))>127
nb=(src.max(2)<244)|(src.max(2)-src.min(2)>12); metal=nb&~far
def sil(A): return (A.max(2)<240)|(A.max(2)-A.min(2)>14)
ys,xs=np.where(sil(src)); W0=xs.max()-xs.min()
bad=[]; ds=[]
for p in sorted(glob.glob("slots_silver/*.jpg")):
    o=np.asarray(Image.open(p).convert("RGB").resize((SZ,SZ),Image.LANCZOS)).astype(np.float32)
    d=float(np.abs(src-o).mean(2)[metal].mean()); ds.append(d)
    ys,xs=np.where(sil(o)); w=int(xs.max()-xs.min())
    if not (d<6 and abs(w-W0)<60): bad.append(os.path.basename(p))
print(f"SILVER FINAL: {len(ds)}/24  median drift {np.median(ds):.1f}  failures: {bad or 'NONE'}")
m=Image.fromarray(mh.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(45)).filter(ImageFilter.GaussianBlur(7))
a=np.asarray(m).astype(np.float32)/255.0
K=["january","february","march","april","may","june","july","august","september","october","november","december"]
C={k: np.asarray(Image.open(f"slots_silver/centre__{k}.jpg").convert("RGB").resize((SZ,SZ),Image.LANCZOS)).astype(np.float32) for k in K}
H={k: np.asarray(Image.open(f"slots_silver/halo__{k}.jpg").convert("RGB").resize((SZ,SZ),Image.LANCZOS)).astype(np.float32) for k in K}
for c,h in itertools.product(K,K):
    out=C[c]*(1-a[...,None])+H[h]*a[...,None]
    Image.fromarray(out.astype(np.uint8)).resize((1000,1000),Image.LANCZOS).save(f"combos_silver/{c}__{h}.jpg",quality=88,optimize=True)
SH=["Gar","Ame","Aqu","Dia","Eme","Lav","Rub","App","Sap","Pnk","Cha","Tan"]
cs=118; PAD=40
sheet=Image.new("RGB",(PAD+cs*12+10,PAD+cs*12+10),(255,255,255)); d=ImageDraw.Draw(sheet)
try:
    f=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",11)
    fb=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf",11)
except Exception: f=fb=ImageFont.load_default()
d.text((4,4),"STERLING SILVER  centre \\ halo",fill=(20,20,20),font=fb)
for j,s in enumerate(SH): d.text((PAD+j*cs+cs//2-10,22),s,fill=(60,60,60),font=f)
for i,c in enumerate(K):
    d.text((4,PAD+i*cs+cs//2-6),SH[i],fill=(60,60,60),font=f)
    for j,h in enumerate(K):
        sheet.paste(Image.open(f"combos_silver/{c}__{h}.jpg").convert("RGB").resize((cs-3,cs-3),Image.LANCZOS),(PAD+j*cs,PAD+i*cs))
sheet.save("combo_full_matrix_silver.jpg",quality=92); print("rebuilt")
