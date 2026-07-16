import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { sideEffectTerms, users } from "@/db/schema";
import { insertExperience } from "@/lib/experiences/create";
import { validateExperienceInput } from "@/lib/validation/experience";
import { getTopicStats, recalcTopicStats } from "./topic-stats";

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

async function addExperience(
  topicId: string,
  effectiveness: number,
  sideEffectIds: string[],
  status: "published" | "flagged",
  email: string,
) {
  const [user] = await db
    .insert(users)
    .values({ email, username: email.split("@")[0] })
    .returning();

  const validation = validateExperienceInput({
    purpose: "test amaç",
    body: "Yeterince uzun bir deneyim metni burada yer alıyor.",
    effectiveness,
    durationDays: null,
    sideEffectIds,
  });
  expect(validation.ok).toBe(true);
  if (!validation.ok) throw new Error("beklenmeyen doğrulama hatası");

  await insertExperience(db, validation.data, user!.id, topicId, status);
}

describe("recalcTopicStats", () => {
  it("yayınlanmış deneyimlerden count/avg/etkili%/top yan etkiyi hesaplar", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const terms = await db.select().from(sideEffectTerms).limit(2);
    const [termA, termB] = terms;

    // Ortak yan etki termA: hem etki=5 hem etki=4 deneyiminde; termB
    // yalnız etki=2 deneyiminde.
    await addExperience(parol!.id, 5, [termA!.id], "published", "e1@example.com");
    await addExperience(parol!.id, 4, [termA!.id], "published", "e2@example.com");
    await addExperience(parol!.id, 2, [termB!.id], "published", "e3@example.com");

    await recalcTopicStats(db, parol!.id);

    const result = await getTopicStats(db, parol!.id);
    expect(result).not.toBeNull();
    expect(result?.experienceCount).toBe(3);
    expect(result?.avgEffectiveness).toBeCloseTo(11 / 3, 2);
    expect(result?.effectivePct).toBe(67); // 2/3 -> Math.round(66.67) = 67
    expect(result?.topSideEffects).toEqual([
      { termId: termA!.id, count: 2 },
      { termId: termB!.id, count: 1 },
    ]);
  });

  it("flagged deneyim sayılmaz", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });

    await addExperience(parol!.id, 5, [], "published", "e1@example.com");
    await addExperience(parol!.id, 1, [], "flagged", "e2@example.com");

    await recalcTopicStats(db, parol!.id);

    const result = await getTopicStats(db, parol!.id);
    expect(result?.experienceCount).toBe(1);
    expect(result?.avgEffectiveness).toBeCloseTo(5, 2);
    expect(result?.effectivePct).toBe(100);
  });

  it("deneyimsiz topic için sıfır satırı yazar", async () => {
    const majezik = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "majezik"),
    });

    await recalcTopicStats(db, majezik!.id);

    const result = await getTopicStats(db, majezik!.id);
    expect(result).not.toBeNull();
    expect(result?.experienceCount).toBe(0);
    expect(result?.avgEffectiveness).toBeNull();
    expect(result?.effectivePct).toBeNull();
    expect(result?.topSideEffects).toEqual([]);
  });

  it("ikinci recalc idempotent (upsert)", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });

    await addExperience(parol!.id, 5, [], "published", "e1@example.com");
    await recalcTopicStats(db, parol!.id);
    const first = await getTopicStats(db, parol!.id);

    await addExperience(parol!.id, 3, [], "published", "e2@example.com");
    await recalcTopicStats(db, parol!.id);
    const second = await getTopicStats(db, parol!.id);

    expect(first?.experienceCount).toBe(1);
    expect(second?.experienceCount).toBe(2);
    expect(second?.avgEffectiveness).toBeCloseTo(4, 2);

    const rows = await db.select().from(schema.topicStats);
    const parolRows = rows.filter((r) => r.topicId === parol!.id);
    expect(parolRows.length).toBe(1);
  });
});

describe("getTopicStats", () => {
  it("satır yoksa null döner", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const result = await getTopicStats(db, parol!.id);
    expect(result).toBeNull();
  });
});
