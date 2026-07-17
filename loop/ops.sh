#!/usr/bin/env bash
# Ops console for machines with no `make` (e.g. plain Windows/Git Bash):
#   bash loop/ops.sh <verb>
# Same six verbs as the Makefile, same files, nothing Makefile-specific -
# keep this in sync with Makefile by hand if you add a verb to either.
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
  tick)  exec ./loop.sh ;;
  queue) grep -E "review:|queued:|FAILED:|rerouted|CONTRACT VIOLATION" memory/STATE.md || echo empty ;;
  trust) scripts/trust-log.sh --render ;;
  audit) scripts/cost-check.sh --report ;;
  goals) ./verify-goals.sh ;;
  # DESTRUCTIVE: removes pending-review evidence. Order is law: review
  # `ops.sh queue` first. See runbook.md "Recovery".
  clean-worktrees) git worktree list | awk '/wt-/{print $1}' | xargs -rn1 git worktree remove --force ;;
  *) echo "usage: bash loop/ops.sh tick|queue|trust|audit|goals|clean-worktrees"; exit 2 ;;
esac
