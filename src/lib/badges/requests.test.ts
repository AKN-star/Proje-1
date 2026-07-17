import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { badgeRequests, users } from "@/db/schema";
import {
  createBadgeRequest,
  getLatestBadgeRequest,
  listPendingBadgeRequests,
  reviewBadgeRequest,
} from "./requests";

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

async function createUser(email: string, overrides: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .insert(users)
    .values({
      email,
      username: email.split("@")[0],
      kvkkConsentAt: new Date(),
      ...overrides,
    })
    .returning({ id: users.id });
  return row.id;
}

const INPUT = {
  claimedRole: "doctor" as const,
  institution: "Ankara Şehir Hastanesi",
  documentNote: "Diploma no: 12345, sicil no: 67890.",
};

describe("createBadgeRequest", () => {
  it("geçerli başvuruyu pending olarak yazar", async () => {
    const userId = await createUser("dr@example.com");
    const result = await createBadgeRequest(db, userId, INPUT);
    expect(result.ok).toBe(true);

    const latest = await getLatestBadgeRequest(db, userId);
    expect(latest).toEqual({ status: "pending", claimedRole: "doctor" });
  });

  it("boş alan ve geçersiz rolü reddeder", async () => {
    const userId = await createUser("dr2@example.com");
    expect(
      await createBadgeRequest(db, userId, { ...INPUT, institution: "  " }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await createBadgeRequest(db, userId, {
        ...INPUT,
        claimedRole: "nurse" as never,
      }),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("bekleyen başvuru varken ikinciyi reddeder", async () => {
    const userId = await createUser("dr3@example.com");
    await createBadgeRequest(db, userId, INPUT);
    expect(await createBadgeRequest(db, userId, INPUT)).toEqual({
      ok: false,
      error: "pending",
    });
  });

  it("zaten rozetli kullanıcıyı reddeder", async () => {
    const userId = await createUser("dr4@example.com", { proBadge: "doctor" });
    expect(await createBadgeRequest(db, userId, INPUT)).toEqual({
      ok: false,
      error: "already",
    });
  });

  it("red sonrası yeni başvuruya izin verir", async () => {
    const userId = await createUser("dr5@example.com");
    const reviewerId = await createUser("admin@example.com", { role: "admin" });
    const first = await createBadgeRequest(db, userId, INPUT);
    if (!first.ok) throw new Error("beklenmedik");
    await reviewBadgeRequest(db, first.id, reviewerId, "reject");

    const second = await createBadgeRequest(db, userId, INPUT);
    expect(second.ok).toBe(true);
  });
});

describe("reviewBadgeRequest", () => {
  it("approve: pro_badge + role='pro' yazar, satırı kapatır", async () => {
    const userId = await createUser("dr6@example.com");
    const reviewerId = await createUser("admin2@example.com", { role: "admin" });
    const result = await createBadgeRequest(db, userId, INPUT);
    if (!result.ok) throw new Error("beklenmedik");

    expect(await reviewBadgeRequest(db, result.id, reviewerId, "approve")).toBe(true);

    const [user] = await db
      .select({ proBadge: users.proBadge, role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    expect(user).toEqual({ proBadge: "doctor", role: "pro" });

    const [request] = await db
      .select({ status: badgeRequests.status, reviewedBy: badgeRequests.reviewedBy })
      .from(badgeRequests)
      .where(eq(badgeRequests.id, result.id));
    expect(request.status).toBe("approved");
    expect(request.reviewedBy).toBe(reviewerId);
  });

  it("approve admin rolünü düşürmez", async () => {
    const userId = await createUser("admindr@example.com", { role: "admin" });
    const reviewerId = await createUser("admin3@example.com", { role: "admin" });
    const result = await createBadgeRequest(db, userId, INPUT);
    if (!result.ok) throw new Error("beklenmedik");

    await reviewBadgeRequest(db, result.id, reviewerId, "approve");
    const [user] = await db
      .select({ proBadge: users.proBadge, role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    expect(user).toEqual({ proBadge: "doctor", role: "admin" });
  });

  it("reject kullanıcıyı değiştirmez; kapanmış başvuru tekrar işlenmez", async () => {
    const userId = await createUser("dr7@example.com");
    const reviewerId = await createUser("admin4@example.com", { role: "admin" });
    const result = await createBadgeRequest(db, userId, INPUT);
    if (!result.ok) throw new Error("beklenmedik");

    expect(await reviewBadgeRequest(db, result.id, reviewerId, "reject")).toBe(true);
    const [user] = await db
      .select({ proBadge: users.proBadge, role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    expect(user).toEqual({ proBadge: null, role: "user" });

    // Kapanmış başvuru ikinci kez sonuçlandırılamaz.
    expect(await reviewBadgeRequest(db, result.id, reviewerId, "approve")).toBe(false);
  });
});

describe("listPendingBadgeRequests", () => {
  it("yalnız pending başvuruları kullanıcı bilgisiyle döner", async () => {
    const userId = await createUser("dr8@example.com");
    const reviewerId = await createUser("admin5@example.com", { role: "admin" });
    const open = await createBadgeRequest(db, userId, INPUT);
    if (!open.ok) throw new Error("beklenmedik");

    const otherId = await createUser("dr9@example.com");
    const closed = await createBadgeRequest(db, otherId, INPUT);
    if (!closed.ok) throw new Error("beklenmedik");
    await reviewBadgeRequest(db, closed.id, reviewerId, "reject");

    const list = await listPendingBadgeRequests(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: open.id,
      username: "dr8",
      claimedRole: "doctor",
      institution: INPUT.institution,
    });
  });
});
