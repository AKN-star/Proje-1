---
name: fix-flaky-test
description: Stabilizes a test that fails intermittently, without weakening what it checks.
when: conductor routes an actionable, non-contract-sensitive flaky-test finding to this skill
---

Steps:
1. Reproduce the flake locally: re-run the specific test several times
   (not the whole suite) until it fails at least once.
2. Identify the source of nondeterminism (timing, ordering, shared state,
   external I/O) - fix that, not the assertion.
3. Re-run the test enough times to be confident the flake is gone before
   handing off to VERIFY.

Never:
- Never delete or weaken the assertion to make it stop failing. That is a
  fail, always (CLAUDE.md NEVER law).
- Never mark the test skipped/pending as a "fix."
- Never touch unrelated tests in the same file.

done_when:
- TEMPLATE-PHASE (this repo has no `package.json`/test command yet, same
  fact `loop/guardrails/verify.sh` already documents): `test ! -f
  package.json` - honestly confirms there is no test suite to have a
  flake in yet, rather than faking a pass against a command that
  doesn't exist.
- Once a real app exists, replace with the actual check, e.g.: the
  previously-flaky test passes N/N consecutive runs (N chosen per how
  rare the flake was).

Starts at `watch` tier (every skill does, per BUILD 4 - no skill is
seeded pre-trusted). This file is this repo's own trust-ledger roster
entry (`loop/skills/`) - unrelated to Claude Code's built-in
`.claude/skills/` system.
