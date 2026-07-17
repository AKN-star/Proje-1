import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { experiences, topics, translations, users } from "@/db/schema";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

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

async function createUser(email: string) {
  const [row] = await db
    .insert(users)
    .values({ email, username: email.split("@")[0], kvkkConsentAt: new Date() })
    .returning({ id: users.id });
  return row.id;
}

async function createTopic(slug: string) {
  const [row] = await db
    .insert(topics)
    .values({ slug, type: "drug", canonicalName: slug })
    .returning({ id: topics.id });
  return row.id;
}

async function insertExperienceAt(userId: string, topicId: string, createdAt: Date) {
  await db.insert(experiences).values({
    topicId,
    userId,
    purpose: "test",
    effectiveness: 3,
    body: "test",
    createdAt,
  });
}

describe("checkRateLimit", () => {
  it("pencere içindeki sayım tavanın altındaysa izin verir", async () => {
    const userId = await createUser("u1@example.com");
    const topicId = await createTopic("parol");
    const { max } = RATE_LIMITS.experience;

    for (let i = 0; i < max - 1; i++) {
      await insertExperienceAt(userId, topicId, new Date());
    }
    expect(await checkRateLimit(db, userId, "experience")).toBe(true);
  });

  it("tavana ulaşınca reddeder", async () => {
    const userId = await createUser("u2@example.com");
    const topicId = await createTopic("arveles");
    const { max } = RATE_LIMITS.experience;

    for (let i = 0; i < max; i++) {
      await insertExperienceAt(userId, topicId, new Date());
    }
    expect(await checkRateLimit(db, userId, "experience")).toBe(false);
  });

  it("pencere dışındaki kayıtları saymaz", async () => {
    const userId = await createUser("u3@example.com");
    const topicId = await createTopic("majezik");
    const { windowMs, max } = RATE_LIMITS.experience;
    const old = new Date(Date.now() - windowMs - 60_000);

    for (let i = 0; i < max; i++) {
      await insertExperienceAt(userId, topicId, old);
    }
    expect(await checkRateLimit(db, userId, "experience")).toBe(true);
  });

  it("başka kullanıcının kayıtları sayılmaz", async () => {
    const userId = await createUser("u4@example.com");
    const otherId = await createUser("u5@example.com");
    const topicId = await createTopic("dolorex");
    const { max } = RATE_LIMITS.experience;

    for (let i = 0; i < max; i++) {
      await insertExperienceAt(otherId, topicId, new Date());
    }
    expect(await checkRateLimit(db, userId, "experience")).toBe(true);
  });

  it("topic kind'ı yalnız pending önerileri sayar", async () => {
    const userId = await createUser("u6@example.com");
    const { max } = RATE_LIMITS.topic;

    for (let i = 0; i < max; i++) {
      await db.insert(topics).values({
        slug: `oneri-${i}`,
        type: "drug",
        canonicalName: `Öneri ${i}`,
        status: "pending",
        createdBy: userId,
      });
    }
    expect(await checkRateLimit(db, userId, "topic")).toBe(false);

    // Biri onaylanınca pencere açılır.
    await db.update(topics).set({ status: "active" }).where(eq(topics.slug, "oneri-0"));
    expect(await checkRateLimit(db, userId, "topic")).toBe(true);
  });

  it("translation kind'ı kullanıcıdan bağımsız global sayar", async () => {
    const userId = await createUser("u7@example.com");
    const topicId = await createTopic("global");
    void topicId;
    const { max } = RATE_LIMITS.translation;

    for (let i = 0; i < max; i++) {
      await db.insert(translations).values({
        targetType: "experience",
        targetId: crypto.randomUUID(),
        field: "body",
        locale: "en",
        text: "t",
        model: "m",
        sourceHash: `h${i}`,
      });
    }
    expect(await checkRateLimit(db, userId, "translation")).toBe(false);
  });
});
