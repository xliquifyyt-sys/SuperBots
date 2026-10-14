#!/usr/bin/env bash
# Protects the verification system from the agents it verifies.
# Protected files may GROW (new assertions, new checks) but may not lose lines,
# be deleted or be renamed unless the PR carries the `human-approved` label.
# Lesson from AI decompilation projects: agents under pressure weaken the test
# instead of fixing the code. This makes that impossible without a human.
set -euo pipefail
BASE="${1:-origin/main}"
LABELS="${PR_LABELS:-}"
PROTECTED_RE='^(\.github/|scripts/ci/|test/(determinism|features|bughunt|rules|online|online-browser|browser|stress|headless)\.mjs$|CLAUDE\.md$|\.claude/agents/reviewer\.md$|docs/alpha/ALPHA\.md$)'
if [[ ",$LABELS," == *",human-approved,"* ]]; then echo "guard: human-approved label present, skipping"; exit 0; fi
bad=0
while IFS=$'\t' read -r add del path; do
  [[ -z "${path:-}" ]] && continue
  if [[ "$path" =~ $PROTECTED_RE ]] && [[ "$del" != "0" ]]; then
    echo "guard: $path removes $del line(s). Protected files may only grow without the human-approved label."; bad=1
  fi
done < <(git diff --numstat "$BASE"...HEAD)
while IFS=$'\t' read -r status path rest; do
  [[ "$status" =~ ^(D|R) ]] && [[ "$path" =~ $PROTECTED_RE ]] && { echo "guard: $path deleted/renamed"; bad=1; }
done < <(git diff --name-status "$BASE"...HEAD)
# Gameplay numbers changed? Require the balance report to be attached in the PR (checked by CI balance job).
exit $bad
