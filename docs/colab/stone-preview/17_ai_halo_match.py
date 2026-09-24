"""Recolour the halo stones of a generated halo slot to match a client reference photo, via Gemini.

Input 1: our halo slot image (centre colourless, halo already the right birthstone).
Input 2: the client's photo whose halo stones are the approved colour.
Only the sixteen small halo stones may change; geometry must stay pixel-identical so the
result can drop straight into the compositing pipeline.
"""
import base64, io, json, os, sys, time, urllib.request
from PIL import Image

KEY = os.environ["OPENROUTER_API_KEY"]
MODEL = os.environ.get("AI_MODEL", "google/gemini-3-pro-image")
SIZE, WANT = 1600, 2048

def b64(img, q=95):
    b = io.BytesIO(); img.save(b, "JPEG", quality=q); return base64.b64encode(b.getvalue()).decode()

def call(src, ref, prompt):
    body = {"model": MODEL, "prompt": prompt, "resolution": "2K", "aspect_ratio": "1:1",
            "input_references": [
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64(src)}},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64(ref)}}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/images", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://thepromiseco.com", "X-Title": "Promise Co halo match"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)

def run(src_path, ref_path, out_path, stone_desc):
    src = Image.open(src_path).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    ref = Image.open(ref_path).convert("RGB")
    prompt = (f"Edit the FIRST image only. Recolour the sixteen small round halo stones around the "
              f"centre stone so they exactly match the {stone_desc} small halo stones in the SECOND image: "
              "the same body colour, the same lightness, the same brightness and sparkle, the same "
              "fresh, light, luminous look. Match the second image's halo stones as precisely as possible. "
              "Do not change anything else in the first image at all - the large centre stone, the gold "
              "metal, the bezels and claws, the band, the white background, the shadow, the camera angle, "
              "the stone positions and sizes and the framing must stay pixel-for-pixel identical. "
              "Output only the edited first image.")
    spend = 0.0
    for attempt in (1, 2):
        resp = call(src, ref, prompt)
        spend += float((resp.get("usage") or {}).get("cost") or 0)
        d = next((x for x in resp.get("data") or [] if x.get("b64_json")), None)
        if not d: raise SystemExit(json.dumps(resp)[:500])
        img = Image.open(io.BytesIO(base64.b64decode(d["b64_json"]))).convert("RGB")
        if img.size[0] >= WANT: break
        print(f"  got {img.size[0]}px, retrying")
    img.resize((SIZE, SIZE), Image.LANCZOS).save(out_path, quality=95)
    print(f"{MODEL}: {img.size[0]}px native -> {out_path}  cost ${spend:.3f}")

if __name__ == "__main__":
    run(*sys.argv[1:5])
