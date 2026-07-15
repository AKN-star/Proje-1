import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { sideEffectTerms, users } from "@/db/schema";
import { getTopicBySlug } from "@/lib/queries/topics";
import { validateExperienceInput } from "@/lib/validation/experience";
import { insertExperience, statusForVerdict } from "./create";

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

describe("statusForVerdict", () => {
  it("'ok' verdict'i 'published' status'üne çevirir", () => {
    expect(statusForVerdict("ok")).toBe("published");
  });

  it("'flag' verdict'i 'flagged' status'üne çevirir", () => {
    expect(statusForVerdict("flag")).toBe("flagged");
  });
});

describe("insertExperience", () => {
  it("geçerli deneyimi ekler ve topic sayfası sorgusunda görünür", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [user] = await db
      .insert(users)
      .values({ email: "yazar@example.com", username: "yazar1234" })
      .returning();
    const [term] = await db.select().from(sideEffectTerms).limit(1);

    const validation = validateExperienceInput({
      purpose: "baş ağrısı",
      body: "İki gündür kullanıyorum, oldukça etkili oldu.",
      effectiveness: 4,
      durationDays: 2,
      sideEffectIds: [term!.id],
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const result = await insertExperience(
      db,
      validation.data,
      user!.id,
      parol!.id,
      "published",
    );
    expect(result.status).toBe("published");

    const topicResult = await getTopicBySlug(db, "parol", "tr");
    expect(topicResult?.experiences.length).toBe(1);
    expect(topicResult?.experiences[0].id).toBe(result.id);
    expect(topicResult?.experiences[0].authorUsername).toBe("yazar1234");
    expect(topicResult?.experiences[0].sideEffects).toContain(term!.nameTr);
  });

  it("'flagged' status'üyle eklenen deneyim yayınlanmış listede görünmez", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [user] = await db
      .insert(users)
      .values({ email: "yazar2@example.com", username: "yazar5678" })
      .returning();

    const validation = validateExperienceInput({
      purpose: "ateş",
      body: "Şüpheli bir içerik burada olabilir, incelenmeli.",
      effectiveness: 3,
      durationDays: null,
      sideEffectIds: [],
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    await insertExperience(db, validation.data, user!.id, parol!.id, "flagged");

    const topicResult = await getTopicBySlug(db, "parol", "tr");
    expect(topicResult?.experiences.length).toBe(0);
  });
});

describe("validateExperienceInput doğrulama reddi", () => {
  it("çok kısa purpose reddedilir", () => {
    const result = validateExperienceInput({
      purpose: "ab",
      body: "Yeterince uzun bir metin burada yer alıyor.",
      effectiveness: 3,
      durationDays: null,
      sideEffectIds: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.purpose).toBeDefined();
    }
  });

  it("geçersiz effectiveness reddedilir", () => {
    const result = validateExperienceInput({
      purpose: "baş ağrısı",
      body: "Yeterince uzun bir metin burada yer alıyor.",
      effectiveness: 6,
      durationDays: null,
      sideEffectIds: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.effectiveness).toBeDefined();
    }
  });
});
