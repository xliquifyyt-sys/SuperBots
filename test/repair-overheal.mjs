// Repair Kit (spec 04: "+40 HP (capped at max). Also clears Poison and Burn.") must never lower HP.
// A bot still carrying Rally Beacon overheal (HP above max) that picks up a Repair Kit should keep its
// HP, not be cut back to max (QA-42). Also checks the cap still holds for a damaged bot.
// Usage: node test/repair-overheal.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';

const players = [
  { name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 0, isAI: true },
  { name: 'C', botId: 'magmaw', team: 1, isAI: true }, { name: 'D', botId: 'skyla', team: 1, isAI: true },
];
const settings = { map: 'emberpit', mode: 'teams', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'ok  ' : 'FAIL', msg); };

// 1. Repair on the Rally pickup turn (overheal 20) and one turn later (overheal 10).
for (const turnsAfter of [0, 1]) {
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, b = w.bots[0];
  w.applyPowerup(b, 'rally');
  for (let t = 0; t < turnsAfter; t++) { w.endTurn(); w.startTurn(); }
  const before = b.hp;
  w.applyPowerup(b, 'repair');
  check(b.hp >= before, `overhealed bot at ${before}/${b.maxHp} (${turnsAfter} turn(s) after Rally) picks Repair Kit -> ${b.hp} (must not drop)`);
}
// 2. Damaged bot: +40, capped at max.
for (const missing of [10, 60]) {
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, b = w.bots[0];
  b.hp = b.maxHp - missing;
  const before = b.hp;
  w.applyPowerup(b, 'repair');
  const want = Math.min(b.maxHp, before + 40);
  check(b.hp === want, `damaged bot at ${before}/${b.maxHp} picks Repair Kit -> ${b.hp} (expect ${want})`);
}
console.log(failed ? `\n${failed} repair check(s) failed` : '\nall repair checks pass');
process.exit(failed ? 1 : 0);
