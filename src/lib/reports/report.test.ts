import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { experiences, reports, users } from "@/db/schema";
import { createReport } from "./report";

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

describe("createReport", () => {
  it("geçerli raporda insert eder ve 'ok' döner", async () => {
    const reporterId = await makeUser("reporter@example.com");
    const authorId = await makeUser("author@example.com");
    const expId = await makeExperience(authorId);

    const result = await createReport(db, reporterId, "experience", expId, "spam");
    expect(result).toBe("ok");

    const rows = await db.select().from(reports).where(eq(reports.targetId, expId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe("spam");
    expect(rows[0]?.status).toBe("open");
  });

  it("aynı kullanıcı aynı hedefi ikinci kez raporlarsa 'duplicate' döner ve satır sayısı 1 kalır", async () => {
    const reporterId = await makeUser("reporter2@example.com");
    const authorId = await makeUser("author2@example.com");
    const expId = await makeExperience(authorId);

    const first = await createReport(db, reporterId, "experience", expId, "spam");
    expect(first).toBe("ok");

    const second = await createReport(
      db,
      reporterId,
      "experience",
      expId,
      "medical_misinfo",
    );
    expect(second).toBe("duplicate");

    const rows = await db.select().from(reports).where(eq(reports.targetId, expId));
    expect(rows).toHaveLength(1);
    // İkinci deneme kabul edilmedi; sebep ilk raporda kaldı.
    expect(rows[0]?.reason).toBe("spam");
  });

  it("farklı kullanıcı aynı hedefi raporlayabilir", async () => {
    const reporterA = await makeUser("reporterA@example.com");
    const reporterB = await makeUser("reporterB@example.com");
    const authorId = await makeUser("author3@example.com");
    const expId = await makeExperience(authorId);

    await createReport(db, reporterA, "experience", expId, "spam");
    const result = await createReport(db, reporterB, "experience", expId, "abuse");
    expect(result).toBe("ok");

    const rows = await db.select().from(reports).where(eq(reports.targetId, expId));
    expect(rows).toHaveLength(2);
  });
});
