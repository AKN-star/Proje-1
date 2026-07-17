# Faz 1 — Yürüyen İskelet (spec)

Amaç: uçtan uca çalışan EN KÜÇÜK dilim. Giriş yapan kullanıcı bir ilaç
başlığında yapılandırılmış deneyim kaydı bırakır ve sayfada görür.
Kaynak sözleşme: docs/master-plan.md "Veri Modeli". Bu spec o sözleşmenin
Faz 1 alt kümesini bağlar.

## Kapsam (bilinçli olarak YOK: oy, soru/cevap, istatistik bloğu, çeviri,
## gerçek AI moderasyon, rozet, Google OAuth, TİTCK tam listesi, admin paneli)

## T1 — DB şeması + seed (ÜRETEN)
`src/db/schema.ts`e Drizzle tabloları (master plan sözleşmesi birebir):
- `users`: id (uuid pk, defaultRandom), email (unique, not null), username
  (unique, not null), locale (text, default 'tr'), role (text, default
  'user'), pro_badge (text, null), created_at (timestamptz, defaultNow)
- `topics`: id uuid pk, slug unique not null, type ('drug'|'condition'|
  'treatment') not null, status (default 'active'), created_by (uuid FK
  users.id, NULL = seed), canonical_name not null, atc_code null
- `topic_i18n`: topic_id FK not null, locale not null, name not null,
  summary null; pk (topic_id, locale)
- `drug_details`: topic_id FK unique not null, active_ingredient, form,
  strength, source (default 'manual')
- `side_effect_terms`: id uuid pk, slug unique not null, name_tr not null,
  name_en not null
- `experiences`: id uuid pk, topic_id FK NOT NULL, user_id FK NOT NULL,
  purpose text not null, duration_days int null, effectiveness int not null
  (1-5 check), body text not null, lang text default 'tr', status text
  default 'published', created_at timestamptz defaultNow
- `experience_side_effects`: experience_id FK not null, term_id FK
  side_effect_terms.id not null; pk (experience_id, term_id) — yan etkiler
  SÖZLÜKTEN, asla serbest metin (kritik kural #2)
Migration: `npm run db:generate` çıktısı commit'lenir.
Seed: `src/db/seed.ts` + `npm run db:seed` script'i — 20 yaygın TR ilacı
(parol, majezik, arveles, nurofen, aspirin, augmentin, cipralex, prozac,
xanax, concerta, euthyrox, glucophage, coraspin, beloc, lustral, dolorex,
apranax, calpol, zinco, devit-3; her biri topic + topic_i18n tr/en +
drug_details) ve ~24 yan etki terimi (bulantı, baş ağrısı, baş dönmesi,
uykusuzluk, uyku hali, ishal, kabızlık, döküntü, kaşıntı, ağız kuruluğu,
çarpıntı, iştah artışı, iştah kaybı, kilo alımı, mide ağrısı, yorgunluk,
titreme, terleme, cinsel isteksizlik, huzursuzluk, hafıza sorunları,
tansiyon değişimi, ödem, karaciğer enzim yükselmesi). Seed idempotent
(onConflictDoNothing).
Test: şema round-trip (insert topic+experience+side effect join, select).

## T2 — Moderasyon stub'ı + disclaimer + doğrulama (ÜRETEN)
- `src/lib/ai/moderate.ts`: `export async function moderate(content:
  string, kind: 'experience'|'question'|'answer'): Promise<{verdict:
  'ok'|'flag'|'block'; reasons: string[]}>` — Faz 1 no-op: her zaman
  `{verdict:'ok', reasons:[]}`. İmza sözleşmedir (kritik kural #3).
- `src/components/medical-disclaimer.tsx`: sabit tıbbi uyarı bileşeni
  (metin brand.ts'e değil, i18n'e hazır sabit dosyaya:
  `src/config/disclaimer.ts` tr+en). Her içerik sayfasında görünür.
- `src/lib/validation/experience.ts`: zod YOK (yeni bağımlılık yasak) —
  el yazımı doğrulayıcı: purpose 3-200 kr, body 10-5000 kr, effectiveness
  1-5 tamsayı, duration_days null|1-3650, side_effect_ids uuid[].
  Test: doğrulayıcı sınır durumları.

## T3 — Auth.js v5 (e-posta magic link) (ÜRETEN)
Bağımlılık ekleme İZNİ (spec ile verildi; NEVER istisnası burada
yazılı): `next-auth@beta`, `@auth/drizzle-adapter`, `resend` DEĞİL —
e-posta gönderimi Faz 1'de soyutlanır: `src/lib/email/send.ts`
`sendMagicLink(to, url)` → RESEND_API_KEY yoksa konsola loglar (dev
modu), varsa fetch ile Resend REST çağrısı (SDK'sız, bağımlılıksız).
- Auth.js Drizzle adapter tabloları şemaya eklenir (accounts, sessions,
  verification_tokens — adapter'ın beklediği adlarla).
- İlk girişte username üretimi: e-posta local-part + rastgele 4 hane;
  kullanıcı sonra değiştirebilir (Faz 1'de değiştirme YOK).
- `src/auth.ts` (NextAuth config), `src/app/api/auth/[...nextauth]/route.ts`,
  `middleware.ts` YOK (koruma sayfa içinde session kontrolüyle).
- Giriş sayfası `/giris`: e-posta gir → link gönderildi ekranı.
Test: username üretici birim testi; auth config'in derlenmesi.

## T4 — Topic sayfaları (TÜKETEN: T1)
- `/` ana sayfa: marka + arama kutusu (client-side filter değil, basit
  `ilike` server araması) + topic listesi (isim, tip rozeti, deneyim sayısı).
- `/baslik/[slug]`: topic adı, drug_details özeti, disclaimer, deneyim
  listesi (yazar takma adı, amaç, süre, etki ★, yan etki chip'leri, body,
  tarih; en yeni üstte), "deneyim yaz" butonu (girişsizse /giris'e).
- RSC ile server-side veri; `getDb()` kullanılır. Tailwind + vendor'lanmış
  shadcn primitifleri (`src/components/ui/` altına button, card, input,
  badge elle eklenir — registry engelli, kritik kural #6).
Test: topic sorgu fonksiyonlarının (src/lib/queries/topics.ts) PGlite testi.

## T5 — Deneyim yazma akışı (TÜKETEN: T1+T2+T3)
- `/baslik/[slug]/deneyim-yaz`: session yoksa /giris'e yönlendir.
  Form: amaç, süre (gün, ops.), etki (1-5 yıldız radio), yan etkiler
  (sözlükten çoklu checkbox), serbest metin.
- Server Action `src/app/actions/experience.ts`: validate →
  `moderate(body,'experience')` → verdict'e göre status ('ok'→published,
  'flag'→flagged, 'block'→reddet) → insert + join tablosu → revalidate →
  topic sayfasına redirect.
Test: action'ın PGlite ile entegrasyon testi (yayınlanan deneyim topic
sayfası sorgusunda görünür).

## Dalga analizi
W1: [T1, T3] paralel (T1: schema/seed; T3: auth dosyaları — schema.ts'e
ikisi de dokunur AMA T3 yalnız adapter tablolarını ekler → çakışmayı
önlemek için T3 adapter tablolarını AYRI dosyada tanımlar:
`src/db/auth-schema.ts`, schema.ts'ten re-export).
W2: [T2, T4] paralel (dosya kesişimi yok).
W3: [T5] tek.
Sonra: suite + davranışsal doğrulama + final review (en güçlü model).

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; dev sunucuda canlı akış: giriş →
deneyim yaz → sayfada gör; final review bulguları kapatıldı; progress.md
güncel. Vercel canlısı insan adımına bağlı (Neon+Vercel hesapları) —
faz kapanışında kullanıcıya tek seferde istenir.

## Kapanış notları (final review sonrası, 2026-07-15)

- Spec'in sessizce düşürdüğü master-plan şartları kapanışta eklendi:
  `users.kvkk_consent_at`, username NULL=onboarding, `/hosgeldin`
  onboarding sayfası (takma ad + KVKK açık rıza checkbox'ı) ve yazma
  yollarında onboarding guard'ı (sayfa + action). Migration 0002.
- Review düzeltmeleri: topicId artık form'dan gelmiyor (slug'dan aktif
  topic server-side çözülür); purpose da body ile birlikte moderate()
  çağrısından geçer; e-posta gönderici adresi tek sabit (EMAIL_FROM);
  prod'da RESEND_API_KEY yoksa açık hata.
- Açık erteleme: submitExperience action'ının kendisi (form parse +
  redirect dalları) entegrasyon testi dışında; çekirdek insert +
  onboarding + validasyon PGlite testli. Faz 2'de useActionState'e
  geçilirse action testi birlikte eklenecek.
- Bilinen kısıt: `next dev` sayfaları ve route handler'ları ayrı Node
  işlemlerinde koşturabiliyor; dosya tabanlı PGlite ikinci işlemde
  çökebiliyor. Yerel uçtan uca doğrulama için `npm run build && npm
  start` (tek işlem) kullanın; Neon (DATABASE_URL) bağlanınca sorun
  ortadan kalkar.
