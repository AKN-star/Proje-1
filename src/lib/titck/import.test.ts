import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { drugDetails, topicI18n, topics } from "@/db/schema";
import { importDrugRows, parseTitckCsv } from "./import";

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
});

afterEach(async () => {
  await client.close();
});

const SAMPLE_CSV = `ad;etkin madde;form;doz
PAROL 500 MG TABLET;Parasetamol;Tablet;500 mg
"ARVELES 25 MG;FILM TABLET";Deksketoprofen;Film tablet;25 mg
MAJEZIK 100 MG;;Draje;
`;

describe("parseTitckCsv", () => {
  it("başlığı atlar, tırnaklı hücreyi ve boş alanları doğru işler", () => {
    const rows = parseTitckCsv(SAMPLE_CSV);
    expect(rows).toEqual([
      {
        name: "PAROL 500 MG TABLET",
        activeIngredient: "Parasetamol",
        form: "Tablet",
        strength: "500 mg",
      },
      {
        name: "ARVELES 25 MG;FILM TABLET",
        activeIngredient: "Deksketoprofen",
        form: "Film tablet",
        strength: "25 mg",
      },
      {
        name: "MAJEZIK 100 MG",
        activeIngredient: null,
        form: "Draje",
        strength: null,
      },
    ]);
  });

  it("virgül ayraçlı dosyayı da okur; boş dosyada boş döner", () => {
    expect(parseTitckCsv("ad,etkin madde\nPAROL,Parasetamol")).toEqual([
      { name: "PAROL", activeIngredient: "Parasetamol", form: null, strength: null },
    ]);
    expect(parseTitckCsv("")).toEqual([]);
  });
});

describe("importDrugRows", () => {
  it("satırları topic + i18n + drug_details(titck) olarak ekler", async () => {
    const rows = parseTitckCsv(SAMPLE_CSV);
    const result = await importDrugRows(db, rows);
    expect(result).toEqual({ inserted: 3, skipped: 0 });

    const [topic] = await db
      .select({ id: topics.id, type: topics.type, status: topics.status })
      .from(topics)
      .where(eq(topics.slug, "parol-500-mg-tablet"));
    expect(topic).toMatchObject({ type: "drug", status: "active" });

    const [i18n] = await db
      .select({ name: topicI18n.name })
      .from(topicI18n)
      .where(eq(topicI18n.topicId, topic.id));
    expect(i18n.name).toBe("PAROL 500 MG TABLET");

    const [details] = await db
      .select({ source: drugDetails.source, activeIngredient: drugDetails.activeIngredient })
      .from(drugDetails)
      .where(eq(drugDetails.topicId, topic.id));
    expect(details).toEqual({ source: "titck", activeIngredient: "Parasetamol" });
  });

  it("mevcut slug'ı korur ve atlar; dryRun yazmaz", async () => {
    await db.insert(topics).values({
      slug: "parol-500-mg-tablet",
      type: "drug",
      canonicalName: "Elle girilmiş Parol",
    });

    const rows = parseTitckCsv(SAMPLE_CSV);
    const dry = await importDrugRows(db, rows, { dryRun: true });
    expect(dry).toEqual({ inserted: 2, skipped: 1 });

    const all = await db.select({ id: topics.id }).from(topics);
    expect(all).toHaveLength(1);

    const wet = await importDrugRows(db, rows);
    expect(wet).toEqual({ inserted: 2, skipped: 1 });
    const [existing] = await db
      .select({ canonicalName: topics.canonicalName })
      .from(topics)
      .where(eq(topics.slug, "parol-500-mg-tablet"));
    expect(existing.canonicalName).toBe("Elle girilmiş Parol");
  });
});
