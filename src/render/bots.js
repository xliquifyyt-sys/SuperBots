import { getSprite, drawSpriteBody } from './sprites.js';
// Bot rigs, second pass: heavy painted-style vector art in the language of the
// reference art — armoured bodies with a glowing core window, one oversized
// weapon up front, chunky mobility parts below, gradient shading, hot rim
// highlights and a ground shadow. Every rig animates its own moves.
//
// drawBot(ctx, def, r, state, time)
//   r     = bot radius in pixels (the collision radius; art extends to ~1.6r)
//   state = { anim: 'idle'|'jump'|'land'|'fire'|'s1'|'s2'|'hit'|'death', t: 0..1,
//             facing: 1|-1, vx, vy, grounded, color, hp: 0..1, id }
// Origin at the bot centre, +y down, +x is the facing direction.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const pulse = (t, k = 1) => Math.sin(clamp(t, 0, 1) * Math.PI) * k;
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (h, f) => { const [r, g, b] = hex2rgb(h); const m = (c) => clamp(Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)), 0, 255); return `rgb(${m(r)},${m(g)},${m(b)})`; };
const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };

// ---------- paint helpers ----------
function metal(c, x0, y0, x1, y1, base) { // top-lit gradient
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, -0.45));
  return g;
}
function outline(c, r, k = 0.1) { c.lineWidth = Math.max(2, r * k); c.strokeStyle = '#0b0e14'; c.lineJoin = 'round'; c.lineCap = 'round'; }
function rr(c, x, y, w, h, rad) { c.beginPath(); c.roundRect(x, y, w, h, rad); }
function fs(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
function gloss(c, x, y, rx, ry, a = 0.35, rot = -0.4) { c.save(); c.globalAlpha = a; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); c.restore(); }
function rim(c, path, r, color = '#fff', a = 0.5) { c.save(); c.globalAlpha = a; c.lineWidth = Math.max(1.5, r * 0.045); c.strokeStyle = color; path(); c.stroke(); c.restore(); }
function glow(c, x, y, rad, color, a = 0.6) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
}
// Glowing core window: dark bezel, radial-lit glass, sparkle.
function core(c, x, y, w, h, color, r, intensity = 1) {
  rr(c, x - w / 2 - r * 0.07, y - h / 2 - r * 0.07, w + r * 0.14, h + r * 0.14, r * 0.14); fs(c, '#14171f');
  const g = c.createRadialGradient(x - w * 0.15, y - h * 0.15, 0, x, y, Math.max(w, h) * 0.7);
  g.addColorStop(0, shade(color, 0.7)); g.addColorStop(0.4, color); g.addColorStop(1, shade(color, -0.5));
  rr(c, x - w / 2, y - h / 2, w, h, r * 0.1); c.fillStyle = g; c.fill();
  c.save(); c.globalAlpha = 0.5 * intensity; glow(c, x, y, Math.max(w, h) * 0.9, color, 0.8); c.restore();
  gloss(c, x - w * 0.2, y - h * 0.25, w * 0.28, h * 0.16, 0.45, -0.3);
}
// Spiked wheel with a hub, rotated by spin.
function spikedWheel(c, x, y, rad, spin, color, r) {
  c.save(); c.translate(x, y); c.rotate(spin);
  outline(c, r, 0.08);
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.lineTo(Math.cos(a) * rad * 1.25, Math.sin(a) * rad * 1.25); c.lineTo(Math.cos(a + TAU / 16) * rad * 0.95, Math.sin(a + TAU / 16) * rad * 0.95); }
  c.closePath(); fs(c, metal(c, 0, -rad, 0, rad, color));
  c.beginPath(); c.arc(0, 0, rad * 0.78, 0, TAU); fs(c, '#1f232c');
  c.beginPath(); c.arc(0, 0, rad * 0.45, 0, TAU); fs(c, metal(c, 0, -rad * 0.45, 0, rad * 0.45, '#8a93a6'));
  c.fillStyle = '#0b0e14'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.arc(Math.cos(a) * rad * 0.28, Math.sin(a) * rad * 0.28, rad * 0.07, 0, TAU); c.fill(); }
  c.restore();
}
function tyreWheel(c, x, y, rad, spin, color, r) {
  c.save(); c.translate(x, y); c.rotate(spin);
  outline(c, r, 0.08);
  c.beginPath(); c.arc(0, 0, rad, 0, TAU); fs(c, '#1f232c');
  c.fillStyle = '#343a47'; for (let i = 0; i < 10; i++) { const a = i * TAU / 10; c.beginPath(); c.arc(Math.cos(a) * rad * 0.85, Math.sin(a) * rad * 0.85, rad * 0.14, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(0, 0, rad * 0.55, 0, TAU); fs(c, metal(c, 0, -rad * 0.55, 0, rad * 0.55, color));
  c.beginPath(); c.arc(0, 0, rad * 0.22, 0, TAU); fs(c, '#d8dde8');
  c.restore();
}
// Big barrel: base ring, tube, muzzle brake. len along +x from (x,y).
function cannon(c, x, y, len, thick, color, r, recoil = 0) {
  c.save(); c.translate(x - recoil * len * 0.25, y);
  outline(c, r, 0.09);
  rr(c, 0, -thick * 0.75, len * 0.28, thick * 1.5, thick * 0.3); fs(c, metal(c, 0, -thick, 0, thick, shade(color, -0.2)));
  rr(c, len * 0.2, -thick / 2, len * 0.62, thick, thick * 0.2); fs(c, metal(c, 0, -thick / 2, 0, thick / 2, '#3a4150'));
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(len * 0.22, -thick * 0.42, len * 0.58, thick * 0.18);
  rr(c, len * 0.78, -thick * 0.68, len * 0.24, thick * 1.36, thick * 0.25); fs(c, metal(c, 0, -thick, 0, thick, color));
  c.fillStyle = '#0b0e14'; c.beginPath(); c.arc(len * 1.0, 0, thick * 0.3, 0, TAU); c.fill();
  c.fillStyle = '#0b0e14'; for (let i = 0; i < 3; i++) c.fillRect(len * 0.82 + i * len * 0.06, -thick * 0.62, len * 0.025, thick * 1.24);
  c.restore();
}
function muzzleFlash(c, x, y, r, color, t) {
  if (t <= 0 || t >= 1) return;
  const k = 1 - t;
  c.save(); c.translate(x, y); c.globalAlpha = k;
  glow(c, 0, 0, r * 1.2 * k, color, 0.9);
  c.fillStyle = '#fff'; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8, L = (i % 2 ? 0.5 : 1.1) * r * k; c.lineTo(Math.cos(a) * L, Math.sin(a) * L * 0.7); }
  c.closePath(); c.fill(); c.restore();
}
function shadow(c, r, w = 1.5, dy = 1.15) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(r * 0.15, r * dy, r * w, r * 0.22, 0, 0, TAU); c.fill(); c.restore(); }
function bolt(c, x, y, r, color) { c.fillStyle = shade(color, -0.3); c.beginPath(); c.arc(x, y, r * 0.06, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - r * 0.015, y - r * 0.015, r * 0.025, 0, TAU); c.fill(); }
function lightning(c, x1, y1, x2, y2, seg, amp, color, w) {
  c.save(); c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1);
  for (let i = 1; i < seg; i++) { const t = i / seg; c.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * amp, y1 + (y2 - y1) * t + (Math.random() - 0.5) * amp); }
  c.lineTo(x2, y2); c.stroke(); c.restore();
}

function bodyTransform(st) {
  let sx = 1, sy = 1, dy = 0, rot = 0;
  const t = st.t;
  switch (st.anim) {
    case 'jump': if (t < 0.25) { const k = t / 0.25; sx = 1 + 0.16 * k; sy = 1 - 0.2 * k; dy = 0.1 * k; } else { const k = ease((t - 0.25) / 0.75); sx = 1 + 0.08 * (1 - k); sy = 1 + 0.16 * (1 - k); } break;
    case 'land': { const k = pulse(t); sx = 1 + 0.2 * k; sy = 1 - 0.25 * k; dy = 0.12 * k; break; }
    case 'fire': { const k = pulse(t * 1.4); rot = -0.05 * k; dy = 0.03 * k; break; }
    case 'hit': { const k = pulse(t); sx = 1 - 0.07 * k; sy = 1 + 0.05 * k; rot = 0.1 * k * Math.sin(t * 40); break; }
    case 'death': rot = t * 0.9; dy = -0.15 * t; break;
    case 's1': case 's2': { const k = pulse(t); sy = 1 + 0.04 * k; break; }
  }
  if (!st.grounded && st.anim !== 'jump') { const v = clamp((st.vy || 0) / 22, -0.12, 0.12); sy = 1 + Math.abs(v); sx = 1 - Math.abs(v) * 0.6; }
  return { sx, sy, dy, rot };
}

// ============================ RIGS ============================
const RIGS = {
  // BULWARK — heavy wheeled gun platform. Three spiked wheels, slab hull with a blue core window, huge cannon, top hatch.
  bulwark(c, r, st, T) {
    const col = st.color, gold = '#e0a33a';
    const spin = (st.vx || 0) * 0.12 + (st.grounded ? Math.sin(T) * 0.02 : T * 3);
    const recoil = st.anim === 's2' ? pulse(st.t * 1.6) : (st.anim === 'fire' ? pulse(st.t * 1.4) * 0.5 : 0);
    const plate = st.anim === 's1' ? ease(st.t * 2) : 0;
    shadow(c, r, 1.6);
    // wheels (back layer)
    for (const x of [-r * 0.85, 0, r * 0.85]) spikedWheel(c, x, r * 0.72, r * 0.42, spin, gold, r);
    // hull
    outline(c, r);
    c.beginPath(); c.moveTo(-r * 1.3, r * 0.55); c.lineTo(-r * 1.2, -r * 0.35); c.lineTo(-r * 0.9, -r * 0.62); c.lineTo(r * 0.75, -r * 0.62); c.lineTo(r * 1.2, -r * 0.2); c.lineTo(r * 1.25, r * 0.55); c.closePath();
    fs(c, metal(c, 0, -r * 0.6, 0, r * 0.6, col));
    rim(c, () => { c.beginPath(); c.moveTo(-r * 0.9, -r * 0.6); c.lineTo(r * 0.75, -r * 0.6); }, r);
    // armour bands
    rr(c, -r * 1.22, r * 0.2, r * 2.4, r * 0.3, r * 0.06); fs(c, metal(c, 0, r * 0.2, 0, r * 0.5, shade(col, -0.3)));
    for (let i = 0; i < 5; i++) bolt(c, -r * 1.0 + i * r * 0.5, r * 0.35, r, gold);
    // core window
    core(c, -r * 0.2, -r * 0.1, r * 0.9, r * 0.55, '#3aa0ff', r, 0.8 + pulse(st.anim === 'hit' ? st.t : 0) * 0.5);
    // hatch
    rr(c, -r * 0.55, -r * 0.95, r * 0.7, r * 0.4, r * 0.1); fs(c, metal(c, 0, -r * 0.95, 0, -r * 0.55, col));
    rr(c, -r * 0.45, -r * 1.05, r * 0.5, r * 0.14, r * 0.05); fs(c, gold);
    // nose shield plate — extends for Bastion Wall
    c.save(); c.translate(r * 1.2 + plate * r * 0.55, 0);
    rr(c, -r * 0.08, -r * 0.7 - plate * r * 0.35, r * 0.24, r * 1.35 + plate * r * 0.7, r * 0.06); fs(c, metal(c, 0, -r, 0, r, gold));
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-r * 0.03, -r * 0.6 - plate * r * 0.35, r * 0.06, r * 1.15 + plate * r * 0.7);
    c.restore();
    // main cannon (front layer)
    cannon(c, r * 0.2, -r * 0.35, r * 1.35, r * 0.3, gold, r, recoil);
    muzzleFlash(c, r * 1.6, -r * 0.35, r * (st.anim === 's2' ? 1.3 : 0.8), '#ffb347', st.anim === 'fire' || st.anim === 's2' ? st.t * 1.6 : 0);
  },

  // MAGMAW — beast tank. Dinosaur head with a molten jaw, spiked shell, lava core, clawed feet over stub wheels.
  magmaw(c, r, st, T) {
    const col = st.color, hide = '#5a3a2a', bone = '#e8c27a';
    const jaw = st.anim === 's2' ? pulse(st.t) * 0.85 : (st.anim === 'fire' ? pulse(st.t) * 0.5 : 0.1 + Math.sin(T * 2) * 0.04);
    const heat = st.anim === 's1' ? 0.7 + pulse(st.t) * 0.5 : 0.7 + Math.sin(T * 3) * 0.15;
    const spin = (st.vx || 0) * 0.12 + T * 0.3;
    shadow(c, r, 1.6);
    for (const x of [-r * 0.75, r * 0.15]) spikedWheel(c, x, r * 0.75, r * 0.36, spin, bone, r);
    // claws
    outline(c, r);
    for (const x of [-r * 1.0, r * 0.45]) { c.beginPath(); c.moveTo(x - r * 0.25, r * 0.45); c.lineTo(x - r * 0.35, r * 0.95); c.lineTo(x - r * 0.05, r * 0.8); c.lineTo(x + 0, r * 1.0); c.lineTo(x + r * 0.2, r * 0.8); c.lineTo(x + r * 0.35, r * 0.95); c.lineTo(x + r * 0.25, r * 0.45); c.closePath(); fs(c, metal(c, 0, r * 0.4, 0, r, bone)); }
    // shell body
    c.beginPath(); c.moveTo(-r * 1.3, r * 0.45); c.quadraticCurveTo(-r * 1.35, -r * 0.7, -r * 0.3, -r * 0.8); c.quadraticCurveTo(r * 0.5, -r * 0.85, r * 0.85, -r * 0.3); c.lineTo(r * 0.85, r * 0.45); c.closePath();
    fs(c, metal(c, 0, -r * 0.8, 0, r * 0.5, hide));
    // spines
    for (let i = 0; i < 5; i++) { const x = -r * 1.05 + i * r * 0.4, h = r * (0.35 + (i % 2) * 0.15); c.beginPath(); c.moveTo(x, -r * 0.62); c.lineTo(x + r * 0.13, -r * 0.62 - h); c.lineTo(x + r * 0.3, -r * 0.6); c.closePath(); fs(c, metal(c, 0, -r, 0, -r * 0.5, bone)); }
    // lava core window
    core(c, -r * 0.3, -r * 0.1, r * 1.0, r * 0.6, '#ff5a1f', r, heat);
    // cracks glow
    c.save(); c.strokeStyle = rgba('#ffb347', heat * 0.8); c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(-r * 1.1, -r * 0.1); c.lineTo(-r * 0.95, -r * 0.4); c.lineTo(-r * 0.75, -r * 0.3); c.moveTo(r * 0.3, -r * 0.55); c.lineTo(r * 0.5, -r * 0.35); c.lineTo(r * 0.7, -r * 0.45); c.stroke(); c.restore();
    // head
    c.save(); c.translate(r * 0.95, -r * 0.15);
    outline(c, r);
    c.beginPath(); c.moveTo(-r * 0.35, -r * 0.45); c.lineTo(r * 0.75, -r * 0.42); c.lineTo(r * 0.95, -r * 0.05); c.lineTo(r * 0.85, r * 0.12); c.lineTo(-r * 0.35, r * 0.15); c.closePath(); fs(c, metal(c, 0, -r * 0.45, 0, r * 0.15, hide));
    // lower jaw
    c.save(); c.translate(-r * 0.3, r * 0.1); c.rotate(jaw * 0.6);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.1, r * 0.02); c.lineTo(r * 1.0, r * 0.3); c.lineTo(r * 0.05, r * 0.32); c.closePath(); fs(c, metal(c, 0, 0, 0, r * 0.3, shade(hide, -0.2)));
    c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(r * 0.15 + i * r * 0.18, r * 0.02); c.lineTo(r * 0.22 + i * r * 0.18, r * 0.2); c.lineTo(r * 0.3 + i * r * 0.18, r * 0.02); c.fill(); }
    c.restore();
    // mouth glow + upper teeth
    c.fillStyle = rgba('#ffb347', 0.35 + jaw * 0.6); c.beginPath(); c.ellipse(r * 0.3, r * 0.1, r * 0.45, r * 0.08 + jaw * r * 0.2, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-r * 0.1 + i * r * 0.18, r * 0.12); c.lineTo(-r * 0.03 + i * r * 0.18, r * 0.3); c.lineTo(r * 0.04 + i * r * 0.18, r * 0.12); c.fill(); }
    // eye
    glow(c, r * 0.25, -r * 0.22, r * 0.25, '#b6ff3a', 0.7); c.fillStyle = '#c8ff4a'; c.beginPath(); c.ellipse(r * 0.25, -r * 0.22, r * 0.12, r * 0.07, 0, 0, TAU); c.fill(); c.fillStyle = '#0b0e14'; c.beginPath(); c.arc(r * 0.29, -r * 0.22, r * 0.035, 0, TAU); c.fill();
    // brow horns
    c.beginPath(); c.moveTo(-r * 0.1, -r * 0.45); c.lineTo(0, -r * 0.75); c.lineTo(r * 0.12, -r * 0.45); c.closePath(); fs(c, bone);
    muzzleFlash(c, r * 1.0, r * 0.1, r * 0.9, '#ff8a2f', st.anim === 's2' ? st.t * 1.5 : 0);
    c.restore();
  },

  // VOLT — energy strike craft. Hover chassis, rune battery core, twin tesla coils, coil cannon.
  volt(c, r, st, T) {
    const col = st.color, steel = '#5a6376', cyan = '#5ff2ff';
    const charge = st.anim === 's1' ? clamp(st.t * 3, 0, 1) : (st.anim === 's2' ? pulse(st.t) : 0.25 + Math.sin(T * 8) * 0.1);
    const hover = Math.sin(T * 5) * r * 0.04;
    shadow(c, r, 1.5, 1.2);
    // repulsor field
    c.save(); c.globalAlpha = 0.5 + Math.sin(T * 14) * 0.15; glow(c, 0, r * 0.9, r * 1.2, cyan, 0.7); c.restore();
    c.translate(0, hover);
    outline(c, r);
    // pad
    rr(c, -r * 1.2, r * 0.45, r * 2.4, r * 0.35, r * 0.15); fs(c, metal(c, 0, r * 0.45, 0, r * 0.8, steel));
    c.fillStyle = cyan; c.fillRect(-r * 1.0, r * 0.66, r * 2.0, r * 0.07);
    for (let i = 0; i < 4; i++) bolt(c, -r * 0.9 + i * r * 0.6, r * 0.55, r, steel);
    // body
    c.beginPath(); c.moveTo(-r * 1.25, r * 0.45); c.lineTo(-r * 1.05, -r * 0.4); c.lineTo(-r * 0.4, -r * 0.7); c.lineTo(r * 0.7, -r * 0.7); c.lineTo(r * 1.15, -r * 0.15); c.lineTo(r * 1.2, r * 0.45); c.closePath();
    fs(c, metal(c, 0, -r * 0.7, 0, r * 0.45, col));
    rim(c, () => { c.beginPath(); c.moveTo(-r * 0.4, -r * 0.68); c.lineTo(r * 0.7, -r * 0.68); }, r);
    c.fillStyle = shade(col, -0.35); c.fillRect(-r * 1.1, r * 0.15, r * 2.25, r * 0.12);
    // rune battery core
    core(c, -r * 0.15, -r * 0.15, r * 0.85, r * 0.55, cyan, r, 0.6 + charge * 0.7);
    c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(-r * 0.3, -r * 0.35); c.lineTo(-r * 0.05, -r * 0.35); c.lineTo(-r * 0.2, -r * 0.1); c.lineTo(0, -r * 0.1); c.lineTo(-r * 0.15, r * 0.08); c.stroke(); c.restore();
    // tesla coils
    for (const x of [-r * 0.85, -r * 0.5]) {
      rr(c, x - r * 0.08, -r * 1.15, r * 0.16, r * 0.5, r * 0.05); fs(c, metal(c, x, -r, x + r * 0.2, -r, steel));
      for (let i = 0; i < 3; i++) { c.fillStyle = '#c7cdd8'; c.fillRect(x - r * 0.12, -r * 1.1 + i * r * 0.14, r * 0.24, r * 0.05); }
      glow(c, x, -r * 1.2, r * 0.3, '#ffe23a', 0.4 + charge * 0.6); c.fillStyle = '#fff7b0'; c.beginPath(); c.arc(x, -r * 1.2, r * 0.09, 0, TAU); c.fill();
    }
    if (charge > 0.35) { lightning(c, -r * 0.85, -r * 1.2, -r * 0.5, -r * 1.2, 6, r * 0.18 * charge, '#fff', r * 0.04); lightning(c, -r * 0.5, -r * 1.2, r * 1.1, -r * 0.3, 8, r * 0.2 * charge, rgba('#ffe23a', charge), r * 0.03); }
    // coil cannon
    c.save(); c.translate(r * 0.55, -r * 0.3);
    rr(c, 0, -r * 0.16, r * 0.95, r * 0.32, r * 0.08); fs(c, metal(c, 0, -r * 0.16, 0, r * 0.16, steel));
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(r * 0.25 + i * r * 0.18, 0, r * 0.2, 0, TAU); fs(c, metal(c, 0, -r * 0.2, 0, r * 0.2, '#e0a33a')); }
    c.fillStyle = cyan; c.beginPath(); c.arc(r * 0.98, 0, r * 0.1, 0, TAU); c.fill();
    muzzleFlash(c, r * 1.05, 0, r * 0.9, '#ffe23a', st.anim === 'fire' ? st.t * 1.5 : 0);
    c.restore();
    // headlamp
    glow(c, r * 1.15, r * 0.1, r * 0.25, '#fff', 0.6); c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 1.15, r * 0.1, r * 0.08, 0, TAU); c.fill();
  },

  // WARDEN — round mech walker. Spherical armoured pod with a numbered core, two jointed legs, big cannon arm, great shield arm.
  warden(c, r, st, T) {
    const col = st.color, cream = '#e6e1d3', accent = '#ff7a3a';
    const walk = Math.sin(T * 8 + (st.vx || 0)) * (st.grounded ? 0.12 : 0.35);
    const dome = st.anim === 's1' ? ease(st.t * 2.5) : 0;
    const harpoon = st.anim === 's2' ? pulse(st.t * 1.5) : 0;
    shadow(c, r, 1.4);
    outline(c, r);
    // legs: hip -> knee -> foot, both sides
    for (const s of [-1, 1]) {
      const hx = s * r * 0.35, hy = r * 0.35, kx = hx + s * r * 0.35, ky = r * 0.75 + walk * s * r * 0.1, fx = hx + s * r * 0.15, fy = r * 1.05;
      c.lineWidth = r * 0.2; c.strokeStyle = '#0b0e14'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.lineWidth = r * 0.12; c.strokeStyle = shade(cream, -0.1); c.stroke();
      outline(c, r);
      c.beginPath(); c.arc(kx, ky, r * 0.13, 0, TAU); fs(c, metal(c, 0, ky - r * 0.13, 0, ky + r * 0.13, '#8a93a6'));
      rr(c, fx - r * 0.3, fy - r * 0.08, r * 0.6, r * 0.18, r * 0.06); fs(c, metal(c, 0, fy - r * 0.1, 0, fy + r * 0.1, cream));
    }
    // shield arm (back)
    c.save(); c.translate(-r * 0.95, -r * 0.05 - dome * r * 0.6);
    const sr = r * 0.6 + dome * r * 0.35;
    c.beginPath(); c.arc(0, 0, sr, 0, TAU); fs(c, metal(c, 0, -sr, 0, sr, cream));
    c.beginPath(); c.arc(0, 0, sr * 0.66, 0, TAU); fs(c, metal(c, 0, -sr, 0, sr, col));
    c.beginPath(); c.arc(0, 0, sr * 0.22, 0, TAU); fs(c, '#d8dde8');
    c.restore();
    // pod body
    c.beginPath(); c.arc(0, -r * 0.15, r * 0.95, 0, TAU); fs(c, metal(c, 0, -r * 1.1, 0, r * 0.8, cream));
    rim(c, () => { c.beginPath(); c.arc(0, -r * 0.15, r * 0.85, Math.PI * 1.15, Math.PI * 1.8); }, r);
    // panel seams + accent stripe
    c.save(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = r * 0.03; c.beginPath(); c.arc(0, -r * 0.15, r * 0.95, -0.3, 0.9); c.moveTo(-r * 0.55, -r * 0.9); c.lineTo(-r * 0.2, -r * 0.3); c.stroke(); c.restore();
    c.fillStyle = accent; c.beginPath(); c.arc(0, -r * 0.15, r * 0.95, 0.95, 1.35); c.arc(0, -r * 0.15, r * 0.8, 1.35, 0.95, true); c.fill();
    // numbered core
    core(c, r * 0.05, -r * 0.2, r * 0.8, r * 0.8, col, r, 0.9);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = `bold ${Math.round(r * 0.34)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('04', r * 0.05, -r * 0.2);
    // antenna
    c.strokeStyle = '#0b0e14'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(r * 0.35, -r * 1.05); c.lineTo(r * 0.5, -r * 1.55); c.stroke(); glow(c, r * 0.5, -r * 1.55, r * 0.15, accent, 0.8);
    // cannon arm + harpoon (front)
    c.save(); c.translate(r * 0.6, -r * 0.05);
    outline(c, r);
    c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); fs(c, metal(c, 0, -r * 0.28, 0, r * 0.28, '#8a93a6'));
    cannon(c, r * 0.1, r * 0.05, r * 1.1, r * 0.26, cream, r, harpoon * 0.5);
    // harpoon tip
    c.fillStyle = '#d8dde8'; c.beginPath(); c.moveTo(r * 1.15 + harpoon * r * 0.5, -r * 0.14); c.lineTo(r * 1.5 + harpoon * r * 0.6, r * 0.05); c.lineTo(r * 1.15 + harpoon * r * 0.5, r * 0.24); c.closePath(); c.fill(); c.stroke();
    muzzleFlash(c, r * 1.3, r * 0.05, r * 0.8, col, st.anim === 'fire' ? st.t * 1.5 : 0);
    c.restore();
    if (dome > 0) { c.save(); c.globalAlpha = dome * 0.4; c.strokeStyle = col; c.lineWidth = r * 0.12; c.beginPath(); c.arc(0, -r * 0.1, r * 2.0, 0, TAU); c.stroke(); glow(c, 0, -r * 0.1, r * 2.0, col, 0.3); c.restore(); }
  },

  // SKYLA — cloud serpent craft. Sleek dragon head, ridged body, feathered wings, cloud thrusters, gold trim.
  skyla(c, r, st, T) {
    const col = st.color, gold = '#f0c04a', white = '#f4fbff';
    const flap = st.anim === 's1' || st.anim === 'jump' ? Math.sin(st.t * TAU * 2) * 0.7 : (st.grounded ? Math.sin(T * 2) * 0.1 : Math.sin(T * 10) * 0.35);
    const fan = st.anim === 's2' ? T * 40 : T * 5;
    shadow(c, r, 1.5, 1.15);
    // clouds under the body
    c.save(); c.globalAlpha = 0.9; outline(c, r, 0.07);
    for (const [x, y, s] of [[-r * 0.8, r * 0.75, 0.42], [-r * 0.2, r * 0.85, 0.5], [r * 0.45, r * 0.8, 0.4]]) { c.beginPath(); c.arc(x, y, r * s, 0, TAU); c.arc(x + r * s * 0.9, y + r * 0.1, r * s * 0.7, 0, TAU); c.arc(x - r * s * 0.8, y + r * 0.12, r * s * 0.65, 0, TAU); fs(c, metal(c, 0, y - r * s, 0, y + r * s, '#dbeeff')); }
    c.restore();
    outline(c, r);
    // back wing
    c.save(); c.translate(-r * 0.3, -r * 0.3); c.rotate(-0.5 - flap * 0.5);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-r * 0.5, -r * 1.3, -r * 1.7, -r * 0.9); c.quadraticCurveTo(-r * 1.0, -r * 0.4, -r * 0.5, r * 0.15); c.closePath(); fs(c, metal(c, 0, -r, 0, 0, shade(col, -0.25)));
    c.restore();
    // body (serpent segments)
    c.beginPath(); c.moveTo(-r * 1.35, r * 0.2); c.quadraticCurveTo(-r * 0.9, -r * 0.75, r * 0.1, -r * 0.55); c.quadraticCurveTo(r * 0.8, -r * 0.45, r * 1.05, r * 0.05); c.quadraticCurveTo(r * 0.3, r * 0.5, -r * 0.5, r * 0.55); c.quadraticCurveTo(-r * 1.2, r * 0.6, -r * 1.35, r * 0.2); c.closePath();
    fs(c, metal(c, 0, -r * 0.7, 0, r * 0.6, col));
    // scales
    c.save(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = r * 0.03; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-r * 1.0 + i * r * 0.33, -r * 0.05, r * 0.3, -0.9, 0.9); c.stroke(); } c.restore();
    // gold dorsal ridge
    c.fillStyle = gold; for (let i = 0; i < 6; i++) { const x = -r * 1.05 + i * r * 0.3; c.beginPath(); c.moveTo(x, -r * 0.45 + i * r * 0.02); c.lineTo(x + r * 0.1, -r * 0.8 + i * r * 0.04); c.lineTo(x + r * 0.22, -r * 0.45 + i * r * 0.02); c.closePath(); c.fill(); c.stroke(); }
    // core pearl
    core(c, -r * 0.35, 0, r * 0.6, r * 0.42, gold, r, 0.9);
    // front wing
    c.save(); c.translate(r * 0.1, -r * 0.35); c.rotate(-0.25 - flap * 0.6);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-r * 0.4, -r * 1.4, -r * 1.5, -r * 1.1); c.quadraticCurveTo(-r * 0.9, -r * 0.5, -r * 0.45, r * 0.1); c.closePath(); fs(c, metal(c, 0, -r * 1.2, 0, 0, white));
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = r * 0.03; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.1 * i, -r * 0.05); c.quadraticCurveTo(-r * 0.4 * i, -r * 0.5 * i, -r * 0.42 * i, -r * 0.32 * i); c.stroke(); }
    c.restore();
    // head
    c.save(); c.translate(r * 1.0, -r * 0.05);
    outline(c, r);
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.4); c.lineTo(r * 0.55, -r * 0.35); c.lineTo(r * 0.85, -r * 0.05); c.lineTo(r * 0.55, r * 0.2); c.lineTo(-r * 0.3, r * 0.3); c.closePath(); fs(c, metal(c, 0, -r * 0.4, 0, r * 0.3, white));
    c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(r * 0.2 + i * r * 0.18, r * 0.05); c.lineTo(r * 0.26 + i * r * 0.18, r * 0.2); c.lineTo(r * 0.32 + i * r * 0.18, r * 0.05); c.fill(); }
    // horns and mane
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.4); c.quadraticCurveTo(-r * 0.4, -r * 0.9, -r * 0.05, -r * 0.95); c.lineTo(0, -r * 0.42); c.closePath(); fs(c, gold);
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.2); c.quadraticCurveTo(-r * 0.7, -r * 0.5, -r * 0.55, r * 0.1); c.closePath(); fs(c, metal(c, 0, -r * 0.5, 0, r * 0.1, col));
    glow(c, r * 0.25, -r * 0.15, r * 0.2, '#5ff2ff', 0.8); c.fillStyle = '#5ff2ff'; c.beginPath(); c.ellipse(r * 0.25, -r * 0.15, r * 0.1, r * 0.06, 0, 0, TAU); c.fill(); c.fillStyle = '#0b0e14'; c.beginPath(); c.arc(r * 0.29, -r * 0.15, r * 0.03, 0, TAU); c.fill();
    muzzleFlash(c, r * 0.85, r * 0.0, r * 0.8, '#fff', st.anim === 'fire' ? st.t * 1.5 : 0);
    c.restore();
    // tail fan
    c.save(); c.translate(-r * 1.35, r * 0.2); c.rotate(fan);
    for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.beginPath(); c.ellipse(r * 0.22, 0, r * 0.24, r * 0.07, 0, 0, TAU); fs(c, gold); }
    c.restore();
    if (st.anim === 's2') { c.save(); c.globalAlpha = pulse(st.t) * 0.7; c.strokeStyle = '#fff'; c.lineWidth = r * 0.06; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(r * 1.6, -r * 0.4 + i * r * 0.35); c.quadraticCurveTo(r * 2.2, -r * 0.5 + i * r * 0.4, r * 2.8 + i * r * 0.2, -r * 0.6 + i * r * 0.55); c.stroke(); } c.restore(); }
  },

  // PHANTOM — crab assassin. Hooded dome with a slit visor, big cannon, scarf, four blade legs; dissolves on Blink.
  phantom(c, r, st, T) {
    const col = st.color, black = '#1b1b24', red = '#e02f4a';
    const fade = st.anim === 's1' ? (st.t < 0.5 ? 1 - st.t * 2 : (st.t - 0.5) * 2) : 1;
    const skitter = Math.sin(T * 12 + (st.vx || 0)) * (st.grounded ? 0.08 : 0.25);
    const recoil = st.anim === 'fire' ? pulse(st.t * 1.5) * 0.5 : 0;
    shadow(c, r, 1.5);
    c.save(); c.globalAlpha = fade;
    if (fade < 1) { c.save(); c.globalAlpha = 1 - fade; for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + T * 3; glow(c, Math.cos(a) * r * (1.3 + (1 - fade) * 1.6), Math.sin(a) * r * (0.9 + (1 - fade)), r * 0.2, col, 0.9); } c.restore(); }
    // legs
    for (const [ox, dir, ph] of [[-0.6, -1, 0], [-0.25, -1, 1], [0.3, 1, 2], [0.65, 1, 3]]) {
      const k = Math.sin(T * 9 + ph * 1.6) * skitter;
      const x0 = ox * r, y0 = r * 0.35, x1 = x0 + dir * r * 0.5, y1 = -r * 0.1 + k * r, x2 = x1 + dir * r * 0.3, y2 = r * 1.05;
      c.lineWidth = r * 0.2; c.strokeStyle = '#0b0e14'; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.lineWidth = r * 0.12; c.strokeStyle = shade(col, -0.2); c.stroke();
      c.strokeStyle = black; c.lineWidth = r * 0.05; for (let j = 1; j < 4; j++) { const t = j / 4; c.beginPath(); c.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r * 0.06, 0, TAU); c.stroke(); }
      outline(c, r);
      c.fillStyle = '#d8dde8'; c.beginPath(); c.moveTo(x2 - r * 0.1, y2 - r * 0.15); c.lineTo(x2 + dir * r * 0.18, y2 + r * 0.05); c.lineTo(x2 + r * 0.1, y2 - r * 0.15); c.closePath(); c.fill(); c.stroke();
    }
    outline(c, r);
    // scarf (back)
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.quadraticCurveTo(-r * 1.3, r * 0.1 + Math.sin(T * 4) * r * 0.15, -r * 1.7, -r * 0.3 + Math.sin(T * 3) * r * 0.1); c.quadraticCurveTo(-r * 1.2, r * 0.25, -r * 0.55, r * 0.15); c.closePath(); fs(c, metal(c, 0, -r * 0.3, 0, r * 0.2, red));
    // dome body
    c.beginPath(); c.arc(0, -r * 0.1, r * 0.95, 0, TAU); fs(c, metal(c, 0, -r * 1.05, 0, r * 0.85, black));
    rim(c, () => { c.beginPath(); c.arc(0, -r * 0.1, r * 0.85, Math.PI * 1.15, Math.PI * 1.75); }, r, col, 0.6);
    // purple armour plates
    c.beginPath(); c.arc(0, -r * 0.1, r * 0.95, Math.PI * 1.05, Math.PI * 1.6); c.arc(0, -r * 0.1, r * 0.6, Math.PI * 1.6, Math.PI * 1.05, true); c.closePath(); fs(c, metal(c, 0, -r, 0, 0, col));
    // spikes on the crown
    for (let i = 0; i < 4; i++) { const a = Math.PI * 1.15 + i * 0.28; const x = Math.cos(a) * r * 0.95, y = -r * 0.1 + Math.sin(a) * r * 0.95; c.beginPath(); c.moveTo(x - r * 0.08, y + r * 0.05); c.lineTo(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32); c.lineTo(x + r * 0.08, y + r * 0.05); c.closePath(); fs(c, col); }
    // visor core
    core(c, r * 0.15, -r * 0.2, r * 0.8, r * 0.3, col, r, 0.9 + pulse(st.anim === 's2' ? st.t : 0) * 0.5);
    c.fillStyle = '#fff'; c.fillRect(r * 0.05, -r * 0.24, r * 0.35, r * 0.06);
    // cannon (front)
    cannon(c, r * 0.3, r * 0.15, r * 1.25, r * 0.28, col, r, recoil);
    muzzleFlash(c, r * 1.55, r * 0.15, r * 0.8, col, st.anim === 'fire' ? st.t * 1.5 : 0);
    // shard launchers on the shoulder
    for (let i = 0; i < 3; i++) { c.fillStyle = '#d8dde8'; c.beginPath(); c.moveTo(r * 0.5 + i * r * 0.12, -r * 0.75 + i * r * 0.1); c.lineTo(r * 0.85 + i * r * 0.12, -r * 0.95 + i * r * 0.1); c.lineTo(r * 0.6 + i * r * 0.12, -r * 0.6 + i * r * 0.1); c.closePath(); c.fill(); c.stroke(); }
    if (st.anim === 's2') { c.save(); c.globalAlpha = 1 - st.t; for (let i = 0; i < 6; i++) { const t = st.t; c.fillStyle = '#c8c8d8'; c.beginPath(); c.arc(-r * 0.4 - t * r * 0.5 * i * 0.25, -r * 0.9 - t * r * 1.4 - i * r * 0.15, r * (0.18 + t * 0.3), 0, TAU); c.fill(); } c.restore(); }
    c.restore();
  },

  // RICOCHET — mortar wagon. Big spoked wheels, riveted iron body, round pink core, stubby mortar that lobs bouncing shells.
  ricochet(c, r, st, T) {
    const col = st.color, iron = '#5b5f6b', brass = '#d9a441';
    const spin = (st.vx || 0) * 0.15 + T * (st.grounded ? 0.2 : 4) + (st.anim === 's1' ? st.t * 10 : 0);
    const recoil = st.anim === 'fire' || st.anim === 's1' || st.anim === 's2' ? pulse(st.t * 1.5) : 0;
    shadow(c, r, 1.6);
    // back wheel
    tyreWheel(c, -r * 0.75, r * 0.6, r * 0.55, spin, col, r);
    outline(c, r);
    // chassis
    rr(c, -r * 1.25, -r * 0.05, r * 2.4, r * 0.5, r * 0.1); fs(c, metal(c, 0, -r * 0.05, 0, r * 0.45, iron));
    for (let i = 0; i < 6; i++) bolt(c, -r * 1.1 + i * r * 0.45, r * 0.32, r, iron);
    // barrel body
    rr(c, -r * 1.05, -r * 0.95, r * 1.9, r * 1.0, r * 0.35); fs(c, metal(c, 0, -r * 0.95, 0, r * 0.05, shade(col, -0.15)));
    rim(c, () => { c.beginPath(); c.moveTo(-r * 0.75, -r * 0.92); c.lineTo(r * 0.55, -r * 0.92); }, r);
    c.fillStyle = brass; c.fillRect(-r * 1.05, -r * 0.7, r * 1.9, r * 0.1); c.fillRect(-r * 1.05, -r * 0.3, r * 1.9, r * 0.1);
    // round core porthole
    core(c, -r * 0.1, -r * 0.45, r * 0.7, r * 0.6, col, r, 0.9);
    c.strokeStyle = brass; c.lineWidth = r * 0.06; c.beginPath(); c.arc(-r * 0.1, -r * 0.45, r * 0.42, 0, TAU); c.stroke();
    // mortar
    c.save(); c.translate(r * 0.65, -r * 0.55); c.rotate(-0.55);
    cannon(c, 0, 0, r * 1.05, r * 0.36, brass, r, recoil);
    muzzleFlash(c, r * 1.2, 0, r * 0.9, col, recoil > 0 ? st.t * 1.5 : 0);
    c.restore();
    // hazard stripes on the bumper
    c.save(); c.beginPath(); c.rect(r * 0.9, -r * 0.05, r * 0.35, r * 0.5); c.clip(); for (let i = -2; i < 6; i++) { c.fillStyle = i % 2 ? '#0b0e14' : brass; c.beginPath(); c.moveTo(r * 0.9 + i * r * 0.14, -r * 0.05); c.lineTo(r * 1.05 + i * r * 0.14, -r * 0.05); c.lineTo(r * 0.9 + i * r * 0.14, r * 0.45); c.lineTo(r * 0.75 + i * r * 0.14, r * 0.45); c.fill(); } c.restore();
    // front wheel
    tyreWheel(c, r * 0.75, r * 0.6, r * 0.55, spin, col, r);
    if (st.anim === 's2') { c.save(); c.globalAlpha = pulse(st.t); for (let i = 0; i < 4; i++) glow(c, r * 1.4 + i * r * 0.2, -r * 1.0 + i * r * 0.28, r * 0.16, col, 0.9); c.restore(); }
  },

  // GRAVITAS — gravity golem. Ornate floating slab with a swirling void core, gold filigree, two orbiting rings, hovering pebbles.
  gravitas(c, r, st, T) {
    const col = st.color, gold = '#d9a441', violet = '#9a6bff', stone = '#4a4f5e';
    const collapse = st.anim === 's1' ? pulse(st.t) : 0;
    const burst = st.anim === 's2' ? ease(st.t) : 0;
    const ringR = r * (1.35 - collapse * 0.55 + burst * 1.2);
    const hover = Math.sin(T * 2.5) * r * 0.05;
    shadow(c, r, 1.5, 1.25);
    c.save(); c.globalAlpha = 0.5; glow(c, 0, r * 0.95, r * 1.3, violet, 0.6); c.restore();
    c.translate(0, hover);
    outline(c, r);
    // back ring
    c.save(); c.rotate(T * 0.8); c.lineWidth = r * 0.13; c.strokeStyle = '#0b0e14'; c.beginPath(); c.ellipse(0, 0, ringR, ringR * 0.35, 0.5, Math.PI, TAU); c.stroke(); c.lineWidth = r * 0.07; c.strokeStyle = gold; c.stroke(); c.restore();
    // slab body
    rr(c, -r * 0.95, -r * 0.85, r * 1.9, r * 1.55, r * 0.18); fs(c, metal(c, 0, -r * 0.85, 0, r * 0.7, stone));
    rim(c, () => { c.beginPath(); c.moveTo(-r * 0.75, -r * 0.83); c.lineTo(r * 0.75, -r * 0.83); }, r);
    // filigree frame
    c.strokeStyle = gold; c.lineWidth = r * 0.07; rr(c, -r * 0.8, -r * 0.7, r * 1.6, r * 1.25, r * 0.12); c.stroke();
    c.lineWidth = r * 0.04; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.8, -r * 0.2); c.quadraticCurveTo(s * r * 0.55, -r * 0.2, s * r * 0.55, r * 0.05); c.quadraticCurveTo(s * r * 0.55, r * 0.3, s * r * 0.8, r * 0.3); c.stroke(); }
    // void core
    core(c, 0, -r * 0.15, r * 0.95, r * 0.8, violet, r, 0.7 + collapse * 0.6 + burst * 0.5);
    c.save(); c.translate(0, -r * 0.15); c.rotate(T * 2); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = r * 0.04; c.beginPath(); for (let a = 0; a < TAU * 2; a += 0.2) { const rad = r * 0.05 + a * r * 0.055; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.8); } c.stroke(); c.restore();
    c.fillStyle = '#0b0e14'; c.beginPath(); c.arc(0, -r * 0.15, r * 0.1 + collapse * r * 0.12, 0, TAU); c.fill();
    // gold cap + emitter
    rr(c, -r * 0.45, -r * 1.1, r * 0.9, r * 0.3, r * 0.08); fs(c, metal(c, 0, -r * 1.1, 0, -r * 0.8, gold));
    rr(c, r * 0.85, -r * 0.45, r * 0.5, r * 0.4, r * 0.08); fs(c, metal(c, 0, -r * 0.45, 0, -r * 0.05, gold));
    glow(c, r * 1.35, -r * 0.25, r * 0.25, violet, 0.8);
    muzzleFlash(c, r * 1.35, -r * 0.25, r * 0.9, violet, st.anim === 'fire' || st.anim === 's1' ? st.t * 1.5 : 0);
    // front ring
    c.save(); c.rotate(-T * 0.8); c.lineWidth = r * 0.13; c.strokeStyle = '#0b0e14'; c.beginPath(); c.ellipse(0, 0, ringR, ringR * 0.35, -0.5, 0, Math.PI); c.stroke(); c.lineWidth = r * 0.07; c.strokeStyle = gold; c.stroke(); c.restore();
    // hovering pebbles
    for (let i = 0; i < 6; i++) { const a = T * 1.3 + i * TAU / 6; const rr2 = ringR * (0.95 + 0.15 * Math.sin(i)); c.beginPath(); c.moveTo(Math.cos(a) * rr2 - r * 0.07, Math.sin(a) * rr2 * 0.4); c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.4 - r * 0.09); c.lineTo(Math.cos(a) * rr2 + r * 0.07, Math.sin(a) * rr2 * 0.4); c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.4 + r * 0.07); c.closePath(); fs(c, stone); }
    if (burst > 0) { c.save(); c.globalAlpha = 1 - burst; c.strokeStyle = '#fff'; c.lineWidth = r * 0.1; c.beginPath(); c.arc(0, -r * 0.1, r * (0.7 + burst * 2.6), 0, TAU); c.stroke(); c.restore(); }
  },
};

export const ANIM_LENGTH = { idle: 1, jump: 0.5, land: 0.35, fire: 0.4, s1: 0.8, s2: 0.7, hit: 0.35, death: 1.0 };

// Art scale relative to the collision radius: rigs are drawn bigger than the hitbox, like the reference art.
export const ART_SCALE = 0.78;

export function drawBot(ctx, def, r, st, time) {
  const rig = RIGS[def.id] || RIGS.gravitas;
  const tf = bodyTransform(st);
  const R = r * ART_SCALE;
  ctx.save();
  ctx.translate(0, tf.dy * r + r * 0.12);
  ctx.rotate(tf.rot * (st.facing || 1));
  ctx.scale(tf.sx * (st.facing || 1), tf.sy);
  ctx.translate(0, -r * 0.12);
  if (st.anim === 'death') ctx.globalAlpha = 1 - st.t * 0.9;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Painted sprite when one is loaded for this bot, vector rig otherwise.
  const sprite = getSprite(def.id);
  if (sprite) drawSpriteBody(ctx, sprite, R, def.id); else rig(ctx, R, st, time);
  if (st.anim === 'hit' && st.t < 0.5) { ctx.globalAlpha = 0.5 * (1 - st.t * 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export const RIG_IDS = Object.keys(RIGS);
