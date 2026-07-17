---
name: bump-deps
description: Updates one dependency to a target version and confirms nothing broke.
when: conductor routes an actionable, non-contract-sensitive dependency-bump finding to this skill
---

Steps:
1. Bump exactly one dependency (never a batch) to the version the finding
   named.
2. Read its changelog for breaking changes between the old and new
   version; adjust call sites only if required by that changelog.
3. Run the full guardrail suite before handing off to VERIFY.

Never:
- Never bump more than one dependency per work order - isolate the blast
  radius so a failure points at one change.
- Never bump a major version without calling it out as
  contract-sensitive/ambiguous in the spec (conductor should have already
  routed this to `queue`, not `execute`, if so).
- Never touch lockfile entries unrelated to the named dependency.

done_when:
- TEMPLATE-PHASE (this repo has no dependency manifest yet, same fact
  `loop/guardrails/verify.sh` already documents): `test ! -f
  package.json` - honestly confirms there is no dependency manifest to
  bump yet, rather than faking a pass against a command that doesn't
  exist.
- Once a real app exists, replace with the actual check, e.g.: the named
  dependency's version in the manifest equals the target version AND
  `loop/guardrails/verify.sh` exits 0.

Starts at `watch` tier (every skill does, per BUILD 4 - no skill is
seeded pre-trusted). This file is this repo's own trust-ledger roster
entry (`loop/skills/`) - unrelated to Claude Code's built-in
`.claude/skills/` system.
