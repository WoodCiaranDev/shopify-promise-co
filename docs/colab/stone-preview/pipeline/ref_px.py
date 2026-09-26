import numpy as np
from PIL import Image
from skimage.color import rgb2lab
def ref_px(n, sat_half=True):
    im=Image.open(f"refs/{n}.png").convert("RGB"); W,H=im.size
    lab=rgb2lab(np.asarray(im).astype(np.float64)/255); L,a,b=lab[...,0],lab[...,1],lab[...,2]; C=np.hypot(a,b)
    solid=(L<78)|(C>8); ys,xs=np.where(solid); x0,x1=np.percentile(xs,[0.5,99.5]); cx=(x0+x1)/2
    rows=np.where(solid[:,int(cx)-3:int(cx)+3].any(1))[0]; hy0,hy1=rows.min(),rows.max(); cy=(hy0+hy1)/2; ry=(hy1-hy0)/2; rx=ry*1.14
    yy,xx=np.mgrid[0:H,0:W]; r=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
    sh=solid&(r>1.1)&(np.abs(yy-cy)<ry*0.2); metal=np.median(lab[sh],axis=0); silver=np.hypot(*metal[1:])<8
    abd=np.linalg.norm(lab[...,1:]-metal[1:],axis=-1); st=(r>0.64)&(r<0.97)&(abd>(7 if silver else 13))&((L<90)|(C>6))
    if sat_half: st&=C>=np.percentile(C[st],50)
    return lab[st]
def med_lch(px):
    C=np.hypot(px[:,1],px[:,2]); h=np.median(np.arctan2(px[:,2],px[:,1]))
    return np.array([np.median(px[:,0]), np.median(C), h])
