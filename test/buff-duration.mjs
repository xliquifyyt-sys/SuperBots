// Buff power-ups stay active for exactly POWERUPS[id].turns turns, counting the pickup turn (QA-36).
// Applies each buff to a bot, then counts end-of-turn ticks until the effect is gone.
// Also checks the contact power-ups' statuses against their Botpedia text (QA-37).
// Usage: node test/buff-duration.mjs   (exit 1 on any mismatch; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { POWERUPS, POWERUP_IDS } from '../src/core/defs.js';

const players = [
  { name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 0, isAI: true },
  { name: 'C', botId: 'magmaw', team: 1, isAI: true }, { name: 'D', botId: 'skyla', team: 1, isAI: true },
];
const settings = { map: 'emberpit', mode: 'teams', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
let failed = 0;
for (const id of POWERUP_IDS) {
  const pu = POWERUPS[id];
  if (pu.kind !== 'buff') continue;
  const m = new Match(players, settings, 5); m.start();
  const w = m.world, b = w.bots[0], mate = w.bots[1];
  w.applyPowerup(b, id);
  let n = 0;
  while (w.hasEffect(b, id) && n < 20) { n++; w.endTurn(); }
  const ok = n === pu.turns;
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', `${pu.name}: defs turns ${pu.turns}, active ${n} turns counting the pickup turn`);
  if (id === 'rally') {
    const m2 = new Match(players, settings, 5); m2.start();
    m2.world.applyPowerup(m2.world.bots[0], id);
    let k = 0;
    while (m2.world.hasEffect(m2.world.bots[1], id) && k < 20) { k++; m2.world.endTurn(); }
    const ok2 = k === pu.turns;
    if (!ok2) failed++;
    console.log(ok2 ? 'ok  ' : 'FAIL', `${pu.name} (teammate ${mate.def.id}): active ${k} turns`);
  }
}
// Contact power-ups (QA-37): the status lands mid-turn (resolve), so count what it does on the turns after it.
// Toxin: "Poisoned (10/turn for 3 turns)" → 3 later turns of DMG.poison.
{
  const duo = [{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'bulwark', team: 1, isAI: true }];
  const m = new Match(duo, { ...settings, mode: 'ffa' }, 5); m.start();
  const w = m.world, a = w.bots[0], b = w.bots[1];
  a.contact = 'toxin'; a.contactTurns = POWERUPS.toxin.turns;
  w.transferContact(a, b);
  const per = [];
  for (let t = 0; t < 6; t++) { w.endTurn(); const h = b.hp; w.startTurn(); per.push(h - b.hp); }
  const hitTurns = per.filter((d) => d > 0).length;
  const ok = hitTurns === 3 && per.slice(0, 3).every((d) => d === 10);
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', `Toxin poison: damage on the next 6 turns ${JSON.stringify(per)} (Botpedia: 10/turn for 3 turns)`);
  // Frost and Shockwire: "no jump / no specials next turn" → active on exactly the next turn.
  for (const [k, eff] of [['frost', 'frozen'], ['shockwire', 'shocked']]) {
    const m2 = new Match(duo, { ...settings, mode: 'ffa' }, 5); m2.start();
    const w2 = m2.world, a2 = w2.bots[0], b2 = w2.bots[1];
    a2.contact = k; a2.contactTurns = POWERUPS[k].turns;
    w2.transferContact(a2, b2);
    const on = [];
    for (let t = 0; t < 3; t++) { w2.endTurn(); w2.startTurn(); on.push(w2.hasEffect(b2, eff)); }
    const ok2 = on[0] === true && on[1] === false;
    if (!ok2) failed++;
    console.log(ok2 ? 'ok  ' : 'FAIL', `${POWERUPS[k].name}: ${eff} on the next 3 turns ${JSON.stringify(on)} (Botpedia: next turn only)`);
  }
}
console.log(failed ? `${failed} buff/status duration mismatch(es)` : 'all buff and status durations match defs and Botpedia');
process.exit(failed ? 1 : 0);
