// 1v1 round-robin balance report: every bot pair on every standard map, several seeds.
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const seeds = Number(process.argv[2] || 3);
const maps = MAP_IDS.filter((id) => MAPS[id].size === 'standard');
const wins = {}, games = {}, dmg = {}, turnsSum = [];
for (const id of BOT_IDS) { wins[id] = 0; games[id] = 0; dmg[id] = 0; }
const pairWins = {};
const t0 = Date.now();
for (let s = 0; s < seeds; s++) for (const a of BOT_IDS) for (const b of BOT_IDS) {
  if (a === b) continue;
  const map = maps[(s + BOT_IDS.indexOf(a) + BOT_IDS.indexOf(b)) % maps.length];
  const r = Match.simulateHeadless([{ name: 'A', botId: a, team: 0 }, { name: 'B', botId: b, team: 1 }], { mode: 'ffa', map, aiDifficulty: 'hard', powerups: 'normal' }, 9000 + s * 100 + BOT_IDS.indexOf(a) * 8 + BOT_IDS.indexOf(b));
  games[a]++; games[b]++; turnsSum.push(r.turns);
  dmg[a] += r.bots[0].stats.dealt; dmg[b] += r.bots[1].stats.dealt;
  if (r.winner && r.winner.type === 'player') { const w = r.bots[r.winner.ids[0]].botId; wins[w]++; pairWins[`${a}>${b}`] = (pairWins[`${a}>${b}`] || 0) + (w === a ? 1 : 0); }
}
console.log(`${turnsSum.length} duels in ${Date.now() - t0}ms, avg turns ${(turnsSum.reduce((x, y) => x + y, 0) / turnsSum.length).toFixed(1)}`);
for (const id of BOT_IDS) console.log(id.padEnd(10), 'winrate', (wins[id] / games[id] * 100).toFixed(0).padStart(3) + '%', ' avg dmg/game', (dmg[id] / games[id]).toFixed(0));
