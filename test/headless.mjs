// Runs many AI-vs-AI matches through the core sim and reports results/balance.
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const N = Number(process.argv[2] || 30);
const wins = {}, picks = {}, dmg = {}, turnsList = [], mapWins = {};
let draws = 0, sd = 0, errors = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const n = 2 + (i % 7);
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 3 + k * 5) % BOT_IDS.length], team: k % 2, isAI: true }));
  const mode = i % 3 === 0 && n % 2 === 0 ? 'teams' : 'ffa';
  const settings = { mode, map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: ['easy', 'normal', 'hard'][i % 3], powerups: 'normal' };
  try {
    const r = Match.simulateHeadless(players, settings, 1000 + i);
    turnsList.push(r.turns);
    if (!r.winner) { console.log('NO WINNER', i); errors++; continue; }
    if (r.winner.type === 'draw') draws++;
    if (r.log.some((l) => l.events.some((e) => e.type === 'suddenDeath'))) sd++;
    for (const b of r.bots) { picks[b.botId] = (picks[b.botId] || 0) + 1; dmg[b.botId] = (dmg[b.botId] || 0) + b.stats.dealt; }
    for (const id of r.winner.ids) { const b = r.bots[id]; wins[b.botId] = (wins[b.botId] || 0) + 1; }
    if (i < 6) console.log(`match ${i}: ${n}p ${mode} ${r.map} -> ${r.winner.type} ${r.winner.ids.map((id) => r.bots[id].botId).join(',')} in ${r.turns} turns`);
  } catch (e) { errors++; console.log('ERROR match', i, e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.log(`\n${N} matches in ${Date.now() - t0}ms, errors=${errors}, draws=${draws}, suddenDeath=${sd}`);
console.log('turns: avg', (turnsList.reduce((a, b) => a + b, 0) / turnsList.length).toFixed(1), 'min', Math.min(...turnsList), 'max', Math.max(...turnsList));
for (const id of BOT_IDS) console.log(id.padEnd(10), 'picks', String(picks[id] || 0).padStart(3), 'wins', String(wins[id] || 0).padStart(3), 'winrate', ((wins[id] || 0) / (picks[id] || 1) * 100).toFixed(0).padStart(3) + '%', 'avg dmg', ((dmg[id] || 0) / (picks[id] || 1)).toFixed(0));
if (errors) process.exit(1);
