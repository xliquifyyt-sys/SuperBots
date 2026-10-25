---
id: QA-24
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-24: A player who was knocked out earlier sees "SHARED WIN" as the results headline

Found by the 2026-10-25 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-25`, match 5:
Volt in a 5p FFA on Skyline Grid at 1280x720).

The local player died on turn 9. Nova and Mira were the last two bots standing and both died on turn 11, so
`Match.checkWin` (`src/core/match.js`, `standing === 0`) correctly ends the match with
`{ type: 'draw', shared: true, ids: [Nova, Mira] }`. But both headline paths ignore whether the local player is in
`winner.ids`:

- `src/main.js` `onMatchOver`: `result-title` = `winner.type === 'draw' ? (shared ? 'SHARED WIN' : 'DRAW') : ...`
- `src/ui/game.js` (phase `over`): the same expression for the centre banner.

So the loser reads a big red "SHARED WIN" (and a plain "DRAW" in a non-shared draw), while the record correctly counts
the game as a loss. The headline should be about the viewer.

Evidence: `docs/alpha/qa/2026-10-25/m5-skylinegrid-1280x720-result.jpg` (title "SHARED WIN", subtitle "Nova, Mira ·
Skyline Grid · 12 turns", the "You (you)" row died 9).

Expected: a player in `winner.ids` sees SHARED WIN (win styling); a player not in it sees DEFEAT, with the subtitle
naming the shared winners (e.g. "Nova, Mira share the win · Skyline Grid · …"); a spectator sees GAME OVER or
SHARED WIN as today.
Actual: everyone sees SHARED WIN; the eliminated player gets it in the red "lose" style.

Repro: `python3 -m http.server 8123 & QA_SET=2 CHROMIUM_PATH=... node test/qa-playthrough.mjs /tmp/qa 5` and open
`m5-skylinegrid-1280x720-result.png` (needs the same-turn double KO, which this seed produces), or any local match
where you die first and the last two opponents trade a simultaneous KO.

Presentation only — no change to `src/core`.

Related: QA-8 (the same subtitle says "12 turns" when the last turn played was 11).

## Acceptance

- [ ] With a shared win that excludes the local player, both the centre banner and `#result-title` read DEFEAT and
      the subtitle names the shared winners; with the local player included they read SHARED WIN in win styling.
- [ ] A new test (e.g. `test/result-title.mjs`) builds a finished match with a same-turn wipe of the last two bots
      after the human died, runs `onMatchOver` in a headless page, and asserts the title text for both cases.
- [ ] All CI gates green.

## Log
