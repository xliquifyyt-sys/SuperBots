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
                        src, match, "--part", "full"], cwd=ROOT)
    if r.returncode != 0:
        print(f"   FAILED, leaving {match} on its vector rig")
        continue
    entry = manifest.get(match, {}).get("full")
    scale = entry.get("scale", DEFAULT_SCALE) if isinstance(entry, dict) else DEFAULT_SCALE
    dy = entry.get("dy", 0) if isinstance(entry, dict) else 0
    manifest.setdefault(match, {})["full"] = {"file": f"bot_{match}_full.png", "scale": scale, "dy": dy}
    seen.append(match)

json.dump(manifest, open(MAN, "w"), indent=2)
print(f"\nregistered: {', '.join(seen) if seen else 'none'}")
if skipped:
    print(f"skipped (no bot id in filename): {', '.join(skipped)}")
missing = [b for b in BOTS if b not in manifest]
print(f"still on vector rigs: {', '.join(missing) if missing else 'none'}")
