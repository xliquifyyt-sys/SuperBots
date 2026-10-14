# Super Bots — status

This file used to hold a hand-written build log (last updated 7 September 2026). It went stale
and has been retired so there is one source of truth for each question:

| Question | Where to look |
| --- | --- |
| What does the game do today? Rules, bots, maps, numbers, architecture, tests | [docs/spec/](spec/00-README.md) (generated from and checked against the running code) |
| What is "alpha" and how far along are we? | [docs/alpha/ALPHA.md](alpha/ALPHA.md) |
| What is being worked on, and what is left? | [docs/alpha/tasks/](alpha/tasks/) (one file per task, with status) and [docs/alpha/BACKLOG.md](alpha/BACKLOG.md) |
| What needs a person (art, audio, accounts, decisions)? | [docs/alpha/HUMAN_QUEUE.md](alpha/HUMAN_QUEUE.md) |
| What did the agent runs do? | [docs/alpha/RUNLOG.md](alpha/RUNLOG.md) |
| Where does v0.1 fall short of Brawl Bots? | [docs/AUDIT-v0.1.md](AUDIT-v0.1.md) |
| Current balance numbers | [docs/spec/12](spec/12-roadmap-known-gaps-and-balance.md#balance-snapshot), refresh with `node test/balance.mjs 3` |

Where these documents and the code disagree, the running code is the truth and the document is the bug.
