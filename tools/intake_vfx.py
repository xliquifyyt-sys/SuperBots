#!/usr/bin/env python3
"""Turn generated effect frames into sheets registered in art/vfx/manifest.json.

Input layout under art/vfx/raw/:

    <key>/*.png                  one file per frame, sorted by name
    <key>_<cols>x<rows>.png      one contact sheet, frames row-major

<key> is an effect name the renderer knows (see VFX table below). Run:

    python3 tools/intake_vfx.py

Frames are cropped to the union of their content, padded square, and written
as one horizontal strip. Effects painted on black are registered with blend
"lighter" (additive) and need no keying; alpha PNGs use "normal".
Existing fps/size/blend tuning in the manifest is preserved on re-run.
"""
import json, os, re, sys
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelib import to_bgra, alpha_bbox, split_grid

# key: (fps, world size at scale 1, loop, blend)
VFX = {
    "explosion": (24, 2.4, False, "lighter"), "explosion_big": (24, 3.2, False, "lighter"),
    "muzzle": (30, 1.2, False, "lighter"), "land_dust": (20, 1.6, False, "normal"), "jump_dust": (20, 1.4, False, "normal"),
    "blink_out": (24, 2.2, False, "lighter"), "blink_in": (24, 2.2, False, "lighter"),
    "gale": (20, 26, False, "lighter"), "singularity": (16, 18.2, True, "lighter"), "toxic_cloud": (12, 4.8, True, "normal"),
    "reflect": (24, 1.8, False, "lighter"), "deflector": (12, 3.2, True, "lighter"), "molten_patch": (10, 3, True, "lighter"),
    "teleport_out": (24, 2.2, False, "lighter"), "teleport_in": (24, 2.2, False, "lighter"),
    "mine_blast": (24, 2.6, False, "lighter"), "geyser": (20, 2, False, "normal"), "wall_break": (20, 1.6, False, "normal"),
    "shockwave": (24, 6, False, "lighter"),
    "cast_bastionWall": (18, 2.6, False, "lighter"), "cast_siegeShell": (18, 2.6, False, "lighter"), "cast_moltenSlam": (18, 2.6, False, "lighter"),
    "cast_emberSpit": (18, 2.6, False, "lighter"), "cast_chainArc": (18, 2.6, False, "lighter"), "cast_staticField": (18, 2.6, False, "lighter"),
    "cast_deflector": (18, 2.6, False, "lighter"), "cast_anchorBolt": (18, 2.6, False, "lighter"), "cast_updraft": (18, 2.6, False, "lighter"),
    "cast_galeShot": (18, 2.6, False, "lighter"), "cast_blinkStrike": (18, 2.6, False, "lighter"), "cast_toxicBomb": (18, 2.6, False, "lighter"),
    "cast_pinball": (18, 2.6, False, "lighter"), "cast_splitShot": (18, 2.6, False, "lighter"), "cast_singularity": (18, 2.6, False, "lighter"),
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "vfx", "raw")
OUT = os.path.join(ROOT, "art", "vfx")
MAN = os.path.join(OUT, "manifest.json")
CELL = 256
os.makedirs(OUT, exist_ok=True)
manifest = json.load(open(MAN)) if os.path.exists(MAN) else {}


def content_bbox(fr):
    """Union of alpha and brightness, so black-backdrop effects crop too."""
    a = fr[:, :, 3] > 8 if fr.shape[2] == 4 else np.ones(fr.shape[:2], bool)
    lum = fr[:, :, :3].max(axis=2) > 12
    m = a & lum
    ys, xs = np.where(m)
    if len(xs) == 0: return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


found = {}
if os.path.isdir(RAW):
    for name in sorted(os.listdir(RAW)):
        path = os.path.join(RAW, name)
        if os.path.isdir(path) and name in VFX:
            fr = [to_bgra(cv2.imread(os.path.join(path, f), cv2.IMREAD_UNCHANGED)) for f in sorted(os.listdir(path)) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
            fr = [f for f in fr if f is not None]
            if fr: found[name] = fr
        else:
            m = re.match(r"([a-z_]+[A-Za-z]*)_(\d+)x(\d+)\.(png|jpg|jpeg|webp)$", name)
            if m and m.group(1) in VFX:
                im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
                if im is not None: found[m.group(1)] = [to_bgra(f) for f in split_grid(to_bgra(im), int(m.group(2)), int(m.group(3)))]

for key, frames in found.items():
    fps, size, loop, blend = VFX[key]
    has_alpha = any(f[:, :, 3].min() < 250 for f in frames)
    boxes = [content_bbox(f) for f in frames]
    boxes = [b for b in boxes if b]
    if not boxes: print(f"{key}: empty"); continue
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    strip = np.zeros((CELL, CELL * len(frames), 4), np.uint8)
    for i, f in enumerate(frames):
        h, w = f.shape[:2]
        # square crop around the union centre, then resize to the cell
        sx0, sy0 = int(round(cx - side / 2)), int(round(cy - side / 2))
        crop = np.zeros((side, side, 4), np.uint8)
        ax0, ay0 = max(0, sx0), max(0, sy0); ax1, ay1 = min(w, sx0 + side), min(h, sy0 + side)
        if ax1 > ax0 and ay1 > ay0: crop[ay0 - sy0:ay1 - sy0, ax0 - sx0:ax1 - sx0] = f[ay0:ay1, ax0:ax1]
        if not has_alpha: crop[:, :, 3] = 255
        strip[:, i * CELL:(i + 1) * CELL] = cv2.resize(crop, (CELL, CELL), interpolation=cv2.INTER_AREA)
    fn = f"{key}.png"
    cv2.imwrite(os.path.join(OUT, fn), strip, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    prev = manifest.get(key, {})
    manifest[key] = {"file": fn, "frames": len(frames), "fps": prev.get("fps", fps), "size": prev.get("size", size), "loop": prev.get("loop", loop), "blend": prev.get("blend", blend if has_alpha is False or blend == "lighter" else "normal")}
    print(f"{key}: {len(frames)} frames, blend {manifest[key]['blend']}")

json.dump(manifest, open(MAN, "w"), indent=2)
print("manifest updated" if found else "nothing found in art/vfx/raw")
