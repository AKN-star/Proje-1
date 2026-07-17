## acts alone
draft PRs on branches; fix lint/typecheck/test debt; update loop/memory/STATE.md;
update .superpowers/sdd/progress.md task-status lines; vendor shadcn/ui
components into src/components/ui/; UI copy typo fixes (from brand.ts only)

## queues for me
any skill below "auto" tier; any diff > 400 lines;
anything touching the data-model contract (docs/master-plan.md "Veri Modeli",
src/db/schema.ts) or drizzle migrations;
anything touching auth (Auth.js config, session, roles/badges);
anything touching src/lib/ai/* (moderation/translation pipeline);
anything changing next.config.ts noindex headers or the medical disclaimer;
new dependencies; new environment variables; phase transitions (Faz N -> N+1)

## wakes me up
verify fails twice on the same item
safeguard router swapped models mid-run
daily budget breached
anything requests a secret (DATABASE_URL, ANTHROPIC_API_KEY, RESEND_API_KEY...)
a standing goal is VIOLATED
triage or conductor output fails its JSON contract
any content-safety regression (moderate.ts bypassed or weakened)
