// Painted effect sheets. Optional: any effect without a sheet keeps its
// procedural canvas version, so a partial VFX set never breaks the game.
//
// art/vfx/manifest.json:
//   { "explosion": { "file": "explosion.png", "frames": 12, "fps": 24, "size": 2.6, "blend": "lighter", "loop": false } }
// A sheet is a horizontal strip of square frames. size is the drawn width in
// world units at scale 1 (the renderer multiplies by the event's own radius).
// blend "lighter" is for effects painted on black (fire, energy); "normal" is
// for alpha-cut smoke and dust. Produced by tools/intake_vfx.py.

const BASE = 'art/vfx/';
const images = new Map();
let manifest = null;
let loading = false;

export function loadVfx(onChange) {
  if (loading) return;
  loading = true;
  const inlined = typeof window !== 'undefined' && window.__SUPERBOTS_VFX;
  if (inlined) {
    manifest = inlined.manifest || {};
    for (const key of Object.keys(manifest)) {
      const uri = inlined.data[key];
      if (!uri) continue;
      const img = new Image();
      img.onload = () => { images.set(key, img); if (onChange) onChange(); };
      img.onerror = () => {};
      img.src = uri;
    }
    return;
  }
  if (typeof location !== 'undefined' && !/^https?:/.test(location.protocol)) { manifest = {}; return; }
  fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => {
      manifest = m || {};
      for (const [key, spec] of Object.entries(manifest)) {
        const file = typeof spec === 'string' ? spec : spec && spec.file;
        if (!file) continue;
        const img = new Image();
        img.onload = () => { images.set(key, img); if (onChange) onChange(); };
        img.onerror = () => {};
        img.src = BASE + file;
      }
      if (onChange) onChange();
    })
    .catch(() => { manifest = {}; });
}

// { img, frames, fps, duration, size, blend, loop } or null when the sheet is missing.
export function getVfx(key) {
  const spec = manifest && manifest[key];
  const img = images.get(key);
  if (!spec || !img) return null;
  const frames = Math.max(1, spec.frames | 0), fps = spec.fps || 24;
  return { img, frames, fps, duration: frames / fps, size: spec.size || 2, blend: spec.blend || 'lighter', loop: !!spec.loop };
}

// Draw one frame centred on screen point (x,y), `width` pixels wide, rotated by rot, mirrored when flip is -1.
export function drawVfxFrame(ctx, clip, frame, x, y, width, rot = 0, flip = 1) {
  const fw = clip.img.width / clip.frames, fh = clip.img.height;
  const h = width * (fh / fw);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1);
  if (clip.blend === 'lighter') ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(clip.img, fw * frame, 0, fw, fh, -width / 2, -h / 2, width, h);
  ctx.restore();
}
