// Server/client parity: the server plans AI and resolves the turn; a client (clock 'client')
// never plans and only replays the server's packed action list. Both must stay digest-identical
// every turn. Catches any AI-planning side effect on the shared world (RNG draws, mutations).
// Usage: node test/net-parity.mjs [seedsPerMap=3]
import { Match, packAction, worldDigest } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const seeds = Number(process.argv[2] || 3);
const t0 = Date.now();
let runs = 0, fails = 0;
for (const map of MAP_IDS) {
  const n = Math.min(8, MAPS[map].maxPlayers);
  for (let s = 0; s < seeds; s++) {
    const seed = 31000 + MAP_IDS.indexOf(map) * 100 + s;
    // Half the seats are scripted humans, half server AI; every bot type appears across seeds.
    const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, botId: BOT_IDS[(i + s * 3) % BOT_IDS.length], team: i, isAI: i >= n / 2 }));
    const settings = { map, mode: 'ffa', turnCap: 30, onTurnCap: 'hp', hazards: true, powerups: 'high', airStrikes: 'normal', planTimer: 10 };
    const S = new Match(players, settings, seed); S.start();
    const C = new Match(players.map((p) => ({ ...p })), settings, seed); C.clock = 'client'; C.start();
    for (const b of C.world.bots) b.human = b.id === 0;
    const acts = ['missile', 's1', 'missile', 's2', 'jump'];
    let bad = null;
    for (let turn = 1; turn <= 40 && S.phase !== 'over'; turn++) {
      S.beginPlan(); C.beginPlan();
      for (const me of S.world.bots) {
        if (!me.alive || me.isAI) continue;
        const dir = me.x < S.world.map.width / 2 ? 1 : -1;
        S.submitAction(me.id, packAction({ type: acts[(turn + me.id) % acts.length], aim: { dx: dir * 0.8, dy: -0.6, power: 0.55 + ((turn * 7 + me.id * 3) % 40) / 100, tx: me.x + dir * 4, ty: me.y - 1 }, locked: true }));
      }
      S.beginResolve();
      const actions = {};
      for (const b of S.world.bots) if (b.action) actions[b.id] = packAction(b.action);
      S.world.runToEnd();
      C.beginPlayback(actions); C.world.runToEnd();
      const ds = worldDigest(S.world), dc = worldDigest(C.world);
      if (ds !== dc) { bad = { turn, ds, dc, ai: S.world.bots.filter((b) => b.isAI).map((b) => b.botId).join(',') }; break; }
      S.beginCleanup(); C.beginCleanup(); S.beginAnnounce(); C.beginAnnounce();
    }
    runs++;
    if (bad) { fails++; console.log(`DESYNC ${map} seed ${seed} after turn ${bad.turn} (AI: ${bad.ai})\n  server ${bad.ds}\n  client ${bad.dc}`); }
  }
}
console.log(`${runs} server/client matches in ${Date.now() - t0}ms, ${fails} desynced`);
process.exit(fails ? 1 : 0);
