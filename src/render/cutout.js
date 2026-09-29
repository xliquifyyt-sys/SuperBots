// Cut-out rigs: one painted still per bot, split into parts (weapon, body,
// head, front legs, back legs) that the game animates with tweens. This is how
// most polished 2D games animate a painted character: crisp, consistent, and a
// death can break the bot into pieces. Part outlines are polygons in the still's
// 512 px canvas; pivots are where each part hinges. Any bot without an entry
// here keeps its still and the procedural squash.
import { getSprite, spriteTuning } from './sprites.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIn = (t) => Math.pow(clamp(t, 0, 1), 2);
const pulse = (t, k = 1) => Math.sin(clamp(t, 0, 1) * Math.PI) * k;
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

// Roles: weapon (recoils, swings, glows), body (leans, bobs), head (lags the body,
// whips on hits), legsF / legsB (brace, tuck, splay). `order` is back to front.
export const CUTOUT = {
  volt: {
    parts: {
      legsB: { poly: [[252, 275], [372, 268], [378, 392], [250, 392]], pivot: [300, 292] },
      legsF: { poly: [[38, 250], [255, 262], [258, 392], [36, 392]], pivot: [150, 272] },
      head:  { poly: [[92, 108], [172, 108], [176, 192], [88, 192]], pivot: [130, 190] },
      body:  { poly: [[82, 176], [222, 164], [262, 200], [264, 282], [88, 284]], pivot: [172, 232] },
      weapon:{ poly: [[214, 200], [238, 166], [322, 164], [334, 204], [512, 198], [512, 272], [282, 276], [214, 258]], pivot: [252, 236] },
    },
    order: ['legsB', 'head', 'body', 'legsF', 'weapon'],
    recoil: 26,          // px the weapon kicks back on a shot
    s1: 'charge', s2: 'swing',
  },
  bulwark: { // tank: tracks, hull with crane arm, turret hatch, cannon
    parts: {
      legsF: { poly: [[40, 284], [396, 284], [396, 392], [40, 392]], pivot: [216, 300] },
      body:  { poly: [[44, 232], [98, 158], [176, 148], [200, 186], [326, 186], [326, 262], [362, 262], [442, 286], [442, 340], [380, 336], [60, 300]], pivot: [230, 236] },
      head:  { poly: [[198, 118], [324, 116], [324, 194], [198, 194]], pivot: [260, 192] },
      weapon:{ poly: [[320, 176], [512, 172], [512, 270], [320, 264]], pivot: [340, 222] },
    },
    order: ['legsF', 'body', 'head', 'weapon'], recoil: 30, s1: 'charge', s2: 'heavyShot',
  },
  magmaw: { // dragon: the jawed head is the weapon, the tail vents are the "head" (they wag)
    parts: {
      legsB: { poly: [[250, 284], [392, 294], [392, 392], [250, 392]], pivot: [320, 300] },
      head:  { poly: [[34, 194], [116, 188], [116, 282], [34, 282]], pivot: [112, 236] },
      body:  { poly: [[100, 192], [150, 128], [342, 126], [352, 302], [104, 302]], pivot: [230, 222] },
      legsF: { poly: [[64, 300], [252, 284], [256, 392], [64, 392]], pivot: [160, 296] },
      weapon:{ poly: [[330, 166], [420, 148], [512, 188], [512, 342], [330, 342]], pivot: [350, 232] },
    },
    order: ['legsB', 'head', 'body', 'legsF', 'weapon'], recoil: 18, s1: 'slam', s2: 'volley',
  },
  warden: { // shield-bearer: the shield is the "head" (it jolts on hits), harpoon rack is the weapon
    parts: {
      legsB: { poly: [[248, 298], [378, 298], [378, 370], [248, 370]], pivot: [310, 306] },
      body:  { poly: [[118, 148], [342, 148], [346, 322], [118, 322]], pivot: [230, 240] },
      legsF: { poly: [[108, 298], [226, 298], [226, 370], [108, 370]], pivot: [166, 306] },
      head:  { poly: [[38, 138], [142, 138], [142, 362], [38, 362]], pivot: [132, 250] },
      weapon:{ poly: [[320, 198], [512, 192], [512, 308], [320, 302]], pivot: [340, 250] },
    },
    order: ['legsB', 'body', 'legsF', 'head', 'weapon'], recoil: 22, s1: 'shield', s2: 'heavyShot',
  },
  skyla: { // jet: nose section is the weapon, tail fin the "head", thruster pod the legs
    parts: {
      head:  { poly: [[98, 118], [226, 118], [226, 264], [98, 264]], pivot: [216, 256] },
      legsF: { poly: [[168, 284], [382, 284], [382, 394], [168, 394]], pivot: [276, 290] },
      body:  { poly: [[38, 282], [220, 240], [226, 116], [302, 116], [322, 188], [402, 188], [402, 302], [58, 306]], pivot: [270, 250] },
      weapon:{ poly: [[378, 230], [512, 230], [512, 302], [378, 302]], pivot: [390, 266] },
    },
    order: ['head', 'legsF', 'body', 'weapon'], recoil: 8, s1: 'rain', s2: 'charge', hover: true,
  },
  phantom: { // assassin: leading blade arm is the weapon, hood is the head, trailing blade rides with the body
    parts: {
      legsB: { poly: [[94, 298], [202, 298], [202, 406], [94, 406]], pivot: [150, 306] },
      body:  { poly: [[38, 342], [58, 238], [148, 188], [254, 148], [332, 178], [338, 332]], pivot: [250, 250] },
      head:  { poly: [[254, 102], [382, 98], [386, 262], [254, 262]], pivot: [310, 242] },
      legsF: { poly: [[178, 294], [346, 300], [346, 406], [178, 406]], pivot: [260, 300] },
      weapon:{ poly: [[298, 214], [512, 298], [512, 346], [318, 346], [298, 262]], pivot: [330, 250] },
    },
    order: ['legsB', 'body', 'head', 'legsF', 'weapon'], recoil: 14, s1: 'blink', s2: 'swing',
  },
  ricochet: { // sphere: cannon arm is the weapon, fins plus rear arm the "head", wheel and lower arms the legs
    parts: {
      head:  { poly: [[18, 114], [104, 58], [262, 58], [262, 246], [18, 246]], pivot: [226, 216] },
      legsF: { poly: [[98, 240], [432, 240], [432, 452], [98, 452]], pivot: [256, 322] },
      body:  { poly: [[158, 128], [352, 128], [352, 302], [158, 302]], pivot: [256, 216] },
      weapon:{ poly: [[338, 148], [502, 148], [502, 272], [338, 272]], pivot: [350, 216] },
    },
    order: ['head', 'legsF', 'body', 'weapon'], recoil: 20, s1: 'spin', s2: 'heavyShot',
  },
  gravitas: { // ringed orb: cannon is the weapon, rear engine block the "head"
    parts: {
      legsB: { poly: [[278, 284], [392, 284], [392, 392], [278, 392]], pivot: [322, 300] },
      head:  { poly: [[54, 128], [152, 128], [152, 292], [54, 292]], pivot: [146, 216] },
      legsF: { poly: [[38, 284], [202, 284], [202, 402], [38, 402]], pivot: [150, 300] },
      body:  { poly: [[128, 114], [402, 114], [402, 342], [128, 342]], pivot: [256, 226] },
      weapon:{ poly: [[338, 194], [512, 194], [512, 292], [338, 292]], pivot: [356, 240] },
    },
    order: ['legsB', 'head', 'legsF', 'body', 'weapon'], recoil: 24, s1: 'charge', s2: 'burst',
  },
};

const built = new Map();   // botId -> { parts: [{ role, canvas, pivot }] } once the still is loaded

export function getCutout(botId) {
  const spec = CUTOUT[botId];
  if (!spec) return null;
  const cached = built.get(botId);
  if (cached) return cached;
  const img = getSprite(botId);
  if (!img) return null;
  const S = 512;
  const parts = [];
  for (const role of spec.order) {
    const p = spec.parts[role];
    if (!p) continue;
    // mask = the part outline dilated by a few pixels so neighbouring parts overlap at the joints
    const mk = document.createElement('canvas'); mk.width = S; mk.height = S;
    const m = mk.getContext('2d');
    m.fillStyle = '#fff'; m.strokeStyle = '#fff'; m.lineWidth = 10; m.lineJoin = 'round';
    m.beginPath(); p.poly.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y))); m.closePath(); m.fill(); m.stroke();
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0, S, S);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(mk, 0, 0);
    parts.push({ role, canvas: cv, pivot: p.pivot });
  }
  const rig = { parts, spec };
  built.set(botId, rig);
  return rig;
}

// Pose of one part for the current state. Units are still-canvas pixels and
// radians; +x is forward (the outer transform mirrors for facing left).
function pose(role, st, time, spec, geo) {
  const t = st.t || 0;
  const o = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1, alpha: 1, glow: 0 };
  const ph = time * 2.2 + (st.id || 0) * 1.7;
  // resting breath under everything except death
  if (st.anim !== 'death') {
    const b = Math.sin(ph);
    if (role === 'body') o.dy += b * 2.2;
    if (spec.hover) { o.dy += Math.sin(ph * 0.8) * 4; if (role === 'legsF') o.glow = 0.25 + 0.25 * Math.sin(time * 18); }
    if (role === 'head') { o.dy += Math.sin(ph - 0.5) * 3; o.rot += Math.sin(ph * 0.7) * 0.03; }
    if (role === 'weapon') { o.dy += Math.sin(ph - 0.3) * 2.2; o.rot += Math.sin(ph * 0.9) * 0.012; }
  }
  switch (st.anim) {
    case 'fire': {
      const k = pulse(t * 1.4), kl = pulse((t - 0.06) * 1.4);
      if (role === 'weapon') { o.dx -= spec.recoil * k; o.rot -= 0.06 * k; o.glow = Math.max(0, 1 - t * 3); }
      if (role === 'body') { o.dx -= 9 * k; o.rot -= 0.03 * k; o.dy += 2 * k; }
      if (role === 'head') { o.dx -= 9 * kl; o.rot -= 0.09 * kl; }
      if (role === 'legsF') o.rot += 0.06 * k;
      if (role === 'legsB') o.rot -= 0.06 * k;
      break;
    }
    case 's1': case 's2': {
      const style = (st.anim === 's1' ? spec.s1 : spec.s2) || (st.anim === 's1' ? 'charge' : 'swing');
      special(style, role, o, t, time, spec, geo);
      break;
    }
    case 'jump': {
      if (t < 0.25) { const k = t / 0.25; if (role === 'body') o.dy += 9 * k; if (role === 'legsF') o.rot += 0.15 * k; if (role === 'legsB') o.rot -= 0.15 * k; }
      else { const k = ease((t - 0.25) / 0.3); if (role === 'legsF') o.rot -= 0.38 * k; if (role === 'legsB') o.rot += 0.38 * k; if (role === 'body') o.sy += 0.05 * k; if (role === 'weapon') o.rot -= 0.08 * k; }
      break;
    }
    case 'land': {
      const k = pulse(t);
      if (role === 'body') { o.dy += 14 * k; o.sy -= 0.1 * k; o.sx += 0.08 * k; }
      if (role === 'head') o.dy += 12 * k;
      if (role === 'weapon') { o.dy += 8 * k; o.rot += 0.05 * k; }
      if (role === 'legsF') o.rot += 0.25 * k;
      if (role === 'legsB') o.rot -= 0.25 * k;
      break;
    }
    case 'hit': {
      const k = pulse(t);
      if (role === 'body') { o.dx -= 10 * k; o.rot += 0.06 * Math.sin(t * 40) * k; }
      if (role === 'head') o.rot += 0.28 * Math.sin(t * 30) * k;
      if (role === 'weapon') { o.rot -= 0.16 * k; o.dx -= 6 * k; }
      break;
    }
    case 'death': {
      // parts fly apart on their own arcs, then fade
      const seed = { weapon: [85, -260, 2.4], body: [-20, -180, -0.6], head: [-70, -320, -3.2], legsF: [-110, -140, -1.8], legsB: [120, -160, 1.6] }[role] || [0, -150, 1];
      const g = 620;
      o.dx += seed[0] * t; o.dy += seed[1] * t + g * t * t; o.rot += seed[2] * t;
      o.alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      break;
    }
  }
  return o;
}

// Special-move body styles. Each describes what the parts do while the effect
// itself is drawn by the renderer. `geo` gives this part's offset from the body
// pivot so whole-body styles (burst, blink, spin) can move parts coherently.
function special(style, role, o, t, time, spec, geo) {
  const W = role === 'weapon', B = role === 'body', H = role === 'head', LF = role === 'legsF', LB = role === 'legsB';
  switch (style) {
    case 'charge': { // pull back and glow, thrust forward and hold, release
      const charge = ease(t / 0.35), hold = t > 0.35 && t < 0.88 ? 1 : 0, back = t >= 0.88 ? ease((t - 0.88) / 0.12) : 0;
      const push = lerp(lerp(-8 * charge, 16, hold ? ease((t - 0.35) / 0.08) : 0), 0, back);
      const flick = 0.85 + 0.15 * Math.sin(time * 40);
      if (W) { o.dx += push; o.glow = lerp(charge * 0.7, flick, hold) * (1 - back); }
      if (B) { o.dx += push * 0.4; o.rot += 0.05 * (hold ? 1 : charge) * (1 - back); }
      if (H) { o.dx += push * 0.35; o.rot -= 0.06 * charge * (1 - back); }
      if (LF) o.rot -= 0.12 * (hold ? 1 : charge) * (1 - back);
      if (LB) o.rot += 0.12 * (hold ? 1 : charge) * (1 - back);
      break;
    }
    case 'swing': { // underhand lob: weapon swings down, snaps up, settles
      let sw;
      if (t < 0.35) sw = 0.75 * ease(t / 0.35);
      else if (t < 0.55) sw = lerp(0.75, -0.4, easeIn((t - 0.35) / 0.2));
      else sw = lerp(-0.4, 0, ease((t - 0.55) / 0.45));
      if (W) { o.rot += sw; o.glow = t > 0.5 && t < 0.62 ? 1 : 0; }
      if (B) { o.rot += sw * 0.15; o.dy += Math.abs(sw) * 4; }
      if (H) o.rot -= sw * 0.2;
      if (LF) o.rot -= sw * 0.1;
      break;
    }
    case 'heavyShot': { // sink on the suspension, barrel out, then a recoil that lifts the front
      const sink = t < 0.3 ? ease(t / 0.3) : (t < 0.42 ? 1 : 1 - ease((t - 0.42) / 0.2));
      const kick = pulse((t - 0.3) / 0.55);
      if (B) { o.dy += 9 * sink; o.dx -= 16 * kick; o.rot -= 0.1 * kick; }
      if (H) { o.dy += 7 * sink; o.rot -= 0.14 * kick; o.dx -= 10 * kick; }
      if (W) { o.dx += 10 * sink - spec.recoil * 1.5 * kick; o.rot -= 0.1 * kick; o.glow = Math.max(0, 1 - Math.abs(t - 0.32) * 8) + 0.5 * sink * (t < 0.3 ? 1 : 0); }
      if (LF) { o.rot += 0.1 * sink + 0.12 * kick; }
      if (LB) { o.rot -= 0.1 * sink - 0.05 * kick; }
      break;
    }
    case 'slam': { // deep crouch, jaw open, spring up into the leap
      const crouch = t < 0.45 ? ease(t / 0.45) : 1 - ease((t - 0.45) / 0.25);
      if (B) { o.dy += 14 * crouch; o.sy -= 0.12 * crouch; o.sx += 0.06 * crouch; }
      if (W) { o.rot -= 0.35 * crouch; o.dy += 10 * crouch; o.glow = crouch; }
      if (H) o.rot += 0.3 * crouch;
      if (LF) o.rot += 0.3 * crouch;
      if (LB) o.rot -= 0.3 * crouch;
      break;
    }
    case 'volley': { // three quick bobs, one per shot
      const k = pulse((t * 3) % 1);
      const lean = ease(t * 2);
      if (W) { o.rot -= 0.22 * k; o.dx -= 9 * k; o.glow = k; }
      if (B) { o.rot -= 0.03 * k + 0.03 * lean; o.dx += 4 * lean; }
      if (H) o.rot += 0.1 * k;
      break;
    }
    case 'shield': { // the shield (head part) lifts, squares up and lights, then holds
      const up = ease(t * 2.2), hold = t < 0.85 ? 1 : 1 - ease((t - 0.85) / 0.15);
      if (H) { o.dy -= 16 * up * hold; o.rot -= 0.3 * up * hold; o.sx += 0.12 * up * hold; o.glow = (0.6 + 0.4 * Math.sin(time * 14)) * up * hold; }
      if (B) { o.dx -= 5 * up * hold; o.rot -= 0.03 * up * hold; }
      if (LF) o.rot += 0.1 * up * hold;
      if (LB) o.rot -= 0.1 * up * hold;
      break;
    }
    case 'rain': { // nose up, thrusters flare, bays release
      const k = pulse(t), up = ease(t * 2);
      if (B) { o.rot -= 0.16 * up * (1 - ease((t - 0.7) / 0.3)); o.dy -= 8 * k; }
      if (W) { o.rot -= 0.1 * k; o.glow = k * 0.8; }
      if (LF) { o.glow = 1; o.dy += 6 * k; }
      if (H) o.rot += 0.12 * k;
      break;
    }
    case 'blink': { // stretch thin and vanish, re-form at the arrival
      const out = t < 0.3 ? ease(t / 0.3) : (t < 0.5 ? 1 : 1 - ease((t - 0.5) / 0.3));
      o.sy += 0.5 * out; o.sx -= 0.55 * out; o.dy -= 18 * out;
      o.alpha *= 1 - out * 0.9;
      if (W) { o.glow = t > 0.7 ? pulse((t - 0.7) / 0.3) : out * 0.5; o.rot += t > 0.7 ? -0.9 * pulse((t - 0.7) / 0.3) : 0; }
      break;
    }
    case 'spin': { // whole body rolls one full turn, weapon flashes at the release
      const r = ease(t) * TAU;
      if (B) o.rot += r;
      if (W) { o.rot += r * 0.2; o.glow = t > 0.85 ? 1 : 0; o.dx -= spec.recoil * pulse((t - 0.85) / 0.15); }
      if (H) o.rot += r * 0.15;
      if (LF) o.rot += 0.08 * Math.sin(r);
      break;
    }
    case 'burst': { // compress toward the core, then blast every part outward and settle
      const sq = t < 0.35 ? ease(t / 0.35) : 0, bl = t >= 0.35 ? pulse((t - 0.35) / 0.65) : 0;
      const ox = geo ? geo.dx : 0, oy = geo ? geo.dy : 0, d = Math.hypot(ox, oy) || 1;
      const push = -0.18 * sq + 0.3 * bl;
      o.dx += ox * push; o.dy += oy * push;
      if (B) { o.sx += -0.15 * sq + 0.18 * bl; o.sy += -0.15 * sq + 0.18 * bl; o.glow = bl; }
      else o.rot += (ox / d) * 0.25 * bl;
      break;
    }
  }
}

// Draw the rigged bot. Caller has already applied the body transform (facing,
// airborne lean); R is the art radius used for the still, so the rig sits on
// exactly the same footprint.
export function drawCutout(ctx, rig, R, botId, st, time) {
  const tun = spriteTuning(botId);
  const w = R * 2.6 * tun.scale, k = w / 512;
  const ox = -w / 2, oy = -w / 2 + R * tun.dy;
  const baseAlpha = ctx.globalAlpha;
  const bodyPivot = (rig.spec.parts.body || rig.spec.parts.weapon).pivot;
  for (const part of rig.parts) {
    const p = pose(part.role, st, time, rig.spec, { dx: part.pivot[0] - bodyPivot[0], dy: part.pivot[1] - bodyPivot[1] });
    const px = ox + part.pivot[0] * k, py = oy + part.pivot[1] * k;
    ctx.save();
    ctx.translate(px + p.dx * k, py + p.dy * k);
    ctx.rotate(p.rot);
    ctx.scale(p.sx, p.sy);
    ctx.globalAlpha = baseAlpha * p.alpha;
    ctx.drawImage(part.canvas, -part.pivot[0] * k, -part.pivot[1] * k, w, w);
    if (p.glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = baseAlpha * p.alpha * p.glow * 0.7;
      ctx.drawImage(part.canvas, -part.pivot[0] * k, -part.pivot[1] * k, w, w);
    }
    ctx.restore();
  }
}

export const CUTOUT_IDS = Object.keys(CUTOUT);
