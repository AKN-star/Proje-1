#!/usr/bin/env bash
# Deterministic gate. No agent has final say over "done" - only this
# script's exit code does.
#
# Audits the CALLING directory, not its own location: loop.sh invokes this
# from INSIDE the worker's isolated worktree, so no `cd` here — $PWD decides.
# (Adding a cd would silently re-check the untouched main repo and turn the
# gate into a no-op that always passes.)
set -e

# 1. Must be inside a valid git repository.
git rev-parse --is-inside-work-tree >/dev/null

# 2. The constitution must exist at the repo root.
test -f CLAUDE.md

# 3. CLAUDE.md must retain its required four-block structure.
for block in NEVER DISPATCH WORDS DONE; do
  grep -q "^## $block" CLAUDE.md
done

# 4. Real stack checks (Kullanılır mı: Next.js + TS + Vitest; tests are
# hermetic — in-memory PGlite, no DATABASE_URL/secrets needed, CI-safe).
# Deps must already be installed (loop.sh worktree setup runs npm ci).
npm run lint
npm run typecheck
npm test

echo "verify.sh: OK"
