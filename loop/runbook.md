# Runbook (BUILD 8)

## Console (from the repo root)
- `make tick` - one loop run NOW (spends real money; budget-gated)
- `make queue` - what awaits a human (reviews, queues, failures, contract violations)
- `make trust` - per-skill trust ledger
- `make audit` - weekly cost report
- `make goals` - re-verify all standing goals
- `make clean-worktrees` - remove loop worktrees (DESTRUCTIVE - see Recovery)

No `make` on this machine (e.g. plain Windows without a make port)?
`loop/ops.sh` is a dependency-free bash equivalent — same six verbs, same
STATE.md/ledger files, nothing Makefile-specific: `bash loop/ops.sh
tick|queue|trust|audit|goals|clean-worktrees`. Keep both: the Makefile is
what CI/other tooling expects to find; ops.sh is what a bare `bash` on any
platform can run without a make binary at all.

## Alarms
| Signal | Meaning | Action |
|---|---|---|
| exit 0 | quiet, done, or a result just queued for human review | nothing (review-queued: check `make queue`) |
| exit 1 | iteration cap without stop | read STATE.md; conductor kept finding work - check for a queue loop |
| exit 2 (reroute) | safeguard router swapped models mid-run | read checkpoint; re-run item tomorrow; never iterate on swapped output |
| exit 3 (budget) | daily spend hit the line | make audit; find which stage grew; fix the effort map, not the budget |
| exit 4 | triage output failed its JSON contract | read the CONTRACT VIOLATION block in STATE.md (raw output preserved) |
| exit 5 | conductor output failed its JSON contract | as exit 4; recurring refusals = audit prompts for reasoning-echo phrasing |
| exit 6 | same item failed verify twice | no unattended continuation; read the two `FAILED: ... [item] (verify)` lines in STATE.md and decide by hand |
| stop_reason: refusal | safety classifier declined (HTTP 200) | official path: fall back to Opus 4.8; recurring on one skill = audit that skill |
| ALERT demoted | an established skill dropped below 90% | read its last 3 fails; usually the spec pattern, not the worker |
| goal VIOLATED | something finished stopped being true | sentinel gives suspects; fix goes through the normal pipeline |
| maker/checker standoff x2 | neither is presumed right | you decide, or a third fresh reviewer judges evidence |
| verify-goals timeout | predicate too expensive | that is a violation; cheapen the predicate |

## Recovery: leftover worktrees (wt-N)
A crashed or failed run leaves repo-root/wt-N directories. The NEXT tick
dies at `git worktree add` until they are removed - but they are also
the pending-review evidence `make queue` points at. Order is law:
1. `make queue`, review anything referencing a wt-N
2. only then `make clean-worktrees`
Branches named loop/<skill>-N are never auto-deleted; prune them in the
monthly delete pass.

## Cron (install at WEEK 2, not before - guide law)
Edit /path/to/repo below (template - MUST be edited), then `crontab -e`:

    PATH=/usr/local/bin:/usr/bin:/bin   # MUST include claude, jq, gh (check: which claude)
    DAILY_BUDGET_USD=5
    0 7 * * 1-5  cd /path/to/repo/loop && flock -n memory/.tick.lock ./loop.sh >> memory/cron.log 2>&1
    30 7 * * *   cd /path/to/repo/loop && ./verify-goals.sh >> memory/cron.log 2>&1
    0 8 * * 1    cd /path/to/repo/loop && claude -p "$(cat compost.md)" --model claude-fable-5 --effort high --tools "Read" --output-format json >> memory/cron.log 2>&1

Notes:
- PATH: cron's default is /usr/bin:/bin; claude/gh/jq usually live
  elsewhere. Auth: claude must be logged in for the cron user; macOS
  keychain-backed auth can fail under cron - test one manual run first.
- Locking: flock stops a hung yesterday-tick overlapping today's
  (trust.tsv update-loss race; STATE.md interleaving). The lock lives in
  memory/, not /tmp (multi-user /tmp is untrusted). macOS has no
  flock(1): use a mkdir-based lock in memory/ or a launchd job (launchd
  never overlaps the same label).
- Missed runs: plain cron skips ticks while the machine sleeps. Linux:
  anacron or a systemd timer with Persistent=true. macOS: launchd
  StartCalendarInterval fires on wake. Windows/Git Bash: no cron - Task
  Scheduler (schtasks) with "run as soon as possible after a missed
  start".
- TZ: cron's timezone defines both the 07:00 tick and the budget-day
  reset (usage.log day matching).
- GNU userland required: verify-goals.sh (GNU sed -i) and cost-check.sh
  (GNU date -d) break on stock macOS/BSD tools - install coreutils +
  gnu-sed, or run under Linux/WSL/Git Bash.
- The compost line is the weekly slot the guide's own cron table omits
  (mandatory: Week 4's graduation depends on compost sign-offs).
  --tools "Read" mechanically enforces propose-only.

## 30-day trust schedule (do not skip graduations)
| Week | Level | You do | Graduate when |
|---|---|---|---|
| 1 | L1 report | Builds 1-6; make tick by hand daily; read everything | 3 consecutive runs route exactly as you would have |
| 2 | L2 draft | cron on; make queue with coffee; reviews feed the ledger | 2 skills cross 20 logged runs |
| 3 | L3 ship | make audit vs the formula; best skill goes unattended | 1 week, zero interventions |
| 4 | L4 grow | compost sign-offs; approve 1 proposed skill; run the delete pass | you removed something and nothing broke |
