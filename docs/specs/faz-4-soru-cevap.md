# Faz 4 — Soru/Cevap + kullanıcı başlık önerisi (spec)

Amaç: topic altında soru/yanıt (oylamalı, moderasyonlu) ve kullanıcıların
yeni hastalık/tedavi başlığı önermesi (admin onay kuyruğu). Kaynak:
docs/master-plan.md Faz 4 + Veri Modeli (questions, answers, topics.status
'pending'|'rejected') + kritik sözleşme #2 (her yayın moderate'ten geçer).

## Kapsam (bilinçli olarak YOK: soru düzenleme/silme [yazar tarafından],
## yanıt kabulü/en iyi yanıt, bildirimler, sayfalama, soru arama,
## soruya rapor [Faz 4.1 — reports.target_type genişletmesi ayrı iş])

## T1 — Şema: questions + answers (ÜRETEN; kontrolör inline)
Sözleşme birebir:
- `questions`: id uuid pk, topic_id FK topics not null, user_id FK users
  not null, title text not null, body text null (sorunun gövdesi
  opsiyonel), lang default 'tr', status ('published'|'pending'|'flagged'|
  'removed') default 'published', created_at.
- `answers`: id uuid pk, question_id FK questions not null, user_id FK
  users not null, body text not null, lang default 'tr', status (aynı
  enum) default 'published', created_at.
- moderation_log.action enum'una `mod_ban` eklenir (Faz 3 sapma notunun
  kapanışı; master plan satırı da güncellenir) ve banUser artık loglar
  (targetType 'user', detail.note).
Migration + round-trip test.

## T2 — Soru/yanıt çekirdeği + action'lar (TÜKETEN: T1)
- `src/lib/qa/questions.ts`: `createQuestion(db, input, userId, topicId,
  status)`, `createAnswer(db, input, userId, questionId, status)` saf
  insert'ler; `listQuestions(db, topicId, currentUserId?)` — published
  sorular + yanıt sayısı + yazar + tarih (en yeni üstte); 
  `getQuestion(db, questionId, currentUserId?)` — soru + published
  yanıtlar (skorlu, oy sıralı: skor desc sonra yeni) + yazarlar.
  Yanıt skorları getScores('answer', ...) ile.
- Validasyon `src/lib/validation/qa.ts` (el yazımı): title 5-150,
  body soru için 0-5000 (ops.), yanıt body 2-5000.
- `src/app/actions/qa.ts`: `submitQuestion(formData)` ve
  `submitAnswer(formData)` — experience action kalıbı birebir: session →
  onboarding+ban → validate → moderate(title+body / body) → verdict
  eşleme (ok→published, flag→flagged, block→reddet+log, timeout→pending+
  log) → insert → revalidate → redirect. Soru formu hedefi
  `/baslik/[slug]/soru-sor`, yanıt formu soru sayfasının içinde.
- `voteExperience` kalıbında `voteAnswer` (target_type 'answer'; votes
  şeması zaten destekliyor).
- Test: validasyon sınırları + createQuestion/Answer + listQuestions/
  getQuestion PGlite (flagged görünmez, yanıt sayısı doğru, oy sırası).

## T3 — Soru/yanıt UI (TÜKETEN: T2)
- `/baslik/[slug]` topic sayfasına "Sorular" bölümü (Deneyimler'in
  altına): soru kartları (başlık linkli, yazar, tarih, N yanıt) +
  "Soru sor" butonu (→ /baslik/[slug]/soru-sor; girişsiz /giris?next=).
- `/baslik/[slug]/soru-sor`: form (başlık + ops. gövde) — deneyim-yaz
  sayfası kalıbı (guard'lar dahil; MedicalDisclaimer).
- `/soru/[id]`: soru + yanıt listesi (▲skor▼ oy blokları answer için,
  aria-pressed) + yanıt yazma formu (girişli+onboarded; girişsizse
  giriş linki). Disclaimer. notFound: yoksa ya da published değilse.
- Test: sayfa sorguları zaten T2'de; UI davranışı canlı doğrulamada.

## T4 — Başlık önerisi (TÜKETEN: Faz 3 admin paneli)
- `/baslik-oner`: form (ad, tür condition|treatment, ops. kısa özet) —
  girişli+onboarded+bansız. Action: moderate(ad+özet) → topics'e status
  'pending' insert (slug: ad'dan üret — küçük harf, tire; çakışmada
  -2 eki) + topic_i18n tr satırı; kullanıcıya "önerin incelemede".
  type 'drug' ÖNERİLEMEZ (ilaçlar seed/TİTCK'dan).
- Admin paneline "Başlık önerileri" bölümü: pending topics — Onayla
  (status 'active') / Reddet (status 'rejected'); log yazılır
  (targetType 'topic', mod_restore/mod_remove karşılığı yerine detail
  notu ile — enum uygun: onay=mod_restore, red=mod_remove kullan,
  detail.note 'topic-proposal').
- Ana sayfa + topic sorguları zaten yalnız 'active' gösteriyor
  (değişiklik yok — doğrula).
- Test: öneri insert (pending) + slug çakışması + onay/red akışı.

## Dalga analizi
W1: [T1] kontrolör inline.
W2: [T2] tek (çekirdek+action'lar — T3/T4 bunu tüketir; T4'ün admin
    dosyaları T2 ile kesişmez AMA banUser logu T1'de değişti →
    admin.ts'e T1'de dokunulur, T4 de dokunacak → T4 W3'e).
W3: [T3, T4] paralel (dosya kesişimi: T3 topic sayfası+soru sayfaları;
    T4 baslik-oner+admin — kesişim yok).
Sonra: suite + canlı doğrulama + final review (fable).

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: soru sor → görünür →
yanıtla → oyla; başlık öner → admin onayla → ana sayfada görünür;
final review kapandı; progress.md güncel.
