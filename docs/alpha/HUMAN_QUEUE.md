# Human queue — things only Ganesh (or a person he assigns) can do

Agents add entries here when a task is blocked on a person. Newest at the bottom.
Mark an entry `DONE` when delivered; the next builder run unblocks the task.

## Setup (once)

### H-01 GitHub repo settings — needed before the first agent PR merges
1. Settings → General → Default branch → switch to **main**.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Actions → General → Workflow permissions: **Read and write**, and tick
   **Allow GitHub Actions to create and approve pull requests**.
4. (Optional, recommended) Settings → Branches → protect `main`: require the checks
   `guard`, `sim`, `balance`, `online`; block force pushes.
5. After that, the old branches `claude/upbeat-fermat-r7uyry`, `cursor/*` can be deleted
   (their work is in main).

### H-02 Render
Render dashboard → New → Blueprint → this repo. It creates `superbots-alpha` from
`render.yaml` (Starter plan, needed for the persistent disk, Singapore region).

### H-03 Store and sign-in accounts (needed by M5/M6)
- Apple Developer Program, Google Play Console.
- Google Cloud OAuth client ids (web, Android, iOS) → `GOOGLE_CLIENT_ID` on Render.
- Apple Services ID → `APPLE_CLIENT_ID` on Render.
- Android upload keystore and App Store Connect API key → GitHub Actions secrets.

## Art and audio
Agents write the exact specs as tasks M1-01 and M1-02 run; entries appear below.

## Design decisions (agents use the default unless you change it here)
| # | Question | Default |
|---|---|---|
| D-1 | Air strike: full-map carpet (current) or 3 bombs (GDD)? | keep carpet |
| D-2 | Power-ups expire after 6 turns (GDD) or stay (current)? | expire after 6 (GDD) |
| D-3 | Thrusters: second jump in the same turn (GDD) or stronger jump (current)? | stronger jump |
| D-4 | Phantom s2: Toxic Bomb (current) or Smoke Bomb that hides aim guides (GDD)? | keep Toxic Bomb |
| D-5 | Destructible terrain in alpha? | yes, for Gravitas/Magmaw specials only (M3) |
| D-6 | Roster for alpha: current 8 bots, or add more? | current 8 |

## Approvals

### H-04 Approve one protected-test change for M0-06 (turn-cap HP tie → draw)
- **What:** PR #8 (branch `agent/M0-06-turncap-tie-draw`) changes one existing line in `test/rules.mjs`
  (the "HP tiebreak does not start Sudden Death" check: `m.winner.type === 'player'` → `'draw'`). Everything
  else in the PR only adds lines.
- **Why:** a 40/40 tie at the turn cap currently gives the win to whoever is listed first. The fix makes it a
  draw, which the old assertion forbids. The guard blocks any edited line in a gate test without a human.
- **Do:** open the M0-06 PR, read the one-line test diff. If you agree, add the label `human-approved` and remove
  `hold`; CI re-runs and auto-merges. If you prefer "first listed wins", close the PR and mark M0-06 `done` with
  a note that ties stay as they are.

### H-05 Merge decision for QA-1 (P0 online desync) — balance gate red by sample noise
- **What:** PR #16 (branch `agent/QA-1-ai-blink-rng-desync`, label `hold`). The AI planner drew from the shared
  world RNG on the server only, so every online match with a server-AI Phantom desyncs (main: 10/20 net-parity
  matches desync; branch: 0/30, `online-8p` 3/3 green). Code fix is two lines, approved on correctness by the reviewer.
- **Why it can't auto-merge:** `scripts/ci/balance-gate.mjs 2` goes red — Skyla 4% vs the 10% floor (main 11%).
  No gameplay number changed; removing the stray RNG draw changes which random games the 28-game sample plays.
  Over 8 seeds Skyla is ~13% before and after. Agents won't pick seeds or touch the gate.
- **Do (pick one):**
  1. Merge PR #16 manually despite the red `balance` check (fastest; restores online play with AI). Then set
     QA-1 to `done` in `docs/alpha/tasks/QA-1-ai-blink-rng-desync.md` (or leave it; the next run will).
  2. Or leave it on `hold`: agents work QA-1a (lift Skyla clear of the floor) next, rebase #16, and CI merges it
     when green. Online games with AI Phantom stay broken until then.
- **Update 2026-10-15 (afternoon):** QA-1a is done and merged into PR #16, so the balance gate no longer
  blocks it: every gate is green on the combined tree (balance-gate 2: Skyla 29%; net-parity 3: 0/30
  desynced; reviewer APPROVE). The PR still has `hold` because only you can lift it. QA-1a is an AI
  change, not a numbers change, but it moves 1v1 win rates (balance 3: Warden 69→52, Bulwark 62→52,
  Ricochet 55→40, Magmaw 45→36, Skyla 12→29, Phantom 21→33). Table in the PR body.
  **Do:** read PR #16, then remove the `hold` label **and** click "Update branch" (or merge it yourself
  once CI is green). Removing the label alone does not re-run CI, so the automerge will not fire on
  its own. If you don't want the balance shift, comment on the PR and agents will split QA-1a out.

