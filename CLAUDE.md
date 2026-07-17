# Kullanılır mı — proje rehberi

İlaç/tedavi deneyimi platformu. Kaynak gerçeklik: **docs/master-plan.md**
(faz planı, veri modeli sözleşmesi, kickoff kararları). Faz ilerlemesi:
**.superpowers/sdd/progress.md**.

## Durum

- **Aktif faz:** Faz 0-5 master'a merge edildi (PR #1-#6, CI yeşil) —
  sırada Faz 6 (rozet + Google OAuth).
- Bekleyen insan adımları: Neon + Vercel hesapları (canlı yayın için);
  Vercel'e ANTHROPIC_API_KEY; prod'da admin:grant; opsiyonel Resend
  anahtarı; next-intl onayı (UI i18n → Faz 5.1).
- Yerel e2e: `npm run build && npm start` kullan (`next dev` çok işlemli,
  dosya tabanlı PGlite çökebiliyor — spec kapanış notları).

## Komutlar

```
npm run dev         # dev sunucu (Turbopack)
npm run build       # prod build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # vitest (hermetik; in-memory PGlite, secret gerekmez)
npm run db:generate # drizzle-kit migration üret
npm run db:migrate  # migration uygula (DATABASE_URL gerekir)
```

## Kritik kurallar

1. **Marka string'i koda gömme** — hepsi `src/config/brand.ts`'ten gelir.
2. **Veri modeli sözleşmedir** — şema değişikliği önce docs/master-plan.md
   "Veri Modeli" bölümünü güncellemeli; yan etkiler kontrollü sözlükten
   (join tablosu), asla serbest metin değil.
3. **Her yayın API'si `src/lib/ai/moderate.ts`'ten geçer** (Faz 1'de no-op
   stub, Faz 3'te gerçek). İmza: `moderate(content, kind) →
   {verdict:'ok'|'flag'|'block', reasons[]}`; AI timeout → içerik 'pending'.
4. **DB:** prod Neon, dev/test PGlite — `src/db/index.ts:getDb()` seçer.
   Testler kendi in-memory PGlite örneğini kurar; CI secret'sız kalmalı.
5. **Yayına kadar noindex** — `next.config.ts` header'ı + `layout.tsx`
   `metadata.robots`; Faz 7'de birlikte kaldırılır.
6. **shadcn registry'sine (ui.shadcn.com) ağ politikası izin vermiyor** —
   bileşenler `src/components/ui/` altına elle vendor'lanır
   (components.json + tema değişkenleri hazır).
7. Teknoloji yığını master planda **sabittir**, alternatif önerme.
8. Her içerik sayfasında sabit tıbbi disclaimer bileşeni (Faz 1'de gelir).

<!-- Aşağıdaki dört blok loop/guardrails/verify.sh tarafından denetlenir;
     başlık metinleri İngilizce KALMALI (## NEVER vb.), içerik projeye özgü. -->

## NEVER (laws; exceptions require asking first)
- Never exceed 200 changed lines in one commit without asking.
- Never report work as done from your own assessment. Done = verify.sh passed.
- Never invent a secret, an endpoint, or a convention. Stop and ask.
- Never add a dependency. Propose it in loop/memory/STATE.md and stop.
- Never exceed effort high inside any loop. xhigh is for one-shot reviews only.
- Never edit or delete a test to make it pass. That is a fail, always.
- Never touch the data-model contract (docs/master-plan.md "Veri Modeli"),
  auth, or drizzle migrations from inside the loop — queue for a human.
- Never hardcode brand strings (must come from src/config/brand.ts) and
  never publish content that bypasses src/lib/ai/moderate.ts.
- Never echo, transcribe, or explain your internal reasoning in response
  text. (Official: triggers reasoning_extraction refusals on Fable 5.)
- When a /goal condition passes, write goals/<name>.md with the condition as
  its predicate before reporting success.

## DISPATCH (route every task; first match wins)
| model           | marginal    | appetite | intelligence | taste |
|-----------------|-------------|----------|---------------|-------|
| claude-fable-5  | 2 (credits) | 3        | 10            | 10    |
| claude-opus-4-8 | 7 (sub)     | 6        | 8             | 9     |
| claude-sonnet-5 | 9 (sub)     | 8        | 7             | 7     |
1. Decision (plan/review/route/standoff) -> fable-5, effort high, read-only.
2. Reads >50k tokens (logs/PDFs/screenshots) -> sonnet-5, effort medium.
   Never fable.
3. Ships to users (UI/API/copy) -> taste >= 8 gets final pass.
4. Spec complete -> sonnet-5, effort medium.
5. Else sonnet-5; escalate one rung on a miss without asking.

## WORDS
- "intelligence" = hardest problem handled unsupervised
- "taste" = UI/UX, code quality, API design, copy
- "done" = the predicate passes; nothing else
- "small" = under 50 changed lines; "quick" = under 10 minutes of your time
- "cleanup" = behavior identical, verify.sh green before and after
- "faz" = a phase in docs/master-plan.md; "defter" = .superpowers/sdd/progress.md

## DONE
- Every task has a machine-checkable done_when before work starts.
- A fresh-context agent that saw neither plan nor draft verifies against it.
- loop/guardrails/verify.sh (lint + typecheck + vitest) has the final vote.
- Deviations: conservative option, log to IMPLEMENTATION.md, continue.
- Maker and checker disagree twice -> stop, queue for a human.
