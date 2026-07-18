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
import {
  getOwnExperience,
  insertExperience,
  statusForVerdict,
  updateOwnExperience,
} from "./create";

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

  it("'timeout' verdict'i 'pending' status'üne çevirir", () => {
    expect(statusForVerdict("timeout")).toBe("pending");
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

describe("updateOwnExperience (Faz 9 T3)", () => {
  async function setupOwn() {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [owner] = await db
      .insert(users)
      .values({ email: "sahip@example.com", username: "sahip" })
      .returning();
    const [other] = await db
      .insert(users)
      .values({ email: "digeri@example.com", username: "digeri" })
      .returning();
    const [term] = await db.select().from(sideEffectTerms).limit(1);
    const inserted = await insertExperience(
      db,
      {
        purpose: "baş ağrısı",
        body: "İlk halim böyleydi, yeterince uzun.",
        effectiveness: 3,
        durationDays: null,
        sideEffectIds: [term!.id],
      },
      owner!.id,
      parol!.id,
      "published",
    );
    return { ownerId: owner!.id, otherId: other!.id, experienceId: inserted.id, termId: term!.id };
  }

  it("getOwnExperience sahibine yan etkilerle döner, başkasına null", async () => {
    const { ownerId, otherId, experienceId, termId } = await setupOwn();
    const own = await getOwnExperience(db, ownerId, experienceId);
    expect(own?.topicSlug).toBe("parol");
    expect(own?.sideEffectIds).toEqual([termId]);
    expect(await getOwnExperience(db, otherId, experienceId)).toBeNull();
  });

  it("alanları ve yan etkileri günceller; yeni status yazılır", async () => {
    const { ownerId, experienceId } = await setupOwn();
    const ok = await updateOwnExperience(
      db,
      ownerId,
      experienceId,
      {
        purpose: "migren",
        body: "Düzenlenmiş metin, yeterince uzun bir açıklama.",
        effectiveness: 5,
        durationDays: 7,
        sideEffectIds: [],
      },
      "pending",
    );
    expect(ok).toBe(true);

    const own = await getOwnExperience(db, ownerId, experienceId);
    expect(own).toMatchObject({
      purpose: "migren",
      effectiveness: 5,
      durationDays: 7,
      sideEffectIds: [],
    });

    // pending status yayınlanmış listede görünmez.
    const topicResult = await getTopicBySlug(db, "parol", "tr");
    expect(topicResult?.experiences).toHaveLength(0);
  });

  it("başkasının deneyimini güncellemez", async () => {
    const { otherId, experienceId } = await setupOwn();
    const ok = await updateOwnExperience(
      db,
      otherId,
      experienceId,
      {
        purpose: "kaçırma denemesi",
        body: "Bu güncelleme asla yazılmamalı, uzun metin.",
        effectiveness: 1,
        durationDays: null,
        sideEffectIds: [],
      },
      "published",
    );
    expect(ok).toBe(false);
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
