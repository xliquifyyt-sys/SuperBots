// Sudden Death must suspend map hazards (docs/spec/06: "Hazards ... are suspended during Sudden
// Death"; 01: hazards are "always" skipped in Sudden Death). Timed spike mines planted before Sudden
// Death stay armed, and Sudden Death revives bots on their spawn pads, which a timed mine can sit on
// (mineSpot never excludes pads). Checks, on both timed-mine maps, that a bot revived by Sudden
// Death next to or on a mine planted earlier takes no mine damage on the first Sudden Death turn (QA-39).
// Usage: node test/sd-mines.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';

const players = [{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true }];
let failed = 0;
for (const map of ['canopyruins', 'templecrossing']) {
  for (const dx of [0, 0.6]) {
    const m = new Match(players, { map, mode: 'ffa', powerups: 'off', airStrikes: 'off' }, 7); m.start();
    const w = m.world, a = w.bots[0], b = w.bots[1];
    // A timed mine that landed on (or beside) A's spawn pad before Sudden Death.
    w.mines.push({ x: a.spawn[0] + dx, y: a.spawn[1] + 0.3, alive: true, timer: 0 });
    w.kill(a, null, 'fell', 0); w.kill(b, null, 'fell', 0);
    w.enterSuddenDeath([a, b]);
    const hp0 = a.hp;
    w.startTurn();
    w.submit(a.id, { type: 'skip' }); w.submit(b.id, { type: 'skip' });
    w.events = []; w.resolve(); w.runToEnd();
    const mineHits = w.events.filter((e) => e.type === 'mine').length;
    const ok = mineHits === 0 && a.hp === hp0;
    if (!ok) failed++;
    console.log(ok ? 'ok  ' : 'FAIL', `${map} mine ${dx} from A's pad: Sudden Death turn 1 A hp ${hp0} -> ${a.hp}, ${mineHits} mine detonation(s) (expect none)`);
  }
}
console.log(failed ? `${failed} failure(s)` : 'all sudden-death mine checks passed');
process.exit(failed ? 1 : 0);
