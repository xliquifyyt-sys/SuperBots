// Aim-guide fidelity (spec 02: "Jump preview in the UI runs exactly this motion including drag, substeps,
// wind and the landing rule, so the dotted guide ends where the bot will land"). For every map and bot,
// a lone shooter (the foe parked far away) plans a seeded spread of jumps and missiles; the preview's
// landing / impact point is compared with where the real resolve puts the bot / the first explosion.
// Only cases the guide is meant to model are counted: the foe never comes near, nothing else moves.
// Usage: node test/preview-fidelity.mjs [casesPerBotMap=6] [--hazards]   (report; exit 1 on any miss > TOL)
import { Match } from '../src/core/match.js';
import { MAP_IDS } from '../src/core/maps.js';
import { BOT_IDS } from '../src/core/defs.js';
import { RNG } from '../src/core/rng.js';

const N = Number(process.argv[2]) || 6;
const hazards = process.argv.includes('--hazards');
const TOL = 0.6;   // units: the landing marker is ~0.5 wide; anything further is a visibly wrong guide
const rng = new RNG(424242);
const stats = { jump: { n: 0, miss: 0, fate: 0, worst: [] }, missile: { n: 0, miss: 0, fate: 0, worst: [] } };

for (const map of MAP_IDS) for (const bot of BOT_IDS) for (let k = 0; k < N; k++) {
  for (const type of ['jump', 'missile']) {
    const seed = 1000 + Math.floor(rng.next() * 1e6);
    const players = [{ name: 'A', botId: bot, team: 0, isAI: true }, { name: 'B', botId: bot === 'bulwark' ? 'warden' : 'bulwark', team: 1, isAI: true }];
    let m;
    try { m = new Match(players, { map, hazards, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 }, seed); } catch { continue; }
    m.start();
    const w = m.world, b = w.bots[0], foe = w.bots[1];
    if (!b.alive || !b.grounded) continue;
    const ang = (-170 + rng.next() * 160) * Math.PI / 180;
    const aim = { dx: Math.cos(ang), dy: Math.sin(ang), power: 0.25 + rng.next() * 0.75 };
    const from = [+b.x.toFixed(2), +b.y.toFixed(2)];
    const pv = w.previewAction(b, type, aim);
    if (!pv.impact) continue;
    if (pv.impact.bot != null) continue;                         // guide says it hits the foe: not a terrain case
    w.submit(b.id, { type, aim }); w.submit(foe.id, { type: 'skip' });
    w.resolve();
    let real = null, foeMoved = false;
    const f0 = [foe.x, foe.y];
    while (!w.step(1 / 60)) {
      if (type === 'missile' && !real) { const e = w.events.find((ev) => ev.type === 'explosion'); if (e) real = { x: e.x, y: e.y }; }
    }
    if (type === 'missile' && !real) { const e = w.events.find((ev) => ev.type === 'explosion'); if (e) real = { x: e.x, y: e.y }; }
    foeMoved = Math.hypot(foe.x - f0[0], foe.y - f0[1]) > 0.3;
    if (foeMoved) continue;                                      // foe got involved; out of scope
    if (type === 'jump') {
      if (pv.impact.type === 'floor') { real = b.alive ? { x: b.x, y: b.y } : { x: pv.impact.x, y: pv.impact.y, died: true }; if (!b.alive) { stats.jump.n++; continue; } }
      else real = { x: b.x, y: b.y, alive: b.alive };
    }
    if (!real) continue;
    const S = stats[type]; S.n++;
    let ddx = Math.abs(real.x - pv.impact.x); if (w.map.teleporters) ddx = Math.min(ddx, w.map.width - ddx);   // looped edges: the seam is one place
    const d = Math.hypot(ddx, real.y - pv.impact.y);
    const wrongFate = type === 'jump' && ((pv.impact.type === 'floor') !== !b.alive);
    if (d > TOL || wrongFate) {
      S.miss++; if (wrongFate) S.fate++;
      S.worst.push({ d: +d.toFixed(2), map, bot, seed, from, aim: { dx: +aim.dx.toFixed(3), dy: +aim.dy.toFixed(3), power: +aim.power.toFixed(3) }, preview: [+pv.impact.x.toFixed(2), +pv.impact.y.toFixed(2), pv.impact.type], real: [+real.x.toFixed(2), +real.y.toFixed(2), b.alive ? 'alive' : 'dead'] });
    }
  }
}
let bad = 0;
for (const [type, S] of Object.entries(stats)) {
  S.worst.sort((a, b) => b.d - a.d);
  console.log(`${type}: ${S.miss}/${S.n} previews off by more than ${TOL} units (or wrong fate)${hazards ? ' [hazards on]' : ''}; ${S.fate} of them show a safe landing for a bot that dies, or a death for one that lands`);
  const byMap = {}; for (const w of S.worst) byMap[w.map] = (byMap[w.map] || 0) + 1;
  if (S.miss) console.log('  by map:', JSON.stringify(byMap));
  for (const w of S.worst.slice(0, 6)) console.log('  ', JSON.stringify(w));
  bad += S.miss;
}
process.exit(bad ? 1 : 0);
