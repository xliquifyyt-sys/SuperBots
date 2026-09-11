#!/usr/bin/env python3
"""Turn generated animation frames into game clips registered in art/sprites/manifest.json.

Input layout under art/sprites/raw/anim/ (either form works, mix freely):

    <bot>/<clip>/*.png                    one file per frame, sorted by name
    <bot>_<clip>_<cols>x<rows>.png        one contact sheet, frames row-major

<bot>  is one of the 8 bot ids. <clip> is one of: idle jump land fire hit death s1 s2.
Run:

    python3 tools/intake_anim.py            # all bots
    python3 tools/intake_anim.py volt       # one bot

Every frame is keyed (flat backdrop removed), then scaled and placed with ONE
transform per bot so the body never jitters between frames or against the
still: the idle clip's first frame (or the still when there is no idle clip) is
matched to the still's body height and centre. Frames that swing outside the
512 canvas grow the canvas for the whole bot, and the manifest scale follows.
Output: art/sprites/bot_<bot>_<clip>.png strips plus manifest entries
anim_<clip> = { file, frames, fps, loop }. Existing fps/loop tuning is kept.
"""
import json, os, re, sys
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spritelib import key_backdrop, alpha_bbox, split_grid

BOTS = ["bulwark", "magmaw", "volt", "warden", "skyla", "phantom", "ricochet", "gravitas"]
CLIPS = {"idle": (8, True), "jump": (12, False), "land": (12, False), "fire": (14, False),
         "hit": (12, False), "death": (10, False), "s1": (14, False), "s2": (14, False)}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "sprites", "raw", "anim")
OUT = os.path.join(ROOT, "art", "sprites")
MAN = os.path.join(OUT, "manifest.json")
SIZE = 512
only = sys.argv[1:] or BOTS

manifest = json.load(open(MAN)) if os.path.exists(MAN) else {}


def collect(bot):
    """clip -> list of BGRA frames, from folders and/or contact sheets."""
    clips = {}
    d = os.path.join(RAW, bot)
    if os.path.isdir(d):
        for clip in sorted(os.listdir(d)):
            cd = os.path.join(d, clip)
            if not os.path.isdir(cd) or clip not in CLIPS: continue
            fr = []
            for f in sorted(os.listdir(cd)):
                if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")): continue
                im = cv2.imread(os.path.join(cd, f), cv2.IMREAD_UNCHANGED)
                if im is not None: fr.append(key_backdrop(im))
            if fr: clips[clip] = fr
    for f in sorted(os.listdir(RAW)) if os.path.isdir(RAW) else []:
        m = re.match(rf"{bot}_([a-z0-9]+)_(\d+)x(\d+)\.(png|jpg|jpeg|webp)$", f.lower())
        if not m or m.group(1) not in CLIPS: continue
        im = cv2.imread(os.path.join(RAW, f), cv2.IMREAD_UNCHANGED)
        if im is None: continue
        frames = [key_backdrop(x) for x in split_grid(im, int(m.group(2)), int(m.group(3)))]
        if frames: clips[m.group(1)] = frames
    return clips


for bot in only:
    clips = collect(bot)
    if not clips: continue
    still_path = os.path.join(OUT, f"bot_{bot}_full.png")
    still = cv2.imread(still_path, cv2.IMREAD_UNCHANGED)
    if still is None:
        print(f"{bot}: no still (bot_{bot}_full.png); run intake_sprites.py first"); continue
    sb = alpha_bbox(still)
    still_h = sb[3] - sb[1]; still_cx = (sb[0] + sb[2]) / 2; still_cy = (sb[1] + sb[3]) / 2
    # Reference frame: idle frame 0, else the first frame of the first clip.
    ref = clips["idle"][0] if "idle" in clips else next(iter(clips.values()))[0]
    rb = alpha_bbox(ref)
    if rb is None: print(f"{bot}: reference frame is empty"); continue
    scale = still_h / max(1, rb[3] - rb[1])
    ref_cx, ref_cy = (rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2
    # Same source canvas for every frame is the normal case (one generator, one prompt).
    # Frames of another size are aligned by their own bbox centre instead.
    src_shape = ref.shape[:2]

    def place(frame):
        h, w = frame.shape[:2]
        fb = alpha_bbox(frame)
        if fb is None: return None
        if (h, w) == src_shape: cx, cy = ref_cx, ref_cy          # shared transform: motion inside the frame is kept
        else: cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2  # different canvas: centre this frame's own body
        # destination of the frame's origin so that (cx,cy) lands on the still's body centre
        ox = still_cx - cx * scale; oy = still_cy - cy * scale
        return ox, oy, fb

    # Find the canvas that holds every frame; grow symmetrically about the 512 centre if needed.
    ext = [0, 0, SIZE, SIZE]
    placed = {}
    for clip, frames in clips.items():
        placed[clip] = []
        for fr in frames:
            pl = place(fr)
            if pl is None: continue
            ox, oy, fb = pl
            x0, y0, x1, y1 = ox + fb[0] * scale, oy + fb[1] * scale, ox + fb[2] * scale, oy + fb[3] * scale
            ext = [min(ext[0], x0), min(ext[1], y0), max(ext[2], x1), max(ext[3], y1)]
            placed[clip].append((fr, ox, oy))
    half = max(SIZE / 2 - ext[0], SIZE / 2 - ext[1], ext[2] - SIZE / 2, ext[3] - SIZE / 2)
    canvas = int(np.ceil(half * 2 / 16) * 16)
    canvas = max(SIZE, canvas)
    shift = (canvas - SIZE) / 2
    full = manifest.get(bot, {}).get("full", {})
    base_scale = full.get("scale", 1.34) if isinstance(full, dict) else 1.34
    clip_scale = round(base_scale * canvas / SIZE, 3)
    for clip, items in placed.items():
        strip = np.zeros((canvas, canvas * len(items), 4), np.uint8)
        for i, (fr, ox, oy) in enumerate(items):
            h, w = fr.shape[:2]
            nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
            rs = cv2.resize(fr, (nw, nh), interpolation=cv2.INTER_AREA)
            dx, dy = int(round(ox + shift)), int(round(oy + shift))
            # paste with clipping
            sx0, sy0 = max(0, -dx), max(0, -dy)
            ex, ey = min(nw, canvas - dx), min(nh, canvas - dy)
            if ex <= sx0 or ey <= sy0: continue
            strip[dy + sy0:dy + ey, i * canvas + dx + sx0:i * canvas + dx + ex] = rs[sy0:ey, sx0:ex]
        fn = f"bot_{bot}_{clip}.png"
        cv2.imwrite(os.path.join(OUT, fn), strip, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        prev = manifest.setdefault(bot, {}).get("anim_" + clip, {})
        fps, loop = CLIPS[clip]
        entry = {"file": fn, "frames": len(items), "fps": prev.get("fps", fps), "loop": prev.get("loop", loop)}
        if canvas != SIZE: entry["scale"] = clip_scale
        manifest[bot]["anim_" + clip] = entry
        print(f"{bot}/{clip}: {len(items)} frames, canvas {canvas}, {os.path.getsize(os.path.join(OUT, fn)) // 1024} KB")

json.dump(manifest, open(MAN, "w"), indent=2)
print("manifest updated")
