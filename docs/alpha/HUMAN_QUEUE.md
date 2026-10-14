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
