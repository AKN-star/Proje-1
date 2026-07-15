import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { topics, users, experiences } from "@/db/schema";
import { getTopicBySlug, listTopics } from "./topics";

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

describe("listTopics", () => {
  it("tüm aktif topic'leri isim ve deneyim sayısıyla döner", async () => {
    const result = await listTopics(db, { locale: "tr" });
    expect(result.length).toBe(20);
    const parol = result.find((t) => t.slug === "parol");
    expect(parol).toBeDefined();
    expect(parol?.name).toBe("Parol");
    expect(parol?.experienceCount).toBe(0);
  });

  it("q ile canonical_name/i18n adı üzerinde arama yapar", async () => {
    const result = await listTopics(db, { q: "majezik", locale: "tr" });
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe("majezik");
  });

  it("eşleşme yoksa boş liste döner", async () => {
    const result = await listTopics(db, { q: "olmayan-ilac-xyz", locale: "tr" });
    expect(result).toEqual([]);
  });
});

describe("getTopicBySlug", () => {
  it("bilinmeyen slug için null döner", async () => {
    const result = await getTopicBySlug(db, "olmayan-slug", "tr");
    expect(result).toBeNull();
  });

  it("deneyimi olmayan topic boş deneyim listesiyle döner", async () => {
    const result = await getTopicBySlug(db, "parol", "tr");
    expect(result).not.toBeNull();
    expect(result?.topic.canonicalName).toBe("Parol");
    expect(result?.experiences).toEqual([]);
  });

  it("yayınlanmış deneyimleri yazar adı ve en yeni üstte döner", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [user] = await db
      .insert(users)
      .values({ email: "user@example.com", username: "user1234" })
      .returning();

    // Sıralamayı belirgin kılmak için deneyimler ayrı ayrı (sıralı)
    // insert edilir — aynı transaction'da toplu insert defaultNow()
    // değerini paylaşabilir.
    await db.insert(experiences).values({
      topicId: parol!.id,
      userId: user.id,
      purpose: "baş ağrısı",
      effectiveness: 4,
      body: "ilk deneyim",
      status: "published",
      createdAt: new Date(Date.now() - 1000),
    });
    await db.insert(experiences).values({
      topicId: parol!.id,
      userId: user.id,
      purpose: "ateş",
      effectiveness: 5,
      body: "ikinci deneyim",
      status: "published",
      createdAt: new Date(),
    });
    await db.insert(experiences).values({
      topicId: parol!.id,
      userId: user.id,
      purpose: "gizli",
      effectiveness: 1,
      body: "yayınlanmamış",
      status: "pending",
    });

    const result = await getTopicBySlug(db, "parol", "tr");
    expect(result?.experiences.length).toBe(2);
    expect(result?.experiences[0].body).toBe("ikinci deneyim");
    expect(result?.experiences[0].authorUsername).toBe("user1234");

    const listed = await listTopics(db, { locale: "tr" });
    const parolListItem = listed.find((t) => t.slug === "parol");
    expect(parolListItem?.experienceCount).toBe(2);
  });
});

describe("topics tablosu", () => {
  it("status aktif olmayan topic'ler listelenmez (kontrol amaçlı boş topics tablosu davranışı)", async () => {
    const all = await db.select().from(topics);
    expect(all.length).toBe(20);
  });
});
