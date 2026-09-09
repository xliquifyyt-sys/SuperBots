#!/usr/bin/env python3
"""Turn a raw generated sprite into a game-ready asset.

Removes a flat backdrop by flood-filling inward from the border, so white
highlights *inside* the artwork survive. Then trims, scales to fit, and centres
on a square transparent canvas.

  python3 tools/prep_sprite.py in.png bulwark
  python3 tools/prep_sprite.py in.png bulwark --part body --pivot-x 0.42

--pivot-x is where the bot's mass sits horizontally in the trimmed art, as a
fraction. Use it when a long barrel drags the bounding-box centre off the
chassis; the sprite is placed so this point lands on the collision centre.
"""
import argparse, os, sys
import cv2, numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("bot")
ap.add_argument("--part", default="full")
ap.add_argument("--size", type=int, default=512)
ap.add_argument("--fill", type=float, default=0.92, help="fraction of canvas the art spans")
ap.add_argument("--pivot-x", type=float, default=0.5)
ap.add_argument("--pivot-y", type=float, default=0.5)
ap.add_argument("--tol", type=int, default=18, help="backdrop colour tolerance")
ap.add_argument("--out", default="art/sprites")
a = ap.parse_args()

img = cv2.imread(a.src, cv2.IMREAD_UNCHANGED)
if img is None:
    sys.exit(f"cannot read {a.src}")
if img.ndim == 2:
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
if img.shape[2] == 3:
    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
h, w = img.shape[:2]
bgr, alpha = img[:, :, :3], img[:, :, 3]

if alpha.min() > 250:  # fully opaque, so there is a backdrop to strip
    # Seed a flood fill from every border pixel matching the corner colour.
    corners = np.array([bgr[0, 0], bgr[0, w - 1], bgr[h - 1, 0], bgr[h - 1, w - 1]], dtype=np.int16)
    backdrop = np.median(corners, axis=0).astype(np.uint8)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    work = bgr.copy()
    lo = up = (a.tol,) * 3
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if np.abs(work[sy, sx].astype(np.int16) - backdrop.astype(np.int16)).max() <= a.tol:
            cv2.floodFill(work, mask, (sx, sy), (0, 0, 0), lo, up, 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
    outside = mask[1:-1, 1:-1] > 0
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    # Feather one pixel so the cut edge is not jagged.
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    alpha = np.where(alpha > 200, 255, np.where(alpha < 60, 0, alpha)).astype(np.uint8)

ys, xs = np.where(alpha > 8)
if len(xs) == 0:
    sys.exit("nothing left after background removal; try a larger --tol")
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
cut = np.dstack([bgr, alpha])[y0:y1, x0:x1]
ch, cw = cut.shape[:2]

span = a.size * a.fill
scale = min(span / cw, span / ch)
nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
cut = cv2.resize(cut, (nw, nh), interpolation=cv2.INTER_AREA)

canvas = np.zeros((a.size, a.size, 4), np.uint8)
ox = int(round(a.size / 2 - nw * a.pivot_x))
oy = int(round(a.size / 2 - nh * a.pivot_y))
ox, oy = max(0, min(a.size - nw, ox)), max(0, min(a.size - nh, oy))
canvas[oy:oy + nh, ox:ox + nw] = cut

os.makedirs(a.out, exist_ok=True)
dst = f"{a.out}/bot_{a.bot}_{a.part}.png"
cv2.imwrite(dst, canvas)
print(f"{dst}  trimmed {cw}x{ch} -> {nw}x{nh} on {a.size} canvas")
