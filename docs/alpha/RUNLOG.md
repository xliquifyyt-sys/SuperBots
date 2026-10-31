# Run log

Builder, QA and producer runs append here.

## 2026-10-14 — builder run (producer)
- **Main at start:** 06ac459, all CLAUDE.md gates green (determinism 53s, rules 1s, headless 20 64s,
  features 447s, bughunt 2 88s, balance-gate 2 450s, online 52s, online-browser 128s, browser 55s; one
  console 404 `/api/config` on the static build — fixed by M0-01).
- **Attempted:** M0-01 (client-ui), M0-02 (qa), M0-03 (gameplay). M0-04 skipped this run: it edits
  `src/core/sim.js` like M0-03.
- **Reviews:** M0-01 APPROVE; M0-02 REJECT (unfiled follow-up, stale spec/11 claim) → fixed → APPROVE;
  M0-03 APPROVE.
- **PRs:** #5 M0-01, #6 M0-02, #7 M0-03 (scope narrowed to Chain Arc + Bulwark) — all three CI-green and
  auto-merged on first push (~7–10 min CI each). #8 M0-06 open with `hold`.
- **Blocked:** M0-06 turn-cap tie → draw (split from M0-03) — changes one protected assertion, needs
  `human-approved` (HUMAN_QUEUE H-04). PR #8 (`hold`; guard red until approved).
- **New tasks:** M0-05 (bughunt 4+ glacierfort embed), M0-07 (online map labels), M0-08 (unknown map id),
  M0-09 (server records draws), M0-10 (AI Chain Arc outline), M0-11 (card text ≥12px), M5-05 (server base
  URL for native builds).
- **Notes:** features.mjs takes ~20 min when three worktrees run gates at once on this 2-core sandbox;
  workers must use their own ports, scratch folders, and never `pkill -f` by pattern.

## 2026-10-14 (evening) — builder run (producer)
- **Main at start:** 8432a39. determinism 6 + rules green locally (50 s); every other gate was green
  in CI on the PRs merged earlier today. PR #8 (M0-06) still has `hold`, no `human-approved` →
  M0-06 and M0-09 stay blocked (H-04).
- **Attempted:** M0-04 (gameplay, owns sim.js this run), M0-05 (qa, told not to edit sim.js),
  M0-07 (client-ui).
- **Reviews:** M0-04 APPROVE, M0-07 APPROVE (both re-ran every gate independently). M0-05 not
  sent to review: the worker found it cannot be finished without a sim fix.
- **PRs:** #10 M0-04 and #11 M0-07 — CI green on first push, auto-merged (~9 min CI).
- **Blocked:** M0-05. The glacierfort hit is a false positive (helper step rect; real hull depth
  0.000, screenshots), but `bughunt 5` has a second, real sink: Volt ends a turn 0.35 inside the
  Nimbus pillar after a rescue-vent teleport onto an occupied exit (seed 9402, T9). Filed as
  M0-12 (gameplay, P1). The invariant fix + `test/terrain-embed.mjs` + evidence are parked on
  pushed branch `agent/M0-05-bughunt-glacierfort-step` (98f7047), not on main.
- **New tasks:** M0-12 (rescue-vent sink), M0-13 (online host-settings grid overflows at 390 wide /
  1280x720, 46px buttons, 11px labels — in #11), M0-14 (AI discounts expiring power-ups),
  M0-15 (run `test/online-maps.mjs` in CI).
- **Gate times (worker, 3 worktrees on 2 cores):** determinism 91–138 s, headless 62–142 s,
  features 437–542 s, bughunt 2 81–126 s, balance-gate 111–150 s, online ~50 s, online-browser
  91–125 s, browser 43–55 s. `bughunt 5` ≈ 333–368 s.
- **Note:** two workers picked the same new task id (M0-12) in parallel; producer renumbered one
  to M0-13. Future runs: producer assigns follow-up ids up front.

## 2026-10-14 (night) — nightly QA run (qa)
- **Main:** 153192f. 2-core cloud sandbox, suites run one at a time (wall times below).

| suite | result | wall |
|---|---|---|
| determinism 12 | PASS | 132 s |
| rules | PASS | 1 s |
| stress 250 | PASS (0 errors, 0 no-winner, 1 sudden death, avg 9.9 turns) | 774 s |
| bughunt 5 | **FAIL**: `bot embedded in terrain` x8, e.g. glacierfort T1 ricochet depth 0.32 (known: M0-05 / M0-12) | 197 s |
| features | PASS (90 matches, all specials/power-ups/events seen) | 371 s |
| headless 60 | PASS (0 errors, 5 draws) | 163 s |
| balance 4 | ran (report only; table below) | 183 s |
| online | PASS | 50 s |
| online-browser | PASS | 59 s |
| browser (static :8123) | PASS (no console errors, Botpedia painted at 3 sizes) | 43 s |
| online-maps | PASS | 3 s |
| **online-8p** (new, 4 ws clients + 4 AI) | **FAIL**: all 4 clients' digests diverge from the server at turn 4 (nimbus, skylinegrid) → QA-1 | 47 s / 41 s |
| **net-parity 2** (new) | **FAIL**: 10/20 desynced, every match with an AI Phantom → QA-1 | 22 s |
| ai-selfkill (new, report) | 43 undamaged self-eliminations in 280 hard 1v1s (15.4%) → QA-3 | 186 s |
| qa-playthrough (new) | 5 matches through the real UI, 0 page errors; HUD/results issues → QA-4/5/6 | ~4 min |

No perf/swarm/ai-usage tests exist yet.

**1v1 balance (`balance.mjs 4`, 224 duels, avg 7.2 turns)**

| bot | win rate | avg dmg/game |
|---|---|---|
| bulwark | 70% | 107 |
| magmaw | 45% | 63 |
| volt | 54% | 107 |
| warden | 63% | 100 |
| skyla | 13% | 51 |
| phantom | 23% | 47 |
| ricochet | 57% | 97 |
| gravitas | 29% | 70 |

Only magmaw, volt and ricochet are inside the 40–60% alpha target. Skyla is 3 points above the
10% CI floor. In headless 60 (2–8 player FFA/teams), Skyla won 1 of 35 games (3%) and Phantom 4 of 39 (10%).
Balance itself is already tracked (M2-03/M2-04). QA-2 (Frozen Keel 1v1 spawns are asymmetric) and QA-3 (AI
self-eliminations) both skew these numbers.

- **UI playthroughs** (`test/qa-playthrough.mjs`): Volt v Magmaw on emberpit at 390x844, Bulwark v
  Phantom+Skyla on frozenkeel at 1280x720, Ricochet v Gravitas on canopyruins at 390x844, Warden in a 6-bot teams game on
  templecrossing at 1280x720, Skyla in a 4p FFA on neonalley at 390x844. All reached the results screen. Evidence is in
  `docs/alpha/qa/2026-10-14/`.
- **Filed:** QA-1 (P0, M0, gameplay): online desync from the AI Blink RNG draw. QA-2 (P1, M0,
  gameplay): pickSpawns puts bots adjacent, and the Frozen Keel 1v1 spawn is asymmetric. QA-3 (P1, M2,
  gameplay): AI self-eliminations. QA-4 (P2, M1, client-ui): results table clipped at 390. QA-5 (P2, M1,
  client-ui): turn label wraps at 390. QA-6 (P2, M1, client-ui): phone plan view hides opponents and the
  roster can't be opened.
- **New tests (additions only, not in CI yet):** `test/net-parity.mjs`, `test/online-8p.mjs`,
  `test/ai-selfkill.mjs`, `test/qa-playthrough.mjs`. QA-1 asks for net-parity to be wired into CI.

## 2026-10-15 — builder run (producer)
- **Main at start:** 4d6e581; CI green on its PR head (#13), so no main fix needed.
- **Attempted:** QA-1 (gameplay, P0), M0-08 (gameplay), M0-11 (client-ui). Skipped this run for file overlap:
  M0-10/M0-14 (planner.js, like QA-1), M0-12 (sim.js, like QA-1), M0-13 (style.css, like M0-11).
- **Reviews:** M0-08 APPROVE, M0-11 APPROVE, QA-1 REJECT on process only (code correct; balance gate red).
- **PRs:** #14 M0-08 and #15 M0-11 — CI green, auto-merged on first push. #16 QA-1 open with `hold`
  (merged up with main after #14 to resolve an additions-only ci.yml conflict).
- **Blocked:** QA-1 — `balance-gate.mjs 2` fails with Skyla 4% vs 10% floor (main 11%). No `defs.js` change;
  removing the server-only RNG draw reshuffles the 28-game sample (8 seeds: Skyla ~13% before and after).
  Human decision HUMAN_QUEUE H-05; agent follow-up QA-1a.
- **New tasks:** QA-1a (Skyla clears the balance floor robustly), M0-08a (`tools/gen_spec.py` would overwrite
  M0-03 hand edits in `docs/spec/03-bots.md`).
- **Gate times (worker, 3 worktrees on 2 cores):** determinism 65–111 s, headless 70–92 s, features 390–500 s,
  bughunt 2 72–73 s, balance-gate 93–121 s, online 50 s, online-browser 90–117 s, browser 43–57 s.
- **Notes:** reviewer findings left for later — `{ map: undefined }` now throws in `Match` (no caller passes it);
  lobby stat chips wrap to 2–3 rows at 390 wide; `browser.mjs` card check is horizontal-only.

## 2026-10-15 (afternoon) — builder run (producer)
- **Main at start:** 15d79da; CI green on its PR head (#17), so no main fix needed.
- **Attempted:** QA-1a (balance, P0 — task file was only on PR #16's branch), M0-08a (gameplay),
  M0-13 (client-ui). Skipped for overlap/risk: M0-10/M0-14 (planner.js, like QA-1a), M0-12 (sim.js,
  and a physics change reshuffles the balance sample), QA-2 (maps.js spawns move Frozen Keel balance).
- **Reviews:** M0-08a APPROVE, M0-13 APPROVE, QA-1 + QA-1a (combined branch) APPROVE. Each reviewer re-ran every gate.
- **QA-1a result:** Skyla's AI was killing herself with her own Updraft rain (1332 self-damage, 10
  self-kills over the 28 gate duels → 180, 0) and Blink Strike dropped its target point. Planner fix,
  no ability numbers changed. `balance.mjs 8` Skyla 13% → 30%. QA-1a alone trips `bughunt 2` on two
  pre-existing sim bugs (QA-1d, M0-12), so it was merged into the QA-1 branch (H-05 option 2); the
  combined tree is green on every gate including balance-gate 2 (Skyla 29%) and net-parity 3 (0/30).
- **PRs:** #19 M0-13 — CI green, auto-merged. #18 M0-08a — CI green, auto-merged. #16 QA-1 + QA-1a —
  updated (merge of main + QA-1a), body rewritten, **kept on `hold`** for Ganesh (H-05 updated); CI on 37ad5de is green on every job, automerge skipped only for `hold`.
- **New tasks:** QA-1b (jump preview vs sim on ramps), QA-1c (gen_spec Blink prose after QA-1a),
  QA-1d (spike mine spawns inside the Temple Crossing post), QA-1e (Bastion Wall point / wedge),
  QA-1g (bughunt stair-step false positive; protected file, needs a human). QA-1f was the same bug as
  M0-12 and was folded into it. All on PR #16's branch.
- **Backlog notes:** M0-15 now also covers `test/online-settings-layout.mjs` (added by M0-13, not yet in
  CI). M2-03 notes that after QA-1a Magmaw sits at 32–36% and Gravitas/Phantom/Skyla below 40%.
- **Reviewer nits left:** gen_spec Chain Arc "within 0.15 of its centre" is ambiguous; wall damage
  ignores damage multipliers (not stated in spec); settings chips leave an uneven last row at 844x390;
  local Custom Game grid never adds `wide`.
- **Gate times (reviewer, 3 in parallel on 2 cores):** determinism 69–76 s, headless 75–85 s, features
  572–624 s, bughunt 2 105–129 s, balance-gate 2 116–153 s, online 50 s, online-browser 86–114 s, browser 50–58 s.

## 2026-10-15 (night) — nightly QA (qa)
- **Main:** 94d14f0 (M0-15). PR #16 (QA-1 + QA-1a) is still on `hold`, so main does not carry the Blink RNG fix.
- **Suites (sequential, 2 cores):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 131 s |
| rules | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 1 sudden death, avg 9.9 turns) | 781 s |
| bughunt 5 | **FAIL** — x8 Ricochet embedded in glacierfort step rect (known: M0-05 / QA-1g; `bughunt 2` gate unaffected) | 202 s |
| features | pass | 374 s |
| headless 60 | pass (0 errors, 5 draws) | 168 s |
| balance 4 | pass (report) | 186 s |
| online | pass | 50 s |
| online-browser | pass | 89 s |
| browser (static :8123) | pass, no page errors | 49 s |
| online-maps | pass | 3 s |
| online-settings-layout | pass | 8 s |
| net-parity 3 (not in CI) | **FAIL** — 15/30 matches desync (known P0 QA-1; fix on held PR #16) | 37 s |
| online-8p (not in CI) | pass (nimbus, 14 turns) | 45 s |
| ai-selfkill 1 (report) | 43 undamaged self-eliminations in 280 hard 1v1s (15.4%; phantom 14, skyla 11) — QA-3 | 244 s |
| balance-gate 2 | pass — Skyla 11% vs 10% floor | 98 s |
| turn-count 12 (new) | **FAIL** — 11/11 off by one (QA-8) | 14 s |

- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.2 turns):**

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 70% | 107 |
| magmaw | 45% | 63 |
| volt | 54% | 107 |
| warden | 63% | 100 |
| skyla | 13% | 51 |
| phantom | 23% | 47 |
| ricochet | 57% | 97 |
| gravitas | 29% | 70 |

  In the 40–60% band: magmaw, volt, ricochet. Headless 60 FFA: Skyla 1/35 wins (3%), Phantom 4/39 (10%).
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs`, the other five maps from last night):
  Magmaw v Ricochet on magmaworks at 1280x720, Phantom v Warden+Volt on glacierfort at 390x844, Gravitas v
  Skyla on cloudsteps at 1280x720, Bulwark in a 4p teams game on nimbus at 390x844, Volt in a 5p FFA on
  skylinegrid at 1280x720. All five reached results with no page errors. The 390 runs repeat QA-4 (results
  table clipped) and QA-5 (turn label wraps). Self-eliminations show up in the UI too: on Skyline Grid,
  Gravitas died on T3 having taken 0 damage, and the human Volt won while dealing 0 damage. Evidence:
  `docs/alpha/qa/2026-10-15/`.
- **Filed:** QA-7 (P2, M1, client-ui): HUD roster covers the top-right bot on Cloud Steps at 1280x720.
  QA-8 (P3, M1, gameplay): the results screen and summaries report turns + 1. QA-9 (P2, M1, client-ui): SKIP and
  disabled FIRE are unreadable on bright sky maps. QA-10 (P3, M1, client-ui): adjacent bots' name tags overlap.
- **New tests (additions only, not in CI):** `test/turn-count.mjs` (QA-8). `test/qa-playthrough.mjs` gains
  `QA_SET=2` for the second map rotation.
- **P0 still open on main:** QA-1 online desync (net-parity 15/30). It is waiting on Ganesh's call on PR #16 (H-05).

## 2026-10-15 (evening) — builder run (producer)
- **Main at start:** 263b17a; CI green on its PR head (#20), so no main fix needed. No human action on #8 / #16 since the last run.
- **Attempted:** M0-15 (qa), M0-12 (gameplay, P1), QA-2 (gameplay, P1). Skipped: M0-10/M0-14 (planner.js,
  conflicts with PR #16 on hold), M0-09 (depends on M0-06, blocked on H-04).
- **Reviews:** M0-15 APPROVE, M0-12 APPROVE, QA-2 APPROVE (round 2). Each reviewer re-ran every gate in a fresh worktree.
- **QA-2 round 1** was blocked: new spawns reshuffled matches and `bughunt 2` hit `mine inside terrain`
  (QA-1d) in sim.js. M0-12's worker had hit the same bug and fixed it (`mineSpot()`), so QA-2 merged M0-12 in;
  the new spawns then dropped `wallHit` from the random features batch, fixed with an explicit scenario.
- **PRs:** #21 M0-15, #22 M0-12, #24 QA-2 — all CI green, auto-merged. #16 QA-1 + QA-1a brought up to main
  (append-only conflicts), all gates green locally on a81a5e1, still on `hold` (H-05).
- **Balance after today (main, `balance.mjs 3`):** bulwark 67, magmaw 40, volt 52, warden 60, skyla 14,
  phantom 17, ricochet 55, gravitas 43. With #16 on top: 55/29/45/52/21/31/52/43; balance-gate 2 there has
  Magmaw at 14% (floor 10%).
- **Backlog:** M0-05 unblocked (todo). New task QA-11 (slope-buried spawn pads; renamed from QA-7, which the
  nightly QA run took). Task-id collisions are possible when nightly QA and builder runs overlap.
- **Reviewer notes left:** `test/spawns.mjs` is a CI gate but not in guard.sh's protected list; M0-12's
  `freeSpotFor` still falls back to the raw exit when nothing within 6 fits (separation is the second guard);
  Nimbus power-up point still at the old vent-exit height; Temple Crossing high pad is left-side only;
  `features.mjs` events seen only by chance in the random batch are fragile.
- **Gate times (2 cores, 3 workers in parallel):** determinism 43–66 s, headless 45–87 s, features 277–563 s,
  bughunt 2 54–129 s, balance-gate 2 78–158 s, online 50 s, online-browser 34–152 s, browser 42–64 s.

## 2026-10-16 (early) — builder run (producer)
- **Main at start:** 23732a4; CI green on its PR head (#25), so no main fix needed. No human action on #8 (H-04) or #16 (H-05) since the last run.
- **Attempted:** M0-05 (qa), M0-10 (gameplay). Skipped: M0-14 (planner.js hunk ~272 overlaps held PR #16), M0-09 (depends on
  M0-06, blocked on H-04), QA-1 (PR #16 on hold, H-05). No other M0 task was unblocked.
- **M0-05:** `test/bughunt.mjs` +12/−0 (step-rect skip mirroring `physTerrain`, plus a ramp-face sink check). `bughunt 5` exits 0.
  Reviewer mutation test: bot 0.1 below a ramp face → flagged; 0.05 above → not flagged. `terrain-embed 5` clean.
- **M0-10:** the planner's Chain Arc uses `distSegPoly` + `beamHalfWidth` + `arcRange` like `World.chainArc`. It also fixes a
  raw-vs-scaled score comparison in the same case. Reviewer harness: wrong-aim picks 20/300 → 0/300. `balance.mjs 3` identical
  before/after (1v1 has one enemy). Branch merge-tree is clean against #16.
- **Reviews:** M0-05 APPROVE, M0-10 APPROVE (round 1 each; reviewers re-ran the relevant gates in their own worktrees).
- **PRs:** #26 M0-05, #27 M0-10 — CI green, auto-merged. #16 still merges cleanly onto the new main.
- **Filed:** M0-16 (gameplay): Chain Arc AI ignores teammates on the beam when friendly fire is on (from the M0-10 review).
- **Gate times (2 cores, 2 workers in parallel):** determinism 44–54 s, headless 45–48 s, features 387–393 s, bughunt 2 83–95 s,
  bughunt 5 224 s, balance-gate 2 103–110 s, online 50 s, online-browser 67–83 s, browser 52–53 s.
- **M0 left:** M0-14, M0-16 (both planner.js), QA-1 (#16 hold), M0-06 (#8 hold), M0-09. The two held PRs are the M0 critical path.

## 2026-10-16 (evening) — builder run (producer)
- **Main at start:** 03579bf; CI green on its PR head (#28), so no main fix needed. No human action on #8 (H-04) or #16 (H-05) since the last run.
- **Attempted:** M0-16 (gameplay). Skipped: M0-14 (planner.js ~276 is inside held PR #16's hunk), M0-09 (depends on M0-06,
  blocked on H-04), QA-1 (PR #16 on hold, H-05). No other M0 task was unblocked, so only one worker ran.
- **M0-16:** `BOTS.volt.s1.aiTeammatePenalty: 40` in defs.js; new `World.beamSegment` shared by `World.chainArc` and the
  planner; planner subtracts the penalty per teammate on the beam only with friendly fire on. features.mjs +22/−0.
  Reviewer: 1,200 randomized setups, identical to main in every friendly-fire-off/FFA case; mutation tests fail the new check.
  `balance.mjs 3` identical before/after (1v1). merge-tree with #16 clean.
- **Reviews:** M0-16 APPROVE (round 1; reviewer re-ran every gate in its own worktree).
- **PRs:** #29 M0-16 — CI green, auto-merged.
- **Filed:** M2-06 (gameplay): planner's arc-jump bonus ignores a teammate the arc can jump to (from M0-16 notes).
- **Gate times (2 cores, 1 worker + reviewer):** determinism 51–55 s, headless 46–48 s, features 406–431 s, bughunt 2 86–115 s,
  balance-gate 2 103–106 s, online 49 s, online-browser 91–117 s, browser 50–53 s. CI on #29: ~7 min.
- **M0 left:** M0-14 (needs #16 in first), QA-1 (#16 hold, H-05), M0-06 (#8 hold, H-04), M0-09 (after M0-06). Every remaining
  M0 item now waits on Ganesh's two decisions; next run will idle on M0 unless they land.

## 2026-10-16 (night) — nightly QA (qa)
- **Main:** 18862f3 (run log after M0-16). PR #16 (QA-1 + QA-1a) is still on `hold` (H-05), so main does not carry the Blink fixes.
- **Suites (2 cores, two lanes in parallel, so wall times run ~20% above a solo run):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 189 s |
| rules | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.0 turns) | 956 s |
| bughunt 5 | pass — NO ISSUES FOUND (M0-05 fixed last night's step-rect false positive) | 238 s |
| features | pass (no specials, power-ups or events missing) | 441 s |
| headless 60 | pass (0 errors, 7 draws) | 188 s |
| balance 4 | pass (report) | 227 s |
| online | pass | 50 s |
| online-browser | pass | 130 s |
| browser (static :8123) | pass, no page errors | 48 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 10 s |
| spawns | pass | <1 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | pass (nimbus, 13 turns, 4 clients digest-identical) | 42 s |
| terrain-embed 5 (not in CI) | pass — 1,854 cleanups, no bot embedded | 234 s |
| net-parity 3 (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 40 s |
| turn-count (not in CI) | **FAIL** — 18/18 off by one (known QA-8) | 24 s |
| ai-selfkill 1 (report) | 53 undamaged self-eliminations in 280 hard 1v1s (18.9%, up from 15.4%) — QA-3 | 280 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 344 s |
| lobby-maplist (new, not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 6 s |

  No perf, swarm or ai-usage tests exist in `test/` yet.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.6 turns):**

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 68% | 101 |
| magmaw | 41% | 60 |
| volt | 52% | 112 |
| warden | 59% | 95 |
| skyla | 16% | 56 |
| phantom | 20% | 43 |
| ricochet | 52% | 92 |
| gravitas | 41% | 70 |

  In the 40–60% band: magmaw, volt, warden, ricochet, gravitas (gravitas up from 29%). Headless 60 FFA: Skyla 1/35 (3%),
  Phantom 3/39 (8%), Ricochet 6/37 (16%); Warden 18/38 (47%) leads.
- **Self-elimination rise (QA-3):** Phantom 18 (was 14), Magmaw 9 (was 5), worst phantom@frozenkeel 9. Root cause reproduced
  (`node test/trace.mjs bulwark phantom frozenkeel 5105`): `AIPlanner.plan` drops the scored Blink point `tx`/`ty` when it
  re-noises the aim, so Blink uses the 18-unit aim-line rule and lands in mid-air over the water. Already fixed on held PR #16;
  logged in QA-3, no new task.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-16`, set 1 since last night ran set 2): Volt v Magmaw on
  Ember Pit at 390x844, Bulwark v Phantom+Skyla on Frozen Keel at 1280x720, Ricochet v Gravitas on Canopy Ruins at 390x844,
  Warden in a 6p teams game on Temple Crossing at 1280x720, Skyla in a 4p FFA on Neon Alley at 390x844. All five reached
  results with no page errors. The 390 runs repeat QA-4 (results table clipped), QA-5 (turn label wraps), QA-6 (enemies
  off-screen on Neon Alley) and QA-10 (Nova/Mira and You/Nova tags overlap). The AI Magmaw on Ember Pit died on T5 with
  0 damage taken (QA-3). Evidence: `docs/alpha/qa/2026-10-16/`.
- **Filed:** QA-12 (P2, M1, client-ui): lobby map picker sub-labels 10px, buttons 45px, ragged rows on phones.
  QA-13 (P3, M1, client-ui): local player reads "You (you)" in the roster and results. QA-14 (P3, M1, client-ui): in-world
  "AIR STRIKE" callout has no outline and fades to pale pink on Frozen Keel's sky.
- **New test (additions only, not in CI):** `test/lobby-maplist.mjs` (QA-12; exits 1 on main).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30). Waiting on Ganesh's call on PR #16 (H-05). No CI gate is red on main.

## 2026-10-17 — builder run (producer)
- **Main at start:** 25a8a10; CI green on its PR head (#31), so no main fix needed. No human action on #8 (H-04) or #16 (H-05) since the last run.
- **Attempted:** M0-14 (gameplay). Skipped: QA-1 (PR #16 on hold, H-05), M0-06 (PR #8 on hold, H-04), M0-09 (depends on M0-06).
  No other M0 task was unblocked, so only one worker ran. Previous runs deferred M0-14 behind #16; this run did it with a hard
  constraint that `git merge-tree` against #16's head exits 0 (verified by worker and reviewer).
- **M0-14:** new `AI_POWERUP` block in defs.js (replaces planner literals); `AIPlanner.powerupValue` gives full value on pickup
  at any `turnsLeft`, a small approach value (≤ 5.5) for landings that get closer, and 0 when the power-up expires first.
  features.mjs +16/−0 (`aiPowerupExpiry`). `balance.mjs 3`: bulwark 67→57, gravitas 43→50, magmaw 40→43, rest unchanged.
- **Reviews:** M0-14 APPROVE (round 1; reviewer re-ran every gate in its own worktree). Nits: second defs import line (deliberate,
  avoids #16's import hunk); the approach term is new behaviour (`approachMul: 0` restores the old).
- **PRs:** #32 M0-14 — CI green (~7 min), auto-merged. #16 and #8 still merge cleanly onto the new main.
- **Gate times (2 cores, 1 worker then reviewer):** determinism 38–40 s, headless 45–145 s, features 341–351 s, bughunt 2 69–203 s,
  balance-gate 2 86–228 s, online 50 s, online-browser 26–89 s, browser 46–47 s.
- **M0 left:** QA-1 (#16 hold, H-05), M0-06 (#8 hold, H-04), M0-09 (after M0-06). Every remaining M0 item now waits on Ganesh.
  Unless he acts or allows M1 work to start in parallel, the next builder run has nothing to pick up.

## 2026-10-17 (11:30 UTC) — builder run (producer)
- **Main at start:** 01bf3bb; CI green on its PR head (#33) and Pages deploy green. No main fix needed.
- **Attempted:** nothing. Every open M0 item still waits on Ganesh: QA-1 (PR #16, `hold`, H-05), M0-06 (PR #8, `hold`,
  H-04), M0-09 (depends on M0-06). Neither PR changed since the last run (no label change, no new commits).
  `git merge-tree` against main 01bf3bb: #16 and #8 both still merge cleanly.
- **Not started:** M1 work. producer.md picks only from the earliest open milestone; added decision **D-7** to
  `docs/alpha/HUMAN_QUEUE.md` so Ganesh can allow M1 to run in parallel with one edit.
- **PRs:** this run log only. No gates run (no code changed).

## 2026-10-17 (evening) — builder run (producer)
- **Main at start:** a242130; CI green on its PR head (#34) and Pages deploy green. No main fix needed.
- **Attempted:** nothing. No change since the 11:30 run: PR #16 (QA-1, H-05) and PR #8 (M0-06, H-04) still carry `hold`,
  no new commits or comments; D-7 still "no". `git merge-tree` against a242130: both still merge cleanly.
  M0-09 depends on M0-06. M1 work not started (D-7).
- **PRs:** this run log only. No gates run (no code changed).

## 2026-10-17 (night) — nightly QA (qa)
- **Main:** 36997cd (run log 2026-10-17c). PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`, so main
  does not carry the Blink fixes.
- **Suites (2 cores, two lanes in parallel, so wall times run ~20% above a solo run):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 134 s |
| rules | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 786 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 211 s |
| features | pass (90 matches, 0 errors; no specials, power-ups or events missing) | 356 s |
| headless 60 | pass (0 errors, 4 draws) | 150 s |
| balance 4 | pass (report) | 189 s |
| balance-gate 2 (CI) | pass | 89 s |
| online | pass | 50 s |
| online-browser | pass | 118 s |
| browser (static :8123) | pass, no page errors | 54 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 9 s |
| spawns | pass | <1 s |
| mapid | pass | 2 s |
| online-8p (not in CI) | pass (nimbus, 18 turns, 4 clients digest-identical) | 57 s |
| terrain-embed 5 (not in CI) | pass — 1,906 cleanups, no bot embedded | 196 s |
| net-parity 3 (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 37 s |
| turn-count (not in CI) | **FAIL** — 20/20 off by one (known QA-8) | 21 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (known QA-12) | 3 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, up from 18.9%) — QA-3 | 213 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 211 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):**

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  In the 40–60% band: bulwark (down from 68% after M0-14), magmaw, volt, ricochet, gravitas. Warden 61% just above.
  Skyla 14% and Phantom 16% stay far below; both lead the self-elimination counts (phantom 17, skyla 14 of 58;
  worst phantom@frozenkeel 9). Headless 60 FFA: Skyla 0/35 (0%), Phantom 6/39 (15%); Magmaw 13/36 (36%) leads.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-17`; last night ran set 1): Magmaw v
  Ricochet on Magma Works at 1280x720, Phantom v Warden+Volt on Glacier Fortress at 390x844, Gravitas v Skyla on Cloud
  Steps at 1280x720, Bulwark in a 4p teams game on Nimbus Reach at 390x844, Volt in a 5p FFA on Skyline Grid at 1280x720.
  All five reached results with no page errors. Repeats seen: QA-4 (results table clipped at 390), QA-5 (turn label
  wraps), QA-6 (no enemy on screen at Glacier Fortress T1), QA-8 (results say 4 turns, last death T3), QA-9 (SKIP/FIRE
  unreadable on Cloud Steps and Nimbus), QA-10 (You/Nova tags overlap on Nimbus), QA-12, QA-13 ("You (you)"), and QA-3
  (AI Warden on Skyline Grid died T3 with 0 damage taken). Cloud Steps/Nimbus cloud puffs render as flat outlined circles;
  left to M3-01 (art pass). Evidence: `docs/alpha/qa/2026-10-17/` (screenshots as JPEG, `report.json`).
- **Filed:** QA-15 (P2, M1, client-ui): portrait playback/plan camera leaves ~70% empty sky, bots ~18px tall on Glacier
  Fortress. QA-16 (P3, M1, client-ui): floating damage number drawn over the HP chip hides the HP value. QA-17 (P3, M1,
  client-ui): local player's KO callout reads "You KO".
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16 (H-05).
  No CI gate is red on main and no new crash or desync was found.

## 2026-10-18 — builder run (producer)
- **Main:** 36c1776 (nightly QA 2026-10-17). Fast gates re-run here: determinism 6 pass (41 s), rules pass, spawns pass.
  Nightly QA had every CI gate green on 36997cd; the only change since is docs/evidence.
- **Backlog:** M0 is still the earliest open milestone. Open M0 tasks: M0-06 `blocked` (H-04, PR #8 on `hold`),
  M0-09 `todo` but depends on M0-06, QA-1 `todo` with its fix already on PR #16 (H-05, `hold`). No HUMAN_QUEUE
  item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh (unchanged since 2026-10-15):** H-05 (lift `hold` on #16 and click "Update branch" — fixes the
  P0 online desync), H-04 (`human-approved` on #8), or set D-7 to yes so builders can work the 13 ready M1 tasks.

## 2026-10-18b — builder run (producer)
- **Main:** 3b8c1f5 (run log 2026-10-18). Fast gates re-run here: determinism 6 pass (42 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 have had no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-18c — builder run (producer)
- **Main:** 7853c89 (run log 2026-10-18b). Fast gates re-run here: determinism 6 pass (45 s), rules pass (1 s), spawns pass (<1 s).
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 have had no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-18 (night) — nightly QA (qa)
- **Main:** 7a4ecdd (run log 2026-10-18c). No code change since last night's 36997cd (docs and evidence only), so
  results match 2026-10-17 almost exactly. PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`.
- **Suites (2 cores, two lanes in parallel):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 129 s |
| rules | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 732 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 204 s |
| features | pass (90 matches; no specials, power-ups or events missing) | 342 s |
| headless 60 | pass (0 errors, 4 draws, avg 9.5 turns) | 141 s |
| balance 4 | pass (report) | 172 s |
| balance-gate 2 (CI) | pass | 92 s |
| online | pass | 50 s |
| online-browser | pass | 115 s |
| browser (static :8123) | pass, no page errors | 62 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 9 s |
| spawns | pass | <1 s |
| mapid | pass | 2 s |
| online-8p (not in CI) | pass (nimbus, 15 turns, 4 clients digest-identical) | 48 s |
| terrain-embed 5 (not in CI) | pass — 1,906 cleanups, no bot embedded | 199 s |
| net-parity 3 (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 34 s |
| turn-count (not in CI) | **FAIL** — 20/20 elimination wins and (new check) 19/19 turn-cap wins off by one (QA-8) | 21 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (known QA-12) | 4 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 209 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 340 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-18`, set 1): Volt v Magmaw on Ember Pit at
  390x844, Bulwark v Phantom+Skyla on Frozen Keel at 1280x720, Ricochet v Gravitas on Canopy Ruins at 390x844, Warden
  in a 6p teams game on Temple Crossing at 1280x720, Skyla in a 4p FFA on Neon Alley at 390x844. All five reached
  results, no page errors. Repeats: QA-3 (AI Magmaw on Ember Pit died T4 with 0 taken; teammates Juno/Magmaw and
  Mira/Phantom both died T1 with 0 taken on Temple Crossing), QA-4 (results table clipped at 390, 3/3 phone matches),
  QA-5 (turn label wraps at 390, every turn), QA-6 (Ember Pit T1 phone: no enemy on screen), QA-7 (roster over the
  right ice ledge on Frozen Keel), QA-8 (Frozen Keel ended "21 turns · turn cap" with a 20-turn cap), QA-13
  ("You (you)"), QA-15 (Canopy Ruins portrait playback ~60% empty sky). Evidence: `docs/alpha/qa/2026-10-18/`.
- **Filed:** QA-18 (P3, M1, client-ui): floating combat text and the struck bot clipped at the viewport edge during
  playback ("Frie…" for a `Friendly` label on Temple Crossing). **Test added:** turn-cap half of the QA-8 invariant in
  `test/turn-count.mjs` (additions only); QA-8 Log updated.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16 (H-05).
  No CI gate is red on main and no new crash or desync was found.

## 2026-10-19 — builder run (producer)
- **Main:** 2099486 (nightly QA 2026-10-18). Fast gates re-run here: determinism 6 pass (37 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 have had no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-19b — builder run (producer)
- **Main:** 93e319a (run log 2026-10-19). Fast gates re-run here: determinism 6 pass (53 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 still have no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-19c — builder run (producer)
- **Main:** 9e02cdb (run log 2026-10-19b). Fast gates re-run here: determinism 6 pass (42 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 still have no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-19 (night) — nightly QA (qa)
- **Main:** deaafb4 (run log 2026-10-19c). No code change since last night's 7a4ecdd (run logs only), so suite
  results match 2026-10-18. PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`.
- **Suites (2 cores, two lanes in parallel, so wall times run above a solo run):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 196 s |
| rules | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1217 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 301 s |
| features | pass (no specials, power-ups or events missing) | 549 s |
| headless 60 | pass (0 errors, 4 draws, avg 9.5 turns) | 225 s |
| balance 4 | pass (report) | 278 s |
| balance-gate 2 (CI) | pass | 137 s |
| online | pass | 50 s |
| online-browser | pass | 142 s |
| browser (static :8123) | pass, no page errors | 61 s |
| online-maps | pass | 5 s |
| online-settings-layout | pass | 9 s |
| spawns | pass | <1 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 7 turns; all 4 clients diverge from the server digest from turn 5 (QA-1; passed last night on a luckier AI roster) | 25 s |
| terrain-embed (not in CI) | pass — 30 eight-bot matches, 1,104 cleanups, no bot embedded | 209 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 53 s |
| turn-count (not in CI) | **FAIL** — elimination and 19/19 turn-cap wins off by one (QA-8) | 37 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 343 s |
| trace (smoke) | pass | 2 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 256 s |
| callout-fit (new, not in CI) | **FAIL** — 96/96 special callouts overflow their pill, 64 off-canvas at the edges (QA-19) | 3 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-19`, set 2): Magmaw v Ricochet on
  Magma Works at 1280x720, Phantom v Warden+Volt on Glacier Fortress at 390x844, Gravitas v Skyla on Cloud Steps at
  1280x720, Bulwark in a 4p teams game on Nimbus Reach at 390x844, Volt in a 5p FFA on Skyline Grid at 1280x720. All
  five reached results, no page errors. Repeats: QA-4 (results table clipped at 390, 2/2 phone matches), QA-5 (turn
  label wraps at 390), QA-6 (Glacier Fortress T1 phone: no enemy on screen), QA-8 (Cloud Steps: Skyla died T6, result
  says "7 turns"), QA-9 (FIRE/SKIP nearly invisible on Cloud Steps and Nimbus), QA-10 (Nova's tag over the player's
  HP bar on Magma Works T6), QA-13 ("You (you)"), QA-15 (Nimbus portrait playback ~60% empty sky), QA-18 (Kilo's tag
  cut at the right edge on Nimbus T5). Checked and not a bug: Volt crossing Skyline Grid edge-to-edge in one turn is the
  map's teleporting edges (`teleporters: true`); a headless scan shows 10% of bot-turns there move >20 units, all wraps.
  Evidence: `docs/alpha/qa/2026-10-19/` (JPEG).
- **Filed:** QA-19 (P2, M1, client-ui): special-move callout name text overflows its pill and is cut at the screen
  edge ("STATIC FI…" on Glacier Fortress). **Test added:** `test/callout-fit.mjs` (new file, drives the real
  `drawCallouts`). QA-1 Log updated with tonight's online-8p failure.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p red tonight), unchanged; waiting on
  Ganesh's call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-20 — builder run (producer)
- **Main:** ea2c494 (nightly QA 2026-10-19). Fast gates re-run here: determinism 6 pass (55 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix sits on PR #16 (H-05, `hold`). PRs #8 and #16 have had no activity since 2026-10-15.
  No HUMAN_QUEUE item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the 15 ready M1/QA client-ui tasks.

## 2026-10-20b — builder run (producer)
- **Main:** 84d03ff (run log 2026-10-20). Fast gates re-run here: determinism 6 pass (71 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09 depends
  on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. No HUMAN_QUEUE item is
  marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the 15 ready M1/QA client-ui tasks.

## 2026-10-20c — builder run (producer)
- **Main:** 145c93f (run log 2026-10-20b). Fast gates re-run here: determinism 6 pass (48 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09 depends
  on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. No HUMAN_QUEUE item is
  marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the 15 ready M1/QA client-ui tasks.

## 2026-10-20 (night) — nightly QA (qa)
- **Main:** 8d68a46 (run log 2026-10-20c). No code change since the last nightly's ea2c494 (run logs only), so suite
  results match 2026-10-19. PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`, no activity since 10-15.
- **Suites (2 cores, two lanes in parallel, so wall times run above a solo run):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 172 s |
| rules | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 961 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 263 s |
| features | pass (no specials, power-ups or events missing) | 449 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death) | 212 s |
| balance 4 | pass (report) | 221 s |
| balance-gate 2 (CI) | pass | 108 s |
| online | pass | 50 s |
| online-browser | pass | 100 s |
| browser (static :8123) | pass, no page errors | 59 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 10 s |
| spawns | pass | <1 s |
| mapid | pass | 2 s |
| online-8p (not in CI) | pass — Nimbus, 7 turns, all 4 clients digest-identical (roster-dependent; failed last night, QA-1 still open) | 24 s |
| terrain-embed (not in CI) | pass — 30 eight-bot matches, 1,104 cleanups, no bot embedded | 160 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 44 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 31 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 267 s |
| trace (smoke) | pass | 1 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 292 s |
| fx-occlusion (new, not in CI) | **FAIL** — toxic cloud hides 86% of a bot at 0.3 s, 75% at 0.6 s (QA-20); 6 other effects ok | 5 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-20`, set 1): Volt v Magmaw on Ember Pit at
  390x844, Bulwark v Phantom+Skyla on Frozen Keel at 1280x720, Ricochet v Gravitas on Canopy Ruins at 390x844, Warden in
  a 6p teams game on Temple Crossing at 1280x720, Skyla in a 4p FFA on Neon Alley at 390x844. All five reached results,
  no page errors. Repeats: QA-4 (results table clipped at 390, 3/3 phone matches), QA-5 (turn label wraps at 390, every
  phone turn), QA-7 (roster panel covers the health power-up at Frozen Keel's top-right, T6), QA-13 ("You (you)"),
  QA-14 (hazard label low contrast on Temple Crossing), QA-15 (Ember Pit and Canopy Ruins portrait cleanup: map in the
  bottom ~35%, rest empty sky). Checked and not a bug: the tall 3-segment blue bar beside Nova on Frozen Keel T5 is
  Bulwark's Bastion Wall (the script cast it). Noted, no task: grey square debris particles hang in the air and over
  the water on Frozen Keel T6 — procedural stand-ins until the VFX sheets arrive (art queue).
  Evidence: `docs/alpha/qa/2026-10-20/` (JPEG).
- **Filed:** QA-20 (P2, M1, client-ui): Toxic Bomb's procedural cloud draws opaque lime squares over the bot inside it,
  hiding the bot, its name tag and HP chip for ~1 s (Temple Crossing T2). **Test added:** `test/fx-occlusion.mjs` (new
  file, drives the real `handleEvent`/`emit`).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16
  (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-21 — builder run (producer)
- **Main:** dc404bd (nightly QA 2026-10-20). Fast gates re-run here: determinism 6 pass (40 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. No HUMAN_QUEUE
  item is marked DONE and D-7 is still "no", so no M1 task was started (QA-20 is now a 16th ready M1/QA task).
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-21b — builder run (producer)
- **Main:** fb42abb (run log 2026-10-21). Fast gates re-run here: determinism 6 pass (40 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. No HUMAN_QUEUE
  item is marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-21c — builder run (producer)
- **Main:** 6baa9eb (run log 2026-10-21b). Fast gates re-run here: determinism 6 pass (42 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. HUMAN_QUEUE
  unchanged since 2026-10-17: no item marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-21 (night) — nightly QA (qa)
- **Main:** b4b1cd2 (run log 2026-10-21c). No code change since the last nightly's dc404bd (run logs only), so every
  seeded suite matches 2026-10-20. PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 136 s |
| rules | pass | <1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 881 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 214 s |
| features | pass (no specials, power-ups or events missing) | 396 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death, avg 9.5 turns) | 178 s |
| balance 4 | pass (report) | 188 s |
| balance-gate 2 (CI) | pass | 95 s |
| online | pass | 50 s |
| online-browser | pass | 94 s |
| online-maps | pass | 3 s |
| online-settings-layout | pass | 9 s |
| browser (static :8123) | pass, no page errors | 44 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | pass — Nimbus, 10 turns, all 4 clients digest-identical | 33 s |
| terrain-embed (not in CI) | pass — 30 eight-bot matches, 1,104 cleanups, no bot embedded | 149 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 36 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 30 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 2 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 1 s |
| fx-occlusion (not in CI) | **FAIL** — toxic cloud hides the bot (QA-20) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 235 s |
| label-tag-overlap (new, not in CI) | **FAIL** — 10/10 bot labels cover the bot's own name/HP chip (QA-21, QA-16) | 2 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 193 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-21`, set 2): Magmaw v Ricochet on
  Magma Works at 1280x720, Phantom v Warden+Volt on Glacier Fortress at 390x844, Gravitas v Skyla on Cloud Steps at
  1280x720, Bulwark in a 4p teams game on Nimbus Reach at 390x844, Volt in a 5p FFA on Skyline Grid at 1280x720. All
  five reached results, no page errors. Repeats: QA-4 (results table clipped at 390, both phone matches), QA-5 (turn
  label wraps at 390, every phone turn), QA-7 (roster panel covers the top-right of Cloud Steps), QA-9 (SKIP/FIRE
  washed out on Cloud Steps and Nimbus), QA-13 ("You (you)"), QA-3 (Volt on Glacier Fortress and Gravitas on Skyline
  Grid die with 0 damage dealt and 0 taken). Evidence: `docs/alpha/qa/2026-10-21/` (JPEG).
- **Filed:** QA-21 (P3, M1, client-ui): pickup/contact/effect labels spawn on the bot's own name tag, so the name
  reads "Frost" (Magma Works T2 and Skyline Grid T2). **Test added:** `test/label-tag-overlap.mjs` (new file, drives
  the real `handleEvent`; also covers QA-16, log line added there).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16
  (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-22 — builder run (producer)
- **Main:** 6e00e01 (nightly QA 2026-10-21). Fast gates re-run here: determinism 6 pass (40 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. HUMAN_QUEUE
  unchanged: no item marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-22b — builder run (producer)
- **Main:** 0383b1d (run log 2026-10-22). Fast gates re-run here: determinism 6 pass (44 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR has had activity since 2026-10-15. HUMAN_QUEUE
  unchanged: no item marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-22c — builder run (producer)
- **Main:** 0be8363 (run log 2026-10-22b). Fast gates re-run here: determinism 6 pass (38 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). #8 last updated 2026-10-14, #16 2026-10-15. HUMAN_QUEUE
  unchanged: no item marked DONE and D-7 is still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-22 (night) — nightly QA (qa)
- **Main:** 1a83620 (run log 2026-10-22c). No code change since the last nightly's 6e00e01 (run logs only), so every
  seeded suite matches 2026-10-21. PR #16 (QA-1 Blink desync fix) and PR #8 (M0-06) still on `hold`.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 124 s |
| rules | pass | <1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 729 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 202 s |
| features | pass (no specials, power-ups or events missing) | 343 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death, avg 9.5 turns) | 144 s |
| balance 4 | pass (report) | 172 s |
| balance-gate 2 (CI) | pass | 84 s |
| online | pass | 49 s |
| online-browser | pass | 80 s |
| online-maps | pass | 3 s |
| online-settings-layout | pass | 7 s |
| browser (static :8123) | pass, no page errors | 49 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | pass — Nimbus, 30 turns, all 4 clients digest-identical | 88 s |
| terrain-embed (not in CI) | pass — 30 eight-bot matches, 1,104 cleanups, no bot embedded | 128 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 34 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 23 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 2 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 1 s |
| fx-occlusion (not in CI) | **FAIL** — toxic cloud hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 bot labels cover the bot's own name/HP chip (QA-21, QA-16) | 2 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 213 s |
| nameplate-edge (new, not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844, 0 at 1280x720 (QA-22) | 2 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 326 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-22`, set 1): Volt v Magmaw on Ember Pit
  at 390x844, Bulwark v Phantom+Skyla on Frozen Keel at 1280x720 (turn-cap win), Ricochet v Gravitas on Canopy Ruins
  at 390x844 (turn cap), Warden in a 6p teams game on Temple Crossing at 1280x720, Skyla in a 4p FFA on Neon Alley
  at 390x844. All five reached results, no page errors. Repeats: QA-4 (results table clipped at 390, Neon Alley),
  QA-5 (turn label wraps at 390, every phone turn), QA-8 (results say 21 turns for a 20-turn cap), QA-13
  ("You (you)"), QA-14 (Air Strike label low-contrast on Ember Pit and Canopy Ruins), QA-15 (portrait playback
  frames the whole map), QA-21 ("Amp" label on Mira's tag, Temple Crossing T2), QA-3 (Temple Crossing ended in a
  SHARED WIN — the spec'd simultaneous wipe — after four bots on both teams died on T5, two of them having taken
  0–15 damage, i.e. falls; Juno/Magmaw fell on T1 with 0 dealt/taken, Kilo/Skyla on T1 in a re-run). A re-run of
  Temple Crossing with an `eliminated`-event hook ended differently (the match seed is `Date.now()`), so the wipe
  is not reproducible from the script; logged as QA-3 evidence, no new task. Evidence: `docs/alpha/qa/2026-10-22/`
  (JPEG).
- **Filed:** QA-22 (P3, M1, client-ui): the portrait plan camera cuts nameplates at the screen edge, your own HP chip
  included (Canopy Ruins T5 "120" cut at x=0; Ember Pit T5 "No…"). **Test added:** `test/nameplate-edge.mjs` (new
  file; real `fitForPlan`/`toScreen` plus `drawBots`' nameplate formulas over every map's pads).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16
  (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-23 — builder run (producer)
- **Main:** 9068421 (nightly QA 2026-10-22). Fast gates re-run here: determinism 6 pass (29 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 is still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`), M0-09
  depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`). #8 last updated 2026-10-14, #16 2026-10-15. HUMAN_QUEUE
  unchanged: no item marked DONE and D-7 is still "no", so no M1 task was started (QA-22 joins the ready M1 queue).
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"; fixes the P0 online desync), H-04
  (`human-approved` on #8), or D-7 → yes to let builders work the ready M1/QA client-ui tasks.

## 2026-10-23b — builder run (producer)
- **Main:** 67ed557 (run log 2026-10-23). Fast gates re-run here: determinism 6 pass (29 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`, last
  updated 2026-10-14), M0-09 depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`, last updated 2026-10-15).
  HUMAN_QUEUE unchanged: no item marked DONE, D-7 still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"), H-04 (`human-approved` on #8), or D-7 → yes.

## 2026-10-23c — builder run (producer)
- **Main:** bb246b1 (run log 2026-10-23b). Fast gates re-run here: determinism 6 pass (29 s), rules pass, spawns pass.
- **Backlog:** unchanged. M0 still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`, last
  updated 2026-10-14), M0-09 depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`, last updated 2026-10-15).
  HUMAN_QUEUE unchanged: no item marked DONE, D-7 still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"), H-04 (`human-approved` on #8), or D-7 → yes.

## 2026-10-23 (night) — nightly QA (qa)
- **Main:** 35e681b (run log 2026-10-23c). No code change since the last nightly's 1a83620 (run logs only), so every
  seeded suite matches 2026-10-22. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`. Chromium 1243.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 98 s |
| rules | pass | 1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 590 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 158 s |
| features | pass (no specials, power-ups or events missing) | 270 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death) | 113 s |
| balance 4 | pass (report) | 136 s |
| balance-gate 2 (CI) | pass | 67 s |
| online | pass | 49 s |
| online-browser | pass | 62 s |
| online-maps | pass | 3 s |
| online-settings-layout | pass | 7 s |
| browser (static :8123) | pass, no page errors | 46 s |
| mapid | pass | <1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 16 turns, all 4 clients diverge from the server digest at T7 (QA-1; passed last night, random AI roster) | 49 s |
| terrain-embed (not in CI) | pass — 30 eight-bot matches, 1,104 cleanups, no bot embedded | 105 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 26 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 17 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 2 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — toxic cloud hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 1 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 169 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 185 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-23`): Magmaw v Ricochet on
  Magma Works at 1280x720, Phantom v Warden+Volt on Glacier Fortress at 390x844, Gravitas v Skyla on Cloud Steps at
  1280x720, Bulwark in a 4p teams game on Nimbus Reach at 390x844, Volt in a 5p FFA on Skyline Grid at 1280x720.
  All five reached results, no page errors. Repeats: QA-4 (results table clipped at 390, Glacier Fortress and
  Nimbus), QA-5 (turn label wraps on every phone turn), QA-9 (SKIP / disabled FIRE unreadable on Cloud Steps and
  Nimbus), QA-13 ("You (you)"), QA-15 (portrait playback frames the whole map, Glacier Fortress T5), QA-16 ("-25"
  over your own HP chip, Skyline Grid T6 and Cloud Steps T6), QA-19 ("STATIC FIELD" pill over Volt at the right edge,
  Glacier Fortress T5), QA-21 ("Toxin" on your tag, Magma Works T2), QA-12 (ragged map rows in the phone lobby),
  QA-3 (Skyline Grid: Juno/Warden died with 0 damage taken, i.e. a fall). Evidence: `docs/alpha/qa/2026-10-23/` (JPEG).
- **Filed:** QA-23 (P3, M1, client-ui): the results table has no solid backing, so on sky maps the animated birds and
  islands scroll through the stat rows (`m4-nimbus-390x844-result.jpg`). QA-1 log updated with tonight's online-8p failure.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p failed tonight), unchanged; waiting on
  Ganesh's call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-24 — builder run (producer)
- **Main:** ec11524 (nightly QA 2026-10-23). Every CLAUDE.md gate re-run here, all pass: determinism 6 (40 s),
  rules (1 s), spawns (<1 s), headless 20 (48 s), features (371 s), bughunt 2 (75 s), balance-gate 2 (91 s),
  online (49 s), online-browser (91 s), online-maps (3 s), online-settings-layout (8 s), browser :8123 (48 s).
  Chromium is now at `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` (the `chrome-linux/` path in CLAUDE.md
  no longer exists; use `require('playwright').chromium.executablePath()`).
- **Backlog:** unchanged. M0 still the earliest open milestone: M0-06 `blocked` (H-04, PR #8 on `hold`, last
  updated 2026-10-14), M0-09 depends on M0-06, QA-1 fix on PR #16 (H-05, `hold`, last updated 2026-10-15).
  HUMAN_QUEUE unchanged: no item marked DONE, D-7 still "no", so no M1 task was started.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch"), H-04 (`human-approved` on #8), or D-7 → yes.

## 2026-10-24b — builder run (producer)
- **Main:** 7663176 (run log only; code identical to ec11524, where every gate passed earlier today).
  Re-ran here: determinism 6 (61 s), rules, spawns — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-24c — builder run (producer)
- **Main:** 81313cd (run log only; code identical to ec11524, where every gate passed earlier today).
  Re-ran here: determinism 6 (66 s), rules (1 s), spawns (<1 s) — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-24 (night) — nightly QA (qa)
- **Main:** 068a8b9 (run log 2026-10-24c). No code change since the last nightly's 35e681b (run logs only), so every
  seeded suite matches 2026-10-23. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`. Chromium 1243
  (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). This container is ~1.5x slower than last night's.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 134 s |
| rules | pass | 1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 909 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 253 s |
| features | pass (no specials, power-ups or events missing) | 419 s |
| headless 60 | pass (0 errors) | 168 s |
| balance 4 | pass (report) | 202 s |
| balance-gate 2 (CI) | pass | 93 s |
| online | pass | 50 s |
| online-browser | pass | 106 s |
| online-maps | pass | 5 s |
| online-settings-layout | pass | 9 s |
| browser (static :8123) | pass, no page errors | 51 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 9 turns, all 4 clients diverge from the server digest at T4 (QA-1) | 41 s |
| terrain-embed (not in CI) | pass — no bot embedded | 152 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 36 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 26 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 227 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 255 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-24`, set 1): Volt v Magmaw on Ember Pit at
  390x844, Bulwark v Phantom+Skyla on Frozen Keel at 1280x720, Ricochet v Gravitas on Canopy Ruins at 390x844, Warden
  in a 6p teams game on Temple Crossing at 1280x720, Skyla in a 4p FFA on Neon Alley at 390x844. All five reached
  results, no page errors. Repeats only: QA-4 (results table cut at 390 on all three phone runs), QA-5 (turn label
  wraps on every phone turn), QA-8 (Ember Pit "9 turns", player died T8 of 8 played), QA-13 ("You (you)"), QA-15
  (portrait playback frames bots ~18px tall, Neon Alley T6), QA-16 ("-10" over your tag, Frozen Keel T6), QA-17
  ("You KO", Temple Crossing T2), QA-18 (Temple Crossing T2: a bot at x<0 with its nameplate cut at 1280x720),
  QA-10/QA-21 (Ember Pit T6: Nova stands on you, its body and "TOXIN!" hide your nameplate), QA-23 (graveyard
  skull shows through the results rows, Temple Crossing), QA-3 (Temple Crossing: Nova/Volt died T4 with 0 damage
  taken, i.e. a fall). Evidence: `docs/alpha/qa/2026-10-24/` (JPEG).
- **Filed:** nothing new; QA-1 log updated with tonight's online-8p failure.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p failed), unchanged; waiting on Ganesh's
  call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-25 — builder run (producer)
- **Main:** 78a9329 (nightly QA log only; code identical to ec11524). Re-ran here: determinism 6 (36 s), rules (1 s),
  spawns (<1 s) — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-25b — builder run (producer)
- **Main:** 1a5468f (run log only; code identical to ec11524). Re-ran here: determinism 6 (44 s), rules (1 s),
  spawns (<1 s) — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-25c — builder run (producer)
- **Main:** cf9d1cb (run log only; code identical to ec11524). Re-ran here: determinism 6 (27 s), rules (<1 s),
  spawns (<1 s) — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-25 (night) — nightly QA (qa)
- **Main:** 08b537b (run log 2026-10-25c). No code change since ec11524 (run logs only), so every seeded suite matches
  2026-10-24. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`. Chromium 1243
  (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). Container ~1.3x slower than last night's.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 200 s |
| rules | pass | 1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1201 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 321 s |
| features | pass (no specials, power-ups or events missing) | 568 s |
| headless 60 | pass (0 errors, 4 draws) | 228 s |
| balance 4 | pass (report) | 292 s |
| balance-gate 2 (CI) | pass | 145 s |
| online | pass | 49 s |
| online-browser | pass | 39 s |
| online-maps | pass | 5 s |
| online-settings-layout | pass | 9 s |
| browser (static :8123) | pass, no page errors | 54 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 30 turns, all 4 clients diverge from the server digest at T4 (QA-1) | 244 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 209 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 51 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 36 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 2 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 1 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 2 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 352 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 284 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-25`, set 2): Magmaw v Ricochet on
  Magma Works at 1280x720, Phantom v Warden+Volt on Glacier Fortress at 390x844, Gravitas v Skyla on Cloud Steps at
  1280x720, Bulwark in a 4p teams game on Nimbus Reach at 390x844, Volt in a 5p FFA on Skyline Grid at 1280x720. All
  five reached results, no page errors. New: QA-24 (Skyline Grid: you died T9, Nova and Mira double-KO on T11, and
  your results headline reads "SHARED WIN" in red). Repeats: QA-4 (results table cut at 390, Glacier Fortress and
  Nimbus), QA-5 (turn label wraps on every phone turn), QA-6 (Glacier Fortress T1 plan shows only you), QA-8 (Magma
  Works "8 turns" with 7 played; Skyline Grid "12 turns", last KO T11), QA-9 (SKIP near-invisible on Nimbus and Cloud
  Steps), QA-13 ("You (you)"), QA-15 (Nimbus portrait playback, bots ~18px tall), QA-19 ("CHAIN ARC" cut at the right
  edge, Glacier Fortress T5), QA-21 ("Shockwire" over your nameplate, Skyline Grid T6), QA-22 (Nimbus T2/T6: your and
  Juno's nameplates cut at the screen edge), QA-23 (Nimbus results: birds through the table), QA-3 (Glacier Fortress:
  Phantom died T1 with 30 damage taken). Evidence: `docs/alpha/qa/2026-10-25/` (JPEG).
- **Filed:** QA-24 (P3, client-ui). QA-1 log updated with tonight's online-8p failure.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p failed), unchanged; waiting on Ganesh's
  call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-26 — builder run (producer)
- **Main:** 15a9edc (nightly QA docs only since 08b537b; code identical to ec11524). Re-ran here: determinism 6,
  rules, spawns — all pass (59 s total). Nightly QA 2026-10-25 had every CI gate green.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`), M0-09 depends on M0-06, QA-1 fix on PR #16
  (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item marked DONE, D-7 still "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or set D-7 → yes so builders can start M1/QA client-ui tasks in parallel.

## 2026-10-26b — builder run (producer)
- **Main:** 388671f (run-log only since 15a9edc; code identical to ec11524). Re-ran here: determinism 6, rules,
  spawns — all pass.
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE, D-7 "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold`), H-04 (`human-approved` on #8), or D-7 → yes.

## 2026-10-26c — builder run (producer)
- **Main:** 48f0bb0 (run-log only since 15a9edc; code identical to ec11524). Re-ran here: determinism 6, rules,
  spawns — all pass (39 s).
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE, D-7 "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes.

## 2026-10-26 (night) — nightly QA (qa)
- **Main:** edeeb0f (run log 2026-10-26c). No code change since ec11524 (docs only), so every seeded suite matches
  2026-10-25. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`. Chromium 1243
  (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). Container ~2x faster than last night's.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 101 s |
| rules | pass | <1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 607 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 166 s |
| features | pass (no specials, power-ups or events missing) | 283 s |
| headless 60 | pass (0 errors, 4 draws, avg 9.5 turns) | 124 s |
| balance 4 | pass (report) | 146 s |
| balance-gate 2 (CI) | pass | 71 s |
| online | pass | 49 s |
| online-browser | pass | 82 s |
| online-maps | pass | 3 s |
| online-settings-layout | pass | 8 s |
| browser (static :8123) | pass, no page errors | 47 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 12 turns, all 4 clients diverge from the server digest at T4 (QA-1) | 96 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 111 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 29 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 19 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 2 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 1 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 179 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 313 s |
| qa-playthrough (new set 3) | 5/5 reached results, 0 page errors | 340 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs.** Set 1 (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-26`): Volt v Magmaw on Ember Pit
  390x844, Bulwark v Phantom+Skyla on Frozen Keel 1280x720, Ricochet v Gravitas on Canopy Ruins 390x844, Warden in a
  6p teams game on Temple Crossing 1280x720, Skyla in a 4p FFA on Neon Alley 390x844. Because the code has not changed
  since ec11524, I added **set 3** to `test/qa-playthrough.mjs` (additions only, `QA_SET=3`) with pairings neither set
  covers: Skyla v Phantom on Canopy Ruins 1280x720, Gravitas v Volt+Warden on Skyline Grid 390x844, Ricochet in a 4p
  teams game on Glacier Fortress 1280x720, Magmaw v Bulwark on Cloud Steps 390x844, Phantom in a 6p FFA on Magma Works
  1280x720. All ten reached results with no page errors. New: **QA-25** (explosion smoke drawn as hard grey squares
  floating in the air; Magma Works T5, Frozen Keel T6). Repeats: QA-3 (Skyla died T2 untouched on Frozen Keel; Skyla T1 and Magmaw
  T4 on Temple Crossing; Volt T7 on Skyline Grid; Ricochet T2 on Magma Works), QA-4 (results table cut on all five
  phone matches), QA-5 (turn label wraps every phone turn), QA-6 (T1 plan shows only you: Canopy Ruins, Skyline Grid,
  Cloud Steps), QA-7 (Glacier Fortress T7: Skyla's Updraft callout and nameplate under the roster and sound button),
  QA-8 (Frozen Keel "21 turns · turn cap" with cap 20), QA-9 (FIRE/SKIP near-invisible on Cloud Steps), QA-10 (Nova
  over Kilo on Magma Works T2), QA-13 ("You (you)"), QA-15 (phone bots ~18px), QA-19/QA-21 ("UPDRAFT" past its pill,
  over Ozzy's name), QA-20 (lime toxic squares over You on Canopy Ruins T2 and Temple Crossing T2), QA-22 (Ember Pit T5,
  Neon Alley T1 tags cut at the right edge), QA-23 (pickups/terrain through the results table). Evidence:
  `docs/alpha/qa/2026-10-26/` and `docs/alpha/qa/2026-10-26/set3/` (JPEG).
- **Filed:** QA-25 (P3, client-ui). QA-1 log updated with tonight's online-8p failure.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p failed), unchanged; waiting on Ganesh's
  call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-27 — builder run (producer)
- **Main:** 713abde (nightly QA 2026-10-26). Only change since ec11524 under `src/ server/ test/` is the
  qa-playthrough set 3 addition (8 lines). Re-ran here: determinism 6, rules, spawns — all pass (28 s).
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE, D-7 "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes.

## 2026-10-27b — builder run (producer)
- **Main:** addf599 (run log 2026-10-27). No change under `src/ server/ test/` since 713abde. Re-ran here:
  determinism 6, rules, spawns — all pass (30 s).
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE, D-7 "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes.

## 2026-10-27c — builder run (producer)
- **Main:** f4c1ed8 (run log 2026-10-27b). No change under `src/ server/ test/` since 713abde. Re-ran here:
  determinism 6, rules, spawns — all pass (38 s).
- **Backlog:** unchanged. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE, D-7 "no".
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes.

## 2026-10-27 (night) — nightly QA (qa)
- **Main:** e8a5813 (run log 2026-10-27c). No code change under `src/ server/` since ec11524 (last test change: the
  qa-playthrough set 3 addition), so every seeded suite matches 2026-10-26. PR #16 (QA-1 fix) and PR #8 (M0-06) still
  on `hold`. Chromium 1243 (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). Container ~2x slower than last
  night's (same results, longer walls).
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 209 s |
| rules | pass | 1 s |
| spawns | pass | <1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1281 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 328 s |
| features | pass (90 matches, 0 errors; no specials, power-ups or events missing) | 588 s |
| headless 60 | pass (0 errors, 4 draws, avg 9.5 turns) | 258 s |
| balance 4 | pass (report) | 298 s |
| balance-gate 2 (CI) | pass | 142 s |
| online | pass | 50 s |
| online-browser | pass | 111 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 10 s |
| browser (static :8123) | pass, no page errors | 59 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 17 turns, all 4 clients diverge from the server digest at T4 (QA-1) | 137 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 222 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 54 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 38 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 2 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 1 s |
| callout-nameplate (new, not in CI) | **FAIL** — 32/32 special callouts cover the caster's nameplate (QA-26) | 2 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 367 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 259 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-27`): Magmaw v Ricochet on Magma
  Works 1280x720, Phantom v Warden+Volt on Glacier Fortress 390x844, Gravitas v Skyla on Cloud Steps 1280x720, Bulwark
  in a 4p teams game on Nimbus Reach 390x844, Volt in a 5p FFA on Skyline Grid 1280x720. All five reached results with
  no page errors. New: **QA-26** (special callout pill pops on the caster's own name tag and fades into a blank grey
  tile on bright maps: Nimbus T6 over Kilo, Glacier Fortress T6 over Juno); added `test/callout-nameplate.mjs`
  (new file, 32/32 fail on main). Repeats: QA-3 (Juno/Volt fell T6 untouched on Glacier Fortress; Juno/Phantom died T2
  untouched on Nimbus; Kilo/Skyla out T1 on Skyline Grid), QA-4 (results table cut on both phone matches), QA-5 (turn
  label wraps every phone turn), QA-6 (T1 plan shows only you on Glacier Fortress), QA-9 (FIRE/SKIP near-invisible on
  Cloud Steps), QA-10 (You and Kilo nameplates stacked on Nimbus T5), QA-13 ("You (you)"), QA-25 (grey smoke squares on
  Cloud Steps T6 and Nimbus T6). Evidence: `docs/alpha/qa/2026-10-27/` (JPEG).
- **Filed:** QA-26 (P2, client-ui). QA-1 log updated with tonight's online-8p and net-parity failures.
- **P0 still open on main:** QA-1 online desync (net-parity 14/30, online-8p failed), unchanged; waiting on Ganesh's
  call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-28 — builder run (producer)
- **Main:** ca295f7 (QA nightly 2026-10-27). Only tests/docs changed since the last builder run (new
  `test/callout-nameplate.mjs`, QA-26). Re-ran here: determinism 6, rules, spawns — all pass (~65 s).
- **Backlog:** M0 still open. M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on M0-06,
  QA-1 fix on PR #16 (H-05, `hold`); QA-2 done. Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes (lets builders start the 25 parked M1/QA tasks).

## 2026-10-28b — builder run (producer)
- **Main:** 74a5c22 (run log 2026-10-28). No code change since the last builder run. Re-ran here: determinism 6,
  rules, spawns — all pass (68 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-28c — builder run (producer)
- **Main:** 18efc5d (run log 2026-10-28b). Only RUNLOG.md changed since the last builder run. Re-ran here:
  determinism 6, rules, spawns — all pass (41 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (merge #16 or remove `hold` + "Update branch"), H-04 (`human-approved` on #8),
  or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-28 (night) — nightly QA (qa)
- **Main:** d82628c (run log 2026-10-28c). No code change under `src/ server/` since ec11524 (last test change: the
  new `test/callout-nameplate.mjs`), so every seeded suite matches 2026-10-27. PR #16 (QA-1 fix) and PR #8 (M0-06)
  still on `hold`. Chromium 1243 (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). Container speed about
  the same as last night's.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 221 s |
| rules | pass | 1 s |
| spawns | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1398 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 381 s |
| features | pass (90 matches, 0 errors; no specials, power-ups or events missing) | 622 s |
| headless 60 | pass (0 errors, 4 draws, avg 9.5 turns) | 271 s |
| balance 4 | pass (report) | 324 s |
| balance-gate 2 (CI) | pass | 163 s |
| online | pass | 50 s |
| online-browser | pass | 124 s |
| online-maps | pass | 6 s |
| online-settings-layout | pass | 13 s |
| browser (static :8123) | pass, no page errors | 48 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | pass this run — Nimbus, 9 turns, all 4 clients digest-identical (unseeded; QA-1 still open, see net-parity) | 31 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 258 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 64 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 43 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 4 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 3 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 2 s |
| callout-nameplate (not in CI) | **FAIL** — 32/32 special callouts cover the caster's nameplate (QA-26) | 3 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 419 s |
| ringout-credit 1 (new, report) | 39/39 knocked-into-kill-floor eliminations credit nobody; 124/256 decisive 1v1 winners show 0 KOs — QA-27 | 418 s |
| qa-playthrough (set 3) | 5/5 reached results, 0 page errors | 352 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=3 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-28`; set 3 last ran 10-26):
  Skyla v Phantom on Canopy Ruins 1280x720, Gravitas v Volt+Warden on Skyline Grid 390x844, Ricochet in a 4p teams
  game on Glacier Fortress 1280x720, Magmaw v Bulwark on Cloud Steps 390x844, Phantom in a 6p FFA on Magma Works
  1280x720. All five reached results with no page errors. New: **QA-27** (Glacier Fortress teams: Orange wiped Blue
  in 3 turns by knocking both into the kill floor and the results show 0 KOs for both winners; ring-outs are never
  credited, so Phantom's KO passive can't fire from them either); added `test/ringout-credit.mjs` (report,
  `STRICT=1` fails on main). Repeats: QA-3 (You/Ricochet and Juno/Skyla both out by T2 on Glacier Fortress), QA-4
  (results table cut on both phone matches), QA-5 (turn label wraps every phone turn), QA-6 (T1 plan on Skyline Grid
  shows only you), QA-8 (Canopy Ruins "21 turns" for a T20 KO; Skyline Grid "21 turns · turn cap"), QA-9 (SKIP
  near-invisible on Cloud Steps), QA-13 ("You (you)"), QA-15 (phone bots ~18px on Skyline Grid), QA-17 ("You KO" on
  Skyline Grid T6), QA-21 ("Toxin" on Ozzy's name tag, Magma Works T2), QA-23 (platforms through the results table
  on Canopy Ruins and Glacier Fortress), QA-25 (grey smoke squares on Canopy Ruins T7 and Cloud Steps T2).
  Evidence: `docs/alpha/qa/2026-10-28/` (JPEG).
- **Filed:** QA-27 (P3, gameplay — needs a design call). QA-1 log updated (online-8p passed tonight, net-parity
  still 14/30).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16
  (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-29 — builder run (producer)
- **Main:** 8163731 (QA nightly 2026-10-28). Only docs/tests changed since the last builder run; no `src/` or
  `server/` change. Re-ran here: determinism 6, rules, spawns — all pass (64 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-29b — builder run (producer)
- **Main:** 693822d (run log 2026-10-29). No `src/` or `server/` change since the last builder run. Re-ran here:
  determinism 6, rules, spawns — all pass (71 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-29c — builder run (producer)
- **Main:** 40acc36 (run log 2026-10-29b). No `src/` or `server/` change since the last builder run. Re-ran here:
  determinism 6, rules, spawns — all pass (57 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA client-ui tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-29 (night) — nightly QA (qa)
- **Main:** d2d9df1 (run log 2026-10-29c). No change under `src/ server/ test/` since 8163731 (QA nightly
  2026-10-28), so every seeded suite matches last night. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`.
  Chromium 1243 (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`). Container ~20% faster than last night.
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 167 s |
| rules | pass | 1 s |
| spawns | pass | 0 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1070 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 277 s |
| features | pass (90 matches, 0 errors; no specials, power-ups or events missing) | 471 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death) | 187 s |
| balance 4 | pass (report) | 249 s |
| balance-gate 2 (CI) | pass | 130 s |
| online | pass | 50 s |
| online-browser | pass | 99 s |
| online-maps | pass | 5 s |
| online-settings-layout | pass | 8 s |
| browser (static :8123) | pass, no page errors | 36 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | pass — Nimbus, 11 turns, 4 clients digest-identical (unseeded; QA-1 still open) | 35 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 187 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 46 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 31 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 2 s |
| callout-nameplate (not in CI) | **FAIL** — 32/32 special callouts cover the caster's nameplate (QA-26) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 301 s |
| ringout-credit 1 (report) | 39/39 kill-floor knock-outs credit nobody; 124/256 decisive winners show 0 KOs — QA-27 | 269 s |
| team-win-credit 1 (new, report) | 18 of 23 team wins leave out 34 dead teammates of the winning team — QA-28 | 103 s |
| qa-playthrough (set 1) | 5/5 reached results, 0 page errors | 378 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`node test/qa-playthrough.mjs docs/alpha/qa/2026-10-29`, set 1; last ran 10-26): Volt v
  Magmaw on Ember Pit 390x844, Bulwark v Phantom+Skyla on Frozen Keel 1280x720, Ricochet v Gravitas on Canopy Ruins
  390x844, Warden in a 6p teams game on Temple Crossing 1280x720, Skyla in a 4p FFA on Neon Alley 390x844. All five
  reached results with no page errors. New: **QA-28** (Temple Crossing teams: "Orange team" wins on the turn cap but
  only the surviving Ozzy row is marked a winner; reading `Match.checkWin` shows team `winner.ids` hold living bots
  only, so a dead teammate of the winning team gets DEFEAT, a local loss and an online `recordResult` loss); added
  `test/team-win-credit.mjs` (report, `STRICT=1` fails on main). Repeats: QA-4 (results table cut on all three phone
  matches), QA-5 (turn label wraps every phone turn), QA-6 (Canopy Ruins T1 plan shows only you), QA-7 (pickup drawn
  under the roster on Frozen Keel T6), QA-8 (Ember Pit "13 turns", Temple Crossing "21 turns · turn cap"), QA-13
  ("You (you)"), QA-15 (phone bots ~18px), QA-21/QA-26 (label behind the "You" tag on Ember Pit T6, "Overclock"
  over Ozzy's tag on Temple Crossing T2), QA-22 ("READY!" cut at the right edge, Neon Alley T1), QA-23 (platforms
  through the results table on Temple Crossing), QA-25 (grey smoke squares on Frozen Keel T6 and Temple Crossing T5),
  QA-27 (Temple Crossing: 5 deaths, 0 KOs credited). Evidence: `docs/alpha/qa/2026-10-29/` (JPEG).
- **Filed:** QA-28 (P1, gameplay). QA-1 log updated (online-8p passed, net-parity still 14/30).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30), unchanged; waiting on Ganesh's call on PR #16
  (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-30 — builder run (producer)
- **Main:** 4bfc783 (QA nightly 2026-10-29). No `src/` or `server/` change since the last builder run. Re-ran here:
  determinism 6, rules, spawns — all pass (35 s).
- **Backlog:** unchanged. M0 open: M0-06 `blocked` (H-04, PR #8 `hold`, no `human-approved`), M0-09 depends on
  M0-06, QA-1 fix on PR #16 (H-05, `hold`). Neither PR touched since 2026-10-14/15. HUMAN_QUEUE: no item DONE,
  D-7 still "no", so M1 and QA tasks (incl. new QA-28) stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes (lets builders start the parked M1/QA tasks).

## 2026-10-30b — builder run (producer)
- **Main:** 35bc0fe (run log 2026-10-30). No `src/` or `server/` change since the last builder run. Re-ran here:
  npm install, determinism 6, rules, spawns — all pass (48 s).
- **Backlog:** unchanged. PR #8 (M0-06, H-04) and PR #16 (QA-1, H-05) both still `hold`, last updated
  2026-10-14/15, no `human-approved`. HUMAN_QUEUE: no item DONE, D-7 still "no", so M0-09, M1 and QA tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes.

## 2026-10-30c — builder run (producer)
- **Main:** 72db87d (run log 2026-10-30b). No `src/` or `server/` change since the last builder run. Re-ran here:
  npm install, determinism 6, rules, spawns — all pass (53 s).
- **Backlog:** unchanged. PR #8 (M0-06, H-04) and PR #16 (QA-1, H-05) both still `hold`, last updated
  2026-10-14/15, no `human-approved`. HUMAN_QUEUE unchanged since 2026-10-18: no item DONE, D-7 still "no", so
  M0-09, M1 and QA tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes.

## 2026-10-30 (night) — nightly QA (qa)
- **Main:** 51ffdbd (run log 2026-10-30c). No change under `src/ server/ test/` since the 2026-10-29 nightly, so every
  seeded suite matches last night. PR #16 (QA-1 fix) and PR #8 (M0-06) still on `hold`.
  Chromium 1243 (`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`).
- **Suites (2 cores, one lane, sequential):**

| Suite | Result | Wall |
|---|---|---|
| determinism 12 | pass | 182 s |
| rules | pass | 0 s |
| spawns | pass | 1 s |
| stress 250 | pass (0 errors, 0 no-winner, 0 sudden death, avg 10.5 turns) | 1100 s |
| bughunt 5 | pass — NO ISSUES FOUND (50 eight-bot matches) | 302 s |
| features | pass (90 matches, 0 errors; no specials, power-ups or events missing) | 506 s |
| headless 60 | pass (0 errors, 4 draws, 0 sudden death) | 224 s |
| balance 4 | pass (report) | 277 s |
| balance-gate 2 (CI) | pass | 139 s |
| online | pass | 49 s |
| online-browser | pass | 69 s |
| online-maps | pass | 4 s |
| online-settings-layout | pass | 9 s |
| browser (static :8123) | pass, no page errors | 50 s |
| mapid | pass | 1 s |
| online-8p (not in CI) | **FAIL** — Nimbus, 18 turns: all 4 clients diverge from the server digest from turn 4 (known P0 QA-1) | 144 s |
| terrain-embed (not in CI) | pass — no bot embedded (1104 cleanups) | 210 s |
| net-parity (not in CI) | **FAIL** — 14/30 matches desync (known P0 QA-1; fix on held PR #16) | 51 s |
| turn-count (not in CI) | **FAIL** — 19/19 turn-cap wins off by one (QA-8) | 34 s |
| lobby-maplist (not in CI) | **FAIL** — 10px sub-labels, 45px buttons (QA-12) | 3 s |
| callout-fit (not in CI) | **FAIL** — 96 callouts, 160 problems (QA-19) | 2 s |
| fx-occlusion (not in CI) | **FAIL** — 7 effects, 1 hides the bot (QA-20) | 1 s |
| label-tag-overlap (not in CI) | **FAIL** — 10/10 labels cover the nameplate (QA-21, QA-16) | 2 s |
| nameplate-edge (not in CI) | **FAIL** — 29 pad nameplates clipped at 390x844 (QA-22) | 2 s |
| callout-nameplate (not in CI) | **FAIL** — 32/32 special callouts cover the caster's nameplate (QA-26) | 1 s |
| ai-selfkill 1 (report) | 58 undamaged self-eliminations in 280 hard 1v1s (20.7%, unchanged) — QA-3 | 369 s |
| ringout-credit 1 (report) | 39/39 kill-floor knock-outs credit nobody; 124/256 decisive winners show 0 KOs — QA-27 | 371 s |
| team-win-credit 1 (report) | 18 of 23 team wins leave out 34 dead teammates of the winning team — QA-28 | 131 s |
| qa-playthrough (set 2) | 5/5 reached results, 0 page errors | 286 s |

  No perf, swarm or ai-usage tests exist in `test/` yet. Every CI gate is green on main.
- **1v1 balance (`node test/balance.mjs 4`, 224 duels, avg 7.5 turns):** identical to last night (same code, same seeds).

| Bot | Win % | Avg dmg |
|---|---|---|
| bulwark | 59% | 96 |
| magmaw | 43% | 68 |
| volt | 55% | 115 |
| warden | 61% | 96 |
| skyla | 14% | 53 |
| phantom | 16% | 36 |
| ricochet | 54% | 90 |
| gravitas | 50% | 68 |

  Warden 61% just above the band; Skyla 14% and Phantom 16% far below. Headless 60 FFA: Skyla 0/35, Phantom 6/39.
- **UI playthroughs** (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-30`; set 2 last ran 10-27): Magmaw
  v Ricochet on Magma Works 1280x720 (VICTORY, 16 turns), Phantom v Warden+Volt on Glacier Fortress 390x844 (DEFEAT),
  Gravitas v Skyla on Cloud Steps 1280x720 (VICTORY), Bulwark in a 4p teams game on Nimbus 390x844 (DEFEAT, "Orange
  team"), Volt in a 5p FFA on Skyline Grid 1280x720 (VICTORY). All five reached results with no page errors. Nothing
  new found; repeats only: QA-4 (results table cut at the left on both phone matches), QA-5 (turn label wraps every
  phone turn), QA-6 (Glacier Fortress T5 plan shows only you), QA-7 (Skyline Grid T2: a "-25" and the top-right
  ledge drawn under the roster), QA-8 (Magma Works "16 turns" after 14 played), QA-9 (SKIP almost invisible on the
  Nimbus sky, T6), QA-13 ("You (you)"), QA-15 (phone bots ~18px), QA-22 ("Juno"/"Nova" nameplates cut at the right
  edge on Glacier Fortress T2 and Nimbus T6), QA-23 (birds and the map through the results table on Nimbus and
  Skyline Grid), QA-25 (grey smoke squares over "You" on Magma Works T6 and Cloud Steps T6), QA-27 (Skyline Grid: 4
  deaths, 0 KOs credited; Cloud Steps winner dealt 0 damage), QA-28 (Nimbus teams: only the surviving Magmaw row is
  marked a winner). Cloud Steps/Nimbus cloud undersides are still flat white circles — art, tracked by M3-01, not
  filed. Evidence: `docs/alpha/qa/2026-10-30/` (JPEG).
- **Filed:** none new. QA-1 log updated (online-8p failed tonight, net-parity still 14/30).
- **P0 still open on main:** QA-1 online desync (net-parity 14/30; online-8p desynced from turn 4 tonight), unchanged;
  waiting on Ganesh's call on PR #16 (H-05). No CI gate is red on main and no new crash was found.

## 2026-10-31 — builder run (producer)
- **Main:** c8e91fa (QA nightly 2026-10-30). No `src/` or `server/` change since the last builder run. Re-ran here:
  npm install, determinism 6, rules, spawns — all pass (54 s).
- **Backlog:** unchanged. PR #8 (M0-06, H-04) and PR #16 (QA-1, H-05) both still `hold`, last updated
  2026-10-14/15, no `human-approved`. HUMAN_QUEUE unchanged since 2026-10-18: no item DONE, D-7 still "no", so
  M0-09, M1 and QA tasks stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes.

## 2026-10-31b — builder run (producer)
- **Main:** fec7215 (run log 2026-10-31). No `src/` or `server/` change since the last builder run. Re-ran here:
  npm install, determinism 6, rules, spawns — all pass (45 s).
- **Backlog:** unchanged. PR #8 (M0-06, H-04) and PR #16 (QA-1, H-05) both still `hold`, no `human-approved`.
  HUMAN_QUEUE unchanged since 2026-10-18: no item DONE, D-7 still "no", so M0-09 (depends M0-06), M1 and QA tasks
  stay parked.
- **Tasks attempted:** none. **PRs opened:** this run log only. **Newly blocked:** none.
- **Waiting on Ganesh:** H-05 (remove `hold` on #16 + "Update branch", or merge it), H-04 (`human-approved` on
  #8), or D-7 → yes.
