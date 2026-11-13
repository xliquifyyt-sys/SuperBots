// Gale Shot slides power-ups 3.5 units along the aim and "drops them back to the ground"
// (docs/spec/03 Skyla S2, docs/spec/04). When the slide carries a power-up past a ledge with
// nothing below, dropToGround stops it 0.6 above the kill floor, where it hovers over water,
// void or lava: no bot can touch it without dying, and it holds a field slot until it expires (QA-41).
// For every map power-up spawn and both slide directions, Skyla casts a real Gale Shot from 2.5
// units away (same height) and the power-up must end resting on terrain.
// Usage: node test/gale-powerup.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { MAP_IDS } from '../src/core/maps.js';
import { BOTS } from '../src/core/defs.js';

const sp = BOTS.skyla.s2;
let failed = 0, total = 0;
for (const map of MAP_IDS) {
  for (let si = 0; ; si++) {
    const m = new Match([{ name: 'A', botId: 'skyla', team: 0, isAI: true }, { name: 'B', botId: 'volt', team: 1, isAI: true }],
      { map, mode: 'ffa', powerups: 'off', airStrikes: 'off', hazards: false }, 3);
    m.start();
    const w = m.world, sky = w.bots[0], other = w.bots[1];
    if (si >= w.map.powerups.length * 2) break;
    const [px, py] = w.map.powerups[si >> 1], dir = si % 2 ? 1 : -1;
    const pu = { x: px, y: py, id: 'repair', turnsLeft: 6 }; w.dropToGround(pu);
    const x0 = pu.x;
    w.powerups = [pu];
    sky.x = pu.x - dir * 2.5; sky.y = pu.y; other.x = sky.x < w.map.width / 2 ? w.map.width - 1 : 1; // keep B out of the cone
    w.galeShot(sky, { dx: dir, dy: 0 }, sp);
    total++;
    const hovering = pu.y >= w.lavaY - 0.6 - 1e-9;
    if (hovering) {
      failed++;
      console.log('FAIL', `${map} power-up at (${px}, ${py}) slid ${dir > 0 ? 'right' : 'left'} from x ${x0.toFixed(2)} -> (${pu.x.toFixed(2)}, ${pu.y.toFixed(2)}), hovering ${(w.lavaY - pu.y).toFixed(2)} above the ${w.map.killFloor.type} kill floor (y ${w.lavaY})`);
    }
  }
}
console.log(failed ? `${failed} of ${total} Gale slides leave a power-up hovering over the kill floor` : `all ${total} Gale slides leave the power-up on terrain`);
process.exit(failed ? 1 : 0);
