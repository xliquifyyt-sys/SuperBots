// Magmaw's passive (defs.js / Botpedia: "Survives the first lava contact each turn.") must hold every turn.
// Drops Magmaw into the lava on consecutive turns and checks it surfs out each time. The sim sets
// lavaImmune = 2 on a surf and only surfs while lavaImmune <= 0, so the turn after a surf the first
// contact kills, and Magmaw survives at most one lava contact every 2 turns (QA-43).
// Usage: node test/magmaw-lava.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { PHYS } from '../src/core/defs.js';

const players = [{ name: 'A', botId: 'magmaw', team: 0, isAI: true }, { name: 'B', botId: 'volt', team: 1, isAI: true }];
const settings = { map: 'emberpit', mode: 'ffa', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'ok  ' : 'FAIL', msg); };
for (const gap of [1, 2, 3]) {   // turns between the two lava drops
  const m = new Match(players, settings, 7); m.start();
  const w = m.world, a = w.bots[0], b = w.bots[1];
  const drop = (turn) => {
    if (turn > 1) w.startTurn();
    a.x = 15; a.y = w.lavaY - 1.2; a.vx = 0; a.vy = 2;   // just above the lava in the centre pit
    w.submit(a.id, { type: 'skip' }); w.submit(b.id, { type: 'skip' });
    w.events = []; w.resolve();
    let surfed = false;
    // Once it surfs, park it back on its spawn pad so the fall back into the pit (a second contact
    // the same turn, which kills by design) does not count.
    while (!w.step(PHYS.dt)) if (!surfed && w.events.some((e) => e.type === 'lavaSurf')) { surfed = true; a.x = a.spawn[0]; a.y = a.spawn[1]; a.vx = 0; a.vy = 0; }
    w.endTurn();
    return surfed;
  };
  const s1 = drop(1);
  check(s1 && a.alive, `drop 1 (turn 1): surf ${s1}, alive ${a.alive}`);
  for (let t = 1; t < gap; t++) { w.startTurn(); w.submit(a.id, { type: 'skip' }); w.submit(b.id, { type: 'skip' }); a.x = a.spawn[0]; a.y = a.spawn[1]; a.vx = 0; a.vy = 0; w.resolve(); w.runToEnd(); w.endTurn(); }
  if (!a.alive) { check(false, `gap ${gap}: Magmaw died between drops`); continue; }
  const s2 = drop(1 + gap);
  check(s2 && a.alive, `drop 2 (turn ${1 + gap}, ${gap} turn(s) later): surf ${s2}, alive ${a.alive} (passive: survives the first contact each turn)`);
}
console.log(failed ? `\n${failed} lava check(s) failed` : '\nall Magmaw lava checks pass');
process.exit(failed ? 1 : 0);
