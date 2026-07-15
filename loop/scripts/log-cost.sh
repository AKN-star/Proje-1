#!/usr/bin/env bash
# BUILD 6: append one cost entry per pipeline stage to the usage ledger.
# usage: log-cost.sh <stage> <amount-usd>
# NOTE (documented limitation, OD-1): amounts are the caller's ESTIMATES
# (loop.sh's hardcoded per-stage constants), not measured API spend. The
# ledger paces the budget; it is not real accounting until per-call costs
# from the CLI's JSON envelope are wired in (blocked on live CHECK 3).
echo -e "$(date -Is)\t$1\t$2" >> "$(dirname "$0")/../memory/usage.log"
