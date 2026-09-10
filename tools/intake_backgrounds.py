#!/usr/bin/env python3
"""Batch-process painted map backgrounds from art/maps/raw/ into the game.

Drop files named after the map (bg_emberpit.png, "ember pit background.jpg",
anything containing the map id) into art/maps/raw/, then:

    python3 tools/intake_backgrounds.py

Each is resized to 2048 wide, saved as JPEG so it stays small enough to inline
into the single-file build, and registered in art/maps/bg/manifest.json with a
default parallax. Existing per-map tuning is preserved on re-run.
"""
import json, os, re, sys
import cv2

MAPS = ["emberpit", "magmaworks", "frozenkeel", "glacierfort", "canopyruins",
        "templecrossing", "cloudsteps", "nimbus", "neonalley", "skylinegrid"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "maps", "raw")
OUT = os.path.join(ROOT, "art", "maps", "bg")
MAN = os.path.join(OUT, "manifest.json")
WIDTH, QUALITY = 2048, 86

os.makedirs(OUT, exist_ok=True)
manifest = {}
if os.path.exists(MAN):
    try: manifest = json.load(open(MAN)) or {}
    except Exception: manifest = {}

done, skipped = [], []
for name in sorted(os.listdir(RAW)):
    if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")): continue
    stem = re.sub(r"[^a-z]", "", name.lower())
    match = next((m for m in MAPS if m in stem), None)
    if not match: skipped.append(name); continue
    img = cv2.imread(os.path.join(RAW, name), cv2.IMREAD_COLOR)
    if img is None: skipped.append(name + " (unreadable)"); continue
    h, w = img.shape[:2]
    if w != WIDTH:
        img = cv2.resize(img, (WIDTH, int(round(h * WIDTH / w))), interpolation=cv2.INTER_AREA)
    dst = f"bg_{match}.jpg"
    cv2.imwrite(os.path.join(OUT, dst), img, [cv2.IMWRITE_JPEG_QUALITY, QUALITY])
    prev = manifest.get(match) if isinstance(manifest.get(match), dict) else {}
    manifest[match] = {"file": dst, "parallax": prev.get("parallax", 0.25), "anchor": prev.get("anchor", "bottom")}
    kb = os.path.getsize(os.path.join(OUT, dst)) // 1024
    print(f"== {match:15s} <- {name}   {w}x{h} -> {img.shape[1]}x{img.shape[0]}  {kb} KB")
    done.append(match)

json.dump(manifest, open(MAN, "w"), indent=2)
print(f"\nregistered: {', '.join(done) if done else 'none'}")
if skipped: print(f"skipped (no map id in filename): {', '.join(skipped)}")
print(f"still procedural: {', '.join(m for m in MAPS if m not in manifest) or 'none'}")
