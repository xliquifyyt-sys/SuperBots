// Terrain-embed check against the geometry the sim actually collides with (M0-05).
//
// test/bughunt.mjs flags a bot as embedded when its 0.5 circle overlaps any rect in
// map.terrain. map.terrain also holds the stair-step helper rects that maps.js builds
// from each slope (rc.step); the sim never collides with those (World.physTerrain drops
// them) and instead collides with the real slope triangle. The last step column of a
// ramp is up to 0.5 units taller than the triangle at its foot, so a bot standing on
// flat ground just past a ramp foot "overlaps" the step rect while being clear of the
// ramp. This test:
//   1. Re-runs the bughunt match set (same seeds/settings as test/bughunt.mjs) and, at
//      every cleanup, measures every live bot's real hull against physTerrain rects and
//      slope triangles with the sim's own collision rules. A real sink fails here.
//   2. Reports every step-rect overlap bughunt would have counted, with the real
//      clearance, so a step-rect hit that hides a real sink is still caught.
//   3. Pins the M0-05 repro: glacierfort seed 9306, Ricochet at ~36.16,16.38.
// Usage: node test/terrain-embed.mjs [runs=5]
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';
import { BOT_HULLS } from '../src/core/hulls.js';

const runs = Number(process.argv[2] || 5);
const SINK_TOL = 0.25;  // same tolerance bughunt uses for the circle check

const FALLBACK_HULL = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
const hull = (b) => { const f = (b.facing || 1) < 0 ? -1 : 1; return (BOT_HULLS[b.def.id] || FALLBACK_HULL).map(([x, y]) => [b.x + x * f, b.y + y]); };
const rectPoly = (rc) => [[rc.x, rc.y], [rc.x + rc.w, rc.y], [rc.x + rc.w, rc.y + rc.h], [rc.x, rc.y + rc.h]];

// SAT overlap depth between convex polygons (0 when separated).
function satDepth(A, B) {
  let best = Infinity;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      const ex = x2 - x1, ey = y2 - y1, len = Math.hypot(ex, ey); if (len < 1e-9) continue;
      const ax = -ey / len, ay = ex / len;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [px, py] of A) { const d = px * ax + py * ay; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const [px, py] of B) { const d = px * ax + py * ay; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const o = Math.min(a1 - b0, b1 - a0);
      if (o <= 0) return 0;
      best = Math.min(best, o);
    }
  }
  return best;
}
// Slope triangle, same winding as sim.js slopeTri.
const slopePoly = (s) => s.dir === 1
  ? [[s.x, s.y + s.h], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h]]
  : [[s.x, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
// Depth behind the sloped face only, as sim.js slopePush (ramps sit on ground, so the
// bottom and back edges are not faces).
function slopeDepth(P, s) {
  const T = slopePoly(s); const [ax, ay] = T[0], [bx, by] = T[1];
  const ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey) || 1;
  const nx = ey / len, ny = -ex / len;
  let d = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of P) { d = Math.max(d, (ax - px) * nx + (ay - py) * ny); minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
  if (maxX <= s.x || minX >= s.x + s.w || maxY <= s.y || minY >= s.y + s.h) return 0;
  return d;
}
function circleRectDepth(cx, cy, r, rc) {
  const px = Math.max(rc.x, Math.min(cx, rc.x + rc.w)), py = Math.max(rc.y, Math.min(cy, rc.y + rc.h));
  const d = Math.hypot(cx - px, cy - py);
  if (cx > rc.x && cx < rc.x + rc.w && cy > rc.y && cy < rc.y + rc.h) return r + 1;
  return d < r ? r - d : 0;
}
// Real embed depth of bot b: max over physics rects and slope faces.
function realDepth(w, b) {
  const P = hull(b); let d = 0, what = null;
  for (const rc of w.map.terrain) { if (rc.step) continue; const k = satDepth(P, rectPoly(rc)); if (k > d) { d = k; what = rc; } }
  for (const s of w.map.slopes || []) { const k = slopeDepth(P, s); if (k > d) { d = k; what = { slope: s }; } }
  return { d, what };
}

const sinks = [], stepHits = [];
let pinned = null;
for (let run = 0; run < runs; run++) {
  for (const mapId of MAP_IDS) {
    const players = Array.from({ length: 8 }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(k + run) % BOT_IDS.length], team: k % 2, isAI: true }));
    const mode = run % 2 ? 'teams' : 'ffa';
    const seed = 9000 + run * 100 + MAP_IDS.indexOf(mapId);
    const m = new Match(players, { mode, map: mapId, aiDifficulty: ['easy', 'normal', 'hard'][run % 3], powerups: 'high', airStrikes: 'normal' }, seed);
    m.start();
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 400) {
      if (m.phase === 'announce') m.beginPlan();
      else if (m.phase === 'plan') m.beginResolve();
      else if (m.phase === 'resolve') { m.world.runToEnd(); m.beginCleanup(); }
      else if (m.phase === 'cleanup') {
        const w = m.world;
        for (const b of w.bots) {
          if (!b.alive) continue;
          const real = realDepth(w, b);
          // Hull SAT depth is not the same metric as bughunt's circle depth; bots rest with
          // contact slop, so only a clear penetration counts as a sink.
          if (real.d > SINK_TOL) sinks.push(`${w.map.id} seed ${seed} T${m.turn} ${b.botId} @${b.x.toFixed(2)},${b.y.toFixed(2)} hull depth ${real.d.toFixed(2)} in ${JSON.stringify(real.what)}`);
          for (const rc of w.map.terrain) {
            if (!rc.step) continue;
            const cd = circleRectDepth(b.x, b.y, 0.5, rc);
            if (cd <= 0.25) continue;
            stepHits.push({ map: w.map.id, seed, turn: m.turn, bot: b.botId, x: b.x, y: b.y, cd, real: real.d, rc });
            if (seed === 9306 && b.botId === 'ricochet' && !pinned) pinned = { turn: m.turn, x: b.x, y: b.y, cd, real: real.d, rc, grounded: b.grounded };
          }
        }
        m.beginAnnounce();
      }
    }
  }
}

console.log(`${runs} runs x ${MAP_IDS.length} maps checked against physics geometry (physTerrain + slope faces, real hulls)`);
console.log(`step-rect overlaps bughunt's circle check sees: ${stepHits.length}`);
for (const h of stepHits.slice(0, 12)) console.log(`  ${h.map} seed ${h.seed} T${h.turn} ${h.bot} @${h.x.toFixed(2)},${h.y.toFixed(2)} step-circle depth ${h.cd.toFixed(2)} real hull depth ${h.real.toFixed(3)} rect ${JSON.stringify(h.rc)}`);
if (pinned) console.log(`M0-05 repro: glacierfort seed 9306 T${pinned.turn} ricochet @${pinned.x.toFixed(2)},${pinned.y.toFixed(2)} grounded=${pinned.grounded} step-circle depth ${pinned.cd.toFixed(2)}, real hull depth ${pinned.real.toFixed(3)}`);
let fail = false;
if (sinks.length) { fail = true; console.log(`FAIL: ${sinks.length} real sinks into physics terrain, e.g.`); for (const s of sinks.slice(0, 8)) console.log('  ' + s); }
for (const h of stepHits) if (h.real > SINK_TOL) { fail = true; console.log(`FAIL: step-rect hit is also a real sink: ${h.map} seed ${h.seed} T${h.turn} ${h.bot}`); }
if (runs >= 4 && !pinned) console.log('note: the M0-05 repro hit (seed 9306 ricochet on a step rect) no longer occurs');
console.log(fail ? 'TERRAIN EMBED FAIL' : 'TERRAIN EMBED OK');
process.exit(fail ? 1 : 0);
