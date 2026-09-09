#!/usr/bin/env python3
"""Batch-process every raw bot render in art/sprites/raw/ into game-ready sprites.

Drop files named after the bot (bulwark.png, magmaw.png, "volt final v2.png" —
anything containing the bot id) into art/sprites/raw/, then:

    python3 tools/intake_sprites.py

Each file is cleaned, trimmed, centred on its alpha centroid, and registered in
art/sprites/manifest.json. Existing manifest tuning is preserved.
"""
import json, os, re, subprocess, sys

BOTS = ["bulwark", "magmaw", "volt", "warden", "skyla", "phantom", "ricochet", "gravitas"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "sprites", "raw")
MAN = os.path.join(ROOT, "art", "sprites", "manifest.json")
DEFAULT_SCALE = 1.34
# Per-bot prep overrides. Warden was generated facing left; the game draws right.
OVERRIDES = {"warden": ["--flip"]}
# Drawn height per weight class, in units of the rig radius. Sprites are all
# normalised to the same canvas, so without this every bot renders the same size
# and the heavy/medium/light read is lost.
WEIGHT_K = {"bulwark": 1.88, "magmaw": 1.88,
            "volt": 1.72, "warden": 1.72, "skyla": 1.72, "gravitas": 1.72,
            "phantom": 1.55, "ricochet": 1.55}

if not os.path.isdir(RAW):
    sys.exit(f"no raw directory at {RAW}")

manifest = {}
if os.path.exists(MAN):
    try:
        manifest = json.load(open(MAN)) or {}
    except Exception:
        manifest = {}

seen, skipped = [], []
for name in sorted(os.listdir(RAW)):
    if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        continue
    stem = re.sub(r"[^a-z]", "", name.lower())
    match = next((b for b in BOTS if b in stem), None)
    if not match:
        skipped.append(name)
        continue
    src = os.path.join(RAW, name)
    print(f"\n== {match}  <-  {name}")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "prep_sprite.py"),
                        src, match, "--part", "full"] + OVERRIDES.get(match, []), cwd=ROOT)
    if r.returncode != 0:
        print(f"   FAILED, leaving {match} on its vector rig")
        continue
    # Scale so drawn height matches the bot's weight class, measured off the
    # cut-out rather than assumed, since every sprite fills the canvas equally.
    import cv2 as _cv, numpy as _np
    _im = _cv.imread(os.path.join(ROOT, "art", "sprites", f"bot_{match}_full.png"), _cv.IMREAD_UNCHANGED)
    _ys = _np.where(_im[:, :, 3] > 8)[0]
    _bh = int(_ys.max() - _ys.min()) if len(_ys) else 512
    k = WEIGHT_K.get(match, 1.72)
    scale = round(k * 512 / (2.6 * max(1, _bh)), 3)
    # Sprites are centred on the collision point, which sits half a world unit
    # (0.768 rig radii) above the ground. A sprite taller than that pokes through
    # the floor, so lift it by the overhang and the feet land on the surface.
    dy = round(-(k / 2 - 0.768), 3)
    print(f"   height {_bh}px -> scale {scale}, dy {dy}")
    manifest.setdefault(match, {})["full"] = {"file": f"bot_{match}_full.png", "scale": scale, "dy": dy}
    seen.append(match)

json.dump(manifest, open(MAN, "w"), indent=2)
print(f"\nregistered: {', '.join(seen) if seen else 'none'}")
if skipped:
    print(f"skipped (no bot id in filename): {', '.join(skipped)}")
missing = [b for b in BOTS if b not in manifest]
print(f"still on vector rigs: {', '.join(missing) if missing else 'none'}")
