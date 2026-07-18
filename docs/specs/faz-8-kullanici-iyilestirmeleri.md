# Faz 8 — Kullanıcı deneyimi iyileştirmeleri (spec)

Amaç: kullanıcı önerisi altı iyileştirme (2026-07-18 oturumu, kullanıcı
onayı: "hepsini ekleyelim"). Master plana Faz 8 satırı eklendi; tek
sözleşme değişikliği users.email_optout (Veri Modeli güncellendi).

## Kickoff kararları
- **İçerik silme = soft delete:** mevcut status='removed' kullanılır
  (yeni durum yok); kendi içeriğini kaldıran kullanıcı için
  moderation_log'a 'mod_remove' + actor kullanıcı yazılır; deneyimde
  topic_stats aynı akışta yeniden hesaplanır. Geri alma yok (admin
  panelden mod_restore mümkün kalır).
- **Hesap silme = anonimleştirme:** FK'ler NOT NULL (sözleşme) →
  satır silinmez; email `silinmis-<id>@hesap.yerel` tombstone'una
  yazılır, username/name/image/proBadge NULL, oturum+account satırları
  silinir. Yayınlanmış içerik "anonim" imzasıyla kalır (KVKK metniyle
  tutarlı: kimlik silinir, anonim içerik korunabilir). Geri dönüşü yok
  — onay kutusu + açık uyarıyla.
- **Yanıt bildirimi:** yalnız yanıt anında 'published' olan yanıtlar
  için, soru sahibine (kendine yanıtta gönderilmez, email_optout=false
  ise) Resend ile; hata yutulur (rozet bildirimi kalıbı). Moderasyon
  kuyruğundan sonradan onaylanan yanıt bildirim ÜRETMEZ (bilinen sınır).
- **Yazım önerisi ("şunu mu demek istediniz"):** pg_trgm YOK (PGlite
  test ortamında extension yükü + bağımlılık riski) — sıfır sonuçta
  JS Levenshtein ile aktif başlık adları üzerinden en yakın ≤3 öneri.
  TİTCK importu sonrası ölçek sorun olursa pg_trgm'e geçiş notu.
- **Karanlık mod:** @custom-variant dark zaten class tabanlı —
  localStorage + inline script (FOUC önleme) + footer'da üç durumlu
  (sistem/açık/koyu) küçük client bileşeni; YENİ BAĞIMLILIK YOK
  (next-themes kullanılmaz).

## Görevler
- T1 — /profil: kendi deneyim/soru/yanıtları (durum rozetiyle) + tekil
  "kaldır" aksiyonları + hesap silme bölümü; navigasyon linki.
- T2 — migration 0008: users.email_optout bool not null default false;
  sendAnswerNotice (email/send.ts kalıbı); submitAnswer'a kanca;
  /ayarlar'da bildirim tercihi.
- T3 — /nasil-calisir: moderasyon, rozet, istatistik ve çeviri
  açıklaması; footer linki.
- T4 — /baslik/[slug]?amac= filtresi: sayfadaki deneyimlerin amaç
  listesinden seçim; istatistik kartı DOKUNULMAZ (topic_stats bütünü
  gösterir, not düşülür), yalnız liste filtrelenir.
- T5 — sıfır sonuçta öneri: suggestTopics(db, q) (Levenshtein, tr
  küçük harf, eşik ~0.4 normalize) → ana sayfada "Şunu mu demek
  istediniz?" linkleri.
- T6 — tema düğmesi: ThemeToggle client bileşeni + layout inline
  script; tercih localStorage'da ("system" varsayılan).

## Kapanış notları
- Final review (8 açı) 10 bulgu kapatıldı: anonimleştirme artık
  verificationToken'ları (PII) ve bekleyen rozet başvurularını da
  temizliyor; yanıt bildirimi next/server after() ile sıcak yoldan
  çıktı ve karar guard'ları lib'de (notifyQuestionOwner); suggest
  join'ine tr locale filtresi; <html suppressHydrationWarning> (tema
  script'i); tema sistem modunda OS değişimini dinler; escapeHtml tek
  kopya; rapor redirect'i ?amac=/?sirala= bağlamını korur; başarısız
  kaldırmada yeşil banner yok.
- Bilinçli kararlar: profil eylemlerinde onboarding/ban guard'ı YOK
  (KVKK hakkı banlıya da tanınır — dosyada açık yorum); banlı kullanıcı
  hesap silip aynı e-postayla yeniden kayıt olabilir (ban hesaba
  bağlıdır, e-posta zaten serbest — kabul edildi); kendi sorusunu
  kaldıran kullanıcı altındaki yanıtları da erişilmez kılar (admin
  mod_restore ile geri açabilir); kuyruktan sonradan onaylanan yanıt
  bildirim üretmez; profil listesindeki yanıt linki, sorusu kaldırıldıysa
  404'e gider (durum rozeti görünür kalır).
- SAPMA: T1a 251, T1b 310 satır commit (200 yasası); migration
  commit'lerinin drizzle-kit üretimi snapshot satırları (0007/0008)
  muaf sayılıyor — bu muafiyet burada açıkça kayda geçirildi.
- Kuyruğa alınan cleanup (davranış değişmez): requireOnboardedUser
  guard yardımcısı (3 review'dur işaretleniyor), formatDate/flash
  banner/PGlite test kurulumu tekilleştirmesi, tema karar ifadesinin
  tek kaynağa bağlanması, TİTCK ölçeğinde suggest için SQL ön filtresi.

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: profil sayfasında kendi
içeriği görünür ve kaldırılabilir, hesap silme oturumu kapatıp anonim
bırakır, ayarlarda bildirim tercihi kalıcı, /nasil-calisir footer'dan
açılır, amaç filtresi listeyi daraltır, bozuk yazımda öneri çıkar,
tema düğmesi FOUC'suz çalışır; final review kapandı; defter güncel.
