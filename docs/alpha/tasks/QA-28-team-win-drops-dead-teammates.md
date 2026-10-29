---
id: QA-28
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-28: A team win credits only the teammates still alive — a player whose bot died sees DEFEAT and is recorded a loss

Found by the 2026-10-29 nightly QA run while reading the set-1 Temple Crossing teams result
(`docs/alpha/qa/2026-10-29/m4-templecrossing-1280x720-result.jpg`): "Orange team" won on the turn cap, but only the
surviving Orange bot (Ozzy/Gravitas) is highlighted as a winner; its dead teammates Nova/Volt (died T3) and
Kilo/Skyla (died T8) are drawn as losers.

Cause (read from code): `src/core/match.js` builds the team winner from living bots only:
- line ~149 (last team standing): `{ type: 'team', ids: alive.map((b) => b.id), team }`
- line ~165 (turn cap): `{ type: 'team', team: top[0], ids: alive.filter((b) => b.team === top[0]).map(...) }`

Every consumer treats `winner.ids` as "who won":
- `src/main.js` `onMatchOver`: `won = winner.ids.includes(me.id)` → title **DEFEAT**, red style, `record.losses++`.
- `src/ui/game.js` (phase `over`, line ~99): centre banner "DEFEAT" and `audio.lose()`.
- `server/hub.js` `_finish()` (line ~477): `recordResult(db, userId, ids.includes(index))` → an online account on the
  winning team gets a **loss** if its bot died before the end.
- `test/headless.mjs` / balance reports count team wins only for the survivors.

That contradicts `docs/spec/01-game-overview-and-loop.md` ("Teams: one team with a living bot left wins") and
spec 08 (Result: VICTORY / DEFEAT …): the team wins, so every member wins.

Measured (`node test/team-win-credit.mjs 1`, new report test, 24 teams matches 4p/6p/8p on all maps, ~100 s):
**18 of 23 team wins leave out 34 teammates** of the winning team. Examples:
- seed 9001 6p magmaworks: team 1 wins, not credited: P3/volt (died T10), P5/skyla (died T5)
- seed 9006 4p cloudsteps: team 0 wins, not credited: P2/skyla (died T4)

Repro (UI): Local match → Teams, 2v2 or larger, any map; play badly so your bot dies first while your AI teammate
wins. The results title reads DEFEAT and the menu record adds a loss.

Expected: in a team win, `winner.ids` (or whatever the UI/server use) covers every bot on `winner.team`, alive or
not; the dead teammate sees VICTORY, gets a win in the local record and in the server's `recordResult`. Highlight all
winning-team rows in the results table.
Actual: only the living teammates are credited.

Suggested fix (gameplay owner's call): in both team branches of `Match.checkWin`, set
`ids: this.world.bots.filter((b) => b.team === team).map((b) => b.id)`. This changes no simulation state (the winner
is decided after the turn) and touches only team modes, so the 1v1 balance table is unaffected; re-run
`node test/determinism.mjs 6` and `node test/online.mjs`. If survivors must stay distinguishable, add a separate
`alive` list rather than overloading `ids`.

## Acceptance
- [ ] `STRICT=1 node test/team-win-credit.mjs 1` exits 0.
- [ ] Dying first in a local 2v2 that your team wins shows VICTORY and increments `record.wins`.
- [ ] Online: a seated human whose bot died on the winning team gets a win from `recordResult`.
- [ ] All CI gates green.

## Log
- 2026-10-29 (qa): filed; added `test/team-win-credit.mjs` (report; `STRICT=1` fails on main).
