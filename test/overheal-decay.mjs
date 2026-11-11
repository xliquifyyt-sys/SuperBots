// Rally Beacon overheal (spec 04: "HP can sit up to 20 above max; each turn start it decays by 10
// toward max") must never raise HP. A bot that still carries overheal but has been damaged below
// max HP must keep its HP at the next turn start (QA-38). Also checks a bot killed while carrying
// overheal and revived by sudden death keeps TURN.suddenDeathHp.
// Usage: node test/overheal-decay.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { TURN } from '../src/core/defs.js';

const players = [
  { name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 0, isAI: true },
  { name: 'C', botId: 'magmaw', team: 1, isAI: true }, { name: 'D', botId: 'skyla', team: 1, isAI: true },
];
const settings = { map: 'emberpit', mode: 'teams', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'ok  ' : 'FAIL', msg); };

// 1. Full HP picker: overheal decays 20 -> 10 -> 0 above max, never below.
{
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, b = w.bots[0];
  w.applyPowerup(b, 'rally');
  const seq = [b.hp];
  for (let t = 0; t < 3; t++) { w.endTurn(); w.startTurn(); seq.push(b.hp); }
  const max = b.maxHp;
  check(seq[0] === max + 20 && seq[1] === max + 10 && seq[2] === max && seq[3] === max, `undamaged picker HP over turns ${JSON.stringify(seq)} (max ${max}; expect ${max + 20}, ${max + 10}, ${max}, ${max})`);
}
// 2. Picker hit hard on the pickup turn: decay must not heal.
for (const hit of [30, 60, 90]) {
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, b = w.bots[0], foe = w.bots[2];
  w.applyPowerup(b, 'rally');
  w.applyDamage(b, hit, { type: 'missile', label: 'Missile', bot: foe });
  const before = b.hp;
  w.endTurn(); w.startTurn();
  const after1 = b.hp;
  w.endTurn(); w.startTurn();
  const after2 = b.hp;
  check(b.alive && after1 <= before && after2 <= after1, `picker at ${before}/${b.maxHp} after a ${hit}-damage hit (dmg setting 1) -> next turn ${after1}, then ${after2} (overheal decay must not heal)`);
}
// 3. Teammate below max at pickup (gets +20, no overheal) then hit: no heal either way.
{
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, mate = w.bots[1], foe = w.bots[2];
  mate.hp = mate.maxHp - 10;
  w.applyPowerup(w.bots[0], 'rally');
  w.applyDamage(mate, 50, { type: 'missile', label: 'Missile', bot: foe });
  const before = mate.hp; w.endTurn(); w.startTurn();
  check(mate.hp <= before, `teammate at ${before}/${mate.maxHp} after the hit -> next turn ${mate.hp}`);
}
// 4. Killed while carrying overheal, revived by sudden death: HP stays TURN.suddenDeathHp.
{
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, b = w.bots[0], foe = w.bots[2];
  w.applyPowerup(b, 'rally');
  w.applyDamage(b, b.hp + 50, { type: 'missile', label: 'Missile', bot: foe });
  w.enterSuddenDeath([b]);
  const rev = b.hp; w.endTurn(); w.startTurn();
  check(b.hp <= rev, `bot killed with overheal, revived at ${rev} HP in sudden death -> next turn ${b.hp} (TURN.suddenDeathHp ${TURN.suddenDeathHp})`);
}
console.log(failed ? `\n${failed} overheal check(s) failed` : '\nall overheal checks pass');
process.exit(failed ? 1 : 0);
