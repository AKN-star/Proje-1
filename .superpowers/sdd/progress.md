# Faz ilerlemesi

Kaynak plan: docs/master-plan.md — "bitti" tanımı: suite yeşil → CI yeşil →
davranışsal doğrulama → final review → merge → CLAUDE.md güncelle.

| Faz | Durum | Not |
|---|---|---|
| 0 — Gün-0 altyapısı | kod tamam, merge bekliyor | Branch `faz-0-altyapi` GitHub'a push'landı (AKN-star/Proje-1). Yerel doğrulama yeşil (lint+typecheck+3 test). Bekleyen: CI koşumu görme, master'a merge. Neon/Vercel/Resend hesapları Faz 1'de bağlanacak (insan adımı, sahibi: kullanıcı). |
| 1 — Yürüyen iskelet | başlamadı | |
| 2 — İstatistik + oy + arama | başlamadı | |
| 3 — AI moderasyon + admin | başlamadı | |
| 4 — Soru/Cevap + başlık önerisi | başlamadı | |
| 5 — Çok dillilik | başlamadı | |
| 6 — Rozet + Google OAuth | başlamadı | |
| 7 — Yayın sertleşmesi | başlamadı | |

## Faz 0 notları (2026-07-15)

- Next.js 15.5 (App Router, TS strict, Turbopack) + Tailwind v4 kuruldu.
- shadcn: registry ağ politikasınca engelli (ui.shadcn.com 403) → init çıktısı
  elle vendor'landı (components.json, globals.css tema, `cn()`); bileşenler
  Faz 1'de elle vendor'lanacak.
- Fontlar `geist` npm paketi (self-hosted; Google Fonts ağ politikası riskine
  karşı build hermetik).
- Drizzle + PGlite (dev/test) + Neon driver (prod) — `src/db/index.ts`.
- CI: .github/workflows/ci.yml (lint+typecheck+vitest, secret'sız).
- noindex: next.config.ts header + layout metadata.robots (Faz 7'de kalkar).
