import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { sessions } from "@/db/auth-schema";
import { experiences, questions, topicStats, topics, users } from "@/db/schema";
import { anonymizeAccount, listMyContent, removeOwnContent } from "./my-content";

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

async function setup() {
  const [user] = await db
    .insert(users)
    .values({ email: "ben@example.com", username: "ben", kvkkConsentAt: new Date() })
    .returning({ id: users.id });
  const [other] = await db
    .insert(users)
    .values({ email: "baska@example.com", username: "baska", kvkkConsentAt: new Date() })
    .returning({ id: users.id });
  const [topic] = await db
    .insert(topics)
    .values({ slug: "parol", type: "drug", canonicalName: "Parol" })
    .returning({ id: topics.id });
  const [experience] = await db
    .insert(experiences)
    .values({
      topicId: topic.id,
      userId: user.id,
      purpose: "baş ağrısı",
      effectiveness: 4,
      body: "işe yaradı",
    })
    .returning({ id: experiences.id });
  const [question] = await db
    .insert(questions)
    .values({ topicId: topic.id, userId: user.id, title: "Aç karnına içilir mi?" })
    .returning({ id: questions.id });
  return { userId: user.id, otherId: other.id, topicId: topic.id, experienceId: experience.id, questionId: question.id };
}

describe("listMyContent", () => {
  it("kullanıcının deneyim ve sorularını tür/durum bilgisiyle döner", async () => {
    const { userId } = await setup();
    const items = await listMyContent(db, userId);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kind).sort()).toEqual(["experience", "question"]);
    expect(items.every((i) => i.status === "published")).toBe(true);
  });

  it("başka kullanıcının içeriğini karıştırmaz", async () => {
    const { otherId } = await setup();
    expect(await listMyContent(db, otherId)).toEqual([]);
  });
});

describe("removeOwnContent", () => {
  it("kendi deneyimini removed yapar ve topic_stats'ı günceller", async () => {
    const { userId, topicId, experienceId } = await setup();
    const result = await removeOwnContent(db, userId, "experience", experienceId);
    expect(result).toBe("/baslik/parol");

    const [row] = await db
      .select({ status: experiences.status })
      .from(experiences)
      .where(eq(experiences.id, experienceId));
    expect(row.status).toBe("removed");

    const [stats] = await db
      .select({ count: topicStats.experienceCount })
      .from(topicStats)
      .where(eq(topicStats.topicId, topicId));
    expect(stats.count).toBe(0);
  });

  it("başkasının içeriğine ve zaten removed olana dokunmaz", async () => {
    const { userId, otherId, questionId } = await setup();
    expect(await removeOwnContent(db, otherId, "question", questionId)).toBeNull();

    expect(await removeOwnContent(db, userId, "question", questionId)).toBe(
      `/soru/${questionId}`,
    );
    expect(await removeOwnContent(db, userId, "question", questionId)).toBeNull();
  });
});

describe("anonymizeAccount", () => {
  it("kimlik alanlarını temizler, oturumları siler, içerik satırı kalır", async () => {
    const { userId, experienceId } = await setup();
    await db.insert(sessions).values({
      sessionToken: "tok-1",
      userId,
      expires: new Date(Date.now() + 86_400_000),
    });

    await anonymizeAccount(db, userId);

    const [user] = await db
      .select({ email: users.email, username: users.username, proBadge: users.proBadge })
      .from(users)
      .where(eq(users.id, userId));
    expect(user.email).toBe(`silinmis-${userId}@hesap.yerel`);
    expect(user.username).toBeNull();
    expect(user.proBadge).toBeNull();

    const remainingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    expect(remainingSessions).toEqual([]);

    // İçerik anonim imzayla durur (FK bozulmaz).
    const [experience] = await db
      .select({ id: experiences.id })
      .from(experiences)
      .where(eq(experiences.id, experienceId));
    expect(experience).toBeDefined();
  });
});
