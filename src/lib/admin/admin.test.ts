import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { experiences, moderationLog, reports, topicStats, users } from "@/db/schema";
import { requireModerator } from "./guard";
import { listModerationQueue, listOpenReports, searchUsers } from "./queries";
import { logModeration } from "@/lib/moderation/log";
import { recalcTopicStats } from "@/lib/stats/topic-stats";

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

async function getParolTopicId(): Promise<string> {
  const parol = await db.query.topics.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.slug, "parol"),
  });
  return parol!.id;
}

async function makeUser(email: string, role = "user"): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email, username: email.split("@")[0], role })
    .returning();
  return user!.id;
}

async function makeExperience(
  userId: string,
  status: "published" | "flagged" | "pending" | "removed" = "published",
): Promise<string> {
  const topicId = await getParolTopicId();
  const [row] = await db
    .insert(experiences)
    .values({
      topicId,
      userId,
      purpose: "baş ağrısı",
      effectiveness: 4,
      body: "Yeterince uzun bir deneyim metni burada yer alıyor.",
      status,
    })
    .returning({ id: experiences.id });
  return row!.id;
}

describe("requireModerator", () => {
  it("role 'user' ise null döner", async () => {
    const userId = await makeUser("plain@example.com", "user");
    const result = await requireModerator(db, userId);
    expect(result).toBeNull();
  });

  it("role 'mod' ise actor döner", async () => {
    const userId = await makeUser("mod@example.com", "mod");
    const result = await requireModerator(db, userId);
    expect(result).toEqual({ id: userId, role: "mod" });
  });

  it("role 'admin' ise actor döner", async () => {
    const userId = await makeUser("admin@example.com", "admin");
    const result = await requireModerator(db, userId);
    expect(result).toEqual({ id: userId, role: "admin" });
  });

  it("kullanıcı yoksa null döner", async () => {
    const result = await requireModerator(db, "00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

describe("listModerationQueue", () => {
  it("flagged ve pending deneyimleri döner, published dönmez", async () => {
    const authorId = await makeUser("author@example.com");
    const flaggedId = await makeExperience(authorId, "flagged");
    const pendingId = await makeExperience(authorId, "pending");
    await makeExperience(authorId, "published");
    await makeExperience(authorId, "removed");

    await logModeration(db, {
      targetType: "experience",
      targetId: flaggedId,
      action: "ai_flag",
      detail: { reasons: ["spam"] },
      actorType: "ai",
    });

    const queue = await listModerationQueue(db);
    const ids = queue.map((item) => item.id);

    expect(ids).toContain(flaggedId);
    expect(ids).toContain(pendingId);
    expect(ids).toHaveLength(2);

    const flaggedItem = queue.find((item) => item.id === flaggedId);
    expect(flaggedItem?.status).toBe("flagged");
    expect(flaggedItem?.aiReasons).toEqual(["spam"]);
    expect(flaggedItem?.authorUsername).toBe("author");
    expect(flaggedItem?.topicSlug).toBe("parol");
  });
});

describe("listOpenReports", () => {
  it("açık raporları hedef önizlemesiyle döner", async () => {
    const reporterId = await makeUser("reporter@example.com");
    const authorId = await makeUser("author2@example.com");
    const expId = await makeExperience(authorId, "published");

    await db.insert(reports).values({
      reporterId,
      targetType: "experience",
      targetId: expId,
      reason: "spam",
    });

    const openReports = await listOpenReports(db);
    expect(openReports).toHaveLength(1);
    expect(openReports[0]?.reason).toBe("spam");
    expect(openReports[0]?.reporterUsername).toBe("reporter");
    expect(openReports[0]?.targetAuthorUsername).toBe("author2");
    expect(openReports[0]?.targetStatus).toBe("published");
  });

  it("resolved raporları döndürmez", async () => {
    const reporterId = await makeUser("reporter3@example.com");
    const authorId = await makeUser("author3@example.com");
    const expId = await makeExperience(authorId, "published");

    await db.insert(reports).values({
      reporterId,
      targetType: "experience",
      targetId: expId,
      reason: "spam",
      status: "resolved",
    });

    const openReports = await listOpenReports(db);
    expect(openReports).toHaveLength(0);
  });
});

describe("moderasyon eylemleri (approve/remove akışı)", () => {
  it("approve → published + stats güncellenir + mod_restore logu yazılır", async () => {
    const modId = await makeUser("mod2@example.com", "mod");
    const authorId = await makeUser("author4@example.com");
    const topicId = await getParolTopicId();
    const flaggedId = await makeExperience(authorId, "flagged");

    // Onaydan önce stats sıfır (flagged yayınlanmış sayılmaz).
    await recalcTopicStats(db, topicId);
    const [beforeStats] = await db
      .select()
      .from(topicStats)
      .where(eq(topicStats.topicId, topicId));
    expect(beforeStats?.experienceCount).toBe(0);

    await db.update(experiences).set({ status: "published" }).where(eq(experiences.id, flaggedId));
    await recalcTopicStats(db, topicId);
    await logModeration(db, {
      targetType: "experience",
      targetId: flaggedId,
      action: "mod_restore",
      actorType: "user",
      actorId: modId,
    });

    const [afterStats] = await db
      .select()
      .from(topicStats)
      .where(eq(topicStats.topicId, topicId));
    expect(afterStats?.experienceCount).toBe(1);

    const [experienceRow] = await db
      .select()
      .from(experiences)
      .where(eq(experiences.id, flaggedId));
    expect(experienceRow?.status).toBe("published");

    const logs = await db
      .select()
      .from(moderationLog)
      .where(eq(moderationLog.targetId, flaggedId));
    expect(logs.some((l) => l.action === "mod_restore" && l.actorId === modId)).toBe(true);
  });

  it("remove → removed olur ve stats düşer", async () => {
    const modId = await makeUser("mod3@example.com", "mod");
    const authorId = await makeUser("author5@example.com");
    const topicId = await getParolTopicId();
    const publishedId = await makeExperience(authorId, "published");
    await recalcTopicStats(db, topicId);

    const [beforeStats] = await db
      .select()
      .from(topicStats)
      .where(eq(topicStats.topicId, topicId));
    expect(beforeStats?.experienceCount).toBe(1);

    await db
      .update(experiences)
      .set({ status: "removed" })
      .where(eq(experiences.id, publishedId));
    await recalcTopicStats(db, topicId);
    await logModeration(db, {
      targetType: "experience",
      targetId: publishedId,
      action: "mod_remove",
      actorType: "user",
      actorId: modId,
    });

    const [afterStats] = await db
      .select()
      .from(topicStats)
      .where(eq(topicStats.topicId, topicId));
    expect(afterStats?.experienceCount).toBe(0);

    const [experienceRow] = await db
      .select()
      .from(experiences)
      .where(eq(experiences.id, publishedId));
    expect(experienceRow?.status).toBe("removed");
  });

  it("searchUsers takma ad/e-posta ile bulur, içerik sayısı ve ban durumunu döner", async () => {
    const userId = await makeUser("aranan-kisi@example.com");
    await makeExperience(userId, "published");

    const byEmail = await searchUsers(db, "aranan-kisi");
    expect(byEmail).toHaveLength(1);
    expect(byEmail[0]).toMatchObject({
      username: "aranan-kisi",
      email: "aranan-kisi@example.com",
      role: "user",
      bannedAt: null,
      experienceCount: 1,
      questionCount: 0,
    });

    // Joker karakterler kaçırılır — '%' tüm kullanıcıları döndürmez.
    expect(await searchUsers(db, "%")).toEqual([]);
    expect(await searchUsers(db, "  ")).toEqual([]);
  });

  it("resolveReport → status resolved", async () => {
    const reporterId = await makeUser("reporter4@example.com");
    const authorId = await makeUser("author6@example.com");
    const expId = await makeExperience(authorId, "published");

    const [report] = await db
      .insert(reports)
      .values({ reporterId, targetType: "experience", targetId: expId, reason: "spam" })
      .returning();

    await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, report!.id));

    const [row] = await db.select().from(reports).where(eq(reports.id, report!.id));
    expect(row?.status).toBe("resolved");
  });
});
