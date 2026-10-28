"""Put the sharpened picker centre stones (rings/legacy/centres/{k}.png, see rings/legacy/ai_centres.py)
into the committed Heirloom images, leaving everything outside the centre stone exactly as approved.

    python sharpen_heirloom_centres.py

Silver is converted gold with the centre stone protected, so the same placement is right for both metals.
The client's Heirloom settings make no centre adjustments, so nothing else needs reapplying. Rewrites
assets/colab-heirloom-*.jpg and colab-heirloom-version.txt.
"""
import os, sys, glob, hashlib, itertools, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, HERE)
from centre_real import place_centre, cover_scale

ASSETS = os.path.join(HERE, "..", "..", "..", "..", "assets")
K = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

def main():
    stone = np.load("photo/mask_centre_stone.npy")
    weight = np.load("weight_centre_gold.npy")
    icons = {k: f"rings/legacy/centres/{k}.png" for k in K}
    cover = {k: cover_scale(p, stone) for k, p in icons.items()}
    for metal, c, h in itertools.product(("gold", "silver"), K, K):
        path = f"{ASSETS}/colab-heirloom-{metal}-{c}-{h}.jpg"
        img = Image.open(path).convert("RGB")
        place_centre(img, icons[c], stone, weight, cover=cover[c], sharpen=False).save(path, quality=84, optimize=True, progressive=True)
    digest = hashlib.sha256()
    for f in sorted(glob.glob(f"{ASSETS}/colab-heirloom-*-*-*.jpg")): digest.update(open(f, "rb").read())
    open(f"{ASSETS}/colab-heirloom-version.txt", "w").write(digest.hexdigest()[:16] + "\n")
    print("288 Heirloom images given sharpened centres; version", digest.hexdigest()[:16])

if __name__ == "__main__":
    main()
