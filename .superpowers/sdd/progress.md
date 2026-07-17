# Faz ilerlemesi

Kaynak plan: docs/master-plan.md — "bitti" tanımı: suite yeşil → CI yeşil →
davranışsal doğrulama → final review → merge → CLAUDE.md güncelle.

| Faz | Durum | Not |
|---|---|---|
| 0 — Gün-0 altyapısı | merge edildi (master) | Branch `faz-0-altyapi` GitHub'a push'landı (AKN-star/Proje-1). Yerel doğrulama yeşil (lint+typecheck+3 test). Bekleyen: CI koşumu görme, master'a merge. Neon/Vercel/Resend hesapları Faz 1'de bağlanacak (insan adımı, sahibi: kullanıcı). |
| 1 — Yürüyen iskelet | merge edildi (master) | Branch `faz-1-yuruyen-iskelet` (da788eb). T1-T5 + final review düzeltmeleri tamam: KVKK rızası + /hosgeldin takma ad onboarding'i, topicId server-side, purpose moderasyonu. lint+typecheck+53/53 test yeşil; canlı akış prod sunucuda doğrulandı (giriş→onboarding→deneyim→sayfada görünür). Bilinen kısıt: `next dev` çok işlemli olduğundan dosya tabanlı PGlite çökebiliyor — yerel e2e için `npm run build && npm start` (spec kapanış notları). Bekleyen insan adımları: PR'ları merge et (faz-0 #1, faz-1), Neon+Vercel hesapları bağla (canlı için), opsiyonel Resend. |
| 2 — İstatistik + oy + arama | merge edildi (master) | Branch `faz-2-istatistik-oy` (faz-1 üstüne). topic_stats+votes (migration 0003), recalcTopicStats action'a bağlı, castVote toggle (atomik), istatistik kartı + ?sirala=oy|yeni + oy butonları + çok alanlı arama (LIKE kaçışlı). 70/70 test; canlı doğrulandı (istatistik güncellenir, oy toggle, arama etken maddeyle bulur). Final review bulguları kapatıldı; kendi deneyimine oy bilinçli serbest (spec notu). PR faz-1 merge'ini bekliyor. |
| 3 — AI moderasyon + admin | merge edildi (master) | Branch `faz-3-moderasyon-admin` (faz-2 üstüne). reports+moderation_log+banned_at (migration 0004); moderate.ts gerçek (haiku, fetch, 5sn timeout→pending, anahtarsız dev=ok); raporlama (Bildir UI); /admin paneli (kuyruk+raporlar, approve/remove/resolve/ban) + admin:grant script'i. 94/94 test; canlı doğrulandı (rapor→kuyruk→kaldır→çözüldü, guard 404). SAPMA: ban loglanmıyor (enum'da değer yok — Faz 4'te mod_ban önerisi). İNSAN ADIMI: ANTHROPIC_API_KEY (Vercel env) + prod'da admin:grant. |
| 4 — Soru/Cevap + başlık önerisi | merge edildi (master) | Branch `faz-4-soru-cevap` (faz-3 üstüne). questions+answers (migration 0005) + mod_ban enum/log; soru-yanıt-oy akışı (lib/qa, actions/qa, /soru-sor, /soru/[id], topic Sorular bölümü); başlık önerisi (/baslik-oner, pending→admin Onayla/Reddet). 129/129 test; canlı doğrulandı (soru→yanıt→oy skor 1; öneri→onay→ana sayfada). Final review bulguları kapatıldı (boş slug, slug yarışı retry, yanıt sayısı sorgusu, voteAnswer eşleşme, ?next=). Sapmalar spec kapanış notlarında. PR #5 faz-3 merge'ini bekliyor. |
| 5 — Çok dillilik | merge edildi (master) | Branch `faz-5-cok-dillilik` (faz-4 üstüne), PR #6. translations tablosu (migration 0006, source_hash + PK sözleşme birebir); translateText + getOrCreateTranslation/getFreshTranslation (hash eşleşmeden servis yok, kickoff #8) + requestTranslation; kartlarda Çevir butonu + çeviri bloğu (tek bileşen); /ayarlar locale. Final review 10 bulgu kapatıldı: çift-? redirect, sahte ?cevir= 500'ü, çeviri metni moderate()'ten geçer (kural #3), safeInternalPath (ters bölü açık yönlendirme, eski kopyalar dahil), buton görünürlüğü action guard'larıyla hizalı, lang/locale mevcut sorgulara taşındı. 139/139 test; canlı smoke: sahte ?cevir= 200, /soru/notauuid 404. SAPMA: ilk review commit'i 235 satır (200 yasası; 79'u test). KAPI: UI i18n next-intl onayı bekliyor → Faz 5.1. Uçtan uca çeviri (anahtarlı) Vercel'de doğrulanacak. |
| 6 — Rozet + Google OAuth | merge edildi (master) | Branch `faz-6-rozet-oauth` (master üstüne). badge_requests (migration 0007, sözleşme birebir; belge yükleme YOK — beyan, kickoff notu spec'te); lib/badges (create/review/list, atomik koşullu UPDATE), Resend bildirimi (brand.contactEmail), /rozet-basvuru + /ayarlar rozet kartı + admin "Rozet başvuruları" bölümü + kartlarda ProBadge ✔; Google OAuth (env varsa provider + buton; yoksa zarif düşüş) + /giris/hata. Final review 10 bulgu kapatıldı (atomik review, pro_badge gerçeklik kaynağı, banlı mesajı, google action guard, OAuthAccountNotLinked sayfası, Resend/UUID_RE/etiket tekilleştirme, Promise.all). 148/148 test; canlı smoke yeşil. SAPMA: T2 465 / T3 292 satır commit (200 yasası). İNSAN ADIMI: Google Cloud OAuth client (AUTH_GOOGLE_ID/SECRET → Vercel). |
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
