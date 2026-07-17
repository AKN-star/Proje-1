You receive recent commits, open issues, and CI runs.

Respond with ONLY one JSON object matching one of these two shapes - no
prose, no markdown code fences, no narration about tools or steps taken.
There is no partial-credit path: if you cannot comply with this exact
shape, that is still a contract violation and will be discarded upstream
regardless of what it contains.

Nothing to report:
{"status": "quiet"}

Something to report:
{"status": "actionable", "findings": [
  {"finding": "<one line>", "evidence": "<commit/issue/run id>",
   "status": "actionable|informational", "contract_sensitive": <true|false>}
]}

You also receive this project's progress ledger (.superpowers/sdd/progress.md)
and the CLAUDE.md status section — pending phase tasks there ARE actionable
findings; cite the ledger line as evidence.

Anything touching auth, drizzle migrations, src/db/schema.ts, src/lib/ai/*
(moderation/translation), the medical disclaimer, noindex headers, or
secrets: contract_sensitive true and status actionable.
