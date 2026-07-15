# BUILD 8: the ops console. Run from the repo root.
# .PHONY (OD-F): a stray root-level file named like a target would
# otherwise silently turn it into an "up to date" no-op.
.PHONY: tick queue trust audit goals clean-worktrees
tick:            ; ./loop/loop.sh
# queue pattern includes CONTRACT VIOLATION (OD-E): exit-4/5 evidence
# from the fail-closed gates must surface in the console too.
queue:           ; @grep -E "review:|queued:|FAILED:|rerouted|CONTRACT VIOLATION" loop/memory/STATE.md || echo empty
trust:           ; @./loop/scripts/trust-log.sh --render
audit:           ; @./loop/scripts/cost-check.sh --report
goals:           ; @./loop/verify-goals.sh
# DESTRUCTIVE: removes pending-review evidence. Order is law: review
# `make queue` first. See loop/runbook.md "Recovery".
clean-worktrees: ; @git worktree list | awk '/wt-/{print $$1}' | xargs -rn1 git worktree remove --force
