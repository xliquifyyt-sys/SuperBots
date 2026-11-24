// Teams mode, same-turn wipe of the last bots standing: Match.checkWin's `standing === 0` branch builds a
// shared win from the wiped bots only, ignoring teams. When the last two bots belong to opposing teams, both
// teams "share the win" but their dead teammates are not credited (QA-49; related QA-28, QA-24).
// Invariant checked: a teams-mode result never names winners from more than one team unless every member of
// those teams is credited.
// Usage: node test/teams-wipe.mjs [rounds]   (report; STRICT=1 exits 1 on any violation)
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const R = Number(process.argv[2] || 1);
let games = 0, draws = 0, cross = 0, left = 0; const examples = [];
const t0 = Date.now();
for (let r = 0; r < R; r++) {
  for (let i = 0; i < 30; i++) {
    const n = [4, 6, 8][i % 3];
    const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 5 + k * 3 + r) % BOT_IDS.length], team: k % 2, isAI: true }));
    const settings = { mode: 'teams', map: MAP_IDS[(i + r) % MAP_IDS.length], aiDifficulty: ['easy', 'normal', 'hard'][i % 3], powerups: 'normal' };
    const seed = 49000 + r * 100 + i;
    const res = Match.simulateHeadless(players, settings, seed);
    games++;
    if (!res.winner || res.winner.type !== 'draw') continue;
    draws++;
    const teams = [...new Set(res.winner.ids.map((id) => players[id].team))];
    const omitted = res.bots.map((b, id) => ({ ...b, id, team: players[id].team })).filter((b) => teams.includes(b.team) && !res.winner.ids.includes(b.id));
    if (teams.length > 1) cross++;
    left += omitted.length;
    if ((teams.length > 1 || omitted.length) && examples.length < 6) {
      examples.push(`seed ${seed} ${n}p ${res.map}: shared win ids ${res.winner.ids.map((id) => `P${id}/t${players[id].team}`).join(', ')}; teammates not credited: ${omitted.map((b) => `P${b.id}/t${b.team} (died T${b.diedTurn})`).join(', ') || 'none'}`);
    }
  }
}
for (const e of examples) console.log(e);
console.log(`${games} teams matches in ${Date.now() - t0}ms; ${draws} same-turn wipes, ${cross} shared across opposing teams, ${left} dead teammates left out`);
if (process.env.STRICT && (cross || left)) process.exit(1);
