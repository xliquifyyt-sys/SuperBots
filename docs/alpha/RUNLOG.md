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
