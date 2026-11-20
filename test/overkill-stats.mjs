// Overkill in the results-table stats (invariant + report; no bug filed, 2026-11-21 nightly: 5.4% of booked damage). applyDamage() adds the full post-modifier hit to target.stats.taken
// and attacker.stats.dealt even when the target had less HP left, so a 60-damage hit on a 5 HP bot books 60 Taken
// and 60 Dealt. Spec 01/08: the results screen shows per player "dealt, taken"; a bot's Taken can then exceed every
// HP it ever had (max HP + healing), and balance.mjs "Avg dmg" counts damage that never came off an HP bar.
// Report probe: wraps World.applyDamage from the test side (src untouched) and sweeps 8-bot FFA headless games.
// Usage: node test/overkill-stats.mjs [seeds=1]   (exit 1 when any bot's Taken exceeds its max HP + healing)
import { Match } from '../src/core/match.js';
import { World } from '../src/core/sim.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

let hits = 0, killing = 0, total = 0, over = 0;
const orig = World.prototype.applyDamage;
World.prototype.applyDamage = function (target, amount, src) {
  const before = target.alive ? target.hp : 0;
  const dmg = orig.call(this, target, amount, src);
  if (dmg > 0) { hits++; total += dmg; if (dmg > before) { killing++; over += dmg - before; } }
  return dmg;
};

const seeds = Number(process.argv[2] || 1);
const maps = MAP_IDS.filter((id) => MAPS[id].size !== 'small');
let games = 0, overTaken = 0; const ex = [];
for (let s = 0; s < seeds; s++) for (const [mi, map] of maps.entries()) {
  const seed = 4800 + s * 97 + mi;
  const players = BOT_IDS.map((id, i) => ({ name: 'P' + i, botId: id, team: i }));
  const r = Match.simulateHeadless(players, { mode: 'ffa', map, aiDifficulty: 'hard', powerups: 'normal' }, seed);
  games++;
  for (const b of r.bots) {
    // Upper bound on HP a bot could ever lose: max HP plus every heal it could have had (generous: +60).
    const maxHp = { bulwark: 140, magmaw: 140, volt: 130, warden: 130, skyla: 130, phantom: 120, ricochet: 120, gravitas: 130 }[b.botId];
    if (b.stats.taken > maxHp + 60) { overTaken++; if (ex.length < 6) ex.push(`${map} seed ${seed}: ${b.botId} Taken ${b.stats.taken} (max HP ${maxHp})`); }
  }
}
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
console.log(`${games} eight-bot FFA games: ${hits} damaging hits, ${killing} lethal; ${total} damage booked, ${over} of it overkill (${pct(over, total)}%)`);
console.log(`bots whose Taken exceeds max HP + 60: ${overTaken}`);
if (ex.length) console.log(ex.join('\n'));
const ok = overTaken === 0;
console.log(ok ? 'ok   no Taken above the HP a bot could lose' : 'FAIL Taken books overkill beyond the HP a bot could lose');
process.exit(ok ? 0 : 1);
