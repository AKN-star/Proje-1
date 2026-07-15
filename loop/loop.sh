#!/usr/bin/env bash
# BUILD 3: The Heartbeat.
#
# Deviations from docs/FABLE5_BUILDER_GUIDE.md, verified against the
# installed CLI (claude --version) rather than assumed from the guide:
#   - Every seat uses `claude` only (no `llm`/OpenRouter: not installed here,
#     and this repo's CLAUDE.md DISPATCH table has no external-model row).
#     Seats map onto existing DISPATCH rules: conductor/verifier -> rule 1
#     (fable-5, effort high, read-only); triage/worker -> rule 2/4 (sonnet-5,
#     effort medium).
#   - `--tools` is used instead of `--allowedTools` to actually restrict the
#     tool set (`--allowedTools` only controls permission auto-approval, per
#     `claude --help`; `--tools ""`/`--tools "Read"` are the flags that
#     restrict what's available at all).
#   - Effort is capped at "high" everywhere in this loop, never "xhigh"
#     (CLAUDE.md NEVER law: "Never exceed effort high inside any loop").
#   - No `--max-tokens`/equivalent flag exists on this CLI version to set;
#     none is passed.
#
# BUILD 4/6 dependency injection: loop.sh's own architecture (per the guide)
# calls out to scripts/trust-log.sh (BUILD 4) and scripts/log-cost.sh /
# cost-check.sh (BUILD 6). Those don't exist yet, and BUILD 3 must not ship
# files that belong to a later build. Instead, the five hooks below check
# for the real script at runtime and fall back to a safe no-op default when
# it's absent. This makes BUILD 3 independently runnable and CHECK-3-passable
# on its own. When BUILD 4 adds scripts/trust-log.sh and BUILD 6 adds
# scripts/log-cost.sh / scripts/cost-check.sh, this file needs NO changes -
# the hooks pick the real scripts up automatically.
#
# Contract validation: triage and conductor output is constrained with
# --json-schema at generation time AND re-validated in bash before any
# branching logic touches it - schema constraints alone are not trusted,
# since a refusal (stop_reason: "refusal", HTTP 200 per BUILD 0) is valid
# JSON while still violating the content contract. Any violation is
# fail-closed: logged to memory/STATE.md with the raw offending output,
# then a distinct nonzero exit - never silently treated as "quiet" or as
# an executable work order.
#
# Field-hardening notes (learned running this loop for real, not just the
# template dry run — see a real adopter's `loop/loop.sh` header for the
# fuller story if this template gets forked with SDD/phase machinery on
# top; the lessons below are kept generic here):
#   - Prompts to `claude -p` are piped via STDIN, never passed as a
#     positional argv string. Windows argv has a ~32KB ceiling; a spec,
#     diff, or STATE.md that grows past it fails with "Argument list too
#     long" the first time a real task is large enough to hit it.
#   - Worktree branch names carry a RUN_ID (`loop/<skill>-$RUN_ID-$i`), not
#     just `loop/<skill>-$i`. Two ticks in the same second-granularity
#     window (or a retried tick after a crash) would otherwise collide on
#     `git worktree add -b`, killing the run before EXECUTE even starts.
#   - Worker and verifier calls are fail-closed, same as triage/conductor:
#     a `claude` CLI crash (network blip, nonzero exit) is caught with
#     `if ! ( ... ); then ...; fi` instead of being allowed to kill the
#     whole script under `set -e`. Silent death here leaves no STATE.md
#     line, no trust record, and an orphaned worktree — worse than a
#     logged FAILED.
#   - The worker's own JSON envelope (CLI metadata, not its authored
#     IMPLEMENTATION.md) is captured to WORKER-LOG.json, never written
#     over IMPLEMENTATION.md — implement.md tells the worker to keep its
#     own 3-line log there; overwriting it silently discards that record.
#   - The verifier's envelope goes to memory/last-verifier.json and is
#     checked with `jq -e . ... || crash-path` before anything reads
#     `.result` — an empty or half-written file is a verifier crash, not
#     a "quiet"/reroute signal, and must be told apart from one (see the
#     empty-`SERVED_V`-before-reroute-check ordering below).
#   - Two verify-FAILs on the SAME item is a hard stop (exit 6), matching
#     contract.md's "wakes me up: verify fails twice on the same item".
#     The counter keys on `$SKILL [$ITEM]`, not just `$SKILL` — skill alone
#     conflates unrelated items ("fix-lint-debt" failing once on item A and
#     once on item B is not the same failure twice) and never resets, so a
#     bare skill-level counter degrades into "any second FAIL for this
#     skill, ever" instead of the contract's actual promise.
#   - After a result lands in the review queue, the tick exits 0 instead of
#     looping to i+1. Nothing about "review" changes on the next iteration
#     (the item the conductor would see is unchanged), so continuing just
#     re-executes and re-verifies the same work at full cost while a human
#     decision is already pending.
#
# Exit map: 0 quiet/done/review-queued, 1 cap, 2 reroute, 3 budget,
#           4 triage-contract-violation, 5 conductor-contract-violation,
#           6 same item failed verify twice (no unattended continuation).
set -euo pipefail
cd "$(dirname "$0")"
MAX_ITERS="${MAX_ITERS:-10}"
DAILY_BUDGET_USD="${DAILY_BUDGET_USD:-5}"
RUN_ID=$(date +%s)

# Seat models, env-overridable. On accounts without Fable access, only
# these four lines (or the env) change — e.g. CONDUCTOR_MODEL=claude-opus-4-8.
# The route-tolerance checks below adapt to whatever model is chosen.
TRIAGE_MODEL="${TRIAGE_MODEL:-claude-sonnet-5}"
CONDUCTOR_MODEL="${CONDUCTOR_MODEL:-claude-fable-5}"
WORKER_MODEL="${WORKER_MODEL:-claude-sonnet-5}"
VERIFIER_MODEL="${VERIFIER_MODEL:-claude-fable-5}"

TRIAGE_SCHEMA='{"type":"object","properties":{"status":{"enum":["quiet","actionable"]},"findings":{"type":"array","items":{"type":"object","properties":{"finding":{"type":"string"},"evidence":{"type":"string"},"status":{"enum":["actionable","informational"]},"contract_sensitive":{"type":"boolean"}},"required":["finding","evidence","status"]}}},"required":["status"]}'
CONDUCTOR_SCHEMA='{"type":"object","properties":{"action":{"enum":["execute","queue","stop"]},"item":{"type":"string"},"skill":{"type":"string"},"spec":{"type":"string"},"done_when":{"type":"array","items":{"type":"string"}}},"required":["action","item","skill","spec","done_when"]}'

cost_check() {   # BUILD 6 hook. Absent -> always within budget.
  if [[ -x scripts/cost-check.sh ]]; then scripts/cost-check.sh "$@"
  else return 0; fi
}
log_cost() {      # BUILD 6 hook. Absent -> no-op (no usage.log yet).
  if [[ -x scripts/log-cost.sh ]]; then scripts/log-cost.sh "$@"; fi
}
trust_render() {  # BUILD 4 hook. Absent -> ledger is empty, say so.
  if [[ -x scripts/trust-log.sh ]]; then scripts/trust-log.sh --render
  else echo "(no trust ledger yet - BUILD 4 not installed)"; fi
}
trust_record() {  # BUILD 4 hook. Absent -> nothing to record yet.
  if [[ -x scripts/trust-log.sh ]]; then scripts/trust-log.sh "$1" "$2"; fi
}
trust_tier() {    # BUILD 4 hook. Absent -> always "queue", never auto-ship.
  if [[ -x scripts/trust-log.sh ]]; then scripts/trust-log.sh --tier "$1"
  else echo queue; fi
}

cost_check --budget "$DAILY_BUDGET_USD" || exit 3

for ((i=1; i<=MAX_ITERS; i++)); do
  # 1 TRIAGE: sonnet-5, effort medium, no tools (DISPATCH rule 2: reads)
  # KURULUM (e): bu projenin gerçek iş defteri .superpowers/sdd/progress.md,
  # durum bölümü kök CLAUDE.md'de — triage yalnız commit/issue/CI okursa
  # bekleyen faz işini hiç göremez ve sonsuza dek "quiet" döner.
  RESP=$({ git log --oneline -20; gh issue list --limit 20 2>/dev/null || true; \
    gh run list --limit 10 2>/dev/null || true; \
    echo "PROGRESS LEDGER (.superpowers/sdd/progress.md):"; \
    cat ../.superpowers/sdd/progress.md 2>/dev/null || true; \
    echo "PROJECT STATUS (CLAUDE.md ## Durum):"; \
    sed -n '/^## Durum/,/^## Komutlar/p' ../CLAUDE.md 2>/dev/null || true; } \
    | claude -p --model "$TRIAGE_MODEL" --effort medium --tools "" \
        --append-system-prompt "$(cat triage.md)" \
        --json-schema "$TRIAGE_SCHEMA" --output-format json)
  log_cost triage 0.01

  # Fail closed: a refusal is a contract violation, not quiet output.
  # NOTE: the stop_reason field path isn't documented by `claude --help`;
  # confirm it against a real response during CHECK 3.
  STOP_REASON=$(jq -r '.stop_reason? // empty' <<<"$RESP" 2>/dev/null || true)
  if [[ "$STOP_REASON" == "refusal" ]]; then
    echo "- CONTRACT VIOLATION (triage): refusal" >> memory/STATE.md
    echo "$RESP" >> memory/STATE.md
    exit 4
  fi
  TRIAGE_JSON=$(jq -r '.result // empty' <<<"$RESP" 2>/dev/null || true)
  if [[ -z "$TRIAGE_JSON" ]] || ! jq -e \
      '(.status=="quiet") or (.status=="actionable" and (.findings|type=="array"))' \
      <<<"$TRIAGE_JSON" >/dev/null 2>&1; then
    echo "- CONTRACT VIOLATION (triage): missing/unparseable/invalid-shape output" >> memory/STATE.md
    echo "$RESP" >> memory/STATE.md
    exit 4
  fi
  echo "$TRIAGE_JSON" >> memory/STATE.md
  [[ "$(jq -r .status <<<"$TRIAGE_JSON")" == quiet ]] && { echo quiet; exit 0; }

  # 2 CONDUCT: fable-5, effort high, read-only, fresh context, JSON out.
  # Prompt via STDIN, not argv: a large STATE.md/CONTRACT.md pushes past
  # the ~32KB Windows argv ceiling ("Argument list too long") the first
  # time either file grows past a trivial size.
  { cat conductor.md; \
    echo "STATE:"; cat memory/STATE.md; \
    echo "TRUST:"; trust_render; \
    echo "CONTRACT:"; cat contract.md; } \
    | claude -p --model "$CONDUCTOR_MODEL" --effort high --tools "Read" \
    --json-schema "$CONDUCTOR_SCHEMA" \
    --output-format json > memory/last-conductor.json
  log_cost conductor 0.35

  STOP_REASON=$(jq -r '.stop_reason? // empty' memory/last-conductor.json 2>/dev/null || true)
  if [[ "$STOP_REASON" == "refusal" ]]; then
    echo "- CONTRACT VIOLATION (conductor): refusal" >> memory/STATE.md
    cat memory/last-conductor.json >> memory/STATE.md
    exit 5
  fi

  # 2a ROUTE-TOLERANCE: never iterate on a model you didn't choose.
  # NOTE: .modelUsage's presence/shape isn't documented by `claude --help`;
  # confirm this jq path against a real response during CHECK 3. The `//` is
  # coalesced BEFORE `keys` deliberately - jq's `//` only substitutes for
  # null/false results, not runtime errors, so `null | keys[0]` would abort
  # the whole script under `set -e` if .modelUsage were ever absent.
  SERVED=$(jq -r --arg m "$CONDUCTOR_MODEL" '(.modelUsage // {}) | keys[0] // $m' memory/last-conductor.json)
  [[ "$SERVED" != *"${CONDUCTOR_MODEL#claude-}"* ]] && { echo "- rerouted" >> memory/STATE.md; exit 2; }

  WORK_ORDER=$(jq -r '.result // empty' memory/last-conductor.json 2>/dev/null || true)
  if [[ -z "$WORK_ORDER" ]] || ! jq -e \
      '(.action=="execute" or .action=="queue" or .action=="stop") and (.item|type=="string") and (.skill|type=="string") and (.spec|type=="string") and (.done_when|type=="array")' \
      <<<"$WORK_ORDER" >/dev/null 2>&1; then
    echo "- CONTRACT VIOLATION (conductor): missing/unparseable/invalid-shape work order" >> memory/STATE.md
    cat memory/last-conductor.json >> memory/STATE.md
    exit 5
  fi

  echo "$WORK_ORDER" > work-order.json
  SKILL=$(jq -r .skill work-order.json); ACTION=$(jq -r .action work-order.json)
  [[ "$ACTION" == stop  ]] && exit 0
  [[ "$ACTION" == queue ]] && { echo "- queued: $SKILL — $(jq -r .item work-order.json)" >> memory/STATE.md; continue; }

  # 3 EXECUTE: sonnet-5, effort medium, full tools, isolated worktree.
  # RUN_ID in the branch name: "loop/<skill>-$i" alone collides across
  # separate tick invocations (retried tick, two ticks in one process
  # window) and kills `git worktree add -b` with "branch already exists".
  WT="../wt-$RUN_ID-$i"
  git worktree add "$WT" -b "loop/$SKILL-$RUN_ID-$i" >/dev/null
  # KURULUM (g): taze worktree'de node_modules YOK; worker'dan önce kurulum.
  # npm ci lockfile'dan kurar; başarısızsa worker hiç başlatılmaz.
  if ! ( cd "$WT" && npm ci --no-audit --no-fund >/dev/null 2>&1 ); then
    trust_record "$SKILL" fail
    echo "- FAILED: $SKILL (worktree npm ci) in $WT" >> memory/STATE.md
    git worktree remove --force "$WT" >/dev/null 2>&1 || true
    continue
  fi
  # Fail closed like triage/conductor above: a `claude` crash here (network
  # blip, nonzero exit) must not kill the whole script under `set -e` with
  # no trace — it needs a STATE.md line, a trust fail, and a `continue`.
  # The CLI's own JSON envelope goes to WORKER-LOG.json, not
  # IMPLEMENTATION.md: implement.md tells the worker to keep its own
  # 3-line decision log at IMPLEMENTATION.md, and overwriting that with
  # the envelope silently destroys it.
  if ! ( cd "$WT" && claude -p \
      --append-system-prompt "$(cat "$OLDPWD/workers/implement.md")" \
      --model "$WORKER_MODEL" --effort medium --output-format json \
      < "$OLDPWD/work-order.json" \
      | jq -r .result > WORKER-LOG.json ); then
    trust_record "$SKILL" fail
    echo "- FAILED: $SKILL (worker-crash) in $WT" >> memory/STATE.md
    continue
  fi
  log_cost worker 0.10

  # 4 VERIFY: fresh fable-5, effort high, no tools, sees only spec + diff.
  # Prompt via STDIN (routine to exceed argv limits on a real diff).
  # Stage first: plain `git diff` omits untracked files, so a worker that
  # only ADDED files would hand the verifier an empty diff. Staged diff
  # shows everything the worker did, including new files.
  { cat workers/verify.md; \
    echo "SPEC:"; jq -r .spec work-order.json; \
    echo "DIFF:"; ( cd "$WT" && git add -A && git diff --cached ); } \
    | claude -p --model "$VERIFIER_MODEL" --effort high --tools "" \
    --output-format json > memory/last-verifier.json || true
  # Empty or unparseable envelope = verifier crash, not a reroute or a
  # quiet FAIL. Check this BEFORE the reroute check below: an empty file
  # also yields an empty $SERVED_V, which would otherwise misclassify a
  # crash as "rerouted" (wrong diagnosis, sends a human down the wrong
  # runbook entry).
  if ! jq -e . memory/last-verifier.json >/dev/null 2>&1; then
    trust_record "$SKILL" fail
    echo "- FAILED: $SKILL [$(jq -r .item work-order.json)] (verifier-crash) in $WT" >> memory/STATE.md
    continue
  fi
  SERVED_V=$(jq -r '(.modelUsage // {}) | keys[0] // empty' memory/last-verifier.json)
  if [[ -z "$SERVED_V" ]]; then
    trust_record "$SKILL" fail
    echo "- FAILED: $SKILL [$(jq -r .item work-order.json)] (verifier-crash) in $WT" >> memory/STATE.md
    continue
  fi
  if [[ "$SERVED_V" != *"${VERIFIER_MODEL#claude-}"* ]]; then
    echo "- rerouted (verifier)" >> memory/STATE.md
    exit 2
  fi
  V=$(jq -r '.result // empty' memory/last-verifier.json 2>/dev/null || true)
  if [[ -z "$V" ]]; then
    trust_record "$SKILL" fail
    echo "- FAILED: $SKILL [$(jq -r .item work-order.json)] (verifier-crash) in $WT" >> memory/STATE.md
    continue
  fi
  log_cost verifier 0.40

  # 5 GATE: deterministic; then ledger; ship only at auto tier.
  if [[ "$V" == PASS* ]] && ( cd "$WT" && "$OLDPWD/guardrails/verify.sh" ); then
    trust_record "$SKILL" pass
    if [[ "$(trust_tier "$SKILL")" == auto ]]; then
      # "shipped" only after the whole chain actually succeeded; a failed
      # commit/PR is recorded as ship-FAILED, never claimed as done.
      if ( cd "$WT" && git add -A && git commit -qm "loop: $SKILL" && gh pr create --fill ); then
        echo "- shipped: $SKILL" >> memory/STATE.md
      else
        echo "- ship-FAILED: $SKILL in $WT" >> memory/STATE.md
      fi
    else
      echo "- review: $SKILL in $WT" >> memory/STATE.md
      # A human gate is now pending on this exact item; nothing about it
      # changes on i+1 (conductor would just pick it again), so stop the
      # tick here instead of re-executing and re-verifying the same work.
      echo "queued for human review; not re-running the same item"
      exit 0
    fi
  else
    trust_record "$SKILL" fail
    # Two-FAIL rule keys on the SAME item (contract.md: "verify fails
    # twice on the same item"), not on skill alone — a bare skill-level
    # counter would conflate unrelated items and never reset. grep -cF is
    # a fixed-string count on purpose: the item text can contain regex
    # metacharacters that would otherwise change what the pattern matches.
    ITEM=$(jq -r .item work-order.json)
    echo "- FAILED: $SKILL [$ITEM] (verify) in $WT" >> memory/STATE.md
    VFAILS=$(grep -cF "FAILED: $SKILL [$ITEM] (verify)" memory/STATE.md || true)
    [[ "$VFAILS" -ge 2 ]] && exit 6
  fi
  cost_check --budget "$DAILY_BUDGET_USD" || exit 3
done
exit 1   # iteration cap without stop: check STATE.md
