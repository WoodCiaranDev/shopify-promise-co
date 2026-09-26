"""Per-slot generation: 12 centre variants + 12 halo variants, not 144 combinations.

Any of the 144 pairings is then composited from two of these 24 images, so cost
is additive. Output size is asserted and retried, because Gemini silently ignores
the requested resolution some of the time.
"""
import base64, io, json, os, sys, time, urllib.request
import numpy as np
from PIL import Image

MODEL = os.environ.get("AI_MODEL", "google/gemini-3.1-flash-image")
KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
if not KEY: sys.exit("no OPENROUTER_API_KEY")
SIZE, WANT = 1600, 2048
OUT = "slots"
os.makedirs(OUT, exist_ok=True)

src = Image.open("client/real07.jpg").convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)

STONES = [
    ("january","a deep red garnet"), ("february","a medium purple amethyst"),
    ("march","a pale sky-blue aquamarine"), ("april","a colourless white diamond"),
    ("may","a rich deep green emerald"), ("june","a soft pale lilac lavender stone"),
    ("july","a vivid pinkish-red ruby"), ("august","a bright yellow-green apple-green peridot"),
    ("september","a rich royal blue sapphire"), ("october","a soft rose pink stone"),
    ("november","a warm champagne-brown topaz"), ("december","a violet-blue tanzanite"),
]
NEUTRAL = "colourless white diamonds"
BASE = ("Edit this product photograph of a gold halo ring. {what} "
        "Keep everything else pixel-for-pixel identical - the yellow gold metal, the bezel and "
        "claws, the band, the white background, the shadow, the camera angle, the lighting and "
        "the framing must not change at all. Photorealistic jewellery product photography, "
        "faceted transparent gemstones with realistic internal reflections.")

def b64(img):
    b = io.BytesIO(); img.save(b, "JPEG", quality=95)
    return base64.b64encode(b.getvalue()).decode()

def call(prompt):
    body = {"model": MODEL, "prompt": prompt, "resolution": "2K", "aspect_ratio": "1:1",
            "input_references": [{"type": "image_url",
                                  "image_url": {"url": "data:image/jpeg;base64," + b64(src)}}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/images",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://thepromiseco.com", "X-Title": "Promise Co slots"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)

def image_of(resp):
    for d in resp.get("data") or []:
        if d.get("b64_json"):
            return Image.open(io.BytesIO(base64.b64decode(d["b64_json"]))).convert("RGB")
    raise RuntimeError(json.dumps(resp)[:400])

spend, retries = [], 0
def generate(path, prompt, label):
    global retries
    if os.path.exists(path):
        print(f"  {label:<28} already done"); return
    for attempt in (1, 2):
        resp = call(prompt)
        img = image_of(resp)
        spend.append(float((resp.get("usage") or {}).get("cost") or 0))
        if img.size[0] >= WANT: break
        retries += 1
        print(f"  {label:<28} got {img.size[0]}px, retrying")
        time.sleep(1)
    img.resize((SIZE, SIZE), Image.LANCZOS).save(path, quality=94)
    print(f"  {label:<28} ok ({img.size[0]}px native)")

print("CENTRE set - centre stone varies, halo held colourless")
for k, desc in STONES:
    generate(f"{OUT}/centre__{k}.jpg",
             BASE.format(what=f"Replace the gemstones: make the large oval centre stone {desc}, "
                              f"and make all sixteen small round halo stones {NEUTRAL}."), k)
print("\nHALO set - halo varies, centre held colourless")
for k, desc in STONES:
    generate(f"{OUT}/halo__{k}.jpg",
             BASE.format(what=f"Replace the gemstones: make the large oval centre stone a "
                              f"colourless white diamond, and make all sixteen small round halo stones {desc}."), k)

print(f"\nspend ${sum(spend):.4f} over {len(spend)} calls ({retries} retries)")
print(f"these 24 images cover all {len(STONES)**2} combinations by compositing")
