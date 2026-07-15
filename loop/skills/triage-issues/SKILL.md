---
name: triage-issues
description: Labels and routes open GitHub issues; does not fix anything itself.
when: conductor routes an actionable, non-contract-sensitive issue-hygiene finding to this skill
---

Steps:
1. Read the issue body and any existing comments.
2. Apply an accurate label (bug/feature/question/duplicate/etc.) and, if
   clearly a duplicate, link to the original and say so in a comment.
3. Do not attempt a fix here - if the issue itself looks actionable as
   code work, that is a separate work order for a different skill.

Never:
- Never close an issue as part of this skill - labeling/linking only.
- Never label something contract-sensitive (auth/payments/migrations) as
  routine - escalate those per `loop/contract.md`'s "wakes me up" list
  instead.
- Never invent a label that doesn't already exist on the repo.

done_when:
- TEMPLATE-PHASE (same fact the other three BUILD-4 skills check: this
  repo has no application yet, so there is no real Issues workflow
  attached to real code to triage - a fact about this repository's
  tracked content, not about which tools happen to be installed on
  whichever machine evaluates the check): `test ! -f package.json`
- Once a real app exists, replace with the actual check, e.g.: the named
  issue has exactly one type label and, if a duplicate, a comment linking
  the original.

Starts at `watch` tier (every skill does, per BUILD 4 - no skill is
seeded pre-trusted). This file is this repo's own trust-ledger roster
entry (`loop/skills/`) - unrelated to Claude Code's built-in
`.claude/skills/` system.
