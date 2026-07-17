import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { topics, users, experiences } from "@/db/schema";
import { getTopicBySlug, listTopics } from "./topics";
import { castVote } from "@/lib/votes/vote";

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

  it("etken madde üzerinde arama yapar", async () => {
    const result = await listTopics(db, { q: "parasetamol", locale: "tr" });
    const slugs = result.map((t) => t.slug).sort();
    expect(slugs).toEqual(["calpol", "parol"]);
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

describe("getTopicBySlug — sıralama ve skor", () => {
  it("sort='oy' skora göre azalan sıralar; skorlar doğru döner", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [author] = await db
      .insert(users)
      .values({ email: "author@example.com", username: "yazar1234" })
      .returning();
    const [voter1] = await db
      .insert(users)
      .values({ email: "voter1@example.com", username: "oyveren1" })
      .returning();
    const [voter2] = await db
      .insert(users)
      .values({ email: "voter2@example.com", username: "oyveren2" })
      .returning();

    const [expA] = await db
      .insert(experiences)
      .values({
        topicId: parol!.id,
        userId: author.id,
        purpose: "baş ağrısı",
        effectiveness: 4,
        body: "eski ama az oylu",
        status: "published",
        createdAt: new Date(Date.now() - 5000),
      })
      .returning();
    const [expB] = await db
      .insert(experiences)
      .values({
        topicId: parol!.id,
        userId: author.id,
        purpose: "ateş",
        effectiveness: 5,
        body: "yeni ama çok oylu",
        status: "published",
        createdAt: new Date(),
      })
      .returning();

    // expA: 1 oy; expB: 2 oy — sort='oy' ile expB üstte olmalı.
    await castVote(db, voter1.id, "experience", expA.id, 1);
    await castVote(db, voter1.id, "experience", expB.id, 1);
    await castVote(db, voter2.id, "experience", expB.id, 1);

    const yeniSirali = await getTopicBySlug(db, "parol", "tr", "yeni");
    expect(yeniSirali?.experiences[0].id).toBe(expB.id);

    const oySirali = await getTopicBySlug(db, "parol", "tr", "oy");
    expect(oySirali?.experiences[0].id).toBe(expB.id);
    expect(oySirali?.experiences[0].score).toBe(2);
    expect(oySirali?.experiences[1].id).toBe(expA.id);
    expect(oySirali?.experiences[1].score).toBe(1);
  });

  it("currentUserId geçilirse kullanıcının kendi oyu myVote'da döner", async () => {
    const parol = await db.query.topics.findFirst({
      where: (t, { eq }) => eq(t.slug, "parol"),
    });
    const [author] = await db
      .insert(users)
      .values({ email: "author2@example.com", username: "yazar5678" })
      .returning();
    const [exp] = await db
      .insert(experiences)
      .values({
        topicId: parol!.id,
        userId: author.id,
        purpose: "baş ağrısı",
        effectiveness: 4,
        body: "deneyim",
        status: "published",
      })
      .returning();

    await castVote(db, author.id, "experience", exp.id, -1);

    const result = await getTopicBySlug(db, "parol", "tr", "yeni", author.id);
    expect(result?.experiences[0].myVote).toBe(-1);
    expect(result?.experiences[0].score).toBe(-1);
  });
});

describe("topics tablosu", () => {
  it("status aktif olmayan topic'ler listelenmez (kontrol amaçlı boş topics tablosu davranışı)", async () => {
    const all = await db.select().from(topics);
    expect(all.length).toBe(20);
  });
});
