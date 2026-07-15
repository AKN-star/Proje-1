# Faz 2 — İstatistik + oy + arama (spec)

Amaç: ürünün özgün kalbi. Topic sayfasında otomatik istatistik bloğu
(★ ortalama, %etkili, en sık yan etkiler), deneyim oylama, sıralama ve
çok alanlı arama. Kaynak sözleşme: docs/master-plan.md "Veri Modeli"
(topic_stats + votes satırları) ve kritik sözleşme #3.

## Kapsam (bilinçli olarak YOK: soru/cevap, çeviri, admin paneli,
## pg_trgm indeksi — aşağıda erteleme kaydı)

## T1 — Şema: topic_stats + votes (ÜRETEN)
`src/db/schema.ts`e sözleşme birebir:
- `topic_stats`: topic_id (uuid PK + FK topics.id), experience_count
  (int not null default 0), avg_effectiveness (numeric/real null),
  effective_pct (int null; etki>=4 oranı, 0-100), top_side_effects
  (jsonb, `[{termId, count}]`, en çok 5), updated_at (timestamptz).
- `votes`: user_id FK users.id not null, target_type
  ('experience'|'answer') not null, target_id uuid not null, value int
  not null CHECK (+1|-1); PK (user_id, target_type, target_id).
Migration `npm run db:generate` çıktısı commit'lenir.
Test: şema round-trip (insert/select + PK çakışması + CHECK ihlali).

## T2 — İstatistik çekirdeği (TÜKETEN: T1; ÜRETEN: recalc API)
- `src/lib/stats/topic-stats.ts`: `recalcTopicStats(db, topicId)` —
  yayınlanmış deneyimlerden count/avg/etkili%/top-5 yan etkiyi hesaplar,
  topic_stats'a upsert eder (onConflictDoUpdate). `getTopicStats(db,
  topicId)` okuyucu.
- `submitExperience` action'ı insert'ten hemen sonra recalc çağırır.
  SAPMA KAYDI: master plan "aynı transaction'da" der; neon-http driver
  transaction desteklemez → aynı istek içinde ardışık çağrı. Faz 7'de
  driver websocket'e geçerse transaction'a alınır.
- Test: PGlite — deneyim ekle→recalc→değerler doğru; flagged sayılmaz;
  yan etki top-5 sıralı; deneyimsiz topic'te sıfır satırı.

## T3 — Oylama (TÜKETEN: T1)
- `src/lib/votes/vote.ts`: `castVote(db, userId, targetType, targetId,
  value)` — aynı değer tekrarında oy SİLİNİR (toggle), farklı değerde
  güncellenir (upsert). `getScores(db, targetType, targetIds[])` →
  Map<id, {score, myVote?}>.
- `src/app/actions/vote.ts`: `voteExperience(formData)` — session yoksa
  /giris'e; onboarding ŞART DEĞİL (oy sağlık verisi yayınlamaz);
  value yalnız +1|-1 kabul; deneyim var+published kontrolü;
  revalidatePath topic sayfası.
- Test: toggle/değiştirme/çift oy engeli PGlite testi.

## T4 — UI: istatistik bloğu + sıralama + oy butonları (TÜKETEN: T2+T3)
- `/baslik/[slug]`: başlık altına istatistik kartı — deneyim sayısı,
  ★ ortalama (1 ondalık), "%X etkili buldu" (etki>=4), en sık 3 yan
  etki chip'i (topic_stats'tan; satır yoksa blok gizlenir).
- Deneyim listesi sıralama: `?sirala=oy|yeni` (varsayılan yeni);
  linkli iki sekme görünümü. Sorgu getTopicBySlug'a sort param'ı +
  skor join'i eklenir (votes toplamı).
- Her deneyim kartında ▲ skor ▼ (form butonları, girişsizse /giris'e
  düşer); kullanıcının kendi oyu vurgulanır (session varsa).
- Ana sayfa araması çok alanlı: topic_i18n.name + canonical_name +
  active_ingredient üstünde ILIKE (mevcut tek alan genişletilir).
  ERTELEME KAYDI: pg_trgm GIN indeksi Faz 7'ye (PGlite/CI'da uzantı
  yönetimi gerektirmesin; ILIKE seed ölçeğinde yeterli).
- Test: sıralama + çok alanlı arama sorgu testleri (PGlite).

## Dalga analizi
W1: [T1] tek (şema herkesi bloklar; küçük — kontrolör inline).
W2: [T2, T3] paralel (dosya kesişimi yok: stats lib+experience action
    vs vote lib+vote action; ikisi de T1'i tüketir).
W3: [T4] tek (topic sayfası + queries + ana sayfa; T2+T3'ü tüketir).
Sonra: suite + davranışsal doğrulama (build&start) + final review.

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: deneyim yaz → istatistik
bloğu güncellenir, oy ver → skor değişir, sıralama çalışır, arama etken
maddeyle bulur; final review bulguları kapatıldı; progress.md güncel.
