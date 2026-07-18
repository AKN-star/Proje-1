import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { levenshtein, suggestTopics } from "./suggest";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../drizzle");

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });

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

  await seed(db);
});

afterEach(async () => {
  await client.close();
});

describe("levenshtein", () => {
  it("temel mesafeleri doğru hesaplar", () => {
    expect(levenshtein("parol", "parol")).toBe(0);
    expect(levenshtein("parool", "parol")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("suggestTopics", () => {
  it("bozuk yazımda en yakın başlığı önerir", async () => {
    const result = await suggestTopics(db, "parool");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].slug).toBe("parol");
  });

  it("alakasız sorguda ve çok kısa sorguda boş döner", async () => {
    expect(await suggestTopics(db, "xqzwjk")).toEqual([]);
    expect(await suggestTopics(db, "ab")).toEqual([]);
  });
});
