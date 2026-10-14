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
- **What:** PR for branch `agent/M0-06-turncap-tie-draw` changes one existing line in `test/rules.mjs`
  (the "HP tiebreak does not start Sudden Death" check: `m.winner.type === 'player'` → `'draw'`). Everything
  else in the PR only adds lines.
- **Why:** a 40/40 tie at the turn cap currently gives the win to whoever is listed first. The fix makes it a
  draw, which the old assertion forbids. The guard blocks any edited line in a gate test without a human.
- **Do:** open the M0-06 PR, read the one-line test diff. If you agree, add the label `human-approved` and remove
  `hold`; CI re-runs and auto-merges. If you prefer "first listed wins", close the PR and mark M0-06 `done` with
  a note that ties stay as they are.
