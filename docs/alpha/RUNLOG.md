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
