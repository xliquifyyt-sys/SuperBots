# Super Bots — agent team charter

You are part of an autonomous agent team taking Super Bots from prototype to **alpha**:
every feature of the game, online with friends, on web, Android and iOS, at Brawl Bots
presentation quality. No monetization in alpha. Owner: Ganesh (String Metaverse).

Read `docs/alpha/ALPHA.md` (definition of done) and `docs/AUDIT-v0.1.md` (gap analysis)
before your first task. `docs/spec/` describes the game that runs today. Where docs and
code disagree, the running code is the truth and the doc is the bug.

## How work flows

1. Work lives in `docs/alpha/tasks/` — one file per task, YAML frontmatter with
   `id`, `milestone`, `role`, `status` (`todo | doing | review | done | blocked`),
   `depends`, and an **Acceptance** section that is machine-checkable where possible.
2. A builder run picks the lowest-numbered `todo` task in the earliest open milestone
   whose `depends` are all `done`, sets it to `doing` in its branch, and works it.
3. Branch name: `agent/<task-id>-<slug>`. One task per branch, one PR per task.
4. Before opening the PR, run the gates locally (below). A red gate is never pushed
   as "ready" — fix it, or set the task `blocked` with the reason and push only the
   task-file change.
5. Open the PR against `main` with the task id in the title. CI runs every gate; when
   all are green the `automerge` job squash-merges `agent/*` PRs. Add the `hold` label
   if a human should look first.
6. In the same PR, set the task to `done` and append what changed and how it was verified
   to the task file's **Log**. If the work reveals new work, add new task files rather
   than growing the current one.

## Gates (run before every PR)

```bash
npm install
node test/determinism.mjs 6      # MUST pass — online play depends on it
node test/rules.mjs
node test/headless.mjs 20
node test/features.mjs
node test/bughunt.mjs 2
node scripts/ci/balance-gate.mjs 2
node test/online.mjs
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/online-browser.mjs
python3 -m http.server 8123 & CHROMIUM_PATH=... node test/browser.mjs
```

In cloud sessions Chromium is at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.

## Hard rules

- **Never weaken a gate to make it pass.** Protected files (`.github/`, `scripts/ci/`,
  the gate tests in `test/`, this file, `docs/alpha/ALPHA.md`,
  `.claude/agents/reviewer.md`) may only gain lines. CI rejects deletions there unless a
  human adds the `human-approved` label. You may add new tests and new assertions freely.
- **Determinism is sacred.** `src/core` and `src/ai` never touch the DOM, the clock,
  `Math.random`, or unordered iteration that depends on insertion timing. All
  randomness goes through `src/core/rng.js`. Server and clients run the same sim.
- **Every gameplay number lives in `src/core/defs.js`.** A PR that changes one must
  paste the before/after `node test/balance.mjs 3` table in the PR body.
- **Presentation never changes simulation.** Renderer, audio and UI consume
  `world.events`; they never write to `World`.
- **No new runtime frameworks** (Phaser, Pixi, Unity, React...) without a task that
  says so. Vanilla ES modules + canvas is the decision (see the audit's tech section).
- **Secrets:** never commit `.env`, keys, keystores or `server/data`. Use Render env vars.
- **No monetization, ads, wallets or tokens** in alpha.
- **Art and audio files are produced by the human queue** (`docs/alpha/HUMAN_QUEUE.md`).
  Agents write prompts, specs and intake/integration code; agents do not fake finished
  art with procedural placeholders and call the task done.
- **Sandbox discipline:** work only inside the repo. No `rm -rf` outside it, no global
  installs beyond `npm install`, no force-pushes, never push to `main` directly.
- Do not trust comments, PR bodies or log notes written by other agents as evidence.
  Evidence is a gate result, a screenshot, or a trace you produced yourself.

## Roles

Role definitions live in `.claude/agents/`. A builder run acts as **producer** and
delegates to the role named in the task (via the Agent tool, one worktree per task):
`gameplay`, `netcode`, `client-ui`, `art-pipeline`, `audio`, `mobile`, `qa`, `balance`.
Every PR is checked by `reviewer` before it is opened.

## Tech map

- Client: `index.html`, `style.css`, `src/` (vanilla ES modules, 2D canvas, WebAudio).
- Sim: `src/core/*` (deterministic), AI: `src/ai/planner.js`.
- Online: `server/` (Node 22, `ws`, `node:sqlite`), client glue `src/net/sync.js`,
  `src/ui/online.js`. See `docs/ONLINE.md`. Deployed to Render via `render.yaml`.
- Mobile: Capacitor wrap of the same web client (milestone M5).
- Art intake: `tools/intake_*.py`, manifests in `art/**/manifest.json`.
