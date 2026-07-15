# Kullanılır mı (çalışma adı)

İlaç ve tedavi deneyimlerinin yapılandırılmış biçimde paylaşıldığı, otomatik
istatistik üreten platform. Plan ve veri modeli sözleşmesi:
[docs/master-plan.md](docs/master-plan.md).

## Geliştirme

```bash
npm ci
npm run dev        # http://localhost:3000 — DB olarak yerel PGlite kullanır
npm test           # hermetik testler (in-memory PGlite)
npm run lint && npm run typecheck
```

`DATABASE_URL` boşken dev ortamı `.pglite/` altında yerel Postgres (PGlite)
kullanır; Neon yalnız deploy ortamlarında gerekir. Ortam değişkenleri için
`.env.example`'a bakın.
