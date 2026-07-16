import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { topicI18n, topics, users } from "@/db/schema";
import { proposeTopic, setTopicStatus, slugify } from "./propose";

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

async function makeUser(email: string, username: string) {
  const [user] = await db
    .insert(users)
    .values({ email, username })
    .returning();
  return user!;
}

describe("slugify", () => {
  it("Türkçe karakterleri dönüştürür ve küçük harfe çevirir", () => {
    expect(slugify("Çölyak Hastalığı")).toBe("colyak-hastaligi");
    expect(slugify("Şeker Hastalığı (Tip 1)")).toBe("seker-hastaligi-tip-1");
    expect(slugify("Öğürme Ürtiker")).toBe("ogurme-urtiker");
  });

  it("baştaki/sondaki tireleri kırpar", () => {
    expect(slugify("--test--")).toBe("test");
  });
});

describe("proposeTopic", () => {
  it("status pending ile topic + topic_i18n satırı ekler", async () => {
    const user = await makeUser("oneren@example.com", "oneren123");

    const result = await proposeTopic(
      db,
      { name: "Migren", type: "condition", summary: "Baş ağrısı türü" },
      user.id,
      "pending",
    );

    expect(result.status).toBe("pending");
    expect(result.slug).toBe("migren");

    const [topicRow] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, result.id));
    expect(topicRow?.status).toBe("pending");
    expect(topicRow?.type).toBe("condition");
    expect(topicRow?.createdBy).toBe(user.id);

    const [i18nRow] = await db
      .select()
      .from(topicI18n)
      .where(eq(topicI18n.topicId, result.id));
    expect(i18nRow?.name).toBe("Migren");
    expect(i18nRow?.summary).toBe("Baş ağrısı türü");
    expect(i18nRow?.locale).toBe("tr");
  });

  it("slug çakışmasında -2 eki eklenir", async () => {
    const user = await makeUser("oneren2@example.com", "oneren223");

    const first = await proposeTopic(
      db,
      { name: "Migren", type: "condition", summary: null },
      user.id,
      "pending",
    );
    const second = await proposeTopic(
      db,
      { name: "Migren", type: "condition", summary: null },
      user.id,
      "pending",
    );
    const third = await proposeTopic(
      db,
      { name: "Migren", type: "condition", summary: null },
      user.id,
      "pending",
    );

    expect(first.slug).toBe("migren");
    expect(second.slug).toBe("migren-2");
    expect(third.slug).toBe("migren-3");
  });
});

describe("setTopicStatus (onay/red akışı)", () => {
  it("onaylanınca status active olur", async () => {
    const user = await makeUser("onaylayan@example.com", "onaylayan1");
    const proposal = await proposeTopic(
      db,
      { name: "Astım", type: "condition", summary: null },
      user.id,
      "pending",
    );

    await setTopicStatus(db, proposal.id, "active");

    const [topicRow] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, proposal.id));
    expect(topicRow?.status).toBe("active");
  });

  it("reddedilince status rejected olur", async () => {
    const user = await makeUser("reddeden@example.com", "reddeden1");
    const proposal = await proposeTopic(
      db,
      { name: "Bronşit", type: "condition", summary: null },
      user.id,
      "pending",
    );

    await setTopicStatus(db, proposal.id, "rejected");

    const [topicRow] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, proposal.id));
    expect(topicRow?.status).toBe("rejected");
  });
});
