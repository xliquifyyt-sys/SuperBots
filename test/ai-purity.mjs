// AI planning must be side-effect free on the shared World (QA-1). Only the server plans AI;
// clients replay the server's actions. So any world.rng draw or world write inside
// AIPlanner.plan() is an online desync. This runs full server-style matches on every map with
// every bot as AI and checks, around every single plan() call, that world.rng was not advanced
// and that the world's serialisable state is byte-identical before and after.
// Usage: node test/ai-purity.mjs [seedsPerMap=1]
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const seeds = Number(process.argv[2] || 1);
const t0 = Date.now();
const SKIP = new Set(['map', 'settings', 'physTerrain', 'slopeTris', 'rng']);

function snapshot(w) {
  const seen = new WeakSet();
  const out = {};
  for (const k of Object.keys(w).sort()) {
    if (SKIP.has(k) || typeof w[k] === 'function') continue;
    out[k] = w[k];
  }
  return JSON.stringify(out, (key, v) => {
    if (key === 'def') return v && v.id; // static bot definition
    if (v && typeof v === 'object') { if (seen.has(v)) return '[ref]'; seen.add(v); }
    return v;
  });
}

let plans = 0, fails = 0;
for (const map of MAP_IDS) {
  const n = Math.min(8, MAPS[map].maxPlayers);
  for (let s = 0; s < seeds; s++) {
    const seed = 47000 + MAP_IDS.indexOf(map) * 100 + s;
    const players = Array.from({ length: n }, (_, i) => ({ name: 'A' + i, botId: BOT_IDS[(i + s * 3 + MAP_IDS.indexOf(map)) % BOT_IDS.length], team: i, isAI: true }));
    const settings = { map, mode: 'ffa', turnCap: 20, onTurnCap: 'hp', hazards: true, powerups: 'high', airStrikes: 'normal', planTimer: 10 };
    const M = new Match(players, settings, seed);
    const w = M.world;
    const realPlan = M.ai.plan.bind(M.ai);
    let draws = 0;
    const realNext = w.rng.next.bind(w.rng);
    w.rng.next = () => { draws++; return realNext(); };
    M.ai.plan = (b) => {
      const before = snapshot(w), s0 = w.rng.s, d0 = draws;
      const a = realPlan(b);
      plans++;
      const after = snapshot(w);
      if (draws !== d0 || w.rng.s !== s0 || before !== after) {
        fails++;
        if (fails <= 10) {
          let i = 0; while (i < before.length && before[i] === after[i]) i++;
          console.log(`IMPURE ${map} seed ${seed} turn ${w.turn} bot ${b.id} (${b.botId}): world.rng draws ${draws - d0}` + (before !== after ? `, state differs near: ${before.slice(Math.max(0, i - 60), i + 60)}` : ''));
        }
      }
      return a;
    };
    M.start();
    for (let turn = 1; turn <= 20 && M.phase !== 'over'; turn++) {
      M.beginPlan(); M.beginResolve(); w.runToEnd();
      M.beginCleanup(); M.beginAnnounce();
    }
  }
}
console.log(`${plans} AI plans checked in ${Date.now() - t0}ms, ${fails} with world side effects`);
process.exit(fails || !plans ? 1 : 0);
