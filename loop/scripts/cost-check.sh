#!/usr/bin/env bash
# BUILD 6: budget gate + weekly report over memory/usage.log.
# --budget <usd>: exit 0 under budget; exit 1 with stderr message when
#   today's logged spend is AT or over the line (>= is a breach - the
#   loop halts the moment the line is hit, mapped to exit 3 by loop.sh).
# --report: per-stage totals since $(date -d '7 days ago'). NOTE (OD-2,
#   documented not changed): >= includes the boundary day itself, so the
#   window spans 8 calendar days once that much history exists - the
#   guide's own semantics.
set -euo pipefail
F="$(dirname "$0")/../memory/usage.log"; touch "$F"; TODAY=$(date +%F)
case "${1:-}" in
  --budget)
    spent=$(awk -F'\t' -v d="$TODAY" '$1 ~ d {s+=$3} END{printf "%.2f",s}' "$F")
    awk -v s="$spent" -v b="$2" 'BEGIN{exit (s>=b)?1:0}' \
      || { echo "spent \$$spent of \$$2" >&2; exit 1; };;
  --report)
    awk -F'\t' -v since="$(date -d '7 days ago' +%F)" \
      '$1>=since{s[$2]+=$3;t+=$3} END{for(k in s) printf "  %-10s $%.2f\n",k,s[k]; printf "  TOTAL      $%.2f\n",t}' "$F";;
esac
