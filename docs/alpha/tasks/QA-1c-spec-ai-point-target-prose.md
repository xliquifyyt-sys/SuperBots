---
id: QA-1c
milestone: M0
role: qa
status: todo
depends: [QA-1a]
severity: P3
---
# QA-1c: Generated bot spec still says AI Blink Strike uses the aim-line fallback

QA-1a makes `AIPlanner.plan` keep `aim.tx, aim.ty` for Blink Strike, so an AI Blink now goes to
the point the planner scored, the same as a player tap. `tools/gen_spec.py` (`IMPL['blinkStrike']`)
still says "AI aims use the legacy rule: walk along the aim line ...", and `docs/spec/03-bots.md` is
generated from that text. QA-1a did not edit `tools/gen_spec.py`, because M0-08a owns the
generator's prose.

Bastion Wall's "AI aims use the legacy rule" line is still correct after QA-1a. QA-1e changes it.

## Acceptance

- [ ] The Blink Strike IMPL line says that AI aims pass the scored map point (`aim.tx, aim.ty`).
      The aim-line rule stays documented as the fallback for an aim with no point.
- [ ] `python3 tools/gen_spec.py` regenerates `docs/spec/03-bots.md` with only that change.

## Log
