import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { moderationLog, reports, users } from "./schema";

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

describe("reports", () => {
  it("insert edilir; aynı kullanıcı aynı hedefi ikinci kez raporlayamaz", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "r@example.com", username: "raporcu" })
      .returning({ id: users.id });

    const report = {
      reporterId: user.id,
      targetType: "experience" as const,
      targetId: user.id, // FK yok, herhangi bir uuid yeterli
      reason: "spam" as const,
    };
    await db.insert(reports).values(report);
    await expect(db.insert(reports).values(report)).rejects.toThrow();

    const rows = await db.select().from(reports);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
  });
});

describe("moderation_log", () => {
  it("AI ve moderatör kayıtları yazılır", async () => {
    const [mod] = await db
      .insert(users)
      .values({ email: "m@example.com", username: "moderator" })
      .returning({ id: users.id });

    await db.insert(moderationLog).values({
      targetType: "experience",
      targetId: mod.id,
      action: "ai_flag",
      detail: { reasons: ["spam"] },
      actorType: "ai",
    });
    await db.insert(moderationLog).values({
      targetType: "experience",
      targetId: mod.id,
      action: "mod_restore",
      actorType: "user",
      actorId: mod.id,
    });

    const rows = await db.select().from(moderationLog);
    expect(rows).toHaveLength(2);
    expect(rows[0].detail?.reasons).toEqual(["spam"]);
    expect(rows[1].actorId).toBe(mod.id);
  });
});

describe("users.banned_at", () => {
  it("varsayılan null; set edilebilir", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "b@example.com", username: "banli" })
      .returning({ id: users.id, bannedAt: users.bannedAt });
    expect(user.bannedAt).toBeNull();
  });
});
