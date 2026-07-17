#!/usr/bin/env bash
# BUILD 5: standing goals + the goal ledger. A goal you only verify once
# is an assumption with a timestamp; this re-verifies every one, daily.
# Detection only - never auto-fixes anything. Fixes go through the normal
# pipeline (BUILD 3's loop.sh).
#
# Guide-defect correction: the guide's own verify-goals.sh has no `cd
# "$(dirname "$0")"` (unlike loop.sh, which does), so it resolves
# goals/*.md and memory/goal-ledger.tsv as bare relative paths against
# whichever directory happens to be the CALLER's cwd at invocation time.
# BUILD 8's own guide text invokes this script two different ways
# (Makefile: from the repo root, no cd first; cron: `cd .../loop &&
# ./verify-goals.sh`) - the same unmodified script would resolve correctly
# under one and silently wrong under the other. Corrected here, in BUILD 5
# where this script is authored: `cd "$(dirname "$0")"` makes path
# resolution deterministic and caller-position-independent, matching
# loop.sh's own existing convention. This also means every path here is
# resolved from the script's own on-disk location, never from an
# undefined env var like the guide's own example predicate's `$REPO`.
set -uo pipefail
cd "$(dirname "$0")"
LEDGER="memory/goal-ledger.tsv"; VIOLATIONS=0
for g in goals/*.md; do
  [ -e "$g" ] || continue
  grep -q '^status: retired' "$g" && continue
  pred=$(grep '^predicate:' "$g" | cut -d' ' -f2-); name=$(basename "$g" .md)
  start=$(date +%s%3N)
  if timeout 60 bash -c "$pred" >/dev/null 2>&1; then r=pass
    sed -i "s/^status:.*/status: satisfied/; s/^last-pass:.*/last-pass: $(date +%F)/" "$g"
  else r=FAIL; VIOLATIONS=$((VIOLATIONS+1)); sed -i "s/^status:.*/status: VIOLATED/" "$g"; fi
  echo -e "$(date -Is)\t$name\t$r\t$(( $(date +%s%3N) - start ))" >> "$LEDGER"
done
[ "$VIOLATIONS" -gt 0 ] && { grep -l '^status: VIOLATED' goals/*.md; exit 1; }
echo "all standing goals hold"
