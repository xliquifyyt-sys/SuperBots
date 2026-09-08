// Power-up icons: bold, readable vector glyphs on a coloured badge. Used in-game,
// in the tap-for-info popup and in the Botpedia.

const TAU = Math.PI * 2;

const BADGE = {
  repair:    { bg: '#2fbf5f', fg: '#ffffff' },
  overclock: { bg: '#2fb9ff', fg: '#ffffff' },
  amp:       { bg: '#ff6a2f', fg: '#ffe7c2' },
  plating:   { bg: '#7b8aa5', fg: '#eef3ff' },
  toxin:     { bg: '#7fd21e', fg: '#0f2a05' },
  frost:     { bg: '#6fd6ff', fg: '#ffffff' },
  thrusters: { bg: '#ffb02e', fg: '#3a1a00' },
  reflector: { bg: '#d7e3ff', fg: '#2a3d7a' },
  shockwire: { bg: '#ffe23a', fg: '#3a2a00' },
  rally:     { bg: '#ff5fa8', fg: '#ffffff' },
};

// Draw the icon centred at (x, y) with badge radius r.
export function drawPowerupIcon(c, id, x, y, r, opts = {}) {
  const B = BADGE[id] || { bg: '#888', fg: '#fff' };
  c.save(); c.translate(x, y);
  if (opts.float) c.translate(0, Math.sin((opts.time || 0) * 3 + x * 0.01) * r * 0.18);
  // glow + badge
  if (!opts.flat) { const g = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8); g.addColorStop(0, B.bg + 'aa'); g.addColorStop(1, B.bg + '00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.8, 0, TAU); c.fill(); }
  const bg = c.createLinearGradient(0, -r, 0, r); bg.addColorStop(0, lighten(B.bg, 0.35)); bg.addColorStop(1, darken(B.bg, 0.35));
  c.fillStyle = bg; c.strokeStyle = '#0b0e14'; c.lineWidth = Math.max(1.5, r * 0.14);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-r * 0.25, -r * 0.4, r * 0.4, r * 0.2, -0.5, 0, TAU); c.fill();
  // glyph
  c.fillStyle = B.fg; c.strokeStyle = B.fg; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, r * 0.18);
  const s = r * 0.62;
  switch (id) {
    case 'repair': // medical cross
      c.fillRect(-s * 0.28, -s, s * 0.56, s * 2); c.fillRect(-s, -s * 0.28, s * 2, s * 0.56);
      break;
    case 'overclock': // circular arrows
      c.beginPath(); c.arc(0, 0, s * 0.75, -2.6, 0.4); c.stroke();
      c.beginPath(); c.moveTo(s * 0.75 * Math.cos(0.4) + s * 0.35, s * 0.75 * Math.sin(0.4) - s * 0.05); c.lineTo(s * 0.75 * Math.cos(0.4) - s * 0.05, s * 0.75 * Math.sin(0.4) - s * 0.35); c.lineTo(s * 0.75 * Math.cos(0.4) - s * 0.1, s * 0.75 * Math.sin(0.4) + s * 0.3); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, 0, s * 0.75, 0.55, 3.5); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.75 - s * 0.35, s * 0.05); c.lineTo(-s * 0.75 + s * 0.05, s * 0.35); c.lineTo(-s * 0.75 + s * 0.1, -s * 0.3); c.closePath(); c.fill();
      break;
    case 'amp': // double up-chevron
      for (const dy of [-s * 0.35, s * 0.45]) { c.beginPath(); c.moveTo(-s * 0.85, dy + s * 0.4); c.lineTo(0, dy - s * 0.45); c.lineTo(s * 0.85, dy + s * 0.4); c.stroke(); }
      break;
    case 'plating': // shield
      c.beginPath(); c.moveTo(-s * 0.85, -s * 0.75); c.lineTo(s * 0.85, -s * 0.75); c.lineTo(s * 0.85, s * 0.1); c.quadraticCurveTo(s * 0.85, s * 0.8, 0, s * 1.0); c.quadraticCurveTo(-s * 0.85, s * 0.8, -s * 0.85, s * 0.1); c.closePath(); c.fill();
      c.fillStyle = B.bg; c.beginPath(); c.moveTo(0, -s * 0.45); c.lineTo(s * 0.45, -s * 0.2); c.lineTo(s * 0.45, s * 0.1); c.quadraticCurveTo(s * 0.45, s * 0.5, 0, s * 0.65); c.quadraticCurveTo(-s * 0.45, s * 0.5, -s * 0.45, s * 0.1); c.lineTo(-s * 0.45, -s * 0.2); c.closePath(); c.fill();
      break;
    case 'toxin': // skull
      c.beginPath(); c.arc(0, -s * 0.2, s * 0.7, 0, TAU); c.fill(); c.fillRect(-s * 0.45, s * 0.2, s * 0.9, s * 0.55);
      c.fillStyle = B.bg; c.beginPath(); c.arc(-s * 0.28, -s * 0.25, s * 0.2, 0, TAU); c.arc(s * 0.28, -s * 0.25, s * 0.2, 0, TAU); c.fill(); c.fillRect(-s * 0.3, s * 0.35, s * 0.12, s * 0.35); c.fillRect(s * 0.18, s * 0.35, s * 0.12, s * 0.35); c.beginPath(); c.moveTo(0, s * 0.05); c.lineTo(-s * 0.12, s * 0.28); c.lineTo(s * 0.12, s * 0.28); c.closePath(); c.fill();
      break;
    case 'frost': // snowflake
      c.lineWidth = Math.max(1.5, r * 0.14);
      for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI / 3); c.beginPath(); c.moveTo(0, -s * 0.95); c.lineTo(0, s * 0.95); c.stroke(); for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(0, sg * s * 0.55); c.lineTo(s * 0.3, sg * s * 0.85); c.moveTo(0, sg * s * 0.55); c.lineTo(-s * 0.3, sg * s * 0.85); c.stroke(); } c.restore(); }
      break;
    case 'thrusters': // rocket flame
      c.beginPath(); c.moveTo(0, -s * 1.0); c.quadraticCurveTo(s * 0.55, -s * 0.3, s * 0.45, s * 0.3); c.lineTo(-s * 0.45, s * 0.3); c.quadraticCurveTo(-s * 0.55, -s * 0.3, 0, -s * 1.0); c.closePath(); c.fill();
      c.fillStyle = '#ff5a1f'; c.beginPath(); c.moveTo(-s * 0.4, s * 0.35); c.lineTo(0, s * 1.05); c.lineTo(s * 0.4, s * 0.35); c.closePath(); c.fill();
      c.fillStyle = '#ffe7a0'; c.beginPath(); c.moveTo(-s * 0.18, s * 0.35); c.lineTo(0, s * 0.7); c.lineTo(s * 0.18, s * 0.35); c.closePath(); c.fill();
      c.fillStyle = B.bg; c.beginPath(); c.arc(0, -s * 0.3, s * 0.16, 0, TAU); c.fill();
      break;
    case 'reflector': // bouncing arrow off a bar
      c.lineWidth = Math.max(1.5, r * 0.16);
      c.beginPath(); c.moveTo(-s * 0.9, s * 0.75); c.lineTo(s * 0.9, s * 0.75); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.8, -s * 0.7); c.lineTo(0, s * 0.55); c.lineTo(s * 0.8, -s * 0.7); c.stroke();
      c.beginPath(); c.moveTo(s * 0.8, -s * 0.7); c.lineTo(s * 0.35, -s * 0.65); c.lineTo(s * 0.8, -s * 0.2); c.closePath(); c.fill();
      break;
    case 'shockwire': // lightning bolt
      c.beginPath(); c.moveTo(s * 0.2, -s * 1.0); c.lineTo(-s * 0.55, s * 0.1); c.lineTo(-s * 0.02, s * 0.1); c.lineTo(-s * 0.3, s * 1.0); c.lineTo(s * 0.6, -s * 0.2); c.lineTo(s * 0.05, -s * 0.2); c.closePath(); c.fill();
      break;
    case 'rally': // flag
      c.lineWidth = Math.max(1.5, r * 0.16);
      c.beginPath(); c.moveTo(-s * 0.6, -s * 0.95); c.lineTo(-s * 0.6, s * 0.95); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.6, -s * 0.9); c.lineTo(s * 0.8, -s * 0.5); c.lineTo(-s * 0.6, -s * 0.05); c.closePath(); c.fill();
      break;
    default:
      c.font = `bold ${Math.round(r)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 1);
  }
  c.restore();
}

// Standalone canvas element with the icon (for HTML panels).
export function iconCanvas(id, size = 40) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  drawPowerupIcon(c, id, size / 2, size / 2, size * 0.42, { flat: true });
  return cv;
}


// ---------------------------------------------------------------------------
// Action icons: Jump, Missile and one unique glyph per special move.
// Drawn as a rounded-square plate with a bold vector glyph, Brawlbots-style.

const ACTION_STYLE = {
  jump:         { bg: '#3fa9ff', fg: '#ffffff' },
  missile:      { bg: '#ff7a2f', fg: '#ffffff' },
  bastionWall:  { bg: '#8a97ad', fg: '#f2f6ff' },
  siegeShell:   { bg: '#b0552a', fg: '#ffe4c8' },
  moltenSlam:   { bg: '#e04a1f', fg: '#ffd9a0' },
  emberSpit:    { bg: '#ff8c2e', fg: '#5a1a00' },
  chainArc:     { bg: '#ffd23a', fg: '#3a2a00' },
  staticField:  { bg: '#3fd2ff', fg: '#04283a' },
  deflector:    { bg: '#9fb4e8', fg: '#13234f' },
  anchorBolt:   { bg: '#4a6a8f', fg: '#e8f2ff' },
  updraft:      { bg: '#7fd8ff', fg: '#053048' },
  galeShot:     { bg: '#bfeaf5', fg: '#0d4a5f' },
  blinkStrike:  { bg: '#8a5cff', fg: '#f0e8ff' },
  toxicBomb:    { bg: '#7fd21e', fg: '#0f2a05' },
  pinball:      { bg: '#ff5fa8', fg: '#ffffff' },
  splitShot:    { bg: '#ffb02e', fg: '#3a1a00' },
  singularity:  { bg: '#5f4ae0', fg: '#e8e2ff' },
  shockwave:    { bg: '#c05fff', fg: '#ffffff' },
};

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// Draw the action icon centred at (x, y); r = half plate size.
export function drawActionIcon(c, kind, x, y, r) {
  const S = ACTION_STYLE[kind] || { bg: '#666', fg: '#fff' };
  c.save(); c.translate(x, y);
  const bg = c.createLinearGradient(0, -r, 0, r); bg.addColorStop(0, lighten(S.bg, 0.35)); bg.addColorStop(1, darken(S.bg, 0.35));
  c.fillStyle = bg; c.strokeStyle = '#0b0e14'; c.lineWidth = Math.max(1.5, r * 0.12);
  roundRectPath(c, -r, -r, r * 2, r * 2, r * 0.32); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.28)'; roundRectPath(c, -r * 0.8, -r * 0.85, r * 1.6, r * 0.5, r * 0.2); c.fill();
  const s = r * 0.62; // glyph scale
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = S.fg; c.fillStyle = S.fg; c.lineWidth = Math.max(1.6, r * 0.2);
  switch (kind) {
    case 'jump': { // bot arc up with motion lines
      c.beginPath(); c.moveTo(-s, s * 0.8); c.quadraticCurveTo(0, -s * 1.25, s, s * 0.8); c.stroke();
      c.beginPath(); c.arc(s * 0.02, -s * 0.62, r * 0.22, 0, TAU); c.fill();
      c.lineWidth = Math.max(1, r * 0.1);
      c.beginPath(); c.moveTo(-s * 0.9, s * 0.95); c.lineTo(-s * 0.3, s * 0.95); c.moveTo(s * 0.3, s * 0.95); c.lineTo(s * 0.9, s * 0.95); c.stroke();
      break; }
    case 'missile': { // rocket at 45° with flame
      c.save(); c.rotate(-Math.PI / 4);
      c.beginPath(); c.moveTo(-s * 0.9, 0); c.lineTo(-s * 0.35, -s * 0.34); c.lineTo(s * 0.45, -s * 0.34); c.lineTo(s * 0.95, 0); c.lineTo(s * 0.45, s * 0.34); c.lineTo(-s * 0.35, s * 0.34); c.closePath(); c.fill();
      c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(-s * 0.9, 0); c.lineTo(-s * 1.35, -s * 0.22); c.lineTo(-s * 1.15, 0); c.lineTo(-s * 1.35, s * 0.22); c.closePath(); c.fill();
      c.restore(); break; }
    case 'bastionWall': { // three wall segments
      for (let i = -1; i <= 1; i++) { const h = s * (1.1 - Math.abs(i) * 0.25); roundRectPath(c, i * s * 0.62 - s * 0.24, s * 0.75 - h, s * 0.48, h, s * 0.1); c.fill(); }
      break; }
    case 'siegeShell': { // big heavy shell, downward
      c.beginPath(); c.moveTo(0, s * 1.05); c.lineTo(-s * 0.55, s * 0.25); c.lineTo(-s * 0.55, -s * 0.7); c.lineTo(s * 0.55, -s * 0.7); c.lineTo(s * 0.55, s * 0.25); c.closePath(); c.fill();
      c.strokeStyle = darken(S.bg, 0.5); c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(-s * 0.55, -s * 0.25); c.lineTo(s * 0.55, -s * 0.25); c.stroke();
      break; }
    case 'moltenSlam': { // fist slamming with splash
      c.beginPath(); c.arc(0, -s * 0.15, s * 0.5, 0, TAU); c.fill();
      c.lineWidth = r * 0.14;
      c.beginPath(); c.moveTo(-s, s * 0.75); c.lineTo(s, s * 0.75); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.8, s * 0.45); c.lineTo(-s * 0.55, s * 0.1); c.moveTo(s * 0.8, s * 0.45); c.lineTo(s * 0.55, s * 0.1); c.stroke();
      break; }
    case 'emberSpit': { // three flame drops
      for (let i = -1; i <= 1; i++) { const dx = i * s * 0.6, dy = Math.abs(i) * s * 0.25 - s * 0.05;
        c.beginPath(); c.moveTo(dx, dy - s * 0.55); c.quadraticCurveTo(dx + s * 0.35, dy, dx, dy + s * 0.4); c.quadraticCurveTo(dx - s * 0.35, dy, dx, dy - s * 0.55); c.fill(); }
      break; }
    case 'chainArc': { // lightning bolt
      c.beginPath(); c.moveTo(s * 0.25, -s); c.lineTo(-s * 0.45, s * 0.15); c.lineTo(-s * 0.02, s * 0.15); c.lineTo(-s * 0.25, s); c.lineTo(s * 0.5, -s * 0.1); c.lineTo(s * 0.05, -s * 0.1); c.closePath(); c.fill();
      break; }
    case 'staticField': { // bolt inside dashed circle
      c.lineWidth = r * 0.11; c.setLineDash([r * 0.18, r * 0.14]); c.beginPath(); c.arc(0, 0, s * 0.95, 0, TAU); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(s * 0.14, -s * 0.55); c.lineTo(-s * 0.25, s * 0.08); c.lineTo(0, s * 0.08); c.lineTo(-s * 0.14, s * 0.55); c.lineTo(s * 0.28, -s * 0.05); c.lineTo(s * 0.02, -s * 0.05); c.closePath(); c.fill();
      break; }
    case 'deflector': { // dome with bounce arrow
      c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, s * 0.5, s * 0.95, Math.PI, 0); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.6, -s * 0.55); c.lineTo(0, s * 0.05); c.lineTo(s * 0.6, -s * 0.55); c.stroke();
      c.beginPath(); c.moveTo(s * 0.6, -s * 0.55); c.lineTo(s * 0.25, -s * 0.6); c.moveTo(s * 0.6, -s * 0.55); c.lineTo(s * 0.62, -s * 0.2); c.stroke();
      break; }
    case 'anchorBolt': { // anchor
      c.lineWidth = r * 0.16;
      c.beginPath(); c.arc(0, -s * 0.65, s * 0.22, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, -s * 0.43); c.lineTo(0, s * 0.7); c.stroke();
      c.beginPath(); c.arc(0, s * 0.25, s * 0.6, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.35, -s * 0.1); c.lineTo(s * 0.35, -s * 0.1); c.stroke();
      break; }
    case 'updraft': { // triple up arrows
      for (let i = -1; i <= 1; i++) { const dx = i * s * 0.62, top = -s * 0.7 + Math.abs(i) * s * 0.3;
        c.lineWidth = r * 0.16;
        c.beginPath(); c.moveTo(dx, s * 0.7); c.lineTo(dx, top); c.stroke();
        c.beginPath(); c.moveTo(dx - s * 0.22, top + s * 0.28); c.lineTo(dx, top); c.lineTo(dx + s * 0.22, top + s * 0.28); c.stroke(); }
      break; }
    case 'galeShot': { // wind swirls
      c.lineWidth = r * 0.15;
      c.beginPath(); c.moveTo(-s, -s * 0.45); c.quadraticCurveTo(s * 0.5, -s * 0.75, s * 0.7, -s * 0.3); c.arc(s * 0.45, -s * 0.22, s * 0.26, -0.4, Math.PI * 1.2, true); c.stroke();
      c.beginPath(); c.moveTo(-s, s * 0.15); c.lineTo(s * 0.35, s * 0.15); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.7, s * 0.65); c.quadraticCurveTo(s * 0.2, s * 0.5, s * 0.45, s * 0.75); c.stroke();
      break; }
    case 'blinkStrike': { // two ghosts + dash
      c.globalAlpha = 0.45; c.beginPath(); c.arc(-s * 0.55, 0, s * 0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.beginPath(); c.arc(s * 0.45, 0, s * 0.45, 0, TAU); c.fill();
      c.lineWidth = r * 0.11; c.setLineDash([r * 0.14, r * 0.12]);
      c.beginPath(); c.moveTo(-s * 0.15, 0); c.lineTo(s * 0.05, 0); c.stroke(); c.setLineDash([]);
      break; }
    case 'toxicBomb': { // skull in cloud
      c.globalAlpha = 0.5; for (const [dx, dy, rr] of [[-0.55, 0.25, 0.42], [0.55, 0.25, 0.42], [0, -0.3, 0.55]]) { c.beginPath(); c.arc(dx * s, dy * s, rr * s, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      c.beginPath(); c.arc(0, -s * 0.05, s * 0.42, 0, TAU); c.fill();
      c.fillStyle = S.bg; c.beginPath(); c.arc(-s * 0.16, -s * 0.1, s * 0.11, 0, TAU); c.arc(s * 0.16, -s * 0.1, s * 0.11, 0, TAU); c.fill();
      c.fillStyle = S.fg; roundRectPath(c, -s * 0.2, s * 0.32, s * 0.4, s * 0.22, s * 0.06); c.fill();
      break; }
    case 'pinball': { // ball bouncing between angles
      c.lineWidth = r * 0.14;
      c.beginPath(); c.moveTo(-s, -s * 0.8); c.lineTo(-s, s * 0.9); c.lineTo(s, s * 0.9); c.lineTo(s, -s * 0.8); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.8, -s * 0.5); c.lineTo(0, s * 0.55); c.lineTo(s * 0.75, -s * 0.35); c.stroke();
      c.beginPath(); c.arc(s * 0.75, -s * 0.35, s * 0.26, 0, TAU); c.fill();
      break; }
    case 'splitShot': { // one shot splitting into four
      c.lineWidth = r * 0.13;
      c.beginPath(); c.moveTo(0, s * 0.9); c.lineTo(0, s * 0.05); c.stroke();
      for (const a of [-0.85, -0.32, 0.32, 0.85]) {
        const dx = Math.sin(a) * s, dy = -Math.cos(a) * s;
        c.beginPath(); c.moveTo(0, s * 0.05); c.lineTo(dx * 0.9, s * 0.05 + dy * 0.75); c.stroke();
        c.beginPath(); c.arc(dx * 0.95, s * 0.05 + dy * 0.85, r * 0.11, 0, TAU); c.fill(); }
      break; }
    case 'singularity': { // black hole spiral
      c.lineWidth = r * 0.13;
      for (let k = 0; k < 3; k++) { c.beginPath(); for (let i = 0; i <= 14; i++) { const a = k * (TAU / 3) + i * 0.16, rr = s * (1 - i / 15); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.stroke(); }
      c.beginPath(); c.arc(0, 0, s * 0.22, 0, TAU); c.fill();
      break; }
    case 'shockwave': { // radiating rings
      c.lineWidth = r * 0.14;
      c.beginPath(); c.arc(0, 0, s * 0.28, 0, TAU); c.fill();
      c.beginPath(); c.arc(0, 0, s * 0.62, 0, TAU); c.stroke();
      c.globalAlpha = 0.6; c.beginPath(); c.arc(0, 0, s * 0.98, 0, TAU); c.stroke(); c.globalAlpha = 1;
      break; }
    default: { c.font = `bold ${r}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 0); }
  }
  c.restore();
}

// Standalone canvas with an action icon (for HTML buttons/panels).
export function actionIconCanvas(kind, size = 44) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  drawActionIcon(c, kind, size / 2, size / 2, size * 0.4);
  return cv;
}

export const ACTION_ACCENT = (kind) => (ACTION_STYLE[kind] || { bg: '#ffffff' }).bg;

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lighten(h, f) { const [r, g, b] = hex2rgb(h); return `rgb(${r + (255 - r) * f},${g + (255 - g) * f},${b + (255 - b) * f})`; }
function darken(h, f) { const [r, g, b] = hex2rgb(h); return `rgb(${r * (1 - f)},${g * (1 - f)},${b * (1 - f)})`; }
