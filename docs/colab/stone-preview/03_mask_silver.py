"""Masks for the Sterling Silver packshot.

Silver metal and colourless halo stones are hard to separate by colour, so the
halo is placed from CAD geometry instead: the centre stone gives the px/mm scale,
and the same halo radius and stone size fitted on the gold shot are reused.
"""
import numpy as np
from PIL import Image

SZ=1600
im=Image.open("packshots/silver.jpg").convert("RGB").resize((SZ,SZ),Image.LANCZOS)
A=np.asarray(im).astype(np.float32)
R,G,B=A[...,0],A[...,1],A[...,2]
mx,mn=A.max(2),A.min(2)
sat=np.where(mx>0,(mx-mn)/np.maximum(mx,1),0)
val=mx/255.0

# Centre stone is the aquamarine: blue/cyan dominant and clearly saturated.
blue=(B>R+14)&(sat>0.16)&(val>0.35)
ys,xs=np.where(blue)
print(f"blue px {blue.sum():,}  bbox x[{xs.min()},{xs.max()}] y[{ys.min()},{ys.max()}]")
CX,CY=xs.mean(),ys.mean()
SX=(xs.max()-xs.min())/7.96; SY=SX*40.5/43.0  # the y bbox catches reflections; keep the gold aspect
print(f"centre ({CX:.0f},{CY:.0f})  scale {SX:.1f} x {SY:.1f} px/mm   (gold was 43.0 x 40.5)")

def fill_convex(m):
    out=m.copy()
    for ax in (1,0):
        a,o=(m,out) if ax==1 else (m.T,out.T)
        for i in range(a.shape[0]):
            idx=np.where(a[i])[0]
            if len(idx)>1: o[i,idx.min():idx.max()+1]=True
    return out

yy,xx=np.mgrid[0:SZ,0:SZ]
centre_mask=fill_convex(blue)&((((xx-CX)/(3.98*SX))**2+((yy-CY)/(2.985*SY))**2)<=1.0)

# Same halo geometry fitted on the gold shot, rescaled to this image.
R_MM, RHO_MM, PHASE = 5.65, 1.05, 0.0
halo_mask=np.zeros((SZ,SZ),bool)
for k in range(16):
    t=np.radians(PHASE+k*22.5)
    hx,hy=CX+R_MM*SX*np.cos(t), CY+R_MM*SY*np.sin(t)
    halo_mask|=((xx-hx)**2+(yy-hy)**2)<=(RHO_MM*(SX+SY)/2)**2
halo_mask&=~centre_mask
print(f"centre mask {int(centre_mask.sum()):,}px   halo mask {int(halo_mask.sum()):,}px")

np.save("photo/silver_mask_centre.npy",centre_mask)
np.save("photo/silver_mask_halo.npy",halo_mask)
vis=A.copy()
vis[centre_mask]=vis[centre_mask]*0.35+np.array([255,0,120])*0.65
vis[halo_mask]=vis[halo_mask]*0.35+np.array([255,140,0])*0.65
Image.fromarray(vis.astype(np.uint8)).resize((780,780),Image.LANCZOS).save("silver_mask_check.jpg",quality=93)
print("wrote silver_mask_check.jpg")
