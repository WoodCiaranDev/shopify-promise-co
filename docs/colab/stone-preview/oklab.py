"""OKLab / OKLCH (Björn Ottosson) in NumPy. Constants are identical to the tuner page's JS,
so the site rebuild reproduces exactly what the client saw."""
import numpy as np

def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)

def rgb_to_oklab(rgb):  # rgb in 0..1, (..., 3)
    r, g, b = [srgb_to_linear(rgb[..., i]) for i in range(3)]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
                     1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
                     0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_], -1)

def oklab_to_rgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return np.stack([linear_to_srgb(r), linear_to_srgb(g), linear_to_srgb(bb)], -1)

def adjust(rgb255, weight, p, lmed):
    """Apply {hue(deg), saturation(frac), brightness(OKLab L), depth(frac)} through weight (0..1)."""
    if not any(p.get(k, 0) for k in ("hue", "saturation", "brightness", "depth")):
        return rgb255
    rgb = rgb255.astype(np.float64) / 255
    lab = rgb_to_oklab(rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); h = np.arctan2(b, a)
    L2 = (L - lmed) * (1 + p.get("depth", 0)) + lmed + p.get("brightness", 0)
    C2 = C * (1 + p.get("saturation", 0))
    h2 = h + np.radians(p.get("hue", 0))
    out = oklab_to_rgb(np.stack([L2, C2 * np.cos(h2), C2 * np.sin(h2)], -1))
    w = weight[..., None]
    res = rgb * (1 - w) + np.clip(out, 0, 1) * w
    return np.round(res * 255)
