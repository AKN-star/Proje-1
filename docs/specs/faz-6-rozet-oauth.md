# Faz 6 — Profesyonel rozet + Google OAuth (spec)

Amaç: sağlık profesyoneli rozet başvurusu (form → e-posta bildirimi →
admin onayı → ✔ rozet gösterimi) ve Google OAuth girişi. Kaynak:
docs/master-plan.md Faz 6 + Veri Modeli (`badge_requests`,
`users.pro_badge`).

## Kickoff kararları
- Master planın açık sorusu "belge mi beyan mı": sözleşme `document_note`
  (metin) tanımlıyor → **beyan** (kurum + açıklama metni); dosya yükleme
  YOK (depolama servisi = yeni bağımlılık, yasak). Admin gerekirse
  e-postayla belge ister.
- Rozet onayı `users.pro_badge = claimed_role` yazar ve `role`'ü 'user'
  ise 'pro' yapar (admin/mod düşürülmez). Red yalnız başvuru satırını
  günceller.
- Başvuru içeriği yayınlanmaz (yalnız admin görür) → moderate() kapsamı
  dışında (kural #3 yayın API'lerini bağlar).
- Google OAuth: next-auth'un yerleşik provider'ı (YENİ BAĞIMLILIK YOK);
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` env'i yoksa provider eklenmez ve
  /giris'te buton görünmez (anahtarsız zarif düşüş). `allowDangerousEmailAccountLinking`
  KAPALI kalır (varsayılan; hesap ele geçirme riski).

## Kapsam (bilinçle YOK: belge yükleme, rozet geri alma UI'si [admin
## SQL ile], rozet başvurusu düzenleme, Google dışı OAuth)

## T1 — Şema: badge_requests (migration 0007)
Sözleşme birebir: id, user_id FK, claimed_role('doctor'|'pharmacist'),
institution text, document_note text, status('pending'|'approved'|
'rejected') default pending, reviewed_by FK users null, reviewed_at
null, created_at.

## T2 — Rozet çekirdeği + action (TÜKETEN: T1)
- `src/lib/badges/requests.ts`: `createBadgeRequest(db, userId, input)`
  — guard'lar: claimed_role sözlükte, institution/document_note dolu ve
  makul uzunlukta, kullanıcıda pending başvuru YOKSA (varsa 'pending'
  hatası), zaten rozeti varsa 'already' hatası. `reviewBadgeRequest(db,
  requestId, reviewerId, 'approve'|'reject')` — approve: users.pro_badge
  = claimed_role, role 'user'→'pro'; her iki dalda status/reviewed_by/
  reviewed_at.
- `src/lib/email/send.ts`: `sendBadgeRequestNotice(request)` — brand
  config'e eklenen `adminEmail`'e Resend REST (mevcut fetch deseni);
  anahtarsız ortamda console.log. E-posta hatası başvuruyu GERİ ALMAZ
  (kayıt DB'de; admin panelde de görünür) — hata yutulur, loglanır.
- `src/app/actions/badge.ts`: `requestBadge(formData)` — girişli +
  onboarded + bansız; başarıda /ayarlar?rozet=alindi'ye redirect.
- Test: guard'lar (pending tekrarı, already, rol doğrulama), approve'un
  users'ı güncellemesi, reject'in güncellememesi.

## T3 — UI (TÜKETEN: T2)
- `/rozet-basvuru`: form (rol seçimi doctor|pharmacist, kurum, beyan
  metni) — girişsiz → /giris?next=; pending başvuru varsa form yerine
  "başvurunuz inceleniyor" mesajı; rozetliyse "rozetiniz var".
- `/ayarlar`: rozet durumu satırı + başvuru linki.
- `/admin`: "Rozet başvuruları" bölümü (pending listesi: kullanıcı, rol,
  kurum, beyan; Onayla/Reddet butonları → admin actions).
- Rozet gösterimi: deneyim ve yanıt kartlarında username yanında ✔
  (title="Doğrulanmış doktor/eczacı") — topics.ts/questions.ts sorguları
  proBadge alanını seçer; tek küçük bileşen `src/components/pro-badge.tsx`.

## T4 — Google OAuth (bağımsız)
- `src/auth.ts`: env varsa Google provider (adapter zaten accounts
  tablosunu yönetiyor; yeni kullanıcı username NULL → mevcut /hosgeldin
  onboarding'i aynen çalışır).
- `/giris`: env varsa "Google ile devam et" butonu (server action →
  signIn("google", { redirectTo })).
- `.env.example`: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
- İNSAN ADIMI: Google Cloud OAuth client oluşturup env'leri Vercel'e
  eklemek (callback: /api/auth/callback/google).

## Dalga analizi
W1: [T1] inline. W2: [T2] tek ajan; [T4] bağımsız paralel olabilir.
W3: [T3] (T2'yi tüketir).

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: başvuru → admin kuyruğunda
görünür → onay → kartta ✔; anahtarsız ortamda Google butonu görünmez;
final review kapandı; progress.md güncel.
