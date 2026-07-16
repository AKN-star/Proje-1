import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { experiences, users } from "@/db/schema";
import { castVote, getScores } from "./vote";

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

async function makeExperience(userId: string) {
  const parol = await db.query.topics.findFirst({
    where: (t, { eq }) => eq(t.slug, "parol"),
  });
  const [row] = await db
    .insert(experiences)
    .values({
      topicId: parol!.id,
      userId,
      purpose: "baş ağrısı",
      effectiveness: 4,
      body: "Yeterince uzun bir deneyim metni burada yer alıyor.",
      status: "published",
    })
    .returning({ id: experiences.id });
  return row!.id;
}

async function makeUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({ email, username: email.split("@")[0] })
    .returning();
  return user!.id;
}

describe("castVote", () => {
  it("aynı değer ikinci kez gönderilirse oy silinir (toggle)", async () => {
    const userId = await makeUser("a@example.com");
    const expId = await makeExperience(userId);

    const first = await castVote(db, userId, "experience", expId, 1);
    expect(first).toBe("added");

    const second = await castVote(db, userId, "experience", expId, 1);
    expect(second).toBe("removed");

    const scores = await getScores(db, "experience", [expId]);
    expect(scores.get(expId)?.score).toBe(0);
  });

  it("farklı değer gönderilirse oy güncellenir", async () => {
    const userId = await makeUser("b@example.com");
    const expId = await makeExperience(userId);

    await castVote(db, userId, "experience", expId, 1);
    const changed = await castVote(db, userId, "experience", expId, -1);
    expect(changed).toBe("changed");

    const scores = await getScores(db, "experience", [expId]);
    expect(scores.get(expId)?.score).toBe(-1);
  });

  it("iki kullanıcının oyu toplanır", async () => {
    const userA = await makeUser("c@example.com");
    const userB = await makeUser("d@example.com");
    const expId = await makeExperience(userA);

    await castVote(db, userA, "experience", expId, 1);
    await castVote(db, userB, "experience", expId, 1);

    const scores = await getScores(db, "experience", [expId]);
    expect(scores.get(expId)?.score).toBe(2);
  });
});

describe("getScores", () => {
  it("currentUserId verildiğinde myVote doğru döner", async () => {
    const userA = await makeUser("e@example.com");
    const userB = await makeUser("f@example.com");
    const expId = await makeExperience(userA);

    await castVote(db, userA, "experience", expId, 1);
    await castVote(db, userB, "experience", expId, -1);

    const scoresForA = await getScores(db, "experience", [expId], userA);
    expect(scoresForA.get(expId)?.myVote).toBe(1);
    expect(scoresForA.get(expId)?.score).toBe(0);

    const scoresForB = await getScores(db, "experience", [expId], userB);
    expect(scoresForB.get(expId)?.myVote).toBe(-1);

    const noUser = await getScores(db, "experience", [expId]);
    expect(noUser.get(expId)?.myVote).toBeNull();
  });

  it("boş targetIds için boş Map döner", async () => {
    const scores = await getScores(db, "experience", []);
    expect(scores.size).toBe(0);
  });

  it("hiç oy olmayan hedef için skor 0 ve myVote null döner", async () => {
    const userId = await makeUser("g@example.com");
    const expId = await makeExperience(userId);

    const scores = await getScores(db, "experience", [expId], userId);
    expect(scores.get(expId)).toEqual({ score: 0, myVote: null });
  });
});
