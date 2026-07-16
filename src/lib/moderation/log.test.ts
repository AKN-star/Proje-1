import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { moderationLog, users } from "@/db/schema";
import { logModeration } from "./log";

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

describe("logModeration", () => {
  it("AI kaydını detail ile birlikte yazar", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "ai-log@example.com", username: "ailog" })
      .returning({ id: users.id });

    await logModeration(db, {
      targetType: "experience",
      targetId: user!.id,
      action: "ai_flag",
      detail: { reasons: ["spam"] },
      actorType: "ai",
    });

    const rows = await db.select().from(moderationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("ai_flag");
    expect(rows[0].actorType).toBe("ai");
    expect(rows[0].actorId).toBeNull();
    expect(rows[0].detail?.reasons).toEqual(["spam"]);
  });

  it("moderatör kaydını actorId ile yazar", async () => {
    const [mod] = await db
      .insert(users)
      .values({ email: "mod-log@example.com", username: "modlog" })
      .returning({ id: users.id });

    await logModeration(db, {
      targetType: "experience",
      targetId: mod!.id,
      action: "mod_restore",
      actorType: "user",
      actorId: mod!.id,
    });

    const rows = await db.select().from(moderationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(mod!.id);
    expect(rows[0].detail).toBeNull();
  });
});
