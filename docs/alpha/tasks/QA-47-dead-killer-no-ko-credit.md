---
id: QA-47
milestone: M2
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-47: KOs scored by a bot that is already dead (self-destruct chains, shots in flight) are never credited

Found by the 2026-11-19 nightly QA run with a new probe, `test/dead-killer-credit.mjs`.

Spec 01: "On elimination by damage (not a fall) the bot **self-destructs** … Chains are allowed up to depth 3. The
killer gets a kill credited, and Phantom's passive triggers." `World.kill()` (`src/core/sim.js` ~line 808) only
credits the killer when `killer.alive`:

```js
if (killer && killer !== b && killer.alive) { killer.stats.kills++; killer.killsTurn++; ... }
this.emit('eliminated', { bot: b.id, ..., by: killer ? killer.id : null, cause });
```

A self-destruct blast's source is the bot that just died, so every self-destruct KO is uncredited. The same
happens to a missile / Siege Shell / special still in flight when its owner dies earlier in the same resolve.
The `eliminated` event still names the dead bot in `by`, so the sim contradicts itself: the event says "A KO'd B",
`A.stats.kills` (the results table's **KOs** column, `src/main.js`) says A never KO'd anyone.

## Repro

`node test/dead-killer-credit.mjs 1` (new, not a CI gate; exit 1 on any mismatch, ~2 min). On main 67a264a:

```
ok   A killed by B, B caught in A's self-destruct (B alive=false, hp 0)
ok   B credited with KO of A (kills=1)
FAIL eliminated event for B says by=0 (A=0); A.stats.kills=0 (must match the event)
10 eight-bot FFA games: 45 eliminations name a killer; 7 name a killer that was already dead; 7 missing from the killer's stats.kills
emberpit seed 7100 T5: warden KO'd by already-dead skyla (Missile)
emberpit seed 7100 T6: magmaw KO'd by already-dead phantom (Self-destruct)
emberpit seed 7100 T6: bulwark KO'd by already-dead magmaw (Self-destruct)
magmaworks seed 7101 T4: skyla KO'd by already-dead warden (Self-destruct)
glacierfort seed 7103 T5: gravitas KO'd by already-dead bulwark (siege)
nimbus seed 7107 T7: gravitas KO'd by already-dead bulwark (Missile)
```

Seeds are fixed (7100 + map index, hard AI, normal power-ups, all 8 bots FFA via `Match.simulateHeadless`).
7 of 45 named KOs (15.6%) are dropped from the results table. In the 2026-11-19 set-1 playthrough (Temple Crossing
teams, `docs/alpha/qa/2026-11-19/m4-templecrossing-1280x720-result.jpg`) three Red bots died and the table shows
one KO in total (most of the gap is QA-27 ring-outs).

- **Expected:** a KO that the sim attributes to a bot (`eliminated.by`) is counted in that bot's `stats.kills`
  whether or not it is still alive (the stat is post-match), so the KOs column matches what happened. Phantom's
  cooldown passive can stay alive-only (a dead bot has no next turn).
- **Actual:** dead attackers get no KO; self-destruct KOs are never counted.

Notes: `stats.kills` is presentation-only today (results table), and `cdBonus` would be unchanged if it stays
alive-only, so the fix should not move `node test/balance.mjs` numbers — still paste the table per CLAUDE.md
if `src/core` changes. Fix together with QA-27 (ring-out credit) and QA-28 (team-win credit) since all three feed
the same KOs column. Update spec 01 to say self-destruct KOs count for the exploded bot.

## Acceptance

- [ ] `node test/dead-killer-credit.mjs 2` exits 0.
- [ ] determinism 6, rules, features, bughunt 2 and balance-gate 2 green; `node test/balance.mjs 3` unchanged
      (or before/after pasted in the PR).
- [ ] `docs/spec/01-game-overview-and-loop.md` states who is credited for a self-destruct KO.

## Log
- 2026-11-19 (qa): filed from the nightly run; added `test/dead-killer-credit.mjs` (report, exit 1 on main).
