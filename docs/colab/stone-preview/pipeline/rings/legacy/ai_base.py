"""Make the Legacy base image: a sharp, high-resolution redraw of one client render via Gemini.

    OPENROUTER_API_KEY=... python ai_base.py renders/gold_c-april_h-april.png 3

Writes ai/{stem}_{n}.png at the model's native size, plus ai/{stem}_lanczos.png for comparison.
The chosen attempt becomes the single geometry source for all 288 images, so it is drawn once and
never per combination.
"""
import base64, io, json, os, sys, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ["OPENROUTER_API_KEY"]
MODEL = os.environ.get("AI_MODEL", "google/gemini-3-pro-image")
OUT = os.path.join(HERE, "ai")

PROMPT = (
    "Redraw this exact ring as a sharp, high-resolution studio product photograph. It is the same "
    "ring: keep its design, proportions, camera angle and framing exactly as they are. A gold signet "
    "ring seen from directly above, with a vertical (north-south) oval centre stone in a smooth gold "
    "bezel, a single row of fine round milgrain beads around that bezel, and a scalloped halo of "
    "exactly sixteen round white stones, each in its own round gold cup. Keep every stone colourless "
    "white, the same size and in the same position. Make the milgrain beads, bezel edges, cups and "
    "facets crisp and clean, with no blur, noise or smudging. Plain flat off-white background, no "
    "text, no props, no hands, no reflections on the background. Output only the photograph."
)

def b64(img):
    b = io.BytesIO(); img.save(b, "PNG"); return base64.b64encode(b.getvalue()).decode()

def call(src):
    body = {"model": MODEL, "prompt": PROMPT, "resolution": "4K", "aspect_ratio": "1:1",
            "input_references": [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64(src)}}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/images", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://thepromiseco.com", "X-Title": "Promise Co legacy base"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.load(r)

def main(src_path, attempts):
    os.makedirs(OUT, exist_ok=True)
    stem = os.path.splitext(os.path.basename(src_path))[0]
    src = Image.open(src_path).convert("RGB")
    src.resize((2400, 2400), Image.LANCZOS).save(os.path.join(OUT, f"{stem}_lanczos.png"))
    spend = 0.0
    for n in range(1, attempts + 1):
        resp = call(src)
        cost = float((resp.get("usage") or {}).get("cost") or 0); spend += cost
        d = next((x for x in resp.get("data") or [] if x.get("b64_json")), None)
        if not d:
            print(f"attempt {n}: no image ({json.dumps(resp)[:300]})"); continue
        img = Image.open(io.BytesIO(base64.b64decode(d["b64_json"]))).convert("RGB")
        path = os.path.join(OUT, f"{stem}_{n}.png"); img.save(path)
        print(f"attempt {n}: {img.size[0]}x{img.size[1]} -> {path}  ${cost:.3f}")
    print(f"{MODEL}: total ${spend:.3f}")

if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 3)
