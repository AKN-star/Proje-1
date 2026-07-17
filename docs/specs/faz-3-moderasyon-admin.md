# Faz 3 — AI moderasyon + raporlama + admin (spec)

Amaç: güvenlik katmanı. moderate.ts gerçeklenir (Anthropic API),
kullanıcı raporlama gelir, admin paneli flagged/pending/reports
kuyruğunu yönetir. Kaynak: docs/master-plan.md Faz 3 + Veri Modeli
(reports, moderation_log) + kritik sözleşme #2 (timeout → 'pending').

## Kapsam (bilinçli olarak YOK: soru/cevap moderasyonu — tablolar Faz
## 4'te; ban süresi/temyiz akışı; e-posta bildirimleri; rate limiting
## [Faz 7]; kendi deneyimine oy engeli [politika kararı sonraya])

## T1 — Şema: reports + moderation_log (ÜRETEN)
Sözleşme birebir:
- `reports`: id uuid pk, reporter_id FK users not null, target_type
  ('experience') not null (enum ileride genişler), target_id uuid not
  null, reason ('spam'|'medical_misinfo'|'personal_data'|'abuse'|
  'other') not null, status ('open'|'resolved') default 'open',
  created_at. Aynı kullanıcı aynı hedefi bir kez raporlar: unique
  (reporter_id, target_type, target_id).
- `moderation_log`: id uuid pk, target_type not null, target_id not
  null, action ('ai_flag'|'ai_block'|'ai_timeout'|'mod_remove'|
  'mod_restore') not null, detail jsonb (AI gerekçesi/reasons), 
  actor_type ('ai'|'user') not null, actor_id FK users null,
  created_at.
- `users.bannedAt` (timestamptz null) — banlı kullanıcı yazamaz/oylayamaz.
  (Master plan "banla" der; kolon sözleşmeye eklenir — bu spec commit'i
  master planı da günceller.)
Migration + PGlite round-trip testi.

## T2 — moderate.ts gerçek implementasyon (ÜRETEN; stub'ın yerine)
- `src/lib/ai/client.ts`: tek sarmalayıcı — `ANTHROPIC_API_KEY` yoksa
  null döner (dev: anahtar yokken moderate stub davranışı 'ok' +
  reasons:['no-api-key']; prod+VERCEL'de anahtar yoksa 'pending'e düşen
  timeout yolu DEĞİL, açık log'la 'ok' — yayın Faz 7 öncesi zaten
  deployment protection arkasında).
- `moderate(content, kind)`: claude-haiku-4-5, fetch ile Messages API
  (SDK bağımlılığı YASAK — çıplak fetch), max_tokens küçük, 5 sn
  AbortController timeout. Sistem istemi: sınıflar ilaç satışı/ticareti,
  tehlikeli doz tavsiyesi, spam/reklam, kişisel veri (ad-soyad, telefon,
  TC no), nefret/istismar. Çıktı: strict JSON {verdict, reasons[]}.
  Parse hatası → 'flag' (temkinli). Timeout/ağ hatası → özel dönüş
  {verdict:'timeout'} → çağıran 'pending' statüsü verir + moderation_log
  'ai_timeout'.
- `submitExperience`: verdict eşlemesi ok→published, flag→flagged
  (yayınlanmaz), block→reddet (hata mesajı), timeout→pending (kullanıcıya
  "incelemede" mesajı; sayfada görünmez). flag/block/timeout
  moderation_log'a yazılır (actor_type 'ai'). Banlı kullanıcı → reddet.
- Test: API mock'lanır (fetch stub) — 4 verdict yolu + parse hatası +
  timeout; gerçek API çağrısı testte YOK (CI secret'sız kalır).

## T3 — Kullanıcı raporlama (TÜKETEN: T1)
- Deneyim kartına "Bildir" (girişli; girişsiz /giris?next=). Mini form
  (reason select + gönder) — `src/app/actions/report.ts`: session,
  hedef published deneyim, unique ihlalinde sessiz başarı ("zaten
  bildirdiniz"), insert. Rapor edilen deneyim OTOMATİK gizlenmez.
- Test: rapor insert + çift rapor + girişsiz yol.

## T4 — Admin paneli (TÜKETEN: T1+T2)
- Yetki: users.role 'mod'|'admin' (seed'de admin yok; İNSAN ADIMI:
  kullanıcının e-postasıyla role='admin' set eden tek seferlik script
  `scripts/make-admin.ts` — npm script `admin:grant -- email`).
- `/admin` (guard: session + role mod/admin, değilse notFound):
  kuyruk sekmeleri — Flagged/Pending deneyimler (body, yazar, AI
  reasons moderation_log'dan) ve Açık raporlar (hedef önizleme).
  Eylemler (server action'lar `src/app/actions/admin.ts`):
  - approve → status published + recalcTopicStats + log 'mod_restore'
  - remove → status removed + recalcTopicStats + log 'mod_remove'
  - resolve report → status resolved
  - ban → users.bannedAt=now (log 'mod_remove' değil; detail'e not)
- Test: guard (rol yoksa erişemez — action seviyesinde), approve/remove
  akışı stats'ı günceller, resolve.

## Dalga analizi
W1: [T1] kontrolör inline (şema + migration + master plan güncellemesi).
W2: [T2, T3] paralel (dosya kesişimi yok: ai/client+moderate+experience
    action vs report action+topic sayfası kartı — DİKKAT: T3 topic
    sayfasına dokunur, T2 dokunmaz → çakışma yok).
W3: [T4] tek (admin sayfası + admin action'ları + script).
Sonra: suite + canlı doğrulama (anahtarsız: no-api-key yolu; anahtar
varsa gerçek çağrı manuel) + final review.

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil (secret'sız); canlı: anahtarsız
akış çalışır (ok yolu), rapor verilebilir, admin kuyruğu görünür ve
approve/remove çalışır; final review kapandı; progress.md güncel.
İNSAN ADIMLARI: ANTHROPIC_API_KEY (Vercel env; sahibi kullanıcı, faz
kapanışında istenir) + admin:grant koşumu.

## Kapanış notları (final review sonrası, 2026-07-16)

- Review düzeltmeleri: banlı kullanıcı oy ve rapor veremez; ai_block logu
  targetType 'topic' + note 'blocked-before-insert' (insert olmadığı için
  experience id yok — yanlış eşleşme riski kapatıldı); approve/remove
  status ön-koşullu; admin kendini/başka mod-admin'i panelden banlayamaz.
- SAPMA (insan onayına): ban eylemi moderation_log'a yazılmıyor —
  action enum'unda ban değeri yok, iz users.banned_at. Faz 4+ şema
  değişikliğinde 'mod_ban' eklenmesi önerilir.
- TAKİP GÖREVİ: src/lib/admin/admin.test.ts akış testleri action'ları
  doğrudan çağırmıyor (auth mock gerektirir) — lib katmanını test ediyor.
  Faz 4'te admin paneli genişlerken action seviyesi teste yükseltilecek.
- Bilinçli kabul: kendi deneyimini raporlamak engellenmedi (zararsız);
  banlı admin senaryosu yok (panelden mod/admin banlanamaz).
