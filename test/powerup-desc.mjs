// QA-44 invariant: every status effect a power-up clears in the sim must be named in its player-facing
// desc (POWERUPS[id].desc, shown in the Botpedia power-up list and the HUD status rows). Spec 04 lists
// "Also clears Poison and Burn" (Repair Kit) and "Also clears Shocked" (Overclock); the in-game text omits both.
// Usage: node test/powerup-desc.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { POWERUP_IDS, POWERUPS } from '../src/core/defs.js';

const players = [
  { name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 0, isAI: true },
  { name: 'C', botId: 'magmaw', team: 1, isAI: true }, { name: 'D', botId: 'skyla', team: 1, isAI: true },
];
const settings = { map: 'emberpit', mode: 'teams', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
const STATUS = { poison: 'poison', burn: 'burn', shocked: 'shock', frozen: 'froz', rooted: 'root' };
let failed = 0, checked = 0;
for (const id of POWERUP_IDS) {
  const m = new Match(players, settings, 11); m.start();
  const w = m.world, b = w.bots[0];   // Volt: not burn-immune
  b.hp = b.maxHp - 50;
  for (const k of Object.keys(STATUS)) b.effects[k] = 3;
  w.applyPowerup(b, id);
  const desc = POWERUPS[id].desc.toLowerCase();
  for (const [k, word] of Object.entries(STATUS)) {
    if (b.effects[k]) continue;
    checked++;
    const ok = desc.includes(word);
    if (!ok) failed++;
    console.log(ok ? 'ok  ' : 'FAIL', `${POWERUPS[id].name} clears ${k}; desc "${POWERUPS[id].desc}" ${ok ? 'says so' : 'does not say so'}`);
  }
}
console.log(failed ? `\n${failed}/${checked} cleared statuses missing from power-up text` : `\nall ${checked} cleared statuses are named in the power-up text`);
process.exit(failed ? 1 : 0);
