// Team wins: every bot on the winning team should be credited (spec 01: "Teams: one team with a living bot
// left wins"). Match.checkWin builds winner.ids from *living* teammates only, so a player whose bot died
// earlier sees DEFEAT on the results screen and gets a loss in the record although their team won (QA-28).
// Usage: node test/team-win-credit.mjs [rounds]   (report; STRICT=1 exits 1 when any teammate is left out)
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const R = Number(process.argv[2] || 1);
let teamWins = 0, missing = 0, gamesMissing = 0; const examples = [];
const t0 = Date.now();
for (let r = 0; r < R; r++) {
  for (let i = 0; i < 24; i++) {
    const n = [4, 6, 8][i % 3];
    const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 3 + k * 5 + r) % BOT_IDS.length], team: k % 2, isAI: true }));
    const settings = { mode: 'teams', map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: ['easy', 'normal', 'hard'][i % 3], powerups: 'normal' };
    const seed = 9000 + r * 100 + i;
    const res = Match.simulateHeadless(players, settings, seed);
    if (!res.winner || res.winner.type !== 'team') continue;
    teamWins++;
    const team = res.winner.team;
    // simulateHeadless bots carry no id/team: bot index = player index, team from the roster.
    const left = res.bots.map((b, id) => ({ ...b, id, team: players[id].team })).filter((b) => b.team === team && !res.winner.ids.includes(b.id));
    if (left.length) {
      missing += left.length; gamesMissing++;
      if (examples.length < 6) examples.push(`seed ${seed} ${n}p ${res.map}: team ${team} wins, not credited: ${left.map((b) => `${b.name}/${b.botId}${b.alive ? '' : ' (died T' + b.diedTurn + ')'}`).join(', ')}`);
    }
  }
}
for (const e of examples) console.log(e);
console.log(`${teamWins} team wins in ${Date.now() - t0}ms; ${gamesMissing} leave out ${missing} teammates of the winning team`);
if (process.env.STRICT && missing) process.exit(1);
