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
- **PRs:** #5 M0-01, #6 M0-02, #7 M0-03 (scope narrowed to Chain Arc + Bulwark).
- **Blocked:** M0-06 turn-cap tie → draw (split from M0-03) — changes one protected assertion, needs
  `human-approved` (HUMAN_QUEUE H-04). Prepared on `agent/M0-06-turncap-tie-draw`.
- **New tasks:** M0-05 (bughunt 4+ glacierfort embed), M0-07 (online map labels), M0-08 (unknown map id),
  M0-09 (server records draws), M0-10 (AI Chain Arc outline), M0-11 (card text ≥12px), M5-05 (server base
  URL for native builds).
- **Notes:** features.mjs takes ~20 min when three worktrees run gates at once on this 2-core sandbox;
  workers must use their own ports, scratch folders, and never `pkill -f` by pattern.
