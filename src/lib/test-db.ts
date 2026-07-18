/**
 * Test veritabanı kurulumu (Faz 10 cleanup — 19 test dosyasındaki
 * migration-runner beforeEach kopyasının tek kaynağı). Yalnız testlerde
 * kullanılır; migration'ları taze bir in-memory PGlite'a uygular.
 *
 * NOT: assert'lere dokunulmaz — bu yalnız kurulum bloğunun ortak hale
 * getirilmesidir (CLAUDE.md "cleanup" tanımı: davranış birebir).
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

// Bu dosya src/lib/ altında; drizzle/ repo kökünde.
const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");

export interface TestDb {
  client: PGlite;
  db: PgliteDatabase<typeof schema>;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.exec(statement);
    }
  }

  return { client, db };
}
