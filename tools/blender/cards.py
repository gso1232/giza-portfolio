"""
The pictures put back into a rendered frame (no render: numpy only). Blender rendered each picture
the user will swap as plain white paper (scene_build: S.card_white) and, in render_cards(), where
every point of each lies in the frame: its own u, v, its number, how much of the pixel it covers.
A new picture is its image (poster_<key>.png, sRGB, as desk.html paints the surface) multiplied
into the light that fell on the white paper there; nothing else in the frame changes.

  apply(img, cards, pictures)   img: linear RGB (H x W x 3), cards: H x W x 4 (the cards pass),
                                pictures: {number: linear RGB image}; returns the frame with them in
"""
import numpy as np

WHITE = 0.85                                     # scene_build's card_white


def load_picture(path):
    import cv2
    im = cv2.imread(path, cv2.IMREAD_COLOR)[..., ::-1].astype(np.float32) / 255
    return np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)     # sRGB -> linear


def sample(pic, u, v):
    """bilinear, u across, v down the image (the glTF's UVs come into Blender with v from the top),
    clamped at the edges"""
    H, W = pic.shape[:2]
    x = np.clip(u * W - 0.5, 0, W - 1)
    y = np.clip(v * H - 0.5, 0, H - 1)
    x0, y0 = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    x1, y1 = np.minimum(x0 + 1, W - 1), np.minimum(y0 + 1, H - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    top = pic[y0, x0] * (1 - fx) + pic[y0, x1] * fx
    bot = pic[y1, x0] * (1 - fx) + pic[y1, x1] * fx
    return top * (1 - fy) + bot * fy


def apply(img, cards, pictures):
    cards = cards.astype(np.float32)
    a = cards[..., 3]
    seen = a > 1e-3
    safe = np.where(seen, a, 1)
    u, v = cards[..., 0] / safe, cards[..., 1] / safe
    num = np.rint(cards[..., 2] / safe * 16).astype(np.int32)
    factor = np.ones_like(img)
    import cv2
    for n, pic in pictures.items():
        m = seen & (num == n)
        if not m.any():
            continue
        # the picture brought down to about twice the size it shows at (area-averaged), so fine
        # lines don't break into dots the way a picture read at single points does
        k = min(1.0, 2.0 * np.sqrt(a[m].sum() / (pic.shape[0] * pic.shape[1])))
        if k < 1:
            pic = cv2.resize(pic, (max(2, int(pic.shape[1] * k)), max(2, int(pic.shape[0] * k))), interpolation=cv2.INTER_AREA)
        alb = sample(pic, u[m], v[m]) / WHITE
        cov = a[m][:, None]
        factor[m] = 1 - cov + cov * alb
    return img * factor
