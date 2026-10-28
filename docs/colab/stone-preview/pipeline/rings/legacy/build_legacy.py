"""Build the Legacy ring stone preview from one base image (photo/gold_base.png).

    python build_legacy.py --poc               # test images and contact sheets into poc/
    python build_legacy.py                     # all 288 site images into the theme's assets/
    python build_legacy.py colours.json        # the same, with the client's Legacy tuner settings
    python build_legacy.py --tuner             # the Legacy tuner's images, masks and base.json

Centre stones are the live picker's real stone images, turned to sit north-south and scaled to cover
the opening, as on Heirloom. Where ai_centres.py has made a sharpened copy (centres/{k}.png), that is
used instead. Halo stones are Heirloom's real halo stones, cut from the approved Heirloom images (her
tuner settings baked in) and set inside the outline of each stone in the base, so both rings show
identical stones, every image keeps the base's exact geometry, and the base's own bezel and prongs stay
on top. April uses the base's own sparkly diamonds. Silver is the finished gold with only the metal
converted (gold_to_silver.py, run from this folder against this ring's slots and centre mask).
Run measure.py first.
"""
import os, sys, json, glob, hashlib, itertools, numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_erosion, binary_dilation, binary_fill_holes, binary_closing, label

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.join(HERE, "..", "..")
ASSETS = os.path.join(PIPE, "..", "..", "..", "..", "assets")
os.chdir(HERE); sys.path.insert(0, PIPE)
from halo_v2 import disc_mask
import measure
from cream_bg import to_cream, background_weight
from centre_real import place_centre, cover_scale
from oklab import rgb_to_oklab, adjust
import gold_to_silver

K = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
CORE = 0.88
CENTRE_GROW = 3
SEAT_SHADOW, SEAT_REACH, SEAT_GROW = 0.18, 2.5, 1.5
SEAT_GOLD_LOW, SEAT_GOLD_HIGH = 0.04, 0.07
APRIL_SILVER_DESATURATE = -0.85
TUNER = os.path.join(HERE, "tuner")
TUNER_BOX, TUNER_SIZE = [250, 372, 1350, 1247], [700, 557]

def heirloom_stones():
    """Heirloom's 16 halo stone positions, paired in ring order with Legacy's slots, each given Legacy's
    angle. Both are sorted clockwise from the top stone, so the real stones keep their order round the
    ring (no stone repeats next to itself) and top stays top for the lighting."""
    ours = json.load(open("slots_matched.json"))["gold"]
    theirs = json.load(open(os.path.join(PIPE, "slots_matched.json")))["gold"]
    def clockwise_from_top(slots):
        order = sorted(range(len(slots)), key=lambda i: slots[i][3])
        top = min(order, key=lambda i: abs(slots[i][3] + np.pi / 2))
        k = order.index(top)
        return order[k:] + order[:k]
    paired = [None] * len(ours)
    for i, j in zip(clockwise_from_top(ours), clockwise_from_top(theirs)):
        x, y, r, _ = theirs[j]
        paired[i] = (x, y, r, ours[i][3])
    return paired

def heirloom_donor(k):
    """The client-approved Heirloom image for this halo stone, her tuner settings already applied."""
    return Image.open(os.path.join(ASSETS, f"colab-heirloom-gold-april-{k}.jpg")).convert("RGB")

def silver_reference():
    """Heirloom's silver tone, from the client's real silver packshot, so both rings share one silver."""
    os.chdir(PIPE)
    try:
        gold_to_silver._REF = None
        return gold_to_silver.silver_reference()
    finally:
        os.chdir(HERE)

def silhouette(img, stones):
    """The ring itself: saturated gold metal plus the stones, closed and filled. Excludes the AI's
    warm contact shadow, which would otherwise be converted to grey metal."""
    lab = rgb_to_oklab(np.asarray(img).astype(np.float64) / 255)
    h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
    metal = (h > 45) & (h < 110) & (C > 0.035)
    m = binary_fill_holes(binary_closing(metal | stones, iterations=6))
    lab_, _ = label(m)
    sizes = np.bincount(lab_.ravel()); sizes[0] = 0
    return binary_dilation(lab_ == np.argmax(sizes), iterations=2)

def client_colours(path):
    import importlib.util
    spec = importlib.util.spec_from_file_location("apply", os.path.join(PIPE, "19_apply_client_colours.py"))
    os.chdir(PIPE)
    try:
        ap = importlib.util.module_from_spec(spec); spec.loader.exec_module(ap)
    finally:
        os.chdir(HERE)
    base = json.load(open("tuner_base.json"))
    return ap.validate(json.load(open(path)), base["baseImageHash"]), base["metals"]["gold"]

class Ring:
    def __init__(self, colours=None):
        self.colours, self.lmed = client_colours(colours) if colours else (None, None)
        self.base = Image.open("photo/gold_base.png").convert("RGB")
        shape = (self.base.height, self.base.width)
        self.stone = np.load("photo/mask_centre_stone.npy")
        self.slots = json.load(open("slots_matched.json"))["gold"]
        self.opening = binary_dilation(self.stone, iterations=CENTRE_GROW)
        self.wc = gaussian_filter(self.opening.astype(np.float64), 1.2)
        wh = np.zeros(shape)
        for x, y, r, _ in self.slots:
            wh = np.maximum(wh, disc_mask(shape, x, y, r, CORE, feather=1.0))
        self.wh = wh * (1 - self.wc)
        self.stones = heirloom_stones()
        self.footprints = self.stone_footprints()
        self.prot = binary_dilation(self.stone | (wh > 0), iterations=40)
        self.B = np.asarray(self.base).astype(np.float64)
        self._c, self._h = {}, {}
        gold_to_silver._REF = silver_reference()
        seated = np.zeros(shape, bool); self.seat_weight = np.zeros(shape)
        for f in self.footprints:
            seated[f["box"]] |= binary_erosion(f["mask"], iterations=1)
            self.seat_weight[f["box"]] = np.maximum(self.seat_weight[f["box"]], f["alpha"])
        self.metal_protect = gold_to_silver._protect() | seated | ~silhouette(self.base, self.stone | (wh > 0))

    def stone_footprints(self):
        """Each white stone in the base as a circle (they are round brilliants in round cups), a little wider
        than the stone. A new stone fills the circle everywhere the base is not gold metal, so no sliver of the
        old stone survives and the base's own bezel lip, milgrain and prongs stay on top. Only gold connected
        to the rim outside the circle counts as metal: warm reflections inside the old stone are not."""
        lab_, _ = measure.stone_blobs(np.asarray(self.base).astype(np.float64))
        lab = rgb_to_oklab(np.asarray(self.base).astype(np.float64) / 255)
        h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])); C = np.hypot(lab[..., 1], lab[..., 2])
        ramp = lambda x, lo, hi, w: np.clip((x - (lo - w)) / w, 0, 1) * np.clip(((hi + w) - x) / w, 0, 1)
        gold = ramp(h, 40, 110, 8) * np.clip((C - SEAT_GOLD_LOW) / (SEAT_GOLD_HIGH - SEAT_GOLD_LOW), 0, 1)
        out = []
        for x, y, r, _ in self.slots:
            blob = lab_ == lab_[int(round(y)), int(round(x))]
            ys, xs = np.nonzero(blob)
            cx, cy = xs.mean(), ys.mean()
            rf = float(np.percentile(np.hypot(xs - cx, ys - cy), 99))
            rd = rf + SEAT_GROW
            reach = int(np.ceil(rd)) + 4
            y0, x0 = int(cy) - reach, int(cx) - reach
            box = (slice(y0, y0 + 2 * reach), slice(x0, x0 + 2 * reach))
            yy, xx = np.mgrid[box[0], box[1]]
            dist = np.hypot(xx - cx, yy - cy)
            parts, n = label(gold[box] > 0.5)
            rim = np.unique(parts[(dist > rd + 0.5) & (parts > 0)])
            kept = np.where(np.isin(parts, rim), gold[box], 0.0)
            alpha = gaussian_filter((dist <= rd).astype(np.float64), 0.8) * (1 - kept)
            out.append({"cx": cx, "cy": cy, "rf": rf, "box": box, "alpha": alpha, "mask": alpha > 0.5,
                        "edge": np.maximum(rd - dist, 0)})
        return out

    def set_stone(self, canvas, donor, slot_i):
        """Set one real Heirloom stone into this circle. The stone is scaled so its pure core (0.88 of the
        Heirloom setting radius) covers the whole circle, then eased darker at the edge as the bezel would
        shade it, so it reads as sitting in the setting and not on top of it."""
        f = self.footprints[slot_i]
        hx, hy, hr, _ = self.stones[slot_i]
        s = (f["rf"] + SEAT_GROW) / (CORE * hr)
        box = f["box"]; y0, x0 = box[0].start, box[1].start; n = box[0].stop - y0
        patch = np.asarray(donor.transform((n, n), Image.AFFINE,
                                           (1 / s, 0, hx - (f["cx"] - x0) / s, 0, 1 / s, hy - (f["cy"] - y0) / s),
                                           resample=Image.BICUBIC)).astype(np.float64)
        shade = 1 - SEAT_SHADOW * np.exp(-f["edge"] / SEAT_REACH)
        alpha = f["alpha"][..., None]
        canvas[box] = canvas[box] * (1 - alpha) + patch * shade[..., None] * alpha

    def centre(self, k):
        if k not in self._c:
            sharp = os.path.join(HERE, "centres", f"{k}.png")
            icon = sharp if os.path.exists(sharp) else os.path.join(PIPE, "icons_solid", f"{k}.png")
            cover = cover_scale(icon, self.opening, rotate=90)
            self._c[k] = np.asarray(place_centre(self.base, icon, self.opening, self.wc, cover=cover, sharpen=icon != sharp, rotate=90)).astype(np.float64)
            if self.colours:
                self._c[k] = adjust(self._c[k], self.wc, self.colours["stones"][k]["centre"], self.lmed[k]["centre"]["lmed"])
        return self._c[k]

    def halo(self, k):
        if k not in self._h:
            if k == "april":
                self._h[k] = self.B
            else:
                canvas = self.B.copy(); donor = heirloom_donor(k)
                for i in range(len(self.slots)): self.set_stone(canvas, donor, i)
                self._h[k] = canvas
            if self.colours:
                self._h[k] = adjust(self._h[k], self.wh, self.colours["stones"][k]["halo"], self.lmed[k]["halo"]["lmed"])
        return self._h[k]

    def gold(self, c, h):
        out = self.halo(h) + self.centre(c) - self.B
        return to_cream(Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)), self.prot)

    def silver(self, gold, h):
        if h == "april":
            gold = Image.fromarray(adjust(np.asarray(gold).astype(np.float64), self.seat_weight, {"saturation": APRIL_SILVER_DESATURATE}, 0).clip(0, 255).astype(np.uint8))
        return gold_to_silver.to_silver(gold, protect=self.metal_protect, halo=h)[0]

def sheet(images, labels, path, cols=6, w=400):
    rows = (len(images) + cols - 1) // cols
    s = Image.new("RGB", (cols * w, rows * w), (242, 237, 229)); d = ImageDraw.Draw(s)
    for i, (im, lb) in enumerate(zip(images, labels)):
        t = im.crop((300, 330, 1300, 1330)).resize((w, w), Image.LANCZOS)
        s.paste(t, ((i % cols) * w, (i // cols) * w)); d.text(((i % cols) * w + 6, (i // cols) * w + 6), lb, fill=(0, 0, 0))
    s.save(path, quality=88)

def poc():
    os.makedirs("poc", exist_ok=True)
    ring = Ring()
    g = ring.gold("october", "june"); g.save("poc/gold-october-june.jpg", quality=92)
    ring.silver(g, "june").save("poc/silver-october-june.jpg", quality=92)
    sheet([ring.gold(k, "april") for k in K], [f"centre {k}" for k in K], "poc/centres.jpg")
    halos = [ring.gold("april", k) for k in K]
    sheet(halos, [f"halo {k}" for k in K], "poc/halos.jpg")
    sheet([ring.silver(im, k) for im, k in zip(halos, K)], [f"silver halo {k}" for k in K], "poc/halos-silver.jpg")
    print("proof of concept written to", os.path.join(HERE, "poc"))

def build_all(colours=None):
    ring = Ring(colours)
    for c, h in itertools.product(K, K):
        g = ring.gold(c, h)
        g.save(f"{ASSETS}/colab-legacy-gold-{c}-{h}.jpg", quality=84, optimize=True, progressive=True)
        ring.silver(g, h).save(f"{ASSETS}/colab-legacy-silver-{c}-{h}.jpg", quality=84, optimize=True, progressive=True)
    digest = hashlib.sha256()
    for f in sorted(glob.glob(f"{ASSETS}/colab-legacy-*-*-*.jpg")): digest.update(open(f, "rb").read())
    open(f"{ASSETS}/colab-legacy-version.txt", "w").write(digest.hexdigest()[:16] + "\n")
    print("288 images written; version", digest.hexdigest()[:16])

def export_tuner():
    """Tuner images are the uncoloured base (the tuner applies settings live); gold and silver share geometry."""
    ring = Ring()
    shape = ring.wc.shape
    pair = np.zeros(shape)
    for x, y, r, _ in ring.slots: pair = np.maximum(pair, disc_mask(shape, x, y, r, 1.0, feather=1.0))
    pair *= 1 - ring.wc
    base = {"version": 1, "space": "OKLCH", "box": TUNER_BOX, "size": TUNER_SIZE, "metals": {"gold": {}, "silver": {}}}
    for d in ("img", "masks"): os.makedirs(os.path.join(TUNER, d), exist_ok=True)
    fit = lambda im: im.crop(TUNER_BOX).resize(tuple(TUNER_SIZE), Image.LANCZOS)
    for metal in ("gold", "silver"):
        for name, m in (("centre", ring.wc), ("halo", ring.wh), ("pair", pair)):
            fit(Image.fromarray((np.clip(m, 0, 1) * 255).round().astype(np.uint8))).save(f"{TUNER}/masks/{metal}-{name}.png", optimize=True)
    digest = hashlib.sha256()
    for k in K:
        gold = ring.gold(k, k)
        for metal, im in (("gold", gold), ("silver", ring.silver(gold, k))):
            full = np.asarray(im); digest.update(full.tobytes())
            fit(Image.fromarray(full)).save(f"{TUNER}/img/{metal}-{k}.webp", lossless=True, quality=100, method=6)
            lab = rgb_to_oklab(full.astype(np.float64) / 255)
            base["metals"][metal][k] = {"centre": {"lmed": float(np.median(lab[..., 0][ring.wc > 0.5]))},
                                        "halo": {"lmed": float(np.median(lab[..., 0][ring.wh > 0.5]))}}
    base["baseImageHash"] = digest.hexdigest()[:16]
    for path in ("tuner_base.json", f"{TUNER}/base.json"): json.dump(base, open(path, "w"), indent=1)
    print("tuner assets written to", TUNER, "hash", base["baseImageHash"])

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--poc" in sys.argv: poc()
    elif "--tuner" in sys.argv: export_tuner()
    else: build_all(args[0] if args else None)
