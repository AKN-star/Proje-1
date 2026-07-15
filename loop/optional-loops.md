# Optional Loops (BUILD 7) - catalog, NOT installation

LAW (guide, CHECK 7): install a loop only when its `condition:` predicate
exits 0. Installing speculatively is how systems bloat. Predicates follow
BUILD 5's rules (a command; cheap, deterministic, read-only) and run from
`loop/`. Nothing in this file is installed; CHECK 7 asserts that
`quorum.sh`/`conduct.sh` do not exist.
SECURITY: `condition:` lines are executed via bash -c by CHECK 7 -
repo-trusted by design (same model as goals/ predicates): commit access
here is command execution on the machine running the check.

## quorum
Three cheap voters read the triage signals independently; the conductor
wakes only on a 2-of-3 actionable vote. MUST: voters never see each
other's answers; wake threshold 2-of-3.
condition: grep -qE '^- stop:' memory/STATE.md
Prerequisites before this can ever fire or be installed (all verified
during BUILD 7 planning):
- loop.sh's stop path exits silently today, so the signal this predicate
  greps for is never written - a one-line stop-logging addition (BUILD 3
  file, deliberately parked) must land first. Until then the condition
  is honestly false, never silently true.
- The guide's snippet is unusable verbatim here: its grep cannot match
  this repo's JSON triage contract (use `jq -e '.status=="actionable"'`,
  fail-closed, per the Revision 2 precedent); its voters (llm+OpenRouter)
  are absent and outside the DISPATCH table (3x sonnet-5 keeps mechanics
  but collapses voter diversity - accepted degradation or a new
  dependency, human decision); /tmp/signals.txt and conduct.sh have no
  writers (loop.sh needs a triage/conduct refactor first); a failed
  `exec` kills the shell before the `||` fallback; add `log_cost` calls
  per voter or BUILD 6's ledger undercounts.
Cost: 3 voters = +$0.02/tick vs $0.35 saved per avoided wasted wake -
installing pays only when the wasted-wake rate exceeds ~5.7% of ticks.

## ratchet
Monotonic improvement on one metric, or self-revert. MUST: the number
NEVER goes up; revert anything that raises it or breaks a test; never
game the metric via config (echoes CLAUDE.md's never-edit-tests law);
timebox, report survivors. The finished floor graduates into goals/
(BUILD 5) per the CLAUDE.md graduation law.
condition: test -f ../package.json
(Proxy for "one number matters": no measurable lint/test surface exists
until a real app does. Refine the predicate when the metric is chosen.)

## sparring
Breaker writes ONE failing test daily under tests/sparring/ (@sparring);
builder fixes CODE only. MUST: neither touches the other's output; never
edit/weaken/delete a sparring test (already a CLAUDE.md NEVER); disputes
queue for a human. WARNING (unresolved in the guide): two daily agents
share one working tree with no lock - stagger their schedules at install
time.
condition: [ "$(git -C .. log --since='7 days ago' --oneline -- ':!loop' ':!docs' ':!CLAUDE.md' | wc -l)" -ge 5 ]
(Proxy for "you ship code daily": >=5 non-scaffolding commits in the
last 7 days.)

## compost
Weekly exhaust-reader: FAILED in STATE.md, fails in trust.tsv, FAILs in
goal-ledger.tsv, PRs closed unmerged -> AT MOST 3 proposals (a new
CLAUDE.md law quoting incidents / a skill fix / a missing standing
goal). MUST: propose only; human signature required; clean week = say
so.
condition: true
(The guide says "install always, weekly" - this condition fires by
design. DECISION recorded 2026-07-08, EXECUTED BY BUILD 8: compost.md +
the Monday cron line in runbook.md provide the weekly slot the guide's
own cron table omits - mandatory, since Week 4's graduation depends on
compost sign-offs. `--tools "Read"` mechanically enforces propose-only.)
