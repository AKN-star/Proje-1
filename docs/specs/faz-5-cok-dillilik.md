# Faz 5 — Çok dillilik (spec)

Amaç: içerikte "çevir" butonu (LLM çevirisi + `translations` önbelleği)
ve kullanıcı locale tercihi. Kaynak: docs/master-plan.md Faz 5 + Veri
Modeli (`translations` tablosu) + kickoff kararı (Twitter tarzı çevir).

## BAĞIMLILIK KAPISI (insan-kapılı, sahibi: kullanıcı)
Master plan UI i18n için **next-intl** öngörür; paket kurulu değil ve
CLAUDE.md yasası yeni bağımlılığı yasaklar (önce sor). ÖNERİ: `npm i
next-intl` onayı. Onaya kadar UI dili TR kalır; bu spec yalnız bağımlılık
gerektirmeyen kısmı kapsar. UI mesaj dosyalarına geçiş (TR/EN) onay
sonrası Faz 5.1 olarak açılır.

## Kapsam (bilinçli olarak YOK: UI dilinin EN'e çevrilmesi [next-intl
## kapısı], çeviri düzenleme, otomatik dil algılama, tr/en dışı diller)

## T1 — Şema: translations (ÜRETEN; kontrolör inline)
Sözleşme birebir: `translations` — target_type text, target_id uuid,
field text, locale text, text text not null, model text not null,
source_hash text not null, created_at; PK (target_type, target_id,
field, locale). İçerik düzenlenince source_hash uyuşmaz → yeniden
çevrilir ve satır güncellenir (bayat çeviri servis edilmez; kickoff
kararı #8). Migration; master plan satırı zaten source_hash içeriyor.

## T2 — Çeviri çekirdeği (TÜKETEN: T1)
- `src/lib/ai/translate.ts`: `translateText(text, targetLocale)` —
  `callClaude` ile (mevcut src/lib/ai/client.ts; YENİ BAĞIMLILIK YOK);
  anahtarsız ortamda `{ok:false, reason:'no-api-key'}`; timeout/parse
  hatasında ok:false. Prompt: sağlık içeriğini hedef dile sadakatle
  çevir, tıbbi terimleri koru, yorum ekleme.
- `src/lib/translations/cache.ts`: `getOrCreateTranslation(db, {
  targetType:'experience'|'question'|'answer', targetId, field, locale,
  sourceText })` — source_hash = sha256(sourceText) (node:crypto);
  tabloda satır var VE hash uyuşuyorsa onu dön; yoksa/uyuşmuyorsa
  translateText → upsert (onConflictDoUpdate) → dön; translateText
  başarısızsa null (önbelleğe hata yazılmaz).
- `src/app/actions/translate.ts`: `requestTranslation(formData)` —
  girişli olmak GEREKMEZ (okuma herkese açık) ama rate kaygısıyla
  girişli+onboarded şartı KONUR (Faz 7 rate limiting'e kadar ucuz fren).
  Hedef içerik published olmalı (experience/question/answer sorgusu);
  locale yalnız 'tr'|'en'. Çeviri metni ?ceviri=<targetId> query'siyle
  aynı sayfaya redirect edilerek gösterilmez — bunun yerine sayfa
  render'ında cache'ten okunur: action çeviriyi üretir, revalidate eder,
  redirect eder; sayfa `?cevir=<targetType>:<targetId>` parametresiyle
  ilgili kartta çeviri metnini gösterir.
- Test: cache round-trip (insert bir kez — ikinci çağrı API'ye gitmez;
  translateText mock), published olmayan hedef reddi, locale doğrulama.

## T3 — UI + locale tercihi (TÜKETEN: T2)
- Deneyim kartı (/baslik/[slug]) ve yanıt kartı (/soru/[id]) altına
  "Çevir (EN)" / "Translate (TR)" butonu — içerik lang'ı ile kullanıcı
  locale'i farklıysa görünür; form → requestTranslation; dönüşte kartta
  çeviri bloğu ("Otomatik çeviri — hatalı olabilir" notuyla) gösterilir.
- `/ayarlar`: locale tercihi (tr|en select) — girişli+onboarded;
  `updateLocale` action'ı users.locale günceller. Girişsiz → /giris?next=.
- Test: updateLocale guard'ları lib seviyesinde; UI canlı doğrulamada.

## Dalga analizi
W1: [T1] kontrolör inline. W2: [T2] tek ajan. W3: [T3] tek ajan
(T2'yi tüketir; paralellik yok — dosya kesişimi: sayfalar).

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: anahtarsız ortamda buton
görünür ve zarifçe düşer (hata banner'ı), anahtar varsa çeviri kartda
görünür + ikinci istek cache'ten; /ayarlar locale değişimi kalıcı;
final review kapandı; progress.md güncel; next-intl kapısı kayıtlı.
