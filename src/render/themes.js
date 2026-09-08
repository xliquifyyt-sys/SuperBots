// Theme painters: painted-style backgrounds, platforms, kill floors and hazard
// decorations for the five kits (lava, ice, jungle, sky, neo). Everything is
// procedural but seeded, so a map always looks the same.

const TAU = Math.PI * 2;
function hash(n) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Decor caches per map id so shapes don't jitter between frames.
const decorCache = new Map();
function decorFor(map, gen) {
  if (!decorCache.has(map.id)) decorCache.set(map.id, gen());
  return decorCache.get(map.id);
}

function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, col]) => g.addColorStop(t, col)); return g; }
function spike(c, x, baseY, w, h, dir) { c.beginPath(); c.moveTo(x - w / 2, baseY); c.lineTo(x, baseY + h * dir); c.lineTo(x + w / 2, baseY); c.closePath(); c.fill(); }

// ------------------------------------------------------------------ SKY / BACKDROP
// cam: { x, y, zoom }; view: { w, h, toScreen(x,y) }
export function paintBackdrop(c, T, map, view, cam, time) {
  const { w, h } = view;
  const z = cam.zoom;
  c.fillStyle = grad(c, 0, 0, 0, h, [[0, T.sky[0]], [1, T.sky[1]]]); c.fillRect(0, 0, w, h);
  const px = (k) => -(cam.x * k) * z; // parallax x offset for layer factor k
  const py = (k) => -(cam.y - map.height / 2) * k * z;
  const d = decorFor(map, () => {
    const items = [];
    for (let i = 0; i < 40; i++) items.push({ a: hash(i * 3 + 1), b: hash(i * 3 + 2), c: hash(i * 3 + 3), d: hash(i * 7 + 5) });
    return items;
  });
  switch (T.id) {
    case 'lava': {
      // far rock spires
      c.fillStyle = '#2a1210';
      for (let i = 0; i < 12; i++) { const x = ((d[i].a * 2600 + px(0.15)) % (w + 400) + w + 400) % (w + 400) - 200; const sw = 60 + d[i].b * 120, sh = h * (0.35 + d[i].c * 0.4); c.beginPath(); c.moveTo(x - sw, h); c.lineTo(x - sw * 0.2, h - sh); c.lineTo(x + sw * 0.15, h - sh * 0.9); c.lineTo(x + sw, h); c.closePath(); c.fill(); }
      c.fillStyle = '#3a1a14';
      for (let i = 12; i < 24; i++) { const x = ((d[i].a * 2600 + px(0.3)) % (w + 400) + w + 400) % (w + 400) - 200; const sw = 40 + d[i].b * 90, sh = h * (0.2 + d[i].c * 0.3); c.beginPath(); c.moveTo(x - sw, h); c.lineTo(x, h - sh); c.lineTo(x + sw, h); c.closePath(); c.fill(); }
      // heat glow near the floor
      c.fillStyle = grad(c, 0, h * 0.45, 0, h, [[0, 'rgba(255,90,30,0)'], [1, 'rgba(255,110,40,0.45)']]); c.fillRect(0, h * 0.45, w, h * 0.55);
      // embers rising
      c.fillStyle = '#ffb347';
      for (let i = 0; i < 40; i++) { const t = (time * (0.05 + d[i].c * 0.08) + d[i].a) % 1; const x = d[i].b * w + Math.sin(time + i) * 12; const y = h - t * h; c.globalAlpha = (1 - t) * 0.8; c.beginPath(); c.arc(x, y, 1.5 + d[i].d * 2, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      break;
    }
    case 'ice': {
      // back wall of ice with crystal spikes hanging and rising
      c.fillStyle = 'rgba(190,235,255,0.35)';
      for (let i = 0; i < 16; i++) { const x = ((d[i].a * 2400 + px(0.12)) % (w + 300) + w + 300) % (w + 300) - 150; spike(c, x, 0, 40 + d[i].b * 110, h * (0.25 + d[i].c * 0.45), 1); }
      c.fillStyle = 'rgba(120,200,240,0.45)';
      for (let i = 16; i < 30; i++) { const x = ((d[i].a * 2400 + px(0.25)) % (w + 300) + w + 300) % (w + 300) - 150; spike(c, x, 0, 30 + d[i].b * 70, h * (0.15 + d[i].c * 0.35), 1); spike(c, x + 60, h, 40 + d[i].d * 80, h * (0.15 + d[i].c * 0.3), -1); }
      // sparkles
      c.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) { const a = (Math.sin(time * 2 + i * 1.7) + 1) / 2; c.globalAlpha = a * 0.8; c.beginPath(); c.arc(d[i].a * w, d[i].b * h * 0.7, 1 + d[i].c * 2, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      // frost haze at the bottom
      c.fillStyle = grad(c, 0, h * 0.6, 0, h, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.35)']]); c.fillRect(0, h * 0.6, w, h * 0.4);
      break;
    }
    case 'jungle': {
      // light shafts
      c.fillStyle = 'rgba(255,250,200,0.12)';
      for (let i = 0; i < 5; i++) { const x = d[i].a * w; c.beginPath(); c.moveTo(x - 30, 0); c.lineTo(x + 40, 0); c.lineTo(x + 160, h); c.lineTo(x + 60, h); c.closePath(); c.fill(); }
      // far trunks and foliage
      c.fillStyle = '#1d6a5a';
      for (let i = 0; i < 10; i++) { const x = ((d[i].a * 2400 + px(0.12)) % (w + 300) + w + 300) % (w + 300) - 150; c.fillRect(x, h * 0.2, 28 + d[i].b * 30, h); c.beginPath(); c.arc(x + 20, h * (0.2 + d[i].c * 0.15), 90 + d[i].d * 80, 0, TAU); c.fill(); }
      c.fillStyle = '#165547';
      for (let i = 10; i < 20; i++) { const x = ((d[i].a * 2400 + px(0.25)) % (w + 300) + w + 300) % (w + 300) - 150; c.fillRect(x, h * 0.3, 20 + d[i].b * 24, h); c.beginPath(); c.arc(x + 15, h * (0.28 + d[i].c * 0.15), 70 + d[i].d * 70, 0, TAU); c.fill(); }
      // hanging vines
      c.strokeStyle = '#2f8f5f'; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 20; i < 34; i++) { const x = ((d[i].a * 2400 + px(0.35)) % (w + 300) + w + 300) % (w + 300) - 150; const len = h * (0.15 + d[i].b * 0.35); c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + Math.sin(time * 0.8 + i) * 20, len * 0.6, x + Math.sin(time * 0.6 + i) * 30, len); c.stroke(); c.fillStyle = '#4fbf6a'; c.beginPath(); c.ellipse(x + Math.sin(time * 0.6 + i) * 30, len, 9, 5, 0.6, 0, TAU); c.fill(); }
      // leafy canopy across the top
      c.fillStyle = '#2f8f5f';
      for (let i = 0; i < 24; i++) { const x = ((d[i].a * 2400 + px(0.4)) % (w + 300) + w + 300) % (w + 300) - 150; c.beginPath(); c.ellipse(x, -10 + d[i].b * 30, 70 + d[i].c * 60, 34 + d[i].d * 20, 0, 0, TAU); c.fill(); }
      break;
    }
    case 'sky': {
      // sun
      const sg = c.createRadialGradient(w * 0.78, h * 0.12, 0, w * 0.78, h * 0.12, w * 0.25); sg.addColorStop(0, 'rgba(255,245,200,0.9)'); sg.addColorStop(0.3, 'rgba(255,240,180,0.35)'); sg.addColorStop(1, 'rgba(255,240,180,0)');
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
      // far clouds
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 12; i++) { const x = ((d[i].a * 2600 + px(0.12) + time * 6) % (w + 400) + w + 400) % (w + 400) - 200; const y = h * (0.15 + d[i].b * 0.5); c.beginPath(); c.ellipse(x, y, 110 + d[i].c * 80, 26 + d[i].d * 14, 0, 0, TAU); c.ellipse(x + 50, y - 12, 60, 24, 0, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 12; i < 22; i++) { const x = ((d[i].a * 2600 + px(0.3) + time * 12) % (w + 400) + w + 400) % (w + 400) - 200; const y = h * (0.35 + d[i].b * 0.5); c.beginPath(); c.ellipse(x, y, 90 + d[i].c * 70, 30, 0, 0, TAU); c.ellipse(x - 40, y + 8, 60, 22, 0, 0, TAU); c.ellipse(x + 55, y + 6, 55, 20, 0, 0, TAU); c.fill(); }
      // birds
      c.strokeStyle = 'rgba(40,60,90,0.6)'; c.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const x = ((d[i].a * 2000 + time * 25 + i * 40) % (w + 100)) - 50; const y = h * (0.1 + d[i].b * 0.3) + Math.sin(time * 3 + i) * 4; c.beginPath(); c.moveTo(x - 7, y); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 7, y); c.stroke(); }
      break;
    }
    case 'neo': {
      // skyline
      for (const [k, col, hMul] of [[0.1, '#1b1a58', 0.55], [0.22, '#25207a', 0.45], [0.38, '#2c2a8a', 0.35]]) {
        c.fillStyle = col;
        for (let i = 0; i < 18; i++) { const x = ((d[i].a * 2600 + px(k)) % (w + 400) + w + 400) % (w + 400) - 200; const bw = 40 + d[i].b * 80, bh = h * (hMul * 0.5 + d[i].c * hMul); c.fillRect(x, h - bh, bw, bh); c.fillStyle = 'rgba(63,233,255,0.35)'; for (let r = 0; r < Math.floor(bh / 14); r++) for (let q = 0; q < Math.floor(bw / 14); q++) if (hash(i * 97 + r * 13 + q * 7 + k * 100) > 0.55) c.fillRect(x + 4 + q * 14, h - bh + 6 + r * 14, 6, 6); c.fillStyle = col; }
      }
      // neon signs
      for (let i = 0; i < 9; i++) { const x = ((d[i].a * 2600 + px(0.3)) % (w + 400) + w + 400) % (w + 400) - 200; const y = h * (0.15 + d[i].b * 0.5); const col = i % 2 ? '#ff3fd8' : '#3fe9ff'; c.save(); c.shadowColor = col; c.shadowBlur = 18; c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = 0.7 + Math.sin(time * 6 + i) * 0.3; c.strokeRect(x, y, 26 + d[i].c * 40, 60 + d[i].d * 80); c.restore(); }
      // holographic grid glow low in the scene
      c.strokeStyle = 'rgba(255,63,216,0.12)'; c.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const y = h * 0.55 + i * i * 3; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      // rain
      c.strokeStyle = 'rgba(180,220,255,0.25)'; c.lineWidth = 1;
      for (let i = 0; i < 60; i++) { const x = (d[i % 40].a * w + i * 13 + time * 40) % w; const y = (d[i % 40].b * h + time * 900 * (0.6 + d[i % 40].c * 0.6)) % h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 14); c.stroke(); }
      break;
    }
  }
}

// ------------------------------------------------------------------ PLATFORMS
// rects: array of { x, y, w, h } in screen px plus `world` rect; z = px per unit
export function paintTerrain(c, T, rects, z, time, slopes = []) {
  const O = '#0b0e14';
  c.lineJoin = 'round';
  // Slopes: filled triangles in the theme's rock colours with a top-edge stripe.
  for (const s of slopes) {
    const { x, y, w, h } = s;
    const topX = s.dir === 1 ? x + w : x, botX = s.dir === 1 ? x : x + w;
    const fill = T.id === 'ice' ? grad(c, x, y, x, y + h, [[0, '#eaf8ff'], [0.35, '#a9dcf5'], [1, '#4f8fc0']]) : (T.id === 'sky' ? grad(c, x, y, x, y + h, [[0, '#fff4d6'], [0.4, T.rock], [1, '#b89860']]) : grad(c, x, y, x, y + h, [[0, T.rockLite], [0.3, T.rock], [1, T.id === 'neo' ? '#14171f' : '#241412']]));
    c.beginPath(); c.moveTo(topX, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath();
    c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(2, z * 0.08); c.strokeStyle = T.id === 'ice' ? '#1e4a70' : (T.id === 'sky' ? '#6b5530' : O); c.stroke();
    // top stripe along the hypotenuse
    const sw = Math.max(4, z * 0.28);
    const nx = (y + h - y) / Math.hypot(w, h), ny = -(botX - topX) / Math.hypot(w, h); // unit normal (approximately up)
    c.save(); c.beginPath(); c.moveTo(topX, y); c.lineTo(botX, y + h); c.lineTo(botX + nx * sw * (s.dir === 1 ? -1 : 1) * 0, y + h + sw); c.lineTo(topX, y + sw); c.closePath(); c.clip();
    c.fillStyle = T.id === 'neo' ? '#d9e64a' : (T.id === 'jungle' ? T.rockTop : (T.id === 'ice' ? '#ffffff' : (T.id === 'sky' ? '#ffffff' : T.rockTop)));
    c.beginPath(); c.moveTo(topX, y); c.lineTo(botX, y + h); c.lineTo(botX, y + h + sw); c.lineTo(topX, y + sw); c.closePath(); c.fill();
    if (T.id === 'neo') { c.fillStyle = '#14171f'; const L = Math.hypot(w, h); const ux = (botX - topX) / L, uy = h / L; for (let d = 0; d < L; d += sw * 2) { c.beginPath(); c.moveTo(topX + ux * d, y + uy * d); c.lineTo(topX + ux * (d + sw), y + uy * (d + sw)); c.lineTo(topX + ux * (d + sw), y + uy * (d + sw) + sw); c.lineTo(topX + ux * d, y + uy * d + sw); c.closePath(); c.fill(); } }
    c.restore();
    void ny;
  }
  for (const r of rects) {
    if (r.world.step) continue;
    const { x, y, w, h } = r;
    const tall = r.world.h > r.world.w * 1.3;
    const lw = Math.max(2, z * 0.08);
    switch (T.id) {
      case 'lava': {
        c.fillStyle = grad(c, x, y, x, y + h, [[0, T.rockLite], [0.25, T.rock], [1, '#241412']]);
        c.beginPath(); c.roundRect(x, y, w, h, z * 0.12); c.fill(); c.lineWidth = lw; c.strokeStyle = O; c.stroke();
        c.fillStyle = T.rockTop; c.fillRect(x + 2, y, w - 4, Math.max(3, z * 0.18));
        // glowing cracks
        c.strokeStyle = `rgba(255,130,40,${0.55 + Math.sin(time * 3 + x * 0.01) * 0.25})`; c.lineWidth = Math.max(1.5, z * 0.05);
        for (let i = 0; i < Math.max(1, Math.floor(w / (z * 2.2))); i++) { const cx = x + z * 0.6 + i * z * 2.2; c.beginPath(); c.moveTo(cx, y + h * 0.35); c.lineTo(cx + z * 0.4, y + h * 0.6); c.lineTo(cx + z * 0.2, y + h * 0.85); c.stroke(); }
        break;
      }
      case 'ice': {
        c.fillStyle = grad(c, x, y, x, y + h, [[0, '#eaf8ff'], [0.35, '#a9dcf5'], [1, '#4f8fc0']]);
        c.beginPath(); c.roundRect(x, y, w, h, z * 0.18); c.fill(); c.lineWidth = lw; c.strokeStyle = '#1e4a70'; c.stroke();
        // snowy cap
        c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(x - 2, y - z * 0.1, w + 4, Math.max(4, z * 0.3), z * 0.12); c.fill(); c.strokeStyle = '#1e4a70'; c.lineWidth = lw * 0.8; c.stroke();
        // gloss
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + z * 0.3, y + z * 0.45, Math.max(6, w * 0.35), Math.max(2, z * 0.12));
        // icicles under wide platforms
        if (!tall) { c.fillStyle = '#d6f2ff'; c.strokeStyle = '#1e4a70'; c.lineWidth = lw * 0.6; for (let i = 0; i < Math.floor(w / (z * 1.1)); i++) { const ix = x + z * 0.5 + i * z * 1.1 + hash(i + x) * z * 0.3; const ih = z * (0.35 + hash(i * 3 + y) * 0.6); c.beginPath(); c.moveTo(ix - z * 0.14, y + h); c.lineTo(ix, y + h + ih); c.lineTo(ix + z * 0.14, y + h); c.closePath(); c.fill(); c.stroke(); } }
        break;
      }
      case 'jungle': {
        c.fillStyle = grad(c, x, y, x, y + h, [[0, T.rockLite], [0.3, T.rock], [1, '#33372f']]);
        c.beginPath(); c.roundRect(x, y, w, h, z * 0.1); c.fill(); c.lineWidth = lw; c.strokeStyle = O; c.stroke();
        // stone block seams
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = Math.max(1, z * 0.04);
        for (let yy = y + z * 0.9; yy < y + h; yy += z * 0.9) { c.beginPath(); c.moveTo(x + 2, yy); c.lineTo(x + w - 2, yy); c.stroke(); }
        for (let i = 0; i < Math.floor(w / (z * 1.4)); i++) { const sx = x + z * 0.7 + i * z * 1.4 + (Math.floor(i / 1) % 2) * z * 0.3; c.beginPath(); c.moveTo(sx, y + z * 0.3); c.lineTo(sx, y + h - 2); c.stroke(); }
        // mossy grass top
        c.fillStyle = T.rockTop; c.beginPath(); c.roundRect(x - 2, y - z * 0.08, w + 4, Math.max(4, z * 0.32), z * 0.1); c.fill(); c.strokeStyle = O; c.lineWidth = lw * 0.8; c.stroke();
        c.fillStyle = '#5fbf3f'; for (let i = 0; i < Math.floor(w / (z * 0.8)); i++) { const gx = x + z * 0.3 + i * z * 0.8; c.beginPath(); c.moveTo(gx, y + z * 0.2); c.lineTo(gx + z * 0.12, y - z * 0.3 - hash(i + x) * z * 0.2); c.lineTo(gx + z * 0.24, y + z * 0.2); c.fill(); }
        // vines dangling from wide platforms
        if (!tall) { c.strokeStyle = '#3f9f5f'; c.lineWidth = Math.max(1.5, z * 0.06); for (let i = 0; i < Math.floor(w / (z * 2.5)); i++) { const vx = x + z * 0.8 + i * z * 2.5; const vl = z * (0.8 + hash(i * 5 + x) * 1.2); c.beginPath(); c.moveTo(vx, y + h); c.quadraticCurveTo(vx + Math.sin(time + i) * z * 0.2, y + h + vl * 0.6, vx + Math.sin(time * 0.7 + i) * z * 0.25, y + h + vl); c.stroke(); } }
        break;
      }
      case 'sky': {
        c.fillStyle = grad(c, x, y, x, y + h, [[0, '#fff4d6'], [0.4, T.rock], [1, '#b89860']]);
        c.beginPath(); c.roundRect(x, y, w, h, z * 0.2); c.fill(); c.lineWidth = lw; c.strokeStyle = '#6b5530'; c.stroke();
        c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(x + 1, y, w - 2, Math.max(4, z * 0.25), z * 0.12); c.fill();
        c.fillStyle = T.accent; c.fillRect(x + z * 0.2, y + z * 0.32, w - z * 0.4, Math.max(2, z * 0.08));
        // cloud puffs beneath
        if (!tall) { c.fillStyle = 'rgba(255,255,255,0.95)'; c.strokeStyle = 'rgba(120,150,190,0.6)'; c.lineWidth = lw * 0.6; for (let i = 0; i < Math.floor(w / (z * 1.6)) + 1; i++) { const cx = x + z * 0.6 + i * z * 1.6; c.beginPath(); c.arc(cx, y + h + z * 0.1, z * (0.45 + hash(i + x) * 0.2), 0, TAU); c.fill(); c.stroke(); } }
        break;
      }
      case 'neo': {
        c.fillStyle = grad(c, x, y, x, y + h, [[0, T.rockLite], [0.3, T.rock], [1, '#14171f']]);
        c.beginPath(); c.roundRect(x, y, w, h, z * 0.08); c.fill(); c.lineWidth = lw; c.strokeStyle = O; c.stroke();
        // panel lines
        c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; for (let yy = y + z * 0.8; yy < y + h; yy += z * 0.8) { c.beginPath(); c.moveTo(x + 3, yy); c.lineTo(x + w - 3, yy); c.stroke(); }
        // hazard stripes on the top edge
        const sh = Math.max(4, z * 0.26);
        c.save(); c.beginPath(); c.rect(x, y, w, sh); c.clip(); c.fillStyle = '#d9e64a'; c.fillRect(x, y, w, sh); c.fillStyle = '#14171f'; for (let sx = x - sh; sx < x + w + sh; sx += sh * 2) { c.beginPath(); c.moveTo(sx, y); c.lineTo(sx + sh, y); c.lineTo(sx + sh * 2, y + sh); c.lineTo(sx + sh, y + sh); c.closePath(); c.fill(); } c.restore();
        c.strokeStyle = O; c.lineWidth = lw * 0.7; c.strokeRect(x, y, w, sh);
        // cyan underglow
        c.save(); c.shadowColor = T.light; c.shadowBlur = z * 0.5; c.fillStyle = T.light; c.fillRect(x + z * 0.1, y + h - Math.max(2, z * 0.06), w - z * 0.2, Math.max(2, z * 0.06)); c.restore();
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ KILL FLOOR
export function paintFloor(c, T, y0, view, z, time, toWorldX) {
  const { w, h } = view;
  switch (T.floor) {
    case 'void': {
      c.fillStyle = grad(c, 0, y0 - z * 3, 0, h, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.8)']]); c.fillRect(0, y0 - z * 3, w, h - y0 + z * 3);
      return;
    }
    case 'lava': {
      c.fillStyle = grad(c, 0, y0, 0, h, [[0, T.floorColor], [0.4, '#e8471a'], [1, T.floorDeep]]);
      wave(c, y0, w, h, z, time, toWorldX, 0.12);
      c.fillStyle = T.floorGlow; c.globalAlpha = 0.35;
      for (let i = 0; i < 16; i++) { const px = ((i * 137 + time * 25) % (w + 60)) - 30; c.beginPath(); c.arc(px, y0 + 12 + (i % 3) * 10, 3 + (i % 2) * 3, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      c.fillStyle = grad(c, 0, y0 - z * 1.6, 0, y0, [[0, 'rgba(255,120,40,0)'], [1, 'rgba(255,140,60,0.5)']]); c.fillRect(0, y0 - z * 1.6, w, z * 1.6);
      return;
    }
    case 'water': {
      c.fillStyle = grad(c, 0, y0, 0, h, [[0, T.floorColor], [1, T.floorDeep]]);
      wave(c, y0, w, h, z, time, toWorldX, 0.1);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const px = ((i * 173 + time * 30) % (w + 100)) - 50; c.beginPath(); c.moveTo(px, y0 + 8 + (i % 4) * 9); c.lineTo(px + 28 + (i % 3) * 10, y0 + 8 + (i % 4) * 9); c.stroke(); }
      if (T.id === 'ice') { c.fillStyle = '#e8f8ff'; c.strokeStyle = '#1e4a70'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const px = ((i * 211 + time * 10) % (w + 120)) - 60; const py = y0 + 4 + Math.sin(time * 1.5 + i) * 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 26, py - 4); c.lineTo(px + 38, py + 6); c.lineTo(px + 6, py + 8); c.closePath(); c.fill(); c.stroke(); } }
      c.fillStyle = grad(c, 0, y0 - z * 1.2, 0, y0, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(200,240,255,0.35)']]); c.fillRect(0, y0 - z * 1.2, w, z * 1.2);
      return;
    }
    case 'neon': {
      c.fillStyle = grad(c, 0, y0, 0, h, [[0, '#2a1c6e'], [1, '#07071a']]);
      wave(c, y0, w, h, z, time, toWorldX, 0.06);
      // neon reflections
      for (let i = 0; i < 12; i++) { const col = i % 2 ? T.accent : T.light; c.fillStyle = col; c.globalAlpha = 0.25 + Math.sin(time * 4 + i) * 0.1; c.fillRect(((i * 191 + time * 15) % (w + 80)) - 40, y0 + 6 + (i % 4) * 12, 40 + (i % 3) * 20, 3); }
      c.globalAlpha = 1;
      c.save(); c.shadowColor = T.accent; c.shadowBlur = 16; c.strokeStyle = T.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(0, y0); c.lineTo(w, y0); c.stroke(); c.restore();
      return;
    }
  }
}
function wave(c, y0, w, h, z, time, toWorldX, amp) {
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) { const wx = toWorldX(x); c.lineTo(x, y0 + Math.sin(wx * 1.7 + time * 2.2) * z * amp + Math.sin(wx * 0.6 - time * 1.1) * z * amp * 0.7); }
  c.lineTo(w, h); c.closePath(); c.fill();
}

// ------------------------------------------------------------------ MINES & HAZARD DECOR
export function paintMine(c, x, y, z, time, alive) {
  const r = z * 0.42;
  c.save(); c.translate(x, y + Math.sin(time * 2 + x * 0.01) * z * 0.08);
  if (!alive) { c.globalAlpha = 0.25; }
  c.rotate(time * 0.8);
  c.fillStyle = '#c8ced8'; c.strokeStyle = '#0b0e14'; c.lineWidth = Math.max(1.5, z * 0.06);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(Math.cos(a - 0.25) * r * 0.6, Math.sin(a - 0.25) * r * 0.6); c.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); c.lineTo(Math.cos(a + 0.25) * r * 0.6, Math.sin(a + 0.25) * r * 0.6); c.closePath(); c.fill(); c.stroke(); }
  const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); g.addColorStop(0, '#6a2a2a'); g.addColorStop(1, '#1a0f12');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = (Math.sin(time * 6) > 0 && alive) ? '#ff2f4a' : '#5a1020'; c.beginPath(); c.arc(0, 0, r * 0.22, 0, TAU); c.fill();
  c.restore();
}

// Crusher-type hazard drop drawn per theme: icicles (ice), a log (jungle), a press (others).
export function paintCrusher(c, T, x, y, w, hgt, k, z) {
  if (T.id === 'ice') {
    c.fillStyle = '#e6f6ff'; c.strokeStyle = '#1e4a70'; c.lineWidth = Math.max(2, z * 0.07);
    const n = Math.max(3, Math.floor(w / (z * 0.9)));
    for (let i = 0; i < n; i++) { const ix = x + (i + 0.5) * (w / n); const ih = hgt * (0.7 + hash(i) * 0.3); c.beginPath(); c.moveTo(ix - z * 0.4, y); c.lineTo(ix, y + ih); c.lineTo(ix + z * 0.4, y); c.closePath(); c.fill(); c.stroke(); }
  } else if (T.id === 'jungle') {
    c.fillStyle = grad(c, x, y + hgt - z * 1.2, x, y + hgt, [[0, '#8a5a3a'], [1, '#4a2e1c']]); c.strokeStyle = '#0b0e14'; c.lineWidth = Math.max(2, z * 0.07);
    c.beginPath(); c.roundRect(x, y + hgt - z * 1.2, w, z * 1.2, z * 0.6); c.fill(); c.stroke();
    c.strokeStyle = '#6b4a2f'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 6, y + hgt - z * 0.9 + i * z * 0.3); c.lineTo(x + w - 6, y + hgt - z * 0.9 + i * z * 0.3); c.stroke(); }
  } else {
    c.fillStyle = '#5b6577'; c.fillRect(x, y, w, hgt); c.strokeStyle = '#0b0e14'; c.lineWidth = 3; c.strokeRect(x, y, w, hgt);
    c.fillStyle = T.accent; for (let i = 0; i < 6; i++) c.fillRect(x + i * w / 6, y + hgt - 8, w / 12, 8);
  }
}
