# Faz 10 — Moderasyon tamamlama + cleanup + soru/yanıt düzenleme (spec)

Kullanıcı onayı 2026-07-18 ("hepsini yap"). Üç iş:

## T1 — Moderasyon kapsamı (gerçek boşluk)
- Boşluk: AI moderasyonu soru/yanıtı flagged/pending'e düşürüyor ama
  admin kuyruğu YALNIZ deneyim listeliyor — işaretli soru/yanıt hiçbir
  panelde görünmüyor; Bildir butonu yalnız deneyim kartında.
- reports.target_type şemada 'experience'e daraltılmıştı; sözleşme
  zaten generic — tip 'experience'|'question'|'answer'e genişletilir
  (text kolon, migration YOK). createReport hedef doğrulaması tür
  bazında (published kontrolü ilgili tablodan).
- Tek generic action `reportContent(formData)` (targetType+targetId+
  returnPath) — deneyim formu da buna geçer (reportExperience kalkar,
  davranış birebir).
- Soru sayfasında soru başlığına ve yanıt kartlarına Bildir formu.
- Admin: `listQaModerationQueue` (flagged/pending soru+yanıt, AI
  gerekçeleriyle) + panelde "Soru/Yanıt kuyruğu" bölümü + generic
  `reviewQaContent` action'ı (approve→published / remove→removed,
  mod_restore/mod_remove logu). Açık raporlar bölümü soru/yanıt
  raporlarını da önizlemeyle gösterir.

## T2 — Cleanup (davranış birebir; verify.sh önce/sonra yeşil)
- `requireOnboardedUser(next, {onBannedRedirect})` guard yardımcısı
  (lib/users/guards.ts) — üç review'dur işaretlenen sürüklenmeyi
  bitirir; experience/qa/topic/badge/settings action'ları geçer.
  profile.ts bilinçli istisna (dosyada kayıtlı) olarak kalır.
- `formatDate(date, {withTime})` lib/utils.ts'e — 5 sayfa kopyası kalkar
  (admin'in saatli varyantı parametreyle).
- `FlashBanner` bileşeni (success|error) — 5+ banner kopyası kalkar.
- `createTestDb()` test yardımcısı (src/lib/test-db.ts) oluşturuldu ve
  yeni T3 testleri bunu kullanır. Mevcut 19 test dosyasının beforeEach'i
  farklı şekillerde (kimi seed'li, kimi vi.mock önekli) olduğundan toplu
  mekanik göç RİSKLİ ve ürün değeri sıfır — ayrı, izole, güvenli bir
  temizlik taraması olarak ERTELENDİ (spec kapanış notu). Yardımcı hazır,
  yeni kod tek kaynağı kullanıyor.

## T3 — Soru/yanıt düzenleme (deneyimle simetri)
- lib/qa/edit.ts: getOwnQuestion/updateOwnQuestion + getOwnAnswer/
  updateOwnAnswer (yalnız sahibi, removed hariç; yeniden moderasyon
  ÇAĞIRANDA — kural #3).
- Rate limit: 'experienceEdit' kind'ı 'contentEdit' olarak yeniden
  adlandırılır — user_edit logları hedef türünden bağımsız sayıldığından
  tüm düzenlemeler tek pencereyi (10/saat) paylaşır.
- /soru-duzenle/[id] ve /yanit-duzenle/[id] sayfaları + action'lar
  (updateQuestion/updateAnswer; block'ta içerik eski haliyle kalır,
  user_edit izi yazılır); profilde Düzenle linki üç türe de çıkar.

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: yanıt raporlanabiliyor,
işaretli soru/yanıt admin kuyruğunda görünüp onaylanıp kaldırılabiliyor,
soru/yanıt düzenlenip yeniden moderasyondan geçiyor, cleanup sonrası
davranış birebir; final review kapandı; defter güncel.
