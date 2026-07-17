import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";
import { topicStats, users, votes } from "./schema";

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

  await seed(db);
});

afterEach(async () => {
  await client.close();
});

describe("topic_stats", () => {
  it("upsert edilir ve okunur", async () => {
    const topic = await db.query.topics.findFirst();
    await db.insert(topicStats).values({
      topicId: topic!.id,
      experienceCount: 3,
      avgEffectiveness: 4.2,
      effectivePct: 67,
      topSideEffects: [{ termId: topic!.id, count: 2 }],
    });

    const row = await db.query.topicStats.findFirst();
    expect(row?.experienceCount).toBe(3);
    expect(row?.avgEffectiveness).toBeCloseTo(4.2, 1);
    expect(row?.topSideEffects).toEqual([{ termId: topic!.id, count: 2 }]);
  });
});

describe("votes", () => {
  it("bileşik PK aynı hedefe ikinci oyu engeller", async () => {
    const topic = await db.query.topics.findFirst();
    const [user] = await db
      .insert(users)
      .values({ email: "oy@example.com", username: "oycu-1" })
      .returning({ id: users.id });

    const vote = {
      userId: user.id,
      targetType: "experience" as const,
      targetId: topic!.id,
      value: 1,
    };
    await db.insert(votes).values(vote);
    await expect(db.insert(votes).values(vote)).rejects.toThrow();
  });

  it("CHECK yalnız +1/-1 kabul eder", async () => {
    const topic = await db.query.topics.findFirst();
    const [user] = await db
      .insert(users)
      .values({ email: "oy2@example.com", username: "oycu-2" })
      .returning({ id: users.id });

    await expect(
      db.insert(votes).values({
        userId: user.id,
        targetType: "experience",
        targetId: topic!.id,
        value: 2,
      }),
    ).rejects.toThrow();
  });
});
