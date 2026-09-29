"""Build centre + halo stone masks for the real product photograph.

The CAD gives the halo's structure (16 stones, 5.24 mm radius, 2.71 mm across);
the photograph gives the scale. Rather than trust either blindly, the ring's
phase, radius and stone size are fitted to the image by maximising stone-pixel
coverage while penalising any gold caught inside the discs.
"""
import numpy as np
from PIL import Image

im = Image.open("client/real07.jpg").convert("RGB")
A = np.asarray(im).astype(np.float32)
H, W, _ = A.shape
R, G, B = A[..., 0], A[..., 1], A[..., 2]
mx, mn = A.max(2), A.min(2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
val = mx / 255.0

green = (G > R + 12) & (G > B + 6) & (sat > 0.18)
ys, xs = np.where(green)
CX, CY = xs.mean(), ys.mean()
SX, SY = (xs.max() - xs.min()) / 7.96, (ys.max() - ys.min()) / 5.97
print(f"centre ({CX:.0f},{CY:.0f})  scale {SX:.1f} x {SY:.1f} px/mm")

def fill_convex(mask):
    out = mask.copy()
    for axis in (1, 0):
        m, o = (mask, out) if axis == 1 else (mask.T, out.T)
        for i in range(m.shape[0]):
            idx = np.where(m[i])[0]
            if len(idx) > 1: o[i, idx.min():idx.max() + 1] = True
    return out

yy, xx = np.mgrid[0:H, 0:W]
centre_mask = fill_convex(green) & ((((xx - CX) / (3.98 * SX)) ** 2 + ((yy - CY) / (2.985 * SY)) ** 2) <= 1.0)

background = (val > 0.95) & (sat < 0.07)
gold = (sat > 0.40) & ((R - B) > 80)
stoneish = ~background & ~gold & ~centre_mask & (val > 0.48) & (sat < 0.46)

D = 4
sm_stone, sm_gold = stoneish[::D, ::D], gold[::D, ::D]
gy, gx = np.mgrid[0:sm_stone.shape[0], 0:sm_stone.shape[1]]
px, py = gx * D, gy * D

best = None
for phase in np.arange(0, 22.5, 1.5):
    for r_mm in np.arange(4.7, 6.0, 0.1):
        for rho in np.arange(1.05, 1.55, 0.05):
            cov = np.zeros(sm_stone.shape, bool)
            for k in range(16):
                t = np.radians(phase + k * 22.5)
                hx, hy = CX + r_mm * SX * np.cos(t), CY + r_mm * SY * np.sin(t)
                cov |= ((px - hx) ** 2 + (py - hy) ** 2) <= (rho * (SX + SY) / 2) ** 2
            score = (cov & sm_stone).sum() - 2.2 * (cov & sm_gold).sum()
            if best is None or score > best[0]:
                best = (score, phase, r_mm, rho)
score, phase, r_mm, rho = best
print(f"fit: phase {phase:.1f}deg  halo radius {r_mm:.2f}mm (CAD 5.24)  "
      f"stone {rho*2:.2f}mm across (CAD 2.71)  score {score:.0f}")

halo_mask = np.zeros((H, W), bool)
for k in range(16):
    t = np.radians(phase + k * 22.5)
    hx, hy = CX + r_mm * SX * np.cos(t), CY + r_mm * SY * np.sin(t)
    halo_mask |= ((xx - hx) ** 2 + (yy - hy) ** 2) <= (rho * (SX + SY) / 2) ** 2
halo_mask &= ~gold & ~background & ~centre_mask
print(f"centre mask {int(centre_mask.sum())}px   halo mask {int(halo_mask.sum())}px")

np.save("photo/mask_centre.npy", centre_mask)
np.save("photo/mask_halo.npy", halo_mask)

vis = A.copy()
vis[centre_mask] = vis[centre_mask] * 0.35 + np.array([255, 0, 120]) * 0.65
vis[halo_mask] = vis[halo_mask] * 0.35 + np.array([0, 190, 255]) * 0.65
Image.fromarray(vis.astype(np.uint8)).resize((760, 760), Image.LANCZOS).save("mask_check.jpg", quality=92)
print("wrote mask_check.jpg")
