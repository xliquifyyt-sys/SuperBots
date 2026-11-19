// KO credit when the attacker is already dead (QA-47). Spec 01: "On elimination by damage (not a fall) the bot
// self-destructs ... The killer gets a kill credited". World.kill() only credits `killer` if `killer.alive`, so a
// self-destruct blast (the source is the bot that just died) or a shot still in flight after its owner died KOs
// the victim, the `eliminated` event names the dead bot in `by` (feed / callouts say it), but the dead bot's
// stats.kills / killsTurn never move — the results table and the feed disagree.
// Usage: node test/dead-killer-credit.mjs [seeds=2]   (exit 1 on any mismatch; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'ok  ' : 'FAIL', msg); };

// 1. Direct: A (5 HP) is killed by B; A's self-destruct (30) finishes B (20 HP), who stands next to it.
{
  const players = [{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true }];
  const m = new Match(players, { map: 'emberpit', mode: 'ffa', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 }, 11);
  m.start();
  const w = m.world, [a, b] = w.bots;
  b.x = a.x + 0.9; b.y = a.y; a.hp = 5; b.hp = 20;
  w.events.length = 0;
  w.applyDamage(a, 10, { type: 'blast', bot: b, label: 'Missile' });
  const elimB = w.events.find((e) => e.type === 'eliminated' && e.bot === b.id);
  check(!a.alive && !!elimB, `A killed by B, B caught in A's self-destruct (B alive=${b.alive}, hp ${b.hp})`);
  check(b.stats.kills === 1, `B credited with KO of A (kills=${b.stats.kills})`);
  if (elimB) check(elimB.by === a.id ? a.stats.kills === 1 : true,
    `eliminated event for B says by=${elimB.by} (A=${a.id}); A.stats.kills=${a.stats.kills} (must match the event)`);
}

// 2. Sweep: 8-bot FFA headless matches. Every 'eliminated' event that names a killer must be reflected in that
// killer's final stats.kills.
const seeds = Number(process.argv[2] || 2);
const maps = MAP_IDS.filter((id) => MAPS[id].size !== 'small');
let games = 0, named = 0, uncounted = 0, deadKiller = 0;
const examples = [];
for (let s = 0; s < seeds; s++) for (const [mi, map] of maps.entries()) {
  const seed = 7100 + s * 97 + mi;
  const players = BOT_IDS.map((id, i) => ({ name: 'P' + i, botId: id, team: i }));
  const r = Match.simulateHeadless(players, { mode: 'ffa', map, aiDifficulty: 'hard', powerups: 'normal' }, seed);
  games++;
  const byCount = new Map();
  for (const t of r.log) {
    const diedBefore = new Set();
    for (const e of t.events) {
      if (e.type !== 'eliminated') continue;
      if (e.by != null && e.by !== e.bot) {
        named++; byCount.set(e.by, (byCount.get(e.by) || 0) + 1);
        if (diedBefore.has(e.by) || (r.bots[e.by].diedTurn >= 0 && r.bots[e.by].diedTurn < t.turn)) {
          deadKiller++;
          if (examples.length < 6) examples.push(`${map} seed ${seed} T${t.turn}: ${r.bots[e.bot].botId} KO'd by already-dead ${r.bots[e.by].botId} (${e.cause})`);
        }
      }
      diedBefore.add(e.bot);
    }
  }
  for (const [id, n] of byCount) if ((r.bots[id].stats.kills || 0) < n) uncounted += n - r.bots[id].stats.kills;
}
console.log(`${games} eight-bot FFA games: ${named} eliminations name a killer; ${deadKiller} name a killer that was already dead; ${uncounted} missing from the killer's stats.kills`);
if (examples.length) console.log(examples.join('\n'));
check(uncounted === 0, `every named KO is in the killer's stats (${uncounted} missing)`);
console.log(failed ? `\n${failed} credit check(s) failed` : '\nall credit checks pass');
process.exit(failed ? 1 : 0);
