"""Sharpen the 200px picker centre stones with one Gemini redraw each, kept faithful to the picker image.

    OPENROUTER_API_KEY=... python ai_centres.py may [june ...]

Each picker stone (icons_solid/{k}.png) is sent, at its own proportions, on a flat canvas (grey, or dark
for a pale stone whose edge would merge with grey) and
redrawn once at 4K. The redrawn stone is fitted back to the picker stone's bounds, cut out with the
picker image's own outline, and its colours quantile-matched to the picker image, so it keeps the
approved cut, outline and colour and only gains detail. Writes centres/{k}.png (RGBA, 1000px on the
long side) and centres/{k}_compare.jpg.
"""
import base64, io, json, os, sys, urllib.request, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_opening, binary_fill_holes, label
from skimage.color import rgb2lab, lab2rgb

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.join(HERE, "..", "..")
OUT = os.path.join(HERE, "centres")
KEY = os.environ["OPENROUTER_API_KEY"]
MODEL = os.environ.get("AI_MODEL", "google/gemini-3-pro-image")
SIZE, STONE = 1400, 1000
BACKGROUND = {"june": (40, 40, 40)}
GREY = (128, 128, 128)

PROMPT = (
    "Redraw this exact gemstone as a sharp, high-resolution studio photograph. It is the same stone: keep "
    "its oval outline, size, position, framing, cut, facet pattern, colour and lighting exactly as they "
    "are. Make the facet edges crisp and clean, with no blur, noise or smudging. Keep the flat "
    "background. Do not add a setting, metal, shadow, reflection, text or anything else. Output only the "
    "photograph."
)

def call(img):
    b = io.BytesIO(); img.save(b, "PNG")
    body = {"model": MODEL, "prompt": PROMPT, "resolution": "4K", "aspect_ratio": "1:1",
            "input_references": [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()}}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/images", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://thepromiseco.com", "X-Title": "Promise Co legacy centres"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.load(r)

def match_colour(src, ref, alpha):
    """Quantile-map L, a and b of the redraw onto the picker image, inside the stone."""
    S, R = rgb2lab(src / 255), rgb2lab(ref / 255)
    m = alpha > 0.9
    q = np.linspace(0, 100, 201)
    out = S.copy()
    for c in range(3):
        out[..., c] = np.interp(S[..., c], np.percentile(S[..., c][m], q), np.percentile(R[..., c][m], q))
    return np.clip(lab2rgb(out), 0, 1) * 255

def stone_box(a, bg, tol=24):
    m = binary_opening(np.abs(a - np.array(bg)).max(-1) > tol, iterations=3)
    lab_, _ = label(binary_fill_holes(m))
    ys, xs = np.nonzero(lab_ == lab_[a.shape[0] // 2, a.shape[1] // 2])
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def main(months):
    os.makedirs(OUT, exist_ok=True)
    spend = 0.0
    for k in months:
        icon = Image.open(os.path.join(PIPE, "icons_solid", f"{k}.png")).convert("RGBA")
        icon = icon.crop(Image.fromarray(np.asarray(icon)[..., 3]).point(lambda v: 255 if v > 128 else 0).getbbox())
        s = STONE / max(icon.size)
        big = icon.resize((round(icon.width * s), round(icon.height * s)), Image.LANCZOS)
        alpha = np.asarray(big)[..., 3].astype(np.float64) / 255
        ref = np.asarray(big)[..., :3].astype(np.float64)
        bg = BACKGROUND.get(k, GREY)
        canvas = Image.new("RGB", (SIZE, SIZE), bg)
        canvas.paste(big, ((SIZE - big.width) // 2, (SIZE - big.height) // 2), big)
        resp = call(canvas)
        spend += float((resp.get("usage") or {}).get("cost") or 0)
        d = next((x for x in resp.get("data") or [] if x.get("b64_json")), None)
        if not d:
            print(f"{k}: no image ({json.dumps(resp)[:200]})"); continue
        ai = Image.open(io.BytesIO(base64.b64decode(d["b64_json"]))).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        box = stone_box(np.asarray(ai).astype(np.float64), bg)
        w, h = box[2] - box[0], box[3] - box[1]
        if abs((w / h) / (big.width / big.height) - 1) > 0.02:
            print(f"{k}: redraw stone {w}x{h} does not match the picker stone's proportions, skipped"); continue
        ai = np.asarray(ai.crop(box).resize(big.size, Image.LANCZOS)).astype(np.float64)
        rgb = match_colour(ai, ref, alpha)
        a8 = (gaussian_filter(alpha, 0.6) * 255).round().astype(np.uint8)
        Image.fromarray(np.dstack([rgb.round().astype(np.uint8), a8])).save(os.path.join(OUT, f"{k}.png"))
        cmp = Image.new("RGB", (2 * big.width, big.height), (255, 255, 255))
        cmp.paste(Image.fromarray(ref.astype(np.uint8)), (0, 0), big); cmp.paste(Image.fromarray(rgb.round().astype(np.uint8)), (big.width, 0), big)
        cmp.save(os.path.join(OUT, f"{k}_compare.jpg"), quality=88)
        print(f"{k}: picker {big.size}, redraw stone {w}x{h} (aspect {w / h:.3f} vs {big.width / big.height:.3f})")
    print(f"{MODEL}: total ${spend:.3f}")

if __name__ == "__main__":
    main(sys.argv[1:])
