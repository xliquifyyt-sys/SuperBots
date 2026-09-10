// Painted terrain kits. A map listed in art/maps/terrain/manifest.json draws its
// collision rects with painted tiles instead of the procedural theme painter:
//
//   { "emberpit": { "top": "lava_ember_top.jpg", "face": "lava_ember_face.jpg",
//                   "tile": 2.2, "lift": 0.18 } }
//
// top   – the surface crust strip, repeated along the top edge of every platform
// face  – the body texture, repeated in both directions under the crust
// tile  – how many world units one repeat of the face texture spans horizontally
// topTile – the same for the crust strip (defaults to tile)
// lift  – how far (world units) the crust rises above the collision surface
//
// Maps without an entry keep the procedural look, so a partial art set is fine.

const BASE = 'art/maps/terrain/';
const images = new Map();   // "mapId:piece" -> Image
let manifest = null;
let loading = false;

export function loadTerrain(onChange) {
  if (loading) return;
  loading = true;
  const inlined = typeof window !== 'undefined' && window.__SUPERBOTS_TERRAIN;
  if (inlined) {
    manifest = inlined.manifest || {};
    for (const [id, spec] of Object.entries(manifest)) {
      for (const piece of ['top', 'face']) {
        const uri = inlined.data[`${id}:${piece}`];
        if (!uri) continue;
        const img = new Image();
        img.onload = () => { images.set(`${id}:${piece}`, img); if (onChange) onChange(); };
        img.onerror = () => {};
        img.src = uri;
      }
    }
    return;
  }
  if (typeof location !== 'undefined' && !/^https?:/.test(location.protocol)) { manifest = {}; return; }
  fetch(BASE + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => {
      manifest = m || {};
      for (const [id, spec] of Object.entries(manifest)) {
        for (const piece of ['top', 'face']) {
          if (!spec || !spec[piece]) continue;
          const img = new Image();
          img.onload = () => { images.set(`${id}:${piece}`, img); if (onChange) onChange(); };
          img.onerror = () => {};
          img.src = BASE + spec[piece];
        }
      }
    })
    .catch(() => { manifest = {}; });
}

// Returns the kit for a map once both pieces have loaded, else null.
export function getTerrainKit(mapId) {
  const spec = manifest && manifest[mapId];
  if (!spec) return null;
  const top = images.get(`${mapId}:top`), face = images.get(`${mapId}:face`);
  if (!top || !face) return null;
  return { top, face, tile: spec.tile ?? 2, topTile: spec.topTile ?? spec.tile ?? 2, lift: spec.lift ?? 0.15 };
}

const OUTLINE = '#0b0709';

function pattern(c, img, scale, ox, oy) {
  const p = c.createPattern(img, 'repeat');
  if (p && p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oy]));
  return p;
}

// rects / slopes come in screen space (see Renderer.drawTerrain); z = px per unit.
export function paintPaintedTerrain(c, kit, rects, z, slopes = []) {
  const s = (kit.tile * z) / kit.face.width;          // face px -> screen px
  const st = (kit.topTile * z) / kit.top.width;
  const topH = kit.top.height * st;
  const lift = kit.lift * z;
  const lw = Math.max(2, z * 0.08);
  c.lineJoin = 'round';

  for (const sl of slopes) {
    const { x, y, w, h } = sl;
    const topX = sl.dir === 1 ? x + w : x, botX = sl.dir === 1 ? x : x + w;
    c.save();
    c.beginPath(); c.moveTo(topX, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath();
    c.fillStyle = pattern(c, kit.face, s, x, y); c.fill();
    c.restore();
    // crust along the hypotenuse, drawn in a rotated frame from the high end down
    const L = Math.hypot(w, h), ang = Math.atan2(h, botX - topX);
    c.save(); c.translate(topX, y); c.rotate(ang);
    c.fillStyle = pattern(c, kit.top, st, 0, -lift); c.fillRect(0, -lift, L, topH);
    c.restore();
    c.beginPath(); c.moveTo(topX, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath();
    c.lineWidth = lw; c.strokeStyle = OUTLINE; c.stroke();
  }

  for (const r of rects) {
    if (r.world.step) continue;
    const { x, y, w, h } = r;
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = pattern(c, kit.face, s, x, y); c.fillRect(x, y, w, h);
    // side shading so stacked blocks read as separate slabs
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, Math.max(2, z * 0.12), h);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + w - Math.max(2, z * 0.16), y, Math.max(2, z * 0.16), h);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y + h - Math.max(2, z * 0.2), w, Math.max(2, z * 0.2));
    c.restore();
    // crust: rises a little above the collision top and overhangs the ends slightly
    const over = Math.max(1, z * 0.05);
    c.fillStyle = pattern(c, kit.top, st, x, y - lift);
    c.fillRect(x - over, y - lift, w + over * 2, Math.min(topH, h + lift));
    c.lineWidth = lw; c.strokeStyle = OUTLINE;
    c.strokeRect(x - over, y - lift, w + over * 2, h + lift);
  }
}
