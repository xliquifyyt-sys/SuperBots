// Painted sprite support. Sprites are optional: anything missing falls back to
// the vector rig, so a partial art set never breaks the game.
//
// art/sprites/manifest.json:
//   { "bulwark": { "full": "bot_bulwark_full.png", "scale": 1, "dy": 0 } }
// scale and dy are per-bot tuning against the vector rig's footprint.

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

// Per-bot tuning, defaulting to neutral when the manifest omits it.
export function spriteTuning(botId, part = 'full') {
  const spec = manifest && manifest[botId] && manifest[botId][part];
  if (!spec || typeof spec === 'string') return { scale: 1, dy: 0 };
  return { scale: spec.scale ?? 1, dy: spec.dy ?? 0 };
}

// Draw a loaded sprite centred on the current origin, sized against the rig
// radius R so painted art and vector rigs occupy the same footprint.
export function drawSpriteBody(ctx, img, R, botId, part = 'full') {
  const t = spriteTuning(botId, part);
  const w = R * 2.6 * t.scale;
  const h = w * (img.height / img.width);
  ctx.drawImage(img, -w / 2, -h / 2 + R * t.dy, w, h);
}
