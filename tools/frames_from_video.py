#!/usr/bin/env python3
"""Pull animation frames out of a generated video clip into the intake folders.

    python3 tools/frames_from_video.py clip.mp4 volt fire --frames 8 --start 0.3 --end 1.4
    python3 tools/frames_from_video.py boom.mp4 --vfx explosion --frames 12

Frames are sampled evenly between --start and --end (seconds; default whole
clip), the flat backdrop is keyed if the video has one, and the results land in
art/sprites/raw/anim/<bot>/<clip>/ (or art/vfx/raw/<key>/) ready for the intake
tools. --crop x,y,w,h trims the source first (pixels) when the video has letterboxing.
--hold N repeats the first N frames' worth of the clip's rest pose at the end
is not needed: pick --end where the bot has settled instead.
"""
import argparse, os, sys
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelib import key_backdrop

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("bot", nargs="?")
ap.add_argument("clip", nargs="?")
ap.add_argument("--vfx", help="effect key instead of a bot clip")
ap.add_argument("--frames", type=int, default=8)
ap.add_argument("--start", type=float, default=0.0)
ap.add_argument("--end", type=float, default=None)
ap.add_argument("--crop", default=None, help="x,y,w,h in pixels")
ap.add_argument("--no-key", action="store_true", help="keep the backdrop (effects painted on black)")
ap.add_argument("--tol", type=int, default=28, help="backdrop colour tolerance; video compression needs more than stills")
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if a.vfx: out = os.path.join(ROOT, "art", "vfx", "raw", a.vfx)
elif a.bot and a.clip: out = os.path.join(ROOT, "art", "sprites", "raw", "anim", a.bot, a.clip)
else: sys.exit("give <bot> <clip>, or --vfx <key>")
os.makedirs(out, exist_ok=True)

cap = cv2.VideoCapture(a.video)
if not cap.isOpened(): sys.exit(f"cannot open {a.video}")
fps = cap.get(cv2.CAP_PROP_FPS) or 24
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur = n / fps
end = a.end if a.end is not None else dur
times = np.linspace(a.start, min(end, dur - 1 / fps), a.frames)
print(f"{a.video}: {dur:.2f}s at {fps:.1f} fps, sampling {a.frames} frames from {times[0]:.2f}s to {times[-1]:.2f}s")
for f in os.listdir(out):
    if f.lower().endswith(".png"): os.remove(os.path.join(out, f))
for i, t in enumerate(times):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, fr = cap.read()
    if not ok: print(f"  frame {i}: read failed at {t:.2f}s"); continue
    if a.crop:
        x, y, w, h = [int(v) for v in a.crop.split(",")]
        fr = fr[y:y + h, x:x + w]
    if a.vfx and a.no_key:
        fr = cv2.cvtColor(fr, cv2.COLOR_BGR2BGRA)
    elif not a.no_key:
        fr = key_backdrop(fr, tol=a.tol)
    else:
        fr = cv2.cvtColor(fr, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(os.path.join(out, f"{i:02d}.png"), fr)
print(f"wrote {a.frames} frames to {out}")
print("next: python3 tools/intake_anim.py" + (f" {a.bot}" if a.bot else "") if not a.vfx else "next: python3 tools/intake_vfx.py")
