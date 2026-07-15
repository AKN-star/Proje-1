---
name: fix-lint-debt
description: Clears accumulated lint warnings without changing behavior.
when: conductor routes an actionable, non-contract-sensitive lint-debt finding to this skill
---

Steps:
1. Run the repo's lint command; capture the current warning count.
2. Fix warnings in small, mechanical batches. No behavior changes.
3. Re-run lint after each batch; stop if the count stops dropping and
   report survivors instead of forcing it.

Never:
- Never edit lint config to lower the threshold instead of fixing code.
- Never touch a file outside the warnings being fixed.
- Never change behavior - this is a `cleanup` per CLAUDE.md's WORDS block
  (behavior identical, verify.sh green before and after).

done_when:
- TEMPLATE-PHASE (this repo has no `package.json`/lint command yet, same
  fact `loop/guardrails/verify.sh` already documents): `test ! -f
  package.json` - honestly confirms there is no lint surface to have debt
  in yet, rather than faking a pass against a command that doesn't exist.
- Once a real app exists, replace with the actual check, e.g.:
  `npm run lint 2>&1 | grep -c warning` reports `0`.

Starts at `watch` tier (every skill does, per BUILD 4 - no skill is
seeded pre-trusted). This file is this repo's own trust-ledger roster
entry (`loop/skills/`) - unrelated to Claude Code's built-in
`.claude/skills/` system.
