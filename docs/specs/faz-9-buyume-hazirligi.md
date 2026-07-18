# Faz 9 — Büyüme hazırlığı (spec)

Amaç: kullanıcı onaylı altı iyileştirme (2026-07-18, "hepsini yap"):
sayfalama + index'ler, deneyim düzenleme, schema.org, admin kullanıcı
yönetimi, paylaşım/OG, boş durum. Master plana Faz 9 satırı eklenir.

## Kickoff kararları
- **Sayfalama iki katmanlı:** Ana sayfa topic listesi SQL seviyesinde
  (limit/offset — TİTCK sonrası binlerce satır groupBy'dan geçmesin).
  Topic sayfası deneyim listesi RENDER seviyesinde dilimlenir (oy
  sıralaması skorları JS'te birleştirdiğinden SQL sayfalaması skor
  sıralamasını bozar; sorgu seviyesi sayfalama, skorun SQL'e taşınması
  refactor'ıyla birlikte İLERİYE NOT). Yanıt/soru listeleri küçük —
  kapsam dışı.
- **Index'ler (migration 0009):** rate-limit COUNT'ları ve topic sayfası
  için: experiences(user_id, created_at), (topic_id, status),
  questions(user_id, created_at), answers(user_id, created_at),
  reports(reporter_id, created_at), badge_requests(user_id, created_at),
  translations(created_at). Veri Modeli kolon sözleşmesi DEĞİŞMEZ.
- **Düzenleme yalnız deneyim:** en zengin içerik; soru/yanıt düzenleme
  kapsam dışı (not). Düzenlenen içerik YENİDEN moderate'ten geçer
  (kural #3); verdict'e göre status güncellenir (block → içerik eski
  haliyle kalır, hata gösterilir). Yan etkiler join tablosunda değiştirilir,
  topic_stats yeniden hesaplanır. source_hash mekanizması bayat çeviriyi
  zaten düşürür. Yalnız sahibi, removed olmayan kaydı düzenler.
- **schema.org YMYL temkinli:** İlaç sayfasına Drug/AggregateRating
  işaretlemesi KONMAZ (tıbbi zengin sonuç iddiası riskli — Google YMYL);
  yalnız /soru/[id] QAPage, ana sayfa WebSite+SearchAction ve
  BreadcrumbList. JSON-LD script'leri sunucuda render edilir.
- **OG görseli:** next/og ImageResponse (Next yerleşik — YENİ BAĞIMLILIK
  YOK); topic sayfasına opengraph-image (ad + deneyim sayısı + ort.
  puan). "Linki kopyala" küçük client bileşeni (clipboard API) topic ve
  soru sayfalarında.
- **Boş durum:** aramasız ana sayfada "Öne çıkan başlıklar" (deneyim
  sayısına göre ilk 5) + "Son sorular" (son 5, lib sorgusu). Arama
  yapılınca gizlenir.

## Görevler
T1 index'ler (0009) → T2 sayfalama (home SQL + topic render) →
T3 deneyim düzenleme (lib+action+/deneyim-duzenle/[id]+profil linki) →
T4 schema.org JSON-LD → T5 paylaş+OG → T6 boş durum →
T7 admin kullanıcı arama (?kullanici= — username/email ilike; rol/ban
durumu + içerik sayıları; mevcut banUser action'ına bağlanır).
Review sonda.

## Kapanış notları
- Final review (6 birleşik açı) 10 bulgu kapatıldı: düzenlemeye rate
  limit (moderation_log'a 'user_edit' — sözleşme enum'u güncellendi,
  text kolon olduğundan migration yok; experienceEdit 10/saat); vitrin
  gerçek top-5 sorgusuna geçti; returnPath sayfa taşır, sort linkleri
  amac'ı korur; aralık dışı sayfa mesajları; admin ban arama bağlamını
  korur; OG tek sorgu + 404 + revalidate=3600; form alanları/hata
  sözlüğü/escapeLike/parsePage tek kaynak; listTopics $dynamic koşullu
  limit (+ q ile limit birlikte kullanılmaz uyarısı).
- Bilinen kabul edilen sınırlar: topic deneyim sayfalaması render
  dilimlemesi (sorgu seviyesi, skorun SQL'e taşınması refactor'ıyla);
  yan etki delete+insert transaction'sız (neon-http — form yeniden
  gönderimi düzeltir); soru/yanıt düzenleme kapsam dışı; searchUsers
  anonimleştirilmiş (silinmis-*) hesapları da listeler (admin bağlamında
  sorun değil); OG görseli tema-bağımsız koyu tasarım.
- SAPMA: T3b 323, T5+T7 280 satır commit (200 yasası; migration
  snapshot muafiyeti Faz 8 kaydına göre uygulanıyor).
- Vitrin/son sorular bölümleri içerik yokken doğru şekilde gizlenir
  (yerel smoke'ta boş DB ile doğrulandı).

## Bitti tanımı
lint+typecheck+vitest yeşil; CI yeşil; canlı: ana sayfa ve topic
sayfası sayfalanıyor, düzenleme akışı çalışıyor (moderasyondan geçer),
soru sayfasında QAPage JSON-LD, topic OG görseli dönüyor, kopyala
butonu çalışıyor, aramasız ana sayfada öne çıkanlar; final review
kapandı; defter güncel.
