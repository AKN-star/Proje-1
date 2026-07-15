import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";
import {
  experiences,
  experienceSideEffects,
  sideEffectTerms,
  topicI18n,
  topics,
  users,
} from "./schema";
import { eq } from "drizzle-orm";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");

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

describe("schema round-trip", () => {
  it("seed idempotent şekilde topic + yan etki verisini kurar", async () => {
    await seed(db);
    await seed(db); // idempotent olmalı, hata atmamalı

    const allTopics = await db.select().from(topics);
    expect(allTopics.length).toBe(20);

    const allTerms = await db.select().from(sideEffectTerms);
    expect(allTerms.length).toBe(24);
  });

  it("user + experience + 2 yan etki join insert edip topic üzerinden okunabiliyor", async () => {
    await seed(db);

    const parol = await db.query.topics.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.slug, "parol"),
    });
    expect(parol).toBeDefined();

    const [user] = await db
      .insert(users)
      .values({ email: "test@example.com", username: "test1234" })
      .returning();
    expect(user.id).toBeDefined();

    const terms = await db
      .select()
      .from(sideEffectTerms)
      .where(eq(sideEffectTerms.slug, "bulanti"));
    const term2 = await db
      .select()
      .from(sideEffectTerms)
      .where(eq(sideEffectTerms.slug, "bas-agrisi"));

    const [experience] = await db
      .insert(experiences)
      .values({
        topicId: parol!.id,
        userId: user.id,
        purpose: "baş ağrısı",
        durationDays: 3,
        effectiveness: 4,
        body: "İşe yaradı, hafif rahatladım.",
      })
      .returning();

    await db.insert(experienceSideEffects).values([
      { experienceId: experience.id, termId: terms[0].id },
      { experienceId: experience.id, termId: term2[0].id },
    ]);

    const joined = await db
      .select({
        experienceId: experiences.id,
        topicSlug: topics.slug,
        termSlug: sideEffectTerms.slug,
      })
      .from(experiences)
      .innerJoin(topics, eq(experiences.topicId, topics.id))
      .innerJoin(experienceSideEffects, eq(experienceSideEffects.experienceId, experiences.id))
      .innerJoin(sideEffectTerms, eq(sideEffectTerms.id, experienceSideEffects.termId))
      .where(eq(experiences.id, experience.id));

    expect(joined.length).toBe(2);
    expect(joined[0].topicSlug).toBe("parol");
    const termSlugs = joined.map((j) => j.termSlug).sort();
    expect(termSlugs).toEqual(["bas-agrisi", "bulanti"]);
  });

  it("effectiveness check constraint aralık dışı değeri reddeder", async () => {
    await seed(db);
    const parol = await db.query.topics.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.slug, "parol"),
    });
    const [user] = await db
      .insert(users)
      .values({ email: "test2@example.com", username: "test5678" })
      .returning();

    await expect(
      db.insert(experiences).values({
        topicId: parol!.id,
        userId: user.id,
        purpose: "test",
        effectiveness: 9,
        body: "gecersiz etkinlik puani",
      }),
    ).rejects.toThrow();
  });

  it("topic_i18n tr/en isimlerini ve drug_details etken maddesini içerir", async () => {
    await seed(db);
    const rows = await db
      .select({ name: topicI18n.name, locale: topicI18n.locale })
      .from(topicI18n)
      .innerJoin(topics, eq(topics.id, topicI18n.topicId))
      .where(eq(topics.slug, "majezik"));
    expect(rows.length).toBe(2);
    const trName = rows.find((r) => r.locale === "tr")?.name;
    expect(trName).toBe("Majezik");
  });
});
