---
id: QA-4
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-4: Results table is cut off at phone width

Found by the 2026-10-14 nightly QA run (`node test/qa-playthrough.mjs <dir> 4`, a 4-player Neon
Alley game at 390x844). The results table is wider than the screen and centred, so the **Player**
column (who is who) runs off the left edge and **Died** runs off the right. The playthrough
reports `results table cells off-screen: Player | Died | You (you) | 10 | Nova | 7`.
Screenshot: `docs/alpha/qa/2026-10-14/m5-neonalley-390x844-result.jpg`.

Also: the local player shows as "You (you)" here and in the HUD roster. The "(you)" is redundant
when the name is already "You".

Expected: every column readable at 390 wide. Wrap it, scroll it inside its own box, or drop or
abbreviate columns.
Actual: the first and last columns are clipped and can't be reached.

## Acceptance

- [ ] At 390x844 and 844x390, every `#result-table th, td` lies within the viewport (or inside a
      horizontally scrollable container whose first column is visible). `test/qa-playthrough.mjs`
      reports no `results table cells off-screen`.
- [ ] Text is at least 12px. Screenshots at 390x844, 844x390 and 1280x720 in the Log.
- [ ] The browser smoke gate is green.

## Log
