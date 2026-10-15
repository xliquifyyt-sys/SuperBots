---
id: QA-1c
milestone: M0
role: qa
status: todo
depends: [QA-1a]
severity: P3
---
# QA-1c: Generated bot spec still says AI Blink and Bastion Wall use the aim-line fallback

QA-1a makes `AIPlanner.plan` keep `aim.tx, aim.ty` for point-target moves. Before that, the AI's
Blink Strike and Bastion Wall went through the sim's aim-line fallback. `tools/gen_spec.py`
(`IMPL['bastionWall']` and `IMPL['blinkStrike']`) still says "AI aims use the legacy rule ...", and
`docs/spec/03-bots.md` is generated from it. QA-1a did not edit `tools/gen_spec.py`, because M0-08a
owns the generator's prose.

## Acceptance

- [ ] Both IMPL lines say that AI aims pass the scored map point (`aim.tx, aim.ty`), the same as a
      player tap. The aim-line rule stays documented as the fallback for an aim with no point.
- [ ] `python3 tools/gen_spec.py` regenerates `docs/spec/03-bots.md` with only those changes.

## Log
