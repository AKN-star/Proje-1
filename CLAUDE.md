# Kullanılır mı — proje rehberi

İlaç/tedavi deneyimi platformu. Kaynak gerçeklik: **docs/master-plan.md**
(faz planı, veri modeli sözleşmesi, kickoff kararları). Faz ilerlemesi:
**.superpowers/sdd/progress.md**.

## Durum

- **Aktif faz:** Faz 0 (gün-0 altyapısı) — bu branch'te kuruldu.
- Bekleyen insan adımları: GitHub remote (push için ön şart), Neon + Vercel
  hesapları (Faz 1 canlıya kadar), Resend (Faz 1).

## Komutlar

```
npm run dev         # dev sunucu (Turbopack)
npm run build       # prod build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # vitest (hermetik; in-memory PGlite, secret gerekmez)
npm run db:generate # drizzle-kit migration üret
npm run db:migrate  # migration uygula (DATABASE_URL gerekir)
```

## Kritik kurallar

1. **Marka string'i koda gömme** — hepsi `src/config/brand.ts`'ten gelir.
2. **Veri modeli sözleşmedir** — şema değişikliği önce docs/master-plan.md
   "Veri Modeli" bölümünü güncellemeli; yan etkiler kontrollü sözlükten
   (join tablosu), asla serbest metin değil.
3. **Her yayın API'si `src/lib/ai/moderate.ts`'ten geçer** (Faz 1'de no-op
   stub, Faz 3'te gerçek). İmza: `moderate(content, kind) →
   {verdict:'ok'|'flag'|'block', reasons[]}`; AI timeout → içerik 'pending'.
4. **DB:** prod Neon, dev/test PGlite — `src/db/index.ts:getDb()` seçer.
   Testler kendi in-memory PGlite örneğini kurar; CI secret'sız kalmalı.
5. **Yayına kadar noindex** — `next.config.ts` header'ı + `layout.tsx`
   `metadata.robots`; Faz 7'de birlikte kaldırılır.
6. **shadcn registry'sine (ui.shadcn.com) ağ politikası izin vermiyor** —
   bileşenler `src/components/ui/` altına elle vendor'lanır
   (components.json + tema değişkenleri hazır).
7. Teknoloji yığını master planda **sabittir**, alternatif önerme.
8. Her içerik sayfasında sabit tıbbi disclaimer bileşeni (Faz 1'de gelir).
