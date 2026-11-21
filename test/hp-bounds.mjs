// HP-bounds invariant (added by the 2026-11-22 nightly QA run). After every turn of 8-bot FFA headless games:
//   - a living bot has 0 < hp <= maxHp + 20 (Rally Beacon's overheal cap, src/core/sim.js applyPowerup)
//   - a dead bot is not left with hp > 0
//   - hp is a finite number
// Wraps World.prototype.endTurn from the test side (src untouched).
// Usage: node test/hp-bounds.mjs [seeds=1]   (exit 1 on any violation)
import { Match } from '../src/core/match.js';
import { World } from '../src/core/sim.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const bad = []; let checks = 0; let ctx = '';
const orig = World.prototype.endTurn;
World.prototype.endTurn = function (...a) {
  const r = orig.apply(this, a);
  for (const b of this.bots) {
    checks++;
    const why = !Number.isFinite(b.hp) ? 'non-finite hp'
      : b.alive && b.hp <= 0 ? 'alive with hp <= 0'
      : b.alive && b.hp > b.maxHp + 20 ? `hp ${b.hp} above maxHp ${b.maxHp} + 20`
      : !b.alive && b.hp > 0 ? `dead with hp ${b.hp}` : null;
    if (why && bad.length < 10) bad.push(`${ctx} turn ${this.turn}: ${b.botId || b.def.id} ${why}`);
  }
  return r;
};

const seeds = Number(process.argv[2] || 1);
let games = 0;
for (let s = 0; s < seeds; s++) for (const [mi, map] of MAP_IDS.filter((id) => MAPS[id].size !== 'small').entries()) {
  const seed = 6100 + s * 89 + mi; ctx = `${map} seed ${seed}`;
  const players = BOT_IDS.map((id, i) => ({ name: 'P' + i, botId: id, team: i }));
  Match.simulateHeadless(players, { mode: 'ffa', map, aiDifficulty: 'hard', powerups: 'high' }, seed);
  games++;
}
console.log(`${games} eight-bot FFA games, ${checks} bot-turn checks`);
if (bad.length) console.log(bad.join('\n'));
console.log(bad.length ? 'FAIL hp left its bounds' : 'ok   hp stays within (0, maxHp + 20] for living bots and is 0 for dead ones');
process.exit(bad.length ? 1 : 0);
