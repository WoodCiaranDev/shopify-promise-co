import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from build import CFG, K, load, parts
from halo_tone import metal_colour
from shade import shade
NAMES = dict(zip(K, ["Garnet","Amethyst","Aquamarine","Diamond simulant","Emerald","Lavender",
                     "Ruby","Apple green","Sapphire","Pink","Champagne","Tanzanite"]))
STEPS = [-2, -1, 0, 1, 2, 3]; LETTERS = "ABCDEF"
def make(metal, rec, out):
    d, src, mcf, mhf = CFG[metal]; mc = np.load(mcf); mh = np.load(mhf)
    ml = metal_colour(load(src), mc, mh)
    C, H, a, _ = parts(metal, "medium", "none")
    F = "/System/Library/Fonts/Supplemental/"
    h1 = ImageFont.truetype(F+"Arial Bold.ttf", 30); h2 = ImageFont.truetype(F+"Arial Bold.ttf", 20)
    tx = ImageFont.truetype(F+"Arial.ttf", 16); lt = ImageFont.truetype(F+"Arial Bold.ttf", 22)
    box = (480, 545, 1120, 1095); cw, ch = 240, 206; LW = 230; PAD = 40
    W = PAD*2 + LW + len(STEPS)*(cw+12); H_ = 230 + (len(K)-1)*(ch+22)
    s = Image.new("RGB", (W, H_), "white"); dr = ImageDraw.Draw(s)
    dr.text((PAD, 28), f"Choose the halo shade for each birthstone  ({metal.title()})", fill=(20,20,20), font=h1)
    dr.text((PAD, 74), "Centre stone stays the same. Halo goes from darker (A) to lighter (F); C is how it looks now. Diamond simulant has no colour to adjust.", fill=(90,90,90), font=tx)
    dr.text((PAD, 98), "Small stones naturally read lighter than the centre, most for pale colours. ★ marks our research-based suggestion.", fill=(90,90,90), font=tx)
    for j, L in enumerate(LETTERS):
        dr.text((PAD + LW + j*(cw+12) + cw//2 - 8, 150), L, fill=(20,20,20), font=lt)
    ROWS = [k for k in K if k != "april"]
    for i, k in enumerate(ROWS):
        y = 190 + i*(ch+22)
        dr.text((PAD, y + ch//2 - 12), f"{i+1:02d}  {NAMES[k]}", fill=(20,20,20), font=h2)
        for j, t in enumerate(STEPS):
            hal = np.asarray(shade(Image.fromarray(H[k].astype(np.uint8)), mh, ml, k, t)).astype(np.float32)
            im = Image.fromarray((C[k]*(1-a) + hal*a).clip(0,255).astype(np.uint8)).crop(box).resize((cw, ch), Image.LANCZOS)
            x = PAD + LW + j*(cw+12); s.paste(im, (x, y))
            dr.rectangle([x+4, y+4, x+28, y+30], fill=(255,255,255))
            dr.text((x+9, y+6), LETTERS[j], fill=(20,20,20), font=h2)
            if rec.get(k) == LETTERS[j]:
                for o in range(4): dr.rectangle([x-5+o, y-5+o, x+cw+4-o, y+ch+4-o], outline=(196,150,40))
    s.save(out, quality=90); return s.size
