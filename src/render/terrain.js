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
// outline – outline colour (default near-black); icicles – draw an icicle fringe
//           under platforms. Rects flagged noCap / noFringe skip crust / fringe.
// snowCap – paint a scalloped snow mound over the top edge (ice kits).
// grass / vines – grass blades along the top edge, vines hanging under wide platforms (jungle kits).
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
  return { top, face, tile: spec.tile ?? 2, topTile: spec.topTile ?? spec.tile ?? 2, lift: spec.lift ?? 0.15, outline: spec.outline || OUTLINE, icicles: !!spec.icicles, snowCap: !!spec.snowCap, grass: !!spec.grass, vines: !!spec.vines };
}

const OUTLINE = '#0b0709';
const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

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
    c.lineWidth = lw; c.strokeStyle = kit.outline; c.stroke();
    if (kit.snowCap) {
      const sw = Math.max(4, z * 0.32);
      c.save(); c.translate(topX, y); c.rotate(ang);
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(-sw * 0.3, -sw * 0.55, L + sw * 0.6, sw, sw * 0.5); c.fill();
      c.strokeStyle = 'rgba(140,200,230,0.8)'; c.lineWidth = Math.max(1, lw * 0.5); c.stroke();
      c.restore();
    }
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
    const cap = !r.world.noCap;
    if (cap) { c.fillStyle = pattern(c, kit.top, st, x, y - lift); c.fillRect(x - over, y - lift, w + over * 2, Math.min(topH, h + lift)); }
    c.lineWidth = lw; c.strokeStyle = kit.outline;
    if (cap) c.strokeRect(x - over, y - lift, w + over * 2, h + lift); else c.strokeRect(x, y, w, h);
    if (kit.snowCap && cap) {
      const capH = Math.max(6, z * 0.4), ov = z * 0.14;
      const g = c.createLinearGradient(x, y - capH * 0.6, x, y + capH); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8effc');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - ov, y + capH * 0.6);
      const bumps = Math.max(2, Math.round(w / (z * 1.1)));
      for (let i = 0; i <= bumps; i++) { const bx = x - ov + ((w + ov * 2) * i) / bumps; const by = y - capH * (0.35 + hash(i * 7 + x) * 0.5); c.quadraticCurveTo(bx - (w + ov * 2) / bumps / 2, by, bx, y + capH * (0.25 + hash(i + x) * 0.3)); }
      c.lineTo(x + w + ov, y + capH * 0.6); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(140,200,230,0.8)'; c.lineWidth = Math.max(1, lw * 0.5); c.stroke();
    }
    if (kit.grass && cap) {
      c.fillStyle = '#7fd43a';
      for (let i = 0; i < Math.floor(w / (z * 0.8)); i++) { const gx = x + z * 0.3 + i * z * 0.8; c.beginPath(); c.moveTo(gx, y - lift + z * 0.05); c.lineTo(gx + z * 0.12, y - lift - z * 0.3 - hash(i + x) * z * 0.2); c.lineTo(gx + z * 0.24, y - lift + z * 0.05); c.fill(); }
    }
    if (kit.vines && !r.world.noFringe && r.world.h <= r.world.w * 1.3) {
      c.strokeStyle = '#3f9f5f'; c.lineWidth = Math.max(1.5, z * 0.06);
      for (let i = 0; i < Math.floor(w / (z * 2.5)); i++) { const vx = x + z * 0.8 + i * z * 2.5 + hash(i * 11 + x) * z; const vl = z * (0.8 + hash(i * 5 + x) * 1.2); c.beginPath(); c.moveTo(vx, y + h); c.quadraticCurveTo(vx + z * 0.15, y + h + vl * 0.6, vx - z * 0.1, y + h + vl); c.stroke(); }
    }
    if (kit.icicles && !r.world.noFringe) {
      c.strokeStyle = kit.outline; c.lineWidth = lw * 0.5;
      const n = Math.max(2, Math.floor(w / (z * 0.75)));
      for (let i = 0; i < n; i++) {
        const ix = x + z * 0.25 + (i * (w - z * 0.5)) / Math.max(1, n - 1) + hash(i + x) * z * 0.2;
        const big = i % 3 === 1; const ih = z * (big ? 0.55 + hash(i * 3 + y) * 0.7 : 0.22 + hash(i * 3 + y) * 0.3);
        const g = c.createLinearGradient(ix, y + h, ix, y + h + ih); g.addColorStop(0, '#dff4ff'); g.addColorStop(1, '#8fd0f0');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(ix - z * (big ? 0.16 : 0.1), y + h); c.lineTo(ix, y + h + ih); c.lineTo(ix + z * (big ? 0.16 : 0.1), y + h); c.closePath(); c.fill(); c.stroke();
      }
    }
  }
}
