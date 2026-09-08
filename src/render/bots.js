// Bot rigs: layered vector art with per-move animation for all eight bots.
//
// drawBot(ctx, def, r, state, time)
//   r      = bot radius in pixels (bot width = 2r)
//   state  = { anim: 'idle'|'jump'|'land'|'fire'|'s1'|'s2'|'hit'|'death', t: 0..1 progress,
//              facing: 1|-1, vx, vy, grounded, color, hp: 0..1, id }
// Coordinates: origin at bot centre, +y down, +x is the facing direction (the caller mirrors).

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const pulse = (t, k = 1) => Math.sin(clamp(t, 0, 1) * Math.PI) * k; // 0 -> 1 -> 0
const shade = (hex, f) => { // lighten (f>0) or darken (f<0)
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => clamp(Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)), 0, 255);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};

// ---------- shared drawing helpers ----------
function outline(c, r) { c.lineWidth = Math.max(2, r * 0.11); c.strokeStyle = '#0d1018'; c.lineJoin = 'round'; }
function rrect(c, x, y, w, h, rad) { c.beginPath(); c.roundRect(x, y, w, h, rad); }
function fillStroke(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
function wheel(c, x, y, rad, spin, color, hub = '#c9ced8') {
  c.save(); c.translate(x, y); c.rotate(spin);
  c.beginPath(); c.arc(0, 0, rad, 0, TAU); fillStroke(c, '#262a33');
  c.fillStyle = '#3a3f4a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * TAU / 6) * rad * 0.82, Math.sin(i * TAU / 6) * rad * 0.82, rad * 0.16, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(0, 0, rad * 0.5, 0, TAU); fillStroke(c, color);
  c.fillStyle = hub; c.beginPath(); c.arc(0, 0, rad * 0.2, 0, TAU); c.fill();
  c.restore();
}
function cockpit(c, x, y, w, h, glass, pilot) {
  rrect(c, x - w / 2, y - h / 2, w, h, h * 0.35); fillStroke(c, '#1c2230');
  rrect(c, x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, h * 0.3); c.fillStyle = glass; c.fill();
  // pilot: a little helmeted head
  c.fillStyle = pilot || '#ffd9a8'; c.beginPath(); c.arc(x, y + h * 0.08, h * 0.28, 0, TAU); c.fill();
  c.fillStyle = '#0d1018'; c.beginPath(); c.arc(x + h * 0.08, y + h * 0.05, h * 0.06, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(x - w * 0.25, y - h * 0.22, w * 0.18, h * 0.12, -0.5, 0, TAU); c.fill();
}
function glowDot(c, x, y, rad, color, a = 1) {
  c.save(); c.globalAlpha = a * 0.5; c.fillStyle = color; c.beginPath(); c.arc(x, y, rad * 2.2, 0, TAU); c.fill();
  c.globalAlpha = a; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); c.restore();
}
function muzzleFlash(c, x, y, r, color, t) {
  if (t <= 0 || t >= 1) return;
  const k = 1 - t;
  c.save(); c.globalAlpha = k; c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(x, y - r * 0.25 * k); c.lineTo(x + r * 0.9 * k, y); c.lineTo(x, y + r * 0.25 * k); c.lineTo(x + r * 0.35 * k, y); c.closePath(); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r * 0.22 * k, 0, TAU); c.fill(); c.restore();
}

// Squash & stretch + vertical offset shared by every rig, derived from the animation state.
function bodyTransform(st) {
  let sx = 1, sy = 1, dy = 0, rot = 0;
  const t = st.t;
  switch (st.anim) {
    case 'jump': { // crouch then stretch upward
      if (t < 0.25) { const k = t / 0.25; sx = 1 + 0.18 * k; sy = 1 - 0.22 * k; dy = 0.1 * k; }
      else { const k = ease((t - 0.25) / 0.75); sx = 1 + 0.18 * (1 - k) - 0.1 * (1 - k); sy = 1 - 0.22 + 0.42 * (1 - k) * k * 2; }
      break;
    }
    case 'land': { const k = pulse(t); sx = 1 + 0.22 * k; sy = 1 - 0.28 * k; dy = 0.12 * k; break; }
    case 'fire': { const k = pulse(t * 1.4); rot = -0.06 * k; dy = 0.03 * k; break; }
    case 'hit': { const k = pulse(t); sx = 1 - 0.08 * k; sy = 1 + 0.06 * k; rot = 0.12 * k * Math.sin(t * 40); break; }
    case 'death': { rot = t * 0.8; dy = -0.2 * t; break; }
    case 's1': case 's2': { const k = pulse(t); sy = 1 + 0.05 * k; break; }
  }
  if (!st.grounded && st.anim !== 'jump') { const v = clamp((st.vy || 0) / 20, -0.15, 0.15); sy = 1 + Math.abs(v); sx = 1 - Math.abs(v) * 0.6; }
  return { sx, sy, dy, rot };
}

// ---------- rigs ----------
const RIGS = {
  // BULWARK: tracked fortress. Twin treads, thick sloped hull, shield plate on the nose, top turret.
  bulwark(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.35), lite = shade(col, 0.25);
    const tread = Math.sin(T * 12 + (st.vx || 0) * 0.3) * 0.5;
    const recoil = st.anim === 's2' ? pulse(st.t * 2) : (st.anim === 'fire' ? pulse(st.t * 1.5) * 0.5 : 0);
    // treads
    rrect(c, -r * 1.05, r * 0.25, r * 2.1, r * 0.55, r * 0.27); fillStroke(c, '#262a33');
    c.fillStyle = '#3a3f4a'; for (let i = 0; i < 6; i++) c.fillRect(-r * 0.95 + ((i * r * 0.35 + tread * r * 0.35 + r * 8) % (r * 1.9)), r * 0.3, r * 0.14, r * 0.45);
    // hull
    c.beginPath(); c.moveTo(-r * 0.95, r * 0.3); c.lineTo(-r * 0.8, -r * 0.35); c.lineTo(r * 0.55, -r * 0.35); c.lineTo(r * 1.0, r * 0.05); c.lineTo(r * 1.0, r * 0.3); c.closePath(); fillStroke(c, col);
    c.fillStyle = lite; c.fillRect(-r * 0.7, -r * 0.3, r * 1.2, r * 0.1);
    // rivets
    c.fillStyle = dark; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-r * 0.6 + i * r * 0.35, r * 0.1, r * 0.05, 0, TAU); c.fill(); }
    // nose shield plate (extends during Bastion Wall)
    const plate = st.anim === 's1' ? ease(st.t * 2) : 0;
    c.save(); c.translate(r * 0.95 + plate * r * 0.5, 0);
    rrect(c, -r * 0.1, -r * 0.7 - plate * r * 0.3, r * 0.22, r * 1.3 + plate * r * 0.6, r * 0.06); fillStroke(c, dark);
    c.fillStyle = lite; c.fillRect(-r * 0.04, -r * 0.55 - plate * r * 0.3, r * 0.08, r * 1.0 + plate * r * 0.6);
    c.restore();
    // turret + barrel
    c.save(); c.translate(-r * 0.15, -r * 0.45);
    rrect(c, -r * 0.45 - recoil * r * 0.15, -r * 0.35, r * 0.9, r * 0.45, r * 0.12); fillStroke(c, dark);
    rrect(c, r * 0.3 - recoil * r * 0.3, -r * 0.22, r * 0.9, r * 0.2, r * 0.05); fillStroke(c, '#2b303a');
    c.fillStyle = col; c.fillRect(r * 1.0 - recoil * r * 0.3, -r * 0.24, r * 0.16, r * 0.24);
    muzzleFlash(c, r * 1.2, -r * 0.12, r * (st.anim === 's2' ? 1.4 : 0.8), '#ffb347', st.anim === 'fire' || st.anim === 's2' ? st.t * 1.6 : 0);
    c.restore();
    cockpit(c, -r * 0.45, -r * 0.1, r * 0.5, r * 0.36, '#9fd8ff');
    glowDot(c, r * 0.75, r * 0.05, r * 0.06, '#5ff2ff');
  },

  // MAGMAW: lava crawler. Six stubby legs, cracked basalt shell, furnace jaw at the front.
  magmaw(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.45);
    const jaw = st.anim === 's2' ? pulse(st.t) * 0.9 : (st.anim === 'fire' ? pulse(st.t) * 0.5 : 0.12 + Math.sin(T * 2) * 0.05);
    const heat = st.anim === 's1' ? 0.6 + pulse(st.t) * 0.4 : 0.55 + Math.sin(T * 3) * 0.15;
    const step = Math.sin(T * 9 + (st.vx || 0));
    // legs
    c.lineWidth = Math.max(3, r * 0.16); c.strokeStyle = '#0d1018';
    for (let i = 0; i < 3; i++) {
      const lx = -r * 0.55 + i * r * 0.5, ph = step * (i % 2 ? 1 : -1) * r * 0.08;
      c.beginPath(); c.moveTo(lx, r * 0.35); c.lineTo(lx - r * 0.15, r * 0.7 + ph); c.lineTo(lx - r * 0.35, r * 0.95); c.stroke();
      c.lineWidth = Math.max(2, r * 0.1); c.strokeStyle = '#3a2a24'; c.stroke(); c.lineWidth = Math.max(3, r * 0.16); c.strokeStyle = '#0d1018';
    }
    outline(c, r);
    // shell
    c.beginPath(); c.ellipse(-r * 0.1, 0, r * 1.0, r * 0.75, 0, 0, TAU); fillStroke(c, '#3b2f2b');
    // cracks glowing
    c.strokeStyle = `rgba(255,120,40,${heat})`; c.lineWidth = Math.max(2, r * 0.07);
    for (const [x1, y1, x2, y2] of [[-0.7, -0.2, -0.3, -0.45], [-0.3, -0.45, 0.1, -0.3], [-0.5, 0.2, -0.1, 0.35], [0.1, -0.3, 0.35, -0.05]]) { c.beginPath(); c.moveTo(x1 * r, y1 * r); c.lineTo(x2 * r, y2 * r); c.stroke(); }
    // spikes on back
    outline(c, r); c.fillStyle = dark;
    for (let i = 0; i < 4; i++) { const x = -r * 0.8 + i * r * 0.35; c.beginPath(); c.moveTo(x, -r * 0.55); c.lineTo(x + r * 0.12, -r * 0.95 - (i % 2) * r * 0.1); c.lineTo(x + r * 0.28, -r * 0.5); c.closePath(); c.fill(); c.stroke(); }
    // head / jaw
    c.save(); c.translate(r * 0.55, r * 0.05);
    c.beginPath(); c.ellipse(0, -r * 0.15, r * 0.5, r * 0.38, 0, Math.PI, TAU); c.lineTo(r * 0.5, 0); c.lineTo(-r * 0.5, 0); c.closePath(); fillStroke(c, col);
    c.save(); c.rotate(jaw * 0.7); c.beginPath(); c.moveTo(-r * 0.5, 0); c.lineTo(r * 0.5, 0); c.lineTo(r * 0.45, r * 0.32); c.lineTo(-r * 0.4, r * 0.28); c.closePath(); fillStroke(c, dark);
    c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.35 + i * r * 0.22, r * 0.02); c.lineTo(-r * 0.27 + i * r * 0.22, r * 0.2); c.lineTo(-r * 0.19 + i * r * 0.22, r * 0.02); c.fill(); }
    c.restore();
    // furnace glow inside the mouth
    c.fillStyle = `rgba(255,190,60,${0.4 + jaw})`; c.beginPath(); c.ellipse(0, 0, r * 0.35, r * 0.1 + jaw * r * 0.15, 0, 0, TAU); c.fill();
    muzzleFlash(c, r * 0.5, r * 0.05, r * 0.9, '#ff8a2f', st.anim === 's2' ? st.t * 1.5 : 0);
    // eyes
    glowDot(c, r * 0.15, -r * 0.28, r * 0.09, '#ffd84f'); glowDot(c, r * 0.32, -r * 0.3, r * 0.07, '#ffd84f');
    c.restore();
    cockpit(c, -r * 0.35, -r * 0.2, r * 0.42, r * 0.32, '#ffb08a');
  },

  // VOLT: hover bike. Sleek wedge on a repulsor pad, tesla coils behind the rider.
  volt(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.4), lite = shade(col, 0.3);
    const charge = st.anim === 's1' ? clamp(st.t * 3, 0, 1) : (st.anim === 's2' ? pulse(st.t) : 0.2 + Math.sin(T * 8) * 0.1);
    const hover = Math.sin(T * 5) * r * 0.04;
    // repulsor glow
    c.save(); c.globalAlpha = 0.45 + Math.sin(T * 14) * 0.15; c.fillStyle = '#5ff2ff'; c.beginPath(); c.ellipse(0, r * 0.75, r * 0.85, r * 0.16, 0, 0, TAU); c.fill(); c.restore();
    c.translate(0, hover);
    outline(c, r);
    // pad
    rrect(c, -r * 0.9, r * 0.35, r * 1.8, r * 0.3, r * 0.15); fillStroke(c, '#2b303a');
    c.fillStyle = '#5ff2ff'; c.fillRect(-r * 0.7, r * 0.5, r * 1.4, r * 0.06);
    // body wedge
    c.beginPath(); c.moveTo(-r * 0.95, r * 0.35); c.lineTo(-r * 0.75, -r * 0.2); c.lineTo(r * 0.4, -r * 0.45); c.lineTo(r * 1.05, r * 0.05); c.lineTo(r * 0.95, r * 0.35); c.closePath(); fillStroke(c, col);
    c.fillStyle = lite; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.1); c.lineTo(r * 0.35, -r * 0.33); c.lineTo(r * 0.5, -r * 0.2); c.lineTo(-r * 0.5, 0); c.closePath(); c.fill();
    c.fillStyle = dark; c.fillRect(-r * 0.2, -r * 0.05, r * 0.9, r * 0.12);
    // headlight
    glowDot(c, r * 0.95, r * 0.05, r * 0.08, '#ffffff', 0.9);
    // tesla coils
    for (const x of [-r * 0.6, -r * 0.35]) {
      c.fillStyle = '#2b303a'; c.fillRect(x - r * 0.05, -r * 0.7, r * 0.1, r * 0.5); c.strokeRect(x - r * 0.05, -r * 0.7, r * 0.1, r * 0.5);
      glowDot(c, x, -r * 0.75, r * 0.09, '#ffe23a', 0.5 + charge * 0.5);
    }
    // arcs between coils when charging
    if (charge > 0.3) {
      c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.globalAlpha = charge;
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.75);
      for (let i = 1; i < 5; i++) c.lineTo(-r * 0.6 + i * r * 0.0625, -r * 0.75 + (Math.sin(T * 60 + i * 7) * r * 0.12)); c.lineTo(-r * 0.35, -r * 0.75); c.stroke();
      c.restore();
    }
    // rider
    cockpit(c, r * 0.05, -r * 0.45, r * 0.4, r * 0.34, '#fff3a0');
    // beam emitter at the nose
    muzzleFlash(c, r * 1.05, r * 0.02, r, '#ffe23a', st.anim === 'fire' ? st.t * 1.5 : 0);
  },

  // WARDEN: bipedal walker with a great round shield on one arm and a harpoon launcher on the other.
  warden(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.4), lite = shade(col, 0.3);
    const walk = Math.sin(T * 8 + (st.vx || 0)) * (st.grounded ? 0.1 : 0.3);
    const dome = st.anim === 's1' ? ease(st.t * 2.5) : 0;
    const harpoon = st.anim === 's2' ? pulse(st.t * 1.5) : 0;
    outline(c, r);
    // legs
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * r * 0.35, r * 0.3); c.rotate(walk * s);
      rrect(c, -r * 0.14, 0, r * 0.28, r * 0.5, r * 0.06); fillStroke(c, '#2b303a');
      rrect(c, -r * 0.22, r * 0.45, r * 0.44, r * 0.18, r * 0.06); fillStroke(c, dark);
      c.restore();
    }
    // torso
    rrect(c, -r * 0.6, -r * 0.55, r * 1.2, r * 0.95, r * 0.18); fillStroke(c, col);
    c.fillStyle = lite; c.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.12);
    c.fillStyle = dark; c.fillRect(-r * 0.45, r * 0.05, r * 0.9, r * 0.25);
    // harpoon launcher (right arm, front)
    c.save(); c.translate(r * 0.55, -r * 0.15);
    rrect(c, -r * 0.1, -r * 0.14, r * 0.7 - harpoon * r * 0.2, r * 0.28, r * 0.06); fillStroke(c, '#2b303a');
    c.fillStyle = '#c9ced8'; c.beginPath(); c.moveTo(r * 0.6 + harpoon * r * 0.4, -r * 0.12); c.lineTo(r * 0.85 + harpoon * r * 0.5, 0); c.lineTo(r * 0.6 + harpoon * r * 0.4, r * 0.12); c.closePath(); c.fill(); c.stroke();
    muzzleFlash(c, r * 0.7, 0, r * 0.8, col, st.anim === 'fire' ? st.t * 1.5 : 0);
    c.restore();
    // head
    rrect(c, -r * 0.3, -r * 0.95, r * 0.6, r * 0.45, r * 0.12); fillStroke(c, dark);
    c.fillStyle = '#5ff2ff'; c.fillRect(-r * 0.05, -r * 0.85, r * 0.3, r * 0.12);
    cockpit(c, -r * 0.05, -r * 0.05, r * 0.45, r * 0.34, '#b8ffe0');
    // great shield (left arm, drawn in front at the back-left) — it rises and rings out as the Deflector dome
    c.save(); c.translate(-r * 0.75, -r * 0.05 - dome * r * 0.5);
    const sr = r * 0.55 + dome * r * 0.35;
    c.beginPath(); c.arc(0, 0, sr, 0, TAU); fillStroke(c, lite);
    c.beginPath(); c.arc(0, 0, sr * 0.65, 0, TAU); fillStroke(c, col);
    c.fillStyle = '#c9ced8'; c.beginPath(); c.arc(0, 0, sr * 0.2, 0, TAU); c.fill();
    c.restore();
    if (dome > 0) { c.save(); c.globalAlpha = dome * 0.35; c.strokeStyle = '#3ddc97'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r * 2.1, 0, TAU); c.stroke(); c.restore(); }
  },

  // SKYLA: winged glider craft. Two feathered wings on a slim fuselage, tail fan at the back.
  skyla(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.4), lite = shade(col, 0.35);
    const flap = st.anim === 's1' || st.anim === 'jump' ? Math.sin(st.t * TAU * 2) * 0.6 : (st.grounded ? Math.sin(T * 2) * 0.08 : Math.sin(T * 10) * 0.3);
    const fan = st.anim === 's2' ? T * 40 : T * 6;
    outline(c, r);
    // wings (behind body)
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * r * 0.15 - r * 0.2, -r * 0.1); c.rotate(-flap * 0.5 + (s < 0 ? 0.35 : -0.35)); c.scale(1, s < 0 ? 1 : 1);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-r * 0.6, -r * 1.2 * (s < 0 ? 1 : 0.7), -r * 1.5, -r * 0.7); c.quadraticCurveTo(-r * 0.9, -r * 0.35, -r * 0.5, r * 0.15); c.closePath(); fillStroke(c, s < 0 ? dark : lite);
      c.strokeStyle = '#0d1018'; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.15 * i, -r * 0.05); c.lineTo(-r * 0.45 * i, -r * 0.3 * i * 0.8); c.stroke(); }
      c.restore();
    }
    // fuselage
    c.beginPath(); c.ellipse(0, 0, r * 1.0, r * 0.42, 0, 0, TAU); fillStroke(c, col);
    c.fillStyle = lite; c.beginPath(); c.ellipse(r * 0.1, -r * 0.12, r * 0.7, r * 0.15, 0, 0, TAU); c.fill();
    // tail fan
    c.save(); c.translate(-r * 0.95, 0); c.rotate(fan);
    for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.ellipse(r * 0.18, 0, r * 0.2, r * 0.06, 0, 0, TAU); fillStroke(c, '#c9ced8'); }
    c.restore();
    // nose lamp + launcher
    c.fillStyle = dark; c.fillRect(r * 0.6, -r * 0.08, r * 0.45, r * 0.16); c.strokeRect(r * 0.6, -r * 0.08, r * 0.45, r * 0.16);
    muzzleFlash(c, r * 1.05, 0, r * 0.8, '#fff', st.anim === 'fire' ? st.t * 1.5 : 0);
    if (st.anim === 's2') { c.save(); c.globalAlpha = pulse(st.t) * 0.6; c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(r * 1.1, -r * 0.3 + i * r * 0.3); c.lineTo(r * 1.9 + i * r * 0.2, -r * 0.45 + i * r * 0.45); c.stroke(); } c.restore(); }
    cockpit(c, r * 0.15, -r * 0.2, r * 0.5, r * 0.36, '#e0f6ff');
  },

  // PHANTOM: spider-crab mech. Four bladed legs, hooded carapace, cloak trails; dissolves on Blink.
  phantom(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.45), lite = shade(col, 0.3);
    const fade = st.anim === 's1' ? (st.t < 0.5 ? 1 - st.t * 2 : (st.t - 0.5) * 2) : 1;
    const skitter = Math.sin(T * 12 + (st.vx || 0)) * (st.grounded ? 0.08 : 0.25);
    c.save(); c.globalAlpha = fade;
    if (fade < 1) { c.save(); c.globalAlpha = 1 - fade; c.fillStyle = col; for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + T * 3; c.beginPath(); c.arc(Math.cos(a) * r * (1.2 + (1 - fade) * 1.5), Math.sin(a) * r * (0.8 + (1 - fade)), r * 0.08, 0, TAU); c.fill(); } c.restore(); }
    outline(c, r);
    // legs: two pairs, jointed, ending in blades
    for (const [ox, dir, ph] of [[-0.55, -1, 0], [-0.25, -1, 1], [0.25, 1, 2], [0.55, 1, 3]]) {
      const k = Math.sin(T * 9 + ph * 1.6) * skitter;
      const x0 = ox * r, y0 = r * 0.2, x1 = x0 + dir * r * 0.45, y1 = -r * 0.25 + k * r, x2 = x1 + dir * r * 0.25, y2 = r * 0.95;
      c.lineWidth = Math.max(3, r * 0.15); c.strokeStyle = '#0d1018'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.lineWidth = Math.max(2, r * 0.09); c.strokeStyle = dark; c.stroke();
      c.fillStyle = '#c9ced8'; c.beginPath(); c.moveTo(x2 - r * 0.08, y2 - r * 0.1); c.lineTo(x2 + dir * r * 0.12, y2 + r * 0.05); c.lineTo(x2 + r * 0.08, y2 - r * 0.1); c.closePath(); c.fill();
    }
    outline(c, r);
    // cloak
    c.beginPath(); c.moveTo(-r * 0.9, -r * 0.2); c.quadraticCurveTo(-r * 1.3, r * 0.4 + Math.sin(T * 4) * r * 0.08, -r * 0.7, r * 0.7); c.lineTo(-r * 0.2, r * 0.3); c.closePath(); fillStroke(c, dark);
    // carapace
    c.beginPath(); c.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, TAU); fillStroke(c, col);
    c.fillStyle = lite; c.beginPath(); c.ellipse(r * 0.1, -r * 0.2, r * 0.6, r * 0.2, 0, 0, TAU); c.fill();
    // hood over cockpit
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.3); c.quadraticCurveTo(0, -r * 1.1, r * 0.6, -r * 0.35); c.closePath(); fillStroke(c, dark);
    cockpit(c, 0, -r * 0.3, r * 0.5, r * 0.36, '#f0d8ff');
    // shard launchers on the front
    for (let i = 0; i < 3; i++) { c.fillStyle = '#2b303a'; c.beginPath(); c.moveTo(r * 0.8, -r * 0.2 + i * r * 0.2); c.lineTo(r * 1.15, -r * 0.25 + i * r * 0.2); c.lineTo(r * 0.8, -r * 0.1 + i * r * 0.2); c.closePath(); c.fill(); c.stroke(); }
    muzzleFlash(c, r * 1.1, 0, r * 0.8, col, st.anim === 'fire' ? st.t * 1.5 : 0);
    // smoke canister on the back during s2
    if (st.anim === 's2') { c.save(); c.globalAlpha = 1 - st.t; c.fillStyle = '#c8c8d8'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-r * 0.6 - st.t * r * 0.8 * i * 0.2, -r * 0.6 - st.t * r * 1.2 - i * r * 0.15, r * (0.15 + st.t * 0.25), 0, TAU); c.fill(); } c.restore(); }
    glowDot(c, r * 0.35, -r * 0.05, r * 0.07, '#f0d8ff');
    c.restore();
  },

  // RICOCHET: hamster-ball rover. A caged sphere with a pilot pod that stays level while the cage spins.
  ricochet(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.4), lite = shade(col, 0.35);
    const spin = (st.vx || 0) * 0.15 + T * (st.grounded ? 1 : 4) + (st.anim === 's1' ? st.t * 12 : 0);
    outline(c, r);
    // inner pod
    c.beginPath(); c.arc(0, r * 0.1, r * 0.55, 0, TAU); fillStroke(c, col);
    c.fillStyle = lite; c.beginPath(); c.arc(-r * 0.15, -r * 0.05, r * 0.22, 0, TAU); c.fill();
    cockpit(c, r * 0.05, r * 0.05, r * 0.5, r * 0.4, '#ffd4ea');
    // cage: rotating ribs
    c.save(); c.rotate(spin);
    c.lineWidth = Math.max(3, r * 0.14); c.strokeStyle = '#0d1018';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, 0, r * 0.98, r * 0.98 * Math.abs(Math.cos(i * Math.PI / 4)) + 0.1, i * Math.PI / 4, 0, TAU); c.stroke(); }
    c.lineWidth = Math.max(2, r * 0.07); c.strokeStyle = '#c9ced8';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, 0, r * 0.98, r * 0.98 * Math.abs(Math.cos(i * Math.PI / 4)) + 0.1, i * Math.PI / 4, 0, TAU); c.stroke(); }
    c.restore();
    // outer ring
    c.lineWidth = Math.max(3, r * 0.12); c.strokeStyle = '#0d1018'; c.beginPath(); c.arc(0, 0, r * 1.0, 0, TAU); c.stroke();
    c.lineWidth = Math.max(2, r * 0.06); c.strokeStyle = dark; c.stroke();
    // launcher port on the equator (fires the pinball / split shot)
    c.save(); c.translate(r * 0.95, 0);
    rrect(c, -r * 0.15, -r * 0.12, r * 0.35, r * 0.24, r * 0.06); c.lineWidth = Math.max(2, r * 0.09); c.strokeStyle = '#0d1018'; fillStroke(c, '#2b303a');
    muzzleFlash(c, r * 0.2, 0, r * 0.8, col, st.anim === 'fire' || st.anim === 's1' || st.anim === 's2' ? st.t * 1.5 : 0);
    c.restore();
    if (st.anim === 's2') { c.save(); c.globalAlpha = pulse(st.t); c.fillStyle = col; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(r * 1.3 + i * r * 0.15, -r * 0.4 + i * r * 0.27, r * 0.08, 0, TAU); c.fill(); } c.restore(); }
  },

  // GRAVITAS: floating monolith core with two orbiting rings and a suspended pilot capsule.
  gravitas(c, r, st, T) {
    const col = st.color, dark = shade(col, -0.45), lite = shade(col, 0.3);
    const collapse = st.anim === 's1' ? pulse(st.t) : 0;   // rings pull in
    const burst = st.anim === 's2' ? ease(st.t) : 0;         // rings fly out
    const ringR = r * (1.15 - collapse * 0.5 + burst * 1.1);
    const hover = Math.sin(T * 2.5) * r * 0.05;
    c.translate(0, hover);
    // gravity well shadow
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.8, r * 0.14, 0, 0, TAU); c.fill(); c.restore();
    outline(c, r);
    // back ring
    c.save(); c.rotate(T * 0.8); c.lineWidth = Math.max(3, r * 0.13); c.strokeStyle = '#0d1018'; c.beginPath(); c.ellipse(0, 0, ringR, ringR * 0.35, 0.5, Math.PI, TAU); c.stroke(); c.lineWidth = Math.max(2, r * 0.07); c.strokeStyle = lite; c.stroke(); c.restore();
    // core monolith
    c.save(); c.rotate(Math.sin(T * 1.5) * 0.06);
    rrect(c, -r * 0.42, -r * 0.8, r * 0.84, r * 1.5, r * 0.12); fillStroke(c, col);
    c.fillStyle = dark; c.fillRect(-r * 0.3, -r * 0.65, r * 0.6, r * 0.32); c.fillRect(-r * 0.3, r * 0.3, r * 0.6, r * 0.28);
    glowDot(c, 0, -r * 0.5, r * 0.1 + collapse * r * 0.15, '#b8c4ff', 0.6 + collapse * 0.4 + burst * 0.4);
    c.restore();
    cockpit(c, 0, r * 0.02, r * 0.55, r * 0.42, '#e0e6ff');
    // front ring
    c.save(); c.rotate(-T * 0.8); c.lineWidth = Math.max(3, r * 0.13); c.strokeStyle = '#0d1018'; c.beginPath(); c.ellipse(0, 0, ringR, ringR * 0.35, -0.5, 0, Math.PI); c.stroke(); c.lineWidth = Math.max(2, r * 0.07); c.strokeStyle = lite; c.stroke(); c.restore();
    // orbiting pebbles pulled in on Singularity
    c.fillStyle = '#c9ced8'; for (let i = 0; i < 5; i++) { const a = T * 1.3 + i * TAU / 5; const rr = ringR * (0.9 + 0.2 * Math.sin(i)); c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.4, r * 0.06, 0, TAU); c.fill(); }
    muzzleFlash(c, r * 0.5, -r * 0.1, r * 0.8, '#b8c4ff', st.anim === 'fire' || st.anim === 's1' ? st.t * 1.5 : 0);
    if (burst > 0) { c.save(); c.globalAlpha = 1 - burst; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r * (0.6 + burst * 2.4), 0, TAU); c.stroke(); c.restore(); }
  },
};

export const ANIM_LENGTH = { idle: 1, jump: 0.5, land: 0.35, fire: 0.4, s1: 0.8, s2: 0.7, hit: 0.35, death: 1.0 };

// Draw one bot at the origin. Handles facing, squash/stretch, hit flash and death fade.
export function drawBot(ctx, def, r, st, time) {
  const rig = RIGS[def.id] || RIGS.gravitas;
  const tf = bodyTransform(st);
  ctx.save();
  ctx.translate(0, tf.dy * r + r * 0.15);   // rigs sit slightly low so wheels/legs touch the ground line
  ctx.rotate(tf.rot * (st.facing || 1));
  ctx.scale(tf.sx * (st.facing || 1), tf.sy);
  ctx.translate(0, -r * 0.15);
  if (st.anim === 'death') ctx.globalAlpha = 1 - st.t * 0.9;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  rig(ctx, r, st, time);
  if (st.anim === 'hit' && st.t < 0.5) { ctx.globalAlpha = 0.55 * (1 - st.t * 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export const RIG_IDS = Object.keys(RIGS);
