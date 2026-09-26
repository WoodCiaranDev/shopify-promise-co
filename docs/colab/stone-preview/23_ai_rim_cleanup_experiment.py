"""Protected AI rim clean-up: Gemini tidies the bezel rims around the halo stones, then only a
thin rim band is taken from its output. Every stone interior is restored from the real stones,
so the AI cannot change any facet or cut."""
import base64, io, json, os, sys, urllib.request, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.registration import phase_cross_correlation
from skimage.color import rgb2gray

KEY = os.environ["OPENROUTER_API_KEY"]
PROMPT = ("Edit this jewellery product photograph. The sixteen small round stones around the centre "
          "stone must stay exactly as they are - do not change their colour, facets, cut, size or position. "
          "Only refine the thin polished metal bezel rim that wraps each small stone so every stone looks "
          "naturally set into the metal, with a clean continuous rim and no seams, slivers or halos. "
          "Keep everything else pixel-for-pixel identical: the centre stone, the metal, the prongs, the "
          "background, the lighting, the camera angle and the framing.")

def call(img, model):
    b = io.BytesIO(); img.save(b, "JPEG", quality=95)
    body = {"model": model, "prompt": PROMPT, "resolution": "2K", "aspect_ratio": "1:1",
            "input_references": [{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()}}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/images", data=json.dumps(body).encode(),
          headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        resp = json.load(r)
    d = next(x for x in resp["data"] if x.get("b64_json"))
    return Image.open(io.BytesIO(base64.b64decode(d["b64_json"]))).convert("RGB"), float((resp.get("usage") or {}).get("cost") or 0)

def merge(ours, ai, stones, core=0.9, outer=1.3):
    A = np.asarray(ours).astype(np.float64)
    B = np.asarray(ai.resize(ours.size, Image.LANCZOS)).astype(np.float64)
    shift, err, _ = phase_cross_correlation(rgb2gray(A / 255), rgb2gray(B / 255), upsample_factor=4)
    B = np.stack([np.roll(np.roll(B[..., c], int(round(shift[0])), 0), int(round(shift[1])), 1) for c in range(3)], -1)
    H, W = A.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    band = np.zeros((H, W))
    for x, y, r, *_ in stones:
        d = np.hypot(xx - x, yy - y)
        band = np.maximum(band, ((d > r * core) & (d < r * outer)).astype(float))
    w = gaussian_filter(band, 1.5)[..., None]
    return Image.fromarray(np.clip(A * (1 - w) + B * w, 0, 255).astype(np.uint8)), shift
