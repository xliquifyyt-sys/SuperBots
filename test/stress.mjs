// Randomised settings stress test: many matches with random host settings, sizes and modes.
import { Match } from '../src/core/match.js';
import { BOT_IDS, SETTING_OPTIONS, POWERUP_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';
import { RNG } from '../src/core/rng.js';

const N = Number(process.argv[2] || 200);
const rng = new RNG(424242);
let errors = 0, noWinner = 0, totalTurns = 0, sd = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const n = 2 + rng.int(7);
  const mode = rng.next() < 0.4 && n >= 4 ? 'teams' : 'ffa';
  const teamCount = mode === 'teams' ? 2 + rng.int(Math.min(3, Math.floor(n / 2) - 1) + 1) : n;
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: rng.pick(BOT_IDS), team: k % teamCount, isAI: true }));
  const settings = {
    mode, map: rng.next() < 0.3 ? 'random' : rng.pick(MAP_IDS),
    planTimer: rng.pick(SETTING_OPTIONS.planTimer), turnCap: rng.pick(SETTING_OPTIONS.turnCap), onTurnCap: rng.pick(SETTING_OPTIONS.onTurnCap),
    powerups: rng.pick(SETTING_OPTIONS.powerups), airStrikes: rng.pick(SETTING_OPTIONS.airStrikes), hazards: rng.next() < 0.8,
    startingHp: rng.pick(SETTING_OPTIONS.startingHp), damage: rng.pick(SETTING_OPTIONS.damage), cooldowns: rng.pick(SETTING_OPTIONS.cooldowns),
    restriction: rng.pick(SETTING_OPTIONS.restriction), friendlyFire: rng.next() < 0.3, aiDifficulty: rng.pick(['easy', 'normal', 'hard']),
    powerupPool: Object.fromEntries(POWERUP_IDS.map((id) => [id, rng.next() < 0.85])),
  };
  try {
    const r = Match.simulateHeadless(players, settings, 70000 + i);
    totalTurns += r.turns;
    if (!r.winner) { noWinner++; console.log('NO WINNER', i, JSON.stringify({ n, mode, map: r.map, turnCap: settings.turnCap, diff: settings.aiDifficulty })); }
    if (r.log.some((l) => l.events.some((e) => e.type === 'suddenDeath'))) sd++;
  } catch (e) { errors++; console.log('ERROR', i, JSON.stringify({ n, mode, settings }), e.stack.split('\n').slice(0, 3).join(' | ')); }
}
console.log(`${N} matches in ${Date.now() - t0}ms: errors=${errors} noWinner=${noWinner} suddenDeath=${sd} avgTurns=${(totalTurns / N).toFixed(1)}`);
if (errors || noWinner) process.exit(1);
