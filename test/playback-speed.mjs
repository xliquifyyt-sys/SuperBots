// Invariant: the playback controls (1x / 2x / 4x speed, SKIP, uneven frame times) only change how
// fast a turn is shown, never what happens. Drives Match.update(dt) the way the client loop does
// (dt clamped to 0.05 s like src/main.js) for all-AI matches and compares every variant's result
// and world digest per turn against plain 1x playback at 60 fps.
// Usage: node test/playback-speed.mjs [matches]
import { Match, worldDigest } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const N = Number(process.argv[2] || 6);
const VARIANTS = {
  'x1@60fps': { speed: 1, dts: [1 / 60] },
  'x2@60fps': { speed: 2, dts: [1 / 60] },
  'x4@60fps': { speed: 4, dts: [1 / 60] },
  'x4@20fps': { speed: 4, dts: [0.05] },
  'x1-jitter': { speed: 1, dts: [1 / 60, 0.05, 1 / 144, 0.033, 0.0001, 0.05] },
  'skip': { speed: 1, dts: [1 / 60], skip: true },
};

function play(i, v) {
  const n = 2 + (i % 5);
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 3 + k * 5) % BOT_IDS.length], team: k % 2, isAI: true }));
  const settings = { mode: 'ffa', map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: ['easy', 'normal', 'hard'][i % 3], powerups: 'high', airStrikes: 'normal' };
  const m = new Match(players, settings, 4242 + i * 17);
  m.playbackSpeed = v.speed;
  m.start();
  const digests = [];
  let lastTurn = -1, frame = 0, guard = 0;
  while (m.phase !== 'over' && guard++ < 2e6) {
    if (m.phase === 'resolve' && v.skip) m.skipRequested = true;
    m.update(v.dts[frame++ % v.dts.length]);
    if (m.phase === 'cleanup' && m.turn !== lastTurn) { lastTurn = m.turn; digests.push(worldDigest(m.world)); }
  }
  return { over: m.phase === 'over', winner: JSON.stringify(m.winner), turns: m.turn, digests };
}

let fail = 0;
for (let i = 0; i < N; i++) {
  const base = play(i, VARIANTS['x1@60fps']);
  if (!base.over) { console.log(`FAIL match ${i}: 1x playback never reached 'over'`); fail++; continue; }
  for (const [name, v] of Object.entries(VARIANTS)) {
    if (name === 'x1@60fps') continue;
    const r = play(i, v);
    const t = r.digests.findIndex((d, k) => d !== base.digests[k]);
    const same = r.over && r.winner === base.winner && r.turns === base.turns && t < 0 && r.digests.length === base.digests.length;
    if (!same) { fail++; console.log(`FAIL match ${i} ${name}: winner ${r.winner} vs ${base.winner}, turns ${r.turns} vs ${base.turns}, first differing turn digest #${t}`); }
  }
  console.log(`ok   match ${i} (${base.turns} turns, winner ${base.winner}) identical under ${Object.keys(VARIANTS).length - 1} playback variants`);
}
console.log(fail ? `FAIL ${fail} variant(s) changed the outcome` : `PASS playback speed/skip/frame timing never change the match (${N} matches)`);
process.exit(fail ? 1 : 0);
