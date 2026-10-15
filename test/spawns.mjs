// Spawn pad picks (QA-2). For every map and every player count it can seat:
//  - no two picked pads are closer than 4 units,
//  - n = 2 is mirrored (the two x positions sum to the map width +- 1),
//  - picks run left to right (team mode relies on adjacent pads for teammates),
//  - no bot drops below its picked pad on World.settle(), and settled bots stay 4+ apart,
//  - pickSpawns is a pure function (same answer twice) and Match uses its answer.
import { MAPS, MAP_IDS, pickSpawns } from '../src/core/maps.js';
import { Match } from '../src/core/match.js';

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.log('FAIL', msg); }
  else console.log('ok  ', msg);
}

const MIN_GAP = 4;
for (const id of MAP_IDS) {
  const m = MAPS[id];
  const gaps = [];
  let worst = Infinity, worstAt = '';
  let ordered = true, pure = true;
  for (let n = m.minPlayers; n <= m.maxPlayers; n++) {
    const p = pickSpawns(m, n);
    if (p.length !== n || new Set(p.map(String)).size !== n) { worst = -1; worstAt = `n=${n} returned ${p.length} pads / duplicates`; }
    let gap = Infinity;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      const d = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
      if (d < gap) gap = d;
      if (d < worst) { worst = d; worstAt = `n=${n} ${p[i]} / ${p[j]}`; }
    }
    gaps.push(`${n}:${gap.toFixed(1)}`);
    for (let i = 1; i < p.length; i++) if (p[i][0] < p[i - 1][0]) ordered = false;
    if (JSON.stringify(pickSpawns(m, n)) !== JSON.stringify(p)) pure = false;
  }
  check(worst >= MIN_GAP, `${id}: closest picked pads ${worst.toFixed(2)} >= ${MIN_GAP} (${worstAt}) [${gaps.join(' ')}]`);
  const two = pickSpawns(m, 2);
  const sum = two[0][0] + two[1][0];
  check(Math.abs(sum - m.width) <= 1, `${id}: n=2 mirrored, x ${two[0][0]} + ${two[1][0]} = ${sum} vs width ${m.width}`);
  check(ordered, `${id}: picks run left to right`);
  check(pure, `${id}: pickSpawns is repeatable`);

  // Every picked pad holds its bot: after World.settle() (which drops bots onto the ground and
  // pushes them out of slopes) no bot has dropped more than 1 unit below its pad, and the settled
  // bots are still 4+ apart. Pads drawn inside a slope wedge get pushed out sideways; that is
  // printed as info (tracked in QA-11), not failed.
  const bad = [], drift = new Set();
  let settledGap = Infinity;
  for (let n = m.minPlayers; n <= m.maxPlayers; n++) {
    const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: 'volt', team: k, isAI: true }));
    const bots = new Match(players, { map: id, mode: 'ffa', hazards: false, powerups: 'off', airStrikes: 'off' }, 1).world.bots;
    for (const b of bots) {
      if (b.y - b.spawn[1] > 1) bad.push(`n=${n} pad ${b.spawn} dropped to ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
      else if (Math.hypot(b.x - b.spawn[0], b.y - b.spawn[1]) > 1) drift.add(`pad ${b.spawn} settles at ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
    }
    for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) settledGap = Math.min(settledGap, Math.hypot(bots[i].x - bots[j].x, bots[i].y - bots[j].y));
  }
  check(!bad.length, `${id}: no bot drops below its picked pad on settle${bad.length ? ' — ' + bad.join('; ') : ''}`);
  if (drift.size) console.log(`info ${id}: ${[...drift].join('; ')}`);
  check(settledGap >= MIN_GAP, `${id}: closest settled bots ${settledGap.toFixed(2)} >= ${MIN_GAP}`);
}

// Match seats players on exactly the picked pads (FFA order = roster order).
{
  const players = [0, 1, 2].map((k) => ({ name: 'P' + k, botId: 'volt', team: k, isAI: true }));
  const mt = new Match(players, { map: 'frozenkeel', mode: 'ffa', hazards: false, powerups: 'off', airStrikes: 'off' }, 5);
  const want = pickSpawns(MAPS.frozenkeel, 3);
  check(mt.players.every((p, i) => p.spawn[0] === want[i][0] && p.spawn[1] === want[i][1]),
    `Match uses pickSpawns: ${mt.players.map((p) => p.spawn.join(',')).join(' | ')}`);
  const duel = new Match(players.slice(0, 2), { map: 'frozenkeel', mode: 'ffa' }, 5103);
  check(duel.players[0].spawn[0] + duel.players[1].spawn[0] === 29.5, `Frozen Keel 1v1 starts on opposite shelves: ${duel.players.map((p) => p.spawn.join(',')).join(' | ')}`);
}

console.log(failed ? `\n${failed} spawn check(s) failed` : '\nspawns: all checks passed');
process.exit(failed ? 1 : 0);
