// Painted map backgrounds. Optional: a map without one keeps its procedural
// backdrop, so a partial art set never breaks the game.
//
// art/maps/bg/manifest.json:
//   { "emberpit": { "file": "bg_emberpit.png", "parallax": 0.25, "anchor": "bottom" } }
// parallax is how far the image slides against the camera, 0 = locked, 1 = 1:1.

const BASE = 'art/maps/bg/';
const images = new Map();
let manifest = null;
let loading = false;

export function loadBackgrounds(onChange) {
  if (loading) return;
  loading = true;
  const inlined = typeof window !== 'undefined' && window.__SUPERBOTS_BG;
  if (inlined) {
    manifest = inlined.manifest || {};
    for (const id of Object.keys(manifest)) {
      const uri = inlined.data[id];
      if (!uri) continue;
      const img = new Image();
      img.onload = () => { images.set(id, img); if (onChange) onChange(); };
      img.onerror = () => {};
      img.src = uri;
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
      for (const [id, spec] of Object.entries(manifest)) {
        const file = typeof spec === 'string' ? spec : spec && spec.file;
        if (!file) continue;
        const img = new Image();
        img.onload = () => { images.set(id, img); if (onChange) onChange(); };
        img.onerror = () => {};
        img.src = BASE + file;
      }
    })
    .catch(() => { manifest = {}; });
}

export function getBackground(mapId) { return images.get(mapId) || null; }

function tuning(mapId) {
  const spec = manifest && manifest[mapId];
  if (!spec || typeof spec === 'string') return { parallax: 0.25, anchor: 'bottom' };
  return { parallax: spec.parallax ?? 0.25, anchor: spec.anchor ?? 'bottom' };
}

// Cover-fit the painting across the viewport and slide it against the camera.
// The image repeats horizontally so a wide map never runs past its edge.
export function drawBackground(ctx, img, mapId, view, cam, map) {
  const t = tuning(mapId);
  const scale = Math.max(view.w / img.width, view.h / img.height);
  const w = img.width * scale, h = img.height * scale;
  const y = t.anchor === 'bottom' ? view.h - h : (view.h - h) / 2;
  let x = -((cam.x - map.width / 2) * cam.zoom * t.parallax) - w / 2 + view.w / 2;
  x = ((x % w) + w) % w - w;           // wrap so the tiling never gaps
  for (let px = x; px < view.w; px += w) ctx.drawImage(img, px, y, w, h);
}
