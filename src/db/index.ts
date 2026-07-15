import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Ortak DB tipi: prod'da Neon (serverless HTTP), dev/test'te PGlite.
 * İkisi de PgDatabase türevi olduğundan uygulama kodu tek tip görür.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Next dev (Turbopack) aynı modülü ayrı chunk graph'larında iki kez
// örnekleyebiliyor; PGlite aynı veri dizinine ikinci kez açılamaz. Bu
// yüzden singleton modül değişkeninde değil globalThis'te tutulur.
const globalDb = globalThis as { __appDb?: Promise<Db> };

/**
 * DATABASE_URL varsa Neon'a bağlanır; yoksa yerel PGlite kullanır
 * (`.pglite/` dizini, gitignore'da). Testler bunu kullanmaz — kendi
 * in-memory PGlite örneklerini kurar.
 */
export function getDb(): Promise<Db> {
  // Promise saklanır ki eşzamanlı ilk çağrılar da tek kurulum paylaşsın.
  globalDb.__appDb ??= initDb();
  return globalDb.__appDb;
}

async function initDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(url, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const pgliteDb = drizzle(".pglite/", { schema });
  // Dev'de migration'ları otomatik uygula (idempotent) — `npm run
  // db:migrate` DATABASE_URL ister, PGlite yolu kendi kendini kurar.
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(pgliteDb, { migrationsFolder: "./drizzle" });
  await autoSeedIfEmpty(pgliteDb);
  return pgliteDb;
}

/**
 * Dev modda (PGlite, DATABASE_URL yok) topics tablosu boşsa otomatik
 * seed çalıştırır — `npm run db:seed` script'i yok (Faz 1'de bağımlılık
 * eklenmeden CLI girişi kurulamadı); dev sunucusu ilk `getDb()`
 * çağrısında kendini tohumlar.
 */
async function autoSeedIfEmpty(target: Db): Promise<void> {
  const { seed } = await import("./seed");
  const { count } = await import("drizzle-orm");
  const [row] = await target.select({ count: count() }).from(schema.topics);
  if (!row || Number(row.count) === 0) {
    await seed(target);
  }
}
