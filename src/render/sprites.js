// Painted sprite support. Sprites are optional: anything missing falls back to
// the vector rig, so a partial art set never breaks the game.
//
// art/sprites/manifest.json:
//   { "bulwark": { "full": { "file": "bot_bulwark_full.png", "scale": 1, "dy": 0 },
//                  "anim_idle": { "file": "bot_bulwark_idle.png", "frames": 6, "fps": 8, "loop": true } } }
// scale and dy are per-bot tuning against the vector rig's footprint.
// Animation clips are parts named anim_<state> (idle, jump, land, fire, hit,
// death, s1, s2): a horizontal strip of equal frames on the same canvas as the
// still, produced by tools/intake_anim.py. Any missing clip falls back to the
// still plus the procedural squash and recoil, so partial sets are fine.

const BASE = 'art/sprites/';
const images = new Map();   // "bulwark:full" -> HTMLImageElement (loaded only)
let manifest = null;
let loading = false;

export function spritesReady() { return manifest !== null; }

// Kick off loading. Safe to call more than once; never throws.
export function loadSprites(onChange) {
  if (loading) return;
  loading = true;
  // Single-file builds inline the art as data URIs, since there is no art/ dir.
  const inlined = typeof window !== 'undefined' && window.__SUPERBOTS_SPRITES;
  if (inlined) {
    manifest = inlined.manifest || {};
    for (const [bot, parts] of Object.entries(manifest)) {
      for (const part of Object.keys(parts)) {
        const uri = inlined.data[`${bot}:${part}`];
        if (!uri) continue;
        const img = new Image();
        img.onload = () => { images.set(`${bot}:${part}`, img); if (onChange) onChange(); };
        img.onerror = () => {};
        img.src = uri;
      }
    }
    return;
  }
  // A bundled single-file build has no server to fetch from; without an http
  // origin the request only produces a CORS error in the console.
  if (typeof location !== 'undefined' && !/^https?:/.test(location.protocol)) { manifest = {}; return; }
  fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => {
      manifest = m || {};
      for (const [bot, parts] of Object.entries(manifest)) {
        for (const [part, spec] of Object.entries(parts)) {
          const file = typeof spec === 'string' ? spec : spec && spec.file;
          if (!file) continue;
          const img = new Image();
          img.onload = () => { images.set(`${bot}:${part}`, img); if (onChange) onChange(); };
          img.onerror = () => {};
          img.src = BASE + file;
        }
      }
      if (onChange) onChange();
    })
    .catch(() => { manifest = {}; });
}

export function getSprite(botId, part = 'full') {
  return images.get(`${botId}:${part}`) || null;
}

// Per-bot tuning, defaulting to neutral when the manifest omits it. Clips
// inherit the still's tuning unless they carry their own.
export function spriteTuning(botId, part = 'full') {
  const parts = manifest && manifest[botId];
  const spec = parts && parts[part];
  const base = parts && parts.full && typeof parts.full !== 'string' ? parts.full : null;
  if (!spec || typeof spec === 'string') return { scale: base ? base.scale ?? 1 : 1, dy: base ? base.dy ?? 0 : 0 };
  return { scale: spec.scale ?? (base ? base.scale ?? 1 : 1), dy: spec.dy ?? (base ? base.dy ?? 0 : 0) };
}

// A loaded animation clip for a bot state, or null. { img, frames, fps, loop, duration }
export function getClip(botId, anim) {
  const spec = manifest && manifest[botId] && manifest[botId]['anim_' + anim];
  const img = images.get(`${botId}:anim_${anim}`);
  if (!spec || !img) return null;
  const frames = Math.max(1, spec.frames | 0), fps = spec.fps || 12;
  return { img, frames, fps, loop: !!spec.loop, duration: frames / fps, part: 'anim_' + anim };
}

// Draw a loaded sprite centred on the current origin, sized against the rig
// radius R so painted art and vector rigs occupy the same footprint.
// frames/frame slice one cell out of a horizontal strip.
export function drawSpriteBody(ctx, img, R, botId, part = 'full', frames = 1, frame = 0) {
  const t = spriteTuning(botId, part);
  const fw = img.width / frames;
  const w = R * 2.6 * t.scale;
  const h = w * (img.height / fw);
  if (frames > 1) ctx.drawImage(img, fw * frame, 0, fw, img.height, -w / 2, -h / 2 + R * t.dy, w, h);
  else ctx.drawImage(img, -w / 2, -h / 2 + R * t.dy, w, h);
}
