# Faz 7 — Yayın sertleşmesi (spec)

Amaç: canlı yayına hazırlık. Kaynak: docs/master-plan.md Faz 7.
Kapsam: rate limiting, SEO (metadata/sitemap/robots, launch anahtarı),
KVKK/yasal metin taslakları, TİTCK import hazırlığı.

## Kickoff kararları
- **Rate limiting şemasız:** ayrı rate_limits tablosu YOK (veri modeli
  sözleşmesine dokunulmaz). Sliding window, mevcut içerik tablolarının
  (experiences/questions/answers/reports/topics/badge_requests)
  `created_at + user_id` alanları üzerinden COUNT ile hesaplanır —
  kayıt zaten atomik yazılıyor, ek durum tutulmaz. Çeviri
  (requestTranslation) için pencere `translations.created_at` üzerinden
  globaldir (tabloda user_id yok; sözleşme değişmeden kullanıcı bazlı
  yapılamaz — kabul edilen sınır, spec notu).
- **noindex kaldırma launch anahtarına bağlı:** `SITE_LAUNCHED=1` env'i
  hem next.config.ts header'ını hem layout metadata.robots'u hem
  app/robots.ts'i açar. İnsan adımı koda dokunmadan tek env değişikliği
  olur; anahtar yokken davranış bugünkiyle birebir (noindex).
- **Yasal metinler taslak:** /kvkk ve /kullanim-sartlari sayfaları
  "taslak — hukuk incelemesi bekliyor" bandıyla yayınlanır (master plan
  insan adımı). Metinler brand.ts'ten isim alır, koda marka gömülmez.
- **BAĞIMLILIK KAPILARI (insan-kapılı):** Sentry SDK ve Playwright yeni
  bağımlılık — CLAUDE.md yasası gereği kurulmaz, onay bekler. Onaya
  kadar: hata görünürlüğü Vercel logları, e2e mevcut vitest + canlı
  smoke ile sınırlı. Onay sonrası Faz 7.1 (Sentry) / 7.2 (Playwright).
- **TİTCK:** lisans/kullanım şartı araştırması sonucu netleşmeden veri
  çekilmez; script insan tarafından indirilen CSV'yi okuyacak şekilde
  hazırlanır (kaynak dosya repoya girmez).

## Kapsam (bilinçle YOK: Sentry, Playwright [kapılar], domain bağlama
## [insan], deployment protection [Vercel panel işi], performans mikro
## optimizasyonu [ölçüm olmadan yapılmaz])

## T1 — Rate limiting (Postgres sliding window)
- `src/lib/rate-limit.ts`: `checkRateLimit(db, userId, kind)` —
  kind → {tablo, pencere, tavan} eşlemesi tek sabitte:
  experience 5/saat, question 5/saat, answer 20/saat, report 10/saat,
  topic önerisi 3/gün, badge 3/gün, translation global 30/dk.
  COUNT(created_at > now()-pencere [AND user_id=...]) >= tavan → false.
- Yazma action'larına tek satır guard: aşımda mevcut hata desenine uygun
  redirect (`?hata=limit`); UI'de banner metni.
- Test: pencere içi/dışı sayım, tavan sınırı, kind eşlemesi.

## T2 — SEO + launch anahtarı
- `src/config/site.ts` yerine mevcut brand.ts kalır; launch bayrağı
  `src/lib/launch.ts: isLaunched()` (env SITE_LAUNCHED === "1").
- next.config.ts header'ı ve layout `metadata.robots` isLaunched'a bağlı;
  `app/robots.ts` (launch öncesi disallow all, sonrası allow + sitemap).
- `app/sitemap.ts`: statik sayfalar + aktif topic'ler (slug, canlı DB).
- `generateMetadata`: /baslik/[slug] (topic adı + özet, OG) ve
  /soru/[id] (soru başlığı). Ana sayfa metadata'sı brand tagline.
- Test: lib seviyesinde isLaunched; sitemap/robots canlı smoke.

## T3 — Yasal metin taslakları
- `/kvkk`: aydınlatma metni + açık rıza açıklaması (sağlık verisi =
  özel nitelikli; işleme amaçları, haklar, saklama). Taslak bandı.
- `/kullanim-sartlari`: kullanım şartları + tıbbi sorumluluk reddi
  (mevcut MedicalDisclaimer metniyle tutarlı). Taslak bandı.
- Footer (layout): iki sayfaya + /ayarlar'a link.
- /hosgeldin KVKK checkbox'ı /kvkk'ya link verir.

## T4 — TİTCK import hazırlığı
- Lisans araştırması (web): sonuç bu spec'in altına not düşülür; izin
  belirsizse veri ÇEKİLMEZ, yalnız script iskeleti kalır.
- `scripts/titck-import.ts`: insan tarafından indirilen CSV yolunu alır;
  satırları topics(type='drug') + drug_details(source='titck') +
  topic_i18n(tr) olarak upsert eder (slug çakışmasında mevcut korunur);
  DATABASE_URL gerekir, dry-run bayrağı vardır.
- Test: satır→kayıt eşlemesi (in-memory PGlite, örnek 3 satırlık CSV).

## Dalga analizi
W1: [T1] ve [T2] paralel (dosya kesişimi yok). W2: [T3] (layout footer),
[T4] bağımsız. Review tek geçiş sonda.

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı (anahtarsız): noindex
header'ı hâlâ dönüyor, /robots.txt disallow, /sitemap.xml topic'leri
listeliyor, /kvkk ve /kullanim-sartlari taslak bandıyla açılıyor, limit
aşımı banner'ı görünüyor; final review kapandı; progress.md güncel;
Sentry/Playwright kapıları ve TİTCK lisans notu kayıtlı.
