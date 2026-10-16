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
