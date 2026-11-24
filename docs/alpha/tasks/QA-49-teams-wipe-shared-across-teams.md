---
id: QA-49
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-49: In Teams, a same-turn wipe of the last two bots gives a "shared win" to two opposing teams and drops their dead teammates

Found by the 2026-11-25 nightly QA run (`QA_SET=3 node test/qa-playthrough.mjs docs/alpha/qa/2026-11-25`, match 3:
Ricochet in a 4p Teams game on Glacier Fortress at 1280x720).

Teams in that match (HUD colours): You/Ricochet + Juno/Skyla (blue) v Nova/Bulwark + Kilo/Magmaw (orange).
You died T1, Nova died T5. Juno (blue) and Kilo (orange) were the last bots, one per team, and both died on T8.
The results read **SHARED WIN — "Juno, Kilo"**, with both of them highlighted as winners, and the local player —
Juno's teammate — sees DEFEAT and is recorded a loss.

Cause (read from code): `src/core/match.js` `checkWin`, branch `standing === 0`:
`this.winner = { type: 'draw', ids: wiped.map((b) => b.id), shared: true }` — built from the bots that died on the
last resolve, with no look at `mode === 'teams'`. So in Teams:
- members of two (or more) opposing teams are named co-winners of one shared win;
- every teammate who died earlier is left out of `winner.ids`, so `onMatchOver` (`won = winner.ids.includes(me.id)`),
  the centre banner and `server/hub.js` `recordResult` give them a loss.

Headless repro (new report test, additions only): `node test/teams-wipe.mjs 1` (30 teams matches, ~3 min):
`seed 49001 6p magmaworks: shared win ids P2/t0, P5/t1; teammates not credited: P0/t0 (died T5), P1/t1 (died T7),
P3/t1 (died T6), P4/t0 (died T7)` — 1 same-turn wipe, shared across opposing teams, 4 dead teammates left out.
`STRICT=1 node test/teams-wipe.mjs 1` exits 1 today.

Evidence: `docs/alpha/qa/2026-11-25/m3-glacierfort-1280x720-result.jpg` (title SHARED WIN, subtitle "Juno, Kilo ·
Glacier Fortress · 9 turns", Juno and Kilo rows in green), `m3-glacierfort-1280x720-plan-T5.jpg` (team colours).

Expected: in Teams, a same-turn wipe that leaves no team standing is a shared result **between teams**: every member of
each team that was still in the match on the final turn is credited the shared win (alive or not), consistent with the
fix for QA-28 ("the team wins, so every member wins"). The winner object should carry the teams (e.g.
`{ type: 'draw', shared: true, teams: [0, 1], ids: [...all members of those teams] }`), and the subtitle should name
teams ("Blue and Orange share the win") rather than two individual bots.
Actual: two individual bots from opposing teams share the win; their teammates are recorded as losers.

Related: QA-28 (team win drops dead teammates — same class, `type: 'team'` path), QA-24 (SHARED WIN headline shown to
players who are not in the shared win), QA-8 ("9 turns" when the last turn played was 8).

Touches `src/core/match.js` (sim): determinism 6 and net-parity must stay unchanged apart from the winner object.

## Acceptance

- [ ] `STRICT=1 node test/teams-wipe.mjs 2` exits 0 (no teams-mode shared win names one team and leaves out its
      dead members; ids cover every member of each sharing team).
- [ ] In a Teams match where the last bots of two teams die on the same turn, a player whose bot died earlier on one
      of those teams sees SHARED WIN (not DEFEAT) and the local record does not add a loss.
- [ ] `node test/team-win-credit.mjs 1` unchanged or better; `node test/determinism.mjs 6` passes.
- [ ] All CI gates green.

## Log
- 2026-11-25 (qa): filed from the nightly run; headless repro added as `test/teams-wipe.mjs`.
