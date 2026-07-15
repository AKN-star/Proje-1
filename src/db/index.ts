import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Ortak DB tipi: prod'da Neon (serverless HTTP), dev/test'te PGlite.
 * İkisi de PgDatabase türevi olduğundan uygulama kodu tek tip görür.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

/**
 * DATABASE_URL varsa Neon'a bağlanır; yoksa yerel PGlite kullanır
 * (`.pglite/` dizini, gitignore'da). Testler bunu kullanmaz — kendi
 * in-memory PGlite örneklerini kurar.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    db = drizzle(url, { schema });
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    db = drizzle(".pglite/", { schema });
    await autoSeedIfEmpty(db);
  }
  return db;
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
