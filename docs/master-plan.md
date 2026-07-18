# "Kullanılır mı" — İlaç & Sağlık Deneyim Platformu — Master Plan (v2, revize)

> **Çalışma adı:** Kullanılır mı (marka kararı sonraya bırakıldı; kodda nötr `app` adlandırması, tüm marka string'leri tek dosyadan: `src/config/brand.ts`).

## Context

Reddit/Ekşi tarzı platformlar var ama ilaç ve sağlık deneyimlerine odaklanan yapılandırılmış bir platform yok. Hedef **yayınlanacak gerçek ürün**: kullanıcı bir ilaç/tedavi başlığı altında yapılandırılmış deneyim kaydı bırakır (amaç, süre, etki puanı, kontrollü sözlükten yan etkiler + serbest metin); site bunlardan otomatik istatistik üretir ("%68 etkili buldu, en sık yan etki: bulantı"). Bu model platformun özgünlüğüdür.

**Repo gerçeği (doğrulandı):** `/home/user/repo` tek commit (`initial`, sadece README), branch `master`, **remote yok**. Ortamda Node 22 + npm/pnpm var; `gh`/`vercel` CLI yok. Yani Faz 0'ın ilk insan adımı GitHub remote bağlamak; ona kadar her şey lokal commit'lenir.

## Bu revizyonda değişenler (taslak → v2)

1. **`topic_stats` şemaya eklendi** — sözleşme 3'te geçiyordu ama tablo listesinde yoktu. Güncelleme mekanizması netleşti: deneyim yazma/kaldırma ile **aynı transaction'da yeniden hesap** (başlık başına satır sayısı küçük; cron/MV karmaşası gereksiz).
2. **`side_effects text[]` → `experience_side_effects` join tablosu.** FK bütünlüğü + istatistik `GROUP BY term_id` ile trivial olur; text[] içinde sözlük dışı değer sızması imkânsızlaşır.
3. **Dev/test DB: PGlite.** Drizzle PGlite'ı destekler; lokal geliştirme + CI Neon'suz ve secret'sız (hermetik) çalışır. Neon yalnız deploy hedefi — Neon insan adımı hiçbir kod task'ını bloklamaz.
4. **Auth.js uyumu + username onboarding.** `users` tablosu `@auth/drizzle-adapter` şekline uyumlu kurulur (emailVerified, accounts/sessions/verification_tokens tabloları dahil). Magic-link kayıtta takma ad toplamaz → ilk girişte zorunlu "takma ad seç" onboarding adımı (Faz 1). Dev'de magic-link konsola loglanır (Resend gelmeden auth geliştirilebilir).
5. **KVKK açık rıza Faz 1'den itibaren.** Sağlık verisi KVKK'da özel nitelikli kişisel veridir; takma adlı olsa bile kayıt anında açık rıza checkbox'ı gerekir. Tam yasal metin Faz 7'de ama consent alanı ve checkbox baştan var — sonradan retrofit acı verir.
6. **Launch'a kadar gizlilik:** tüm ortamlara `X-Robots-Tag: noindex` + Vercel deployment protection. Gerçek moderasyon Faz 3'te geldiği için Faz 1–2'deki canlı site indexlenmemeli/paylaşılmamalı; Faz 7'de kaldırılır.
7. **Arama eklendi (Faz 2)** — taslakta hiç yoktu; ilaç platformu aramasız kullanılamaz. `pg_trgm` + ILIKE, topic adları ve etken madde üstünde.
8. **`translations` önbelleğine `source_hash`** + unique index `(target_type, target_id, field, locale)` — içerik düzenlenince bayat çeviri servis edilmesin.
9. **Şema düzeltmeleri:** `moderation_log.actor` → `actor_type('ai'|'user') + actor_id`; `experiences/questions/answers.status`'a `'pending'` eklendi (AI moderasyon timeout'unda kullanıcıyı bloklamak yerine beklet); `votes.value` CHECK (+1|-1); `badge_requests`'e `reviewed_by, reviewed_at`.
10. **Deneyim çokluğu kararı:** bir kullanıcı aynı başlığa **birden fazla** deneyim bırakabilir (farklı dönem/amaç gerçek bir senaryo); istatistik yayınlanmış tüm kayıtları sayar. Unique kısıt yok.
11. **Rate limiting Postgres-içi** (sliding window) — Upstash gibi yeni bir hesap/insan adımı eklememek için.

## Teknoloji Yığını (sabit — tartışmaya kapalı, alt modeller değiştirmez)

- **Framework:** Next.js 15 (App Router) + TypeScript strict + RSC
- **DB:** PostgreSQL — prod: Neon; dev/test: **PGlite** (aynı Drizzle şeması) + **Drizzle ORM**, migration `drizzle-kit`
- **Auth:** Auth.js v5 (email magic-link + Google provider) + `@auth/drizzle-adapter`
- **UI:** Tailwind CSS v4 + shadcn/ui; mobil öncelikli
- **i18n (UI):** `next-intl` — `messages/tr.json`, `messages/en.json`
- **AI (moderasyon + çeviri):** Anthropic API — `claude-haiku-4-5`; tek sarmalayıcı `src/lib/ai/client.ts`
- **E-posta:** Resend (magic-link + rozet bildirimi); dev'de console transport
- **Hata izleme:** Sentry · **Test:** Vitest + Playwright · **CI:** GitHub Actions (lint+typecheck+vitest, ilk commit'te, secret'sız/hermetik) · **Deploy:** Vercel + Neon

## Veri Modeli (sözleşme — feature planları bu tabloya referans verir)

```
users                  id, email, email_verified, username(unique, takma ad; NULL=onboarding bekliyor),
                       locale('tr'|'en'), role('user'|'pro'|'mod'|'admin'),
                       pro_badge('doctor'|'pharmacist'|null), kvkk_consent_at, banned_at(null=aktif),
                       email_optout(bool, default false — yanıt bildirimi tercihi, Faz 8), created_at
                       -- hesap silme = anonimleştirme (Faz 8): email tombstone, username/name/image/pro_badge NULL;
                       -- satır FK'ler nedeniyle silinmez, içerik "anonim" imzasıyla kalır
                       (+ Auth.js adapter tabloları: accounts, sessions, verification_tokens;
                       adapter uyumu için email_verified kolonu DB'de "emailVerified" adıyla,
                       name/image kolonları nullable olarak tutulur)
topics                 id, slug(unique), type('drug'|'condition'|'treatment'),
                       status('active'|'pending'|'rejected'), created_by(FK users, null=seed),
                       canonical_name, atc_code(null olabilir)
topic_i18n             topic_id FK, locale, name, summary        -- PK(topic_id, locale)
drug_details           topic_id FK(unique), active_ingredient, form, strength, source('titck'|'manual')
experiences            id, topic_id FK NOT NULL, user_id FK NOT NULL, purpose(text),
                       duration_days(int|null), effectiveness(1-5), body(text), lang(ISO),
                       status('published'|'pending'|'flagged'|'removed'), created_at
                       -- aynı kullanıcı aynı başlığa birden fazla kayıt bırakabilir
experience_side_effects experience_id FK, term_id FK side_effect_terms  -- PK(experience_id, term_id)
side_effect_terms      id, slug(unique), name_tr, name_en        -- kontrollü sözlük; istatistik bunun üstünden
topic_stats            topic_id PK/FK, experience_count, avg_effectiveness, effective_pct,
                       top_side_effects(jsonb [{termId,count}]), updated_at
questions              id, topic_id FK NOT NULL, user_id FK, title, body, lang, status, created_at
answers                id, question_id FK NOT NULL, user_id FK, body, lang, status, created_at
votes                  user_id + target_type('experience'|'answer') + target_id (unique bileşik),
                       value CHECK(-1|+1)
reports                id, reporter_id FK, target_type, target_id, reason(enum), unique(reporter_id, target_type, target_id),
                       status('open'|'resolved'), created_at
moderation_log         id, target_type, target_id, action('ai_flag'|'ai_block'|'ai_timeout'|'mod_remove'|'mod_restore'|'mod_ban'|'user_edit' [Faz 9: düzenleme denetim izi + edit rate-limit sayacı]),
                       detail(jsonb: AI gerekçesi), actor_type('ai'|'user'), actor_id(FK users|null), created_at
translations           target_type, target_id, field, locale, text, model, source_hash, created_at
                       -- unique(target_type, target_id, field, locale); source_hash bayatlık kontrolü
badge_requests         id, user_id FK, claimed_role, institution, document_note,
                       status('pending'|'approved'|'rejected'), reviewed_by, reviewed_at, created_at
```

### Kritik sözleşmeler
1. **Yan etkiler serbest metin DEĞİL** — `experience_side_effects` join tablosu, `side_effect_terms` sözlüğünden çoklu seçim. ÜRETEN: Faz 1 seed. TÜKETEN: deneyim formu + istatistik.
2. **Her yayın API'si** (`experience`, `question`, `answer`) yanıt dönmeden önce `src/lib/ai/moderate.ts`'ten geçer. Faz 1'de aynı imzalı **no-op stub** üretilir (imza: `moderate(content, kind) → {verdict:'ok'|'flag'|'block', reasons[]}`), Faz 3'te gerçeklenir. AI timeout → içerik `'pending'`, kullanıcı bloklanmaz.
3. **Topic istatistikleri** canlı sorguyla değil `topic_stats` tablosundan sunulur; deneyim insert/kaldırma ile **aynı transaction'da** yeniden hesaplanır. ÜRETEN: Faz 2. TÜKETEN: topic sayfası.

```mermaid
flowchart LR
    F0[Faz 0<br/>altyapı] --> F1[Faz 1<br/>yürüyen iskelet] --> F2[Faz 2<br/>istatistik+oy+arama] --> F3[Faz 3<br/>AI moderasyon+admin] --> F4[Faz 4<br/>soru/cevap] --> F5[Faz 5<br/>çeviri] --> F6[Faz 6<br/>rozet+OAuth] --> F7[Faz 7<br/>yayın]
    F1 -.side_effect_terms sözlüğü.-> F2
    F1 -.moderate.ts no-op stub.-> F3
    F2 -.topic_stats.-> F7
    F3 -.admin paneli.-> F4 & F6
```

## Faz Planı

Her faz: kendi `spec → plan → SDD` döngüsü, kendi branch + PR. "Bitti" tanımı: suite yeşil → CI yeşil → davranışsal doğrulama (canlı tıklama) → final review (en güçlü model) → merge → CLAUDE.md güncelle.

### Faz 0 — Gün-0 altyapısı
Mevcut repo (`master`, tek commit) üstüne: Next.js 15 iskeleti + TS strict; Tailwind v4 + shadcn/ui; Drizzle kurulumu (**PGlite ile dev/test — Neon beklenmez**); GitHub Actions CI (lint+typecheck+vitest, secret'sız); `X-Robots-Tag: noindex` middleware'i; `src/config/brand.ts`; `.env.example`; `.claude/settings.json` izin allowlist'i; CLAUDE.md iskeleti (durum+komutlar+kritik kurallar); `.superpowers/sdd/progress.md`; proje skill'leri (`run-dev`, `verify-all`) ilk ihtiyaçta.
**İnsan adımı:** GitHub repo oluştur + remote bağla (push için ön şart); Neon + Vercel hesapları (Faz 1 canlıya kadar yetişmesi yeterli, kodu bloklamaz).

### Faz 1 — Yürüyen iskelet (uçtan uca EN KÜÇÜK dilim)
Seed: ~20 örnek ilaç başlığı + yan-etki sözlüğü → topic listesi → topic sayfası → Auth.js e-posta girişi (dev'de konsol magic-link) → **takma ad onboarding'i** (username NULL ise yazma öncesi zorunlu) → KVKK açık rıza checkbox'ı → giriş yapan kullanıcı deneyim kaydı bırakır → sayfada görünür → Vercel'de canlı (deployment protection açık).
İçerir: `users`(+adapter tabloları), `topics/topic_i18n/drug_details/experiences/experience_side_effects/side_effect_terms` tabloları; `moderate.ts` no-op stub; sabit tıbbi disclaimer bileşeni.
**Bilinçli YOK:** oy, soru/cevap, istatistik, arama, çeviri, gerçek moderasyon, rozet, TİTCK tam listesi, Google OAuth.
**İnsan adımı:** Resend hesabı (test modu); Neon DB + Vercel proje bağlama.
**Faz kapanış şartı:** kullanıcı canlı URL'de bir deneyim kaydı bırakıp görür (insan-kapılı E2E).

### Faz 2 — Deneyim derinliği + istatistik (ürünün özgün kalbi)
Yapılandırılmış deneyim formunun tam hali; `topic_stats` üretimi (transaction-içi yeniden hesap) + topic sayfasında istatistik bloğu (★ ortalama, %etkili, en sık yan etkiler); oylama; deneyim sıralama (oy/tarih); **başlık arama** (pg_trgm — topic adı + etken madde).
**Bilinçli YOK:** soru/cevap, çeviri, admin paneli.

### Faz 3 — Güvenlik katmanı: AI moderasyon + raporlama + admin
`moderate.ts` gerçek implementasyon (Anthropic API; sınıflar: ilaç satışı, tehlikeli doz tavsiyesi, spam, kişisel veri) — flagged içerik yayınlanmaz, `moderation_log`'a yazılır; timeout→pending politikası; kullanıcı raporlama; admin paneli (kuyruk: flagged+pending+reports; kaldır/geri al/banla).
**İnsan adımı:** Anthropic API anahtarı.

### Faz 4 — Soru/Cevap + kullanıcı başlık önerisi
Topic altında sorular/yanıtlar (oylamalı, moderasyondan geçer); yeni hastalık/tedavi başlığı önerisi → admin onay kuyruğu (Faz 3 paneline eklenir).

### Faz 5 — Çok dillilik
UI'nin next-intl ile TR/EN tamamlanması; içerikte "çevir" butonu → LLM çeviri + `translations` önbelleği (`source_hash` ile geçersizleme); kullanıcı locale tercihi.

### Faz 6 — Profesyonel rozet + kimlik
Rozet başvuru formu → Resend ile **hepteqsadeceteq@gmail.com**'a mail + admin panelde onay → ✔ rozet gösterimi (deneyim/yanıt kartlarında); Google OAuth.
**İnsan adımı:** Google Cloud OAuth client.

### Faz 8 — Kullanıcı deneyimi iyileştirmeleri (plan sonrası ek, 2026-07-18)
/profil (kendi içeriğini görme + kaldırma) + hesap silme (anonimleştirme); yanıt bildirimi e-postası (+ email_optout tercihi); /nasil-calisir güven sayfası; topic sayfasında amaç filtresi; sıfır sonuçta yazım önerisi; karanlık mod düğmesi. Ayrıntı: docs/specs/faz-8-kullanici-iyilestirmeleri.md

### Faz 9 — Büyüme hazırlığı (plan sonrası ek, 2026-07-18)
Sayfalama + performans index'leri (migration 0009 — kolon sözleşmesi değişmez); deneyim düzenleme (yeniden moderasyonlu); schema.org (QAPage/WebSite; ilaç sayfasına YMYL gereği rating işaretlemesi konmaz); admin kullanıcı yönetimi; paylaş linki + next/og görseli; ana sayfa boş durum bölümleri. Ayrıntı: docs/specs/faz-9-buyume-hazirligi.md

### Faz 10 — Moderasyon tamamlama + cleanup (plan sonrası ek, 2026-07-18)
Soru/yanıt için admin kuyruğu + Bildir (reports.target_type genişler — sözleşme zaten generic); soru/yanıt düzenleme; guard/formatDate/banner/test-kurulum tekilleştirmesi. Ayrıntı: docs/specs/faz-10-moderasyon-tamamlama.md

### Faz 7 — Yayın sertleşmesi
TİTCK tam ilaç listesi import script'i (önce lisans/kullanım şartı araştırması); SEO (metadata, sitemap, OG) + **noindex ve deployment protection kaldırılır**; Sentry; rate limiting (Postgres-içi sliding window); KVKK aydınlatma + açık rıza metinleri + kullanım şartları (tıbbi sorumluluk reddi dahil); Playwright e2e ana akışlar; performans; domain bağlama.
**İnsan adımı:** domain satın alma; yasal metinlerin (tercihen bir hukukçuyla) gözden geçirilmesi.

## Yürütme politikası
`orkestra` skill'i uygulanır (dispatch matrisi, wave protokolü, rapor filtreleme). Her feature planında: sözleşme kontrolü (üreten+tüketen task adlandırılmış mı), dalga analizi, test politikası (test ekle ya da açık erteleme kaydı), insan-kapılı task'lar sahip+tarih ile işaretli.

## Doğrulama
Her faz sonunda: `verify-all` (lint+typecheck+vitest, PGlite ile hermetik) → Vercel preview'da canlı tıklama ile davranışsal doğrulama → final review. Faz 1 kapanışı insan-kapılı E2E (yukarıda).

## Onay sonrası bu oturumda yapılacak ilk iş paketi
Faz 0'ın insan adımı gerektirmeyen tamamı: Next.js iskeleti, Drizzle+PGlite, Tailwind/shadcn, CI workflow, noindex middleware, `brand.ts`, `.env.example`, CLAUDE.md, allowlist. Remote henüz yok — commit'ler lokalde birikir; kullanıcı GitHub repo'yu bağlayınca push + PR açılır.

## Cevaplanmamış sorular (ilgili faz spec'inde sorulacak — şimdi bloklamıyor)
- Marka/isim ve domain (Faz 7'den önce).
- TİTCK verisinin lisans/kullanım şartları (Faz 7 başında araştırılacak).
- Rozet başvurusunda belge yükleme mi, beyan mı? (Faz 6 spec'i.)
