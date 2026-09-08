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

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lighten(h, f) { const [r, g, b] = hex2rgb(h); return `rgb(${r + (255 - r) * f},${g + (255 - g) * f},${b + (255 - b) * f})`; }
function darken(h, f) { const [r, g, b] = hex2rgb(h); return `rgb(${r * (1 - f)},${g * (1 - f)},${b * (1 - f)})`; }
