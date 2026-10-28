---
id: QA-27
milestone: M2
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-27: Knocking an enemy into the kill floor credits nobody — winners show 0 KOs and Phantom's passive never fires on ring-outs

Found by the 2026-10-28 nightly QA run. In the set-3 playthrough on Glacier Fortress (4p teams, 1280x720) the
Orange team (Nova/Bulwark, Kilo/Magmaw) eliminated the whole Blue team in 3 turns, yet the results table shows
**0 KOs** for both winners (`docs/alpha/qa/2026-10-28/m3-glacierfort-1280x720-result.jpg`): You/Ricochet took 55 from
Nova and died T1, Juno/Skyla took 25 from Kilo and died T2 — both into the kill floor.

Cause (read from code): `src/core/sim.js` only credits a kill in `damage()` → `kill(target, attacker, …)` (line ~799).
Both kill-floor paths call `this.kill(b, null, 'fell', 0)` (lines ~905 and ~908), so a bot that is blasted off the map
by an enemy shot gets `by: null`, the shooter's `stats.kills` / `killsTurn` stay unchanged, and Phantom's
"KO → cooldown bonus" passive (`killer.cdBonus = 1`) cannot trigger from a ring-out. This matches
`docs/spec/01-game-overview-and-loop.md` ("On elimination by damage (not a fall)… The killer gets a kill credited"),
so it is a design gap, not a code/spec mismatch: ring-outs are one of the main ways matches end.

Measured (`node test/ringout-credit.mjs 1`, new report, 280 hard 1v1s on the standard maps, ~7 min):
- 39 eliminations where the victim took damage on the turn it fell into the kill floor; **39/39** left the opponent
  with no KO credit.
- 256 decisive games; the winner shows **0 KOs in 124 (48.4%)** (includes QA-3 self-eliminations).
- Example: `node test/trace.mjs bulwark warden frozenkeel 5103` → T1 "dmg 44 to warden (siege), ELIM warden fell";
  Bulwark wins in 2 turns with 0 KOs.

Expected (proposal, needs the gameplay owner's / Ganesh's call): a bot that falls within the turn it last took
damage from an enemy (or within N seconds of it) is credited to that enemy — `stats.kills`, `killsTurn`, the
`eliminated` event's `by`, and Phantom's passive. Self-damage and hazards with no owner stay uncredited.
Actual: no ring-out is ever credited.

Notes: this changes simulation (Phantom's cdBonus) and therefore `node test/balance.mjs 3` numbers — paste
before/after per CLAUDE.md. Must stay deterministic (track `lastHitBy` on the bot inside `World`, no clock).
Update `docs/spec/01-game-overview-and-loop.md` in the same PR.

## Acceptance

- [ ] Decision recorded in this file's Log (credit ring-outs: yes/no). If "no", close as won't-fix with the spec
      line kept.
- [ ] If "yes": `STRICT=1 node test/ringout-credit.mjs 1` exits 0, and the Glacier Fortress-style case (enemy blast →
      fall) shows the shooter's KO in the results table.
- [ ] Self-jumps into the kill floor (QA-3 cases from `node test/ai-selfkill.mjs`) still credit nobody.
- [ ] determinism 6, rules, features, bughunt 2 and balance-gate 2 green; balance table before/after in the PR.

## Log
- 2026-10-28 (qa): filed from the nightly run; added `test/ringout-credit.mjs` (report; `STRICT=1` fails on main).
