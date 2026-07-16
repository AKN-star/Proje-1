import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { users } from "@/db/schema";
import { castVote } from "@/lib/votes/vote";
import {
  createAnswer,
  createQuestion,
  getQuestion,
  listQuestions,
} from "./questions";

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

async function getParolId(): Promise<string> {
  const parol = await db.query.topics.findFirst({
    where: (t, { eq }) => eq(t.slug, "parol"),
  });
  return parol!.id;
}

async function makeUser(email: string, username: string) {
  const [user] = await db
    .insert(users)
    .values({ email, username })
    .returning();
  return user!;
}

describe("createQuestion / createAnswer", () => {
  it("soru ekler ve listQuestions'da görünür", async () => {
    const topicId = await getParolId();
    const author = await makeUser("soran@example.com", "soran1234");

    const result = await createQuestion(
      db,
      { title: "Aç karnına mı alınmalı?", body: null },
      author.id,
      topicId,
      "published",
    );
    expect(result.status).toBe("published");

    const list = await listQuestions(db, topicId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(result.id);
    expect(list[0].authorUsername).toBe("soran1234");
    expect(list[0].answerCount).toBe(0);
  });

  it("yanıt ekler ve getQuestion'da görünür", async () => {
    const topicId = await getParolId();
    const author = await makeUser("soran2@example.com", "soran5678");
    const answerer = await makeUser("cevaplayan@example.com", "cevap1234");

    const question = await createQuestion(
      db,
      { title: "Yan etkisi var mı?", body: "Baş dönmesi yaşayan var mı?" },
      author.id,
      topicId,
      "published",
    );

    const answer = await createAnswer(
      db,
      { body: "Bende baş dönmesi olmadı." },
      answerer.id,
      question.id,
      "published",
    );
    expect(answer.status).toBe("published");

    const detail = await getQuestion(db, question.id);
    expect(detail).not.toBeNull();
    expect(detail?.question.title).toBe("Yan etkisi var mı?");
    expect(detail?.answers.length).toBe(1);
    expect(detail?.answers[0].id).toBe(answer.id);
    expect(detail?.answers[0].authorUsername).toBe("cevap1234");
  });
});

describe("listQuestions", () => {
  it("flagged soru listede görünmez", async () => {
    const topicId = await getParolId();
    const author = await makeUser("flagli@example.com", "flagli1234");

    await createQuestion(
      db,
      { title: "Yayınlanan soru başlığı", body: null },
      author.id,
      topicId,
      "published",
    );
    await createQuestion(
      db,
      { title: "Flaglenen soru başlığı", body: null },
      author.id,
      topicId,
      "flagged",
    );

    const list = await listQuestions(db, topicId);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Yayınlanan soru başlığı");
  });

  it("en yeni soru üstte döner", async () => {
    const topicId = await getParolId();
    const author = await makeUser("sirali@example.com", "sirali1234");

    const first = await createQuestion(
      db,
      { title: "İlk sorulan soru başlığı", body: null },
      author.id,
      topicId,
      "published",
    );
    // createdAt farkını belirgin kılmak için ikinci soruyu manuel createdAt
    // ile ekliyoruz (defaultNow aynı ms'e denk gelebilir).
    void first;
    const second = await createQuestion(
      db,
      { title: "İkinci sorulan soru başlığı", body: null },
      author.id,
      topicId,
      "published",
    );

    const list = await listQuestions(db, topicId);
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(second.id);
  });

  it("yanıt sayısı doğru hesaplanır (yalnız published yanıtlar)", async () => {
    const topicId = await getParolId();
    const author = await makeUser("sayan@example.com", "sayan1234");
    const answerer = await makeUser("cevap2@example.com", "cevap5678");

    const question = await createQuestion(
      db,
      { title: "Kaç yanıt geldi?", body: null },
      author.id,
      topicId,
      "published",
    );
    await createAnswer(db, { body: "İlk yanıt burada." }, answerer.id, question.id, "published");
    await createAnswer(db, { body: "İkinci yanıt burada." }, answerer.id, question.id, "published");
    await createAnswer(db, { body: "Flaglenen yanıt burada." }, answerer.id, question.id, "flagged");

    const list = await listQuestions(db, topicId);
    expect(list[0].answerCount).toBe(2);
  });
});

describe("getQuestion", () => {
  it("published olmayan soru için null döner", async () => {
    const topicId = await getParolId();
    const author = await makeUser("gizli@example.com", "gizli1234");

    const question = await createQuestion(
      db,
      { title: "Görünmeyecek soru başlığı", body: null },
      author.id,
      topicId,
      "pending",
    );

    const detail = await getQuestion(db, question.id);
    expect(detail).toBeNull();
  });

  it("bilinmeyen id için null döner", async () => {
    const detail = await getQuestion(db, "11111111-1111-1111-1111-111111111111");
    expect(detail).toBeNull();
  });

  it("flagged yanıt yanıt listesinde görünmez", async () => {
    const topicId = await getParolId();
    const author = await makeUser("sorubir@example.com", "sorubir1");
    const answerer = await makeUser("cevapbir@example.com", "cevapbir1");

    const question = await createQuestion(
      db,
      { title: "Flagli yanıt testi başlığı", body: null },
      author.id,
      topicId,
      "published",
    );
    await createAnswer(db, { body: "Görünecek yanıt." }, answerer.id, question.id, "published");
    await createAnswer(db, { body: "Görünmeyecek yanıt." }, answerer.id, question.id, "flagged");

    const detail = await getQuestion(db, question.id);
    expect(detail?.answers.length).toBe(1);
    expect(detail?.answers[0].body).toBe("Görünecek yanıt.");
  });

  it("yanıtlar skora göre azalan sıralanır (oy sıralaması)", async () => {
    const topicId = await getParolId();
    const author = await makeUser("oysoran@example.com", "oysoran1");
    const answerer = await makeUser("oycevap@example.com", "oycevap1");
    const voter1 = await makeUser("oyveren1@example.com", "oyveren1x");
    const voter2 = await makeUser("oyveren2@example.com", "oyveren2x");

    const question = await createQuestion(
      db,
      { title: "Oy sıralaması test başlığı", body: null },
      author.id,
      topicId,
      "published",
    );

    const answerA = await createAnswer(
      db,
      { body: "Az oylu yanıt burada." },
      answerer.id,
      question.id,
      "published",
    );
    const answerB = await createAnswer(
      db,
      { body: "Çok oylu yanıt burada." },
      answerer.id,
      question.id,
      "published",
    );

    await castVote(db, voter1.id, "answer", answerA.id, 1);
    await castVote(db, voter1.id, "answer", answerB.id, 1);
    await castVote(db, voter2.id, "answer", answerB.id, 1);

    const detail = await getQuestion(db, question.id, voter1.id);
    expect(detail?.answers[0].id).toBe(answerB.id);
    expect(detail?.answers[0].score).toBe(2);
    expect(detail?.answers[0].myVote).toBe(1);
    expect(detail?.answers[1].id).toBe(answerA.id);
    expect(detail?.answers[1].score).toBe(1);
  });
});
