// Hull-accurate terrain-embed check (M0-12). Runs the same 8-bot matches as
// test/bughunt.mjs (same seeds and settings) and, at every cleanup, measures how far
// each live bot's real collision hull (the convex sprite outline the sim uses) sits
// inside physics terrain: the world's physTerrain rects and the sloped face of every
// ramp. Stair-step rects (rc.step) are skipped because the sim never collides with them.
// A bot more than 0.25 inside anything is a failure.
//   node test/terrain-embed.mjs [runs=3]
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';
import { polyPush, slopePush } from '../src/core/sim.js';

const runs = Number(process.argv[2] || 3);
const LIMIT = 0.25;
const rectPoly = (rc) => [[rc.x, rc.y], [rc.x + rc.w, rc.y], [rc.x + rc.w, rc.y + rc.h], [rc.x, rc.y + rc.h]];

// Deepest penetration of a bot's hull into any physics solid of world w.
function deepest(w, b) {
  const poly = w.botPoly(b);
  let best = { depth: 0, what: '' };
  for (const rc of w.physTerrain) {
    const h = polyPush(poly, rectPoly(rc));
    if (h && h.depth > best.depth) best = { depth: h.depth, what: `R(${rc.x},${rc.y},${rc.w},${rc.h})` };
  }
  for (const tri of w.slopeTris) {
    const h = slopePush(poly, tri);
    if (h && h.depth > best.depth) best = { depth: h.depth, what: `ramp(${tri.slope.x},${tri.slope.y},${tri.slope.w},${tri.slope.h})` };
  }
  return best;
}

const hits = [];
let matches = 0, checks = 0;
const t0 = Date.now();
for (let run = 0; run < runs; run++) {
  for (const mapId of MAP_IDS) {
    const players = Array.from({ length: 8 }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(k + run) % BOT_IDS.length], team: k % 2, isAI: true }));
    const mode = run % 2 ? 'teams' : 'ffa';
    const ai = ['easy', 'normal', 'hard'][run % 3];
    const seed = 9000 + run * 100 + MAP_IDS.indexOf(mapId);
    const m = new Match(players, { mode, map: mapId, aiDifficulty: ai, powerups: 'high', airStrikes: 'normal' }, seed);
    m.start();
    matches++;
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 400) {
      if (m.phase === 'announce') m.beginPlan();
      else if (m.phase === 'plan') m.beginResolve();
      else if (m.phase === 'resolve') { m.world.runToEnd(); m.beginCleanup(); }
      else if (m.phase === 'cleanup') {
        const w = m.world;
        for (const b of w.bots) {
          if (!b.alive) continue;
          checks++;
          const d = deepest(w, b);
          if (d.depth > LIMIT) hits.push(`run ${run} seed ${seed} ${mode}/${ai} ${w.map.id} T${m.turn} ${b.botId} @${b.x.toFixed(3)},${b.y.toFixed(3)} ${d.depth.toFixed(3)} into ${d.what}`);
        }
        m.beginAnnounce();
      }
    }
  }
}
console.log(`${matches} eight-bot matches, ${checks} bot cleanups checked, ${Date.now() - t0}ms`);
for (const h of hits) console.log('EMBEDDED', h);
console.log(hits.length ? `${hits.length} bot(s) embedded more than ${LIMIT} in terrain` : 'NO BOT EMBEDDED IN TERRAIN');
process.exit(hits.length ? 1 : 0);
