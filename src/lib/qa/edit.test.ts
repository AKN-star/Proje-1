import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { answers, questions, topics, users } from "@/db/schema";
import { createTestDb } from "@/lib/test-db";
import {
  getOwnAnswer,
  getOwnQuestion,
  updateOwnAnswer,
  updateOwnQuestion,
} from "./edit";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeEach(async () => {
  ({ client, db } = await createTestDb());
});

afterEach(async () => {
  await client.close();
});

async function setup() {
  const [owner] = await db
    .insert(users)
    .values({ email: "sahip@example.com", username: "sahip", kvkkConsentAt: new Date() })
    .returning({ id: users.id });
  const [other] = await db
    .insert(users)
    .values({ email: "digeri@example.com", username: "digeri", kvkkConsentAt: new Date() })
    .returning({ id: users.id });
  const [topic] = await db
    .insert(topics)
    .values({ slug: "parol", type: "drug", canonicalName: "Parol" })
    .returning({ id: topics.id });
  const [question] = await db
    .insert(questions)
    .values({ topicId: topic.id, userId: owner.id, title: "İlk soru başlığı", body: "gövde" })
    .returning({ id: questions.id });
  const [answer] = await db
    .insert(answers)
    .values({ questionId: question.id, userId: owner.id, body: "ilk yanıt" })
    .returning({ id: answers.id });
  return {
    ownerId: owner.id,
    otherId: other.id,
    questionId: question.id,
    answerId: answer.id,
  };
}

describe("getOwnQuestion / updateOwnQuestion", () => {
  it("sahibine döner, başkasına null; günceller", async () => {
    const { ownerId, otherId, questionId } = await setup();
    expect(await getOwnQuestion(db, otherId, questionId)).toBeNull();
    const own = await getOwnQuestion(db, ownerId, questionId);
    expect(own?.title).toBe("İlk soru başlığı");

    const ok = await updateOwnQuestion(
      db,
      ownerId,
      questionId,
      { title: "Düzenlenmiş başlık", body: null },
      "pending",
    );
    expect(ok).toBe(true);

    const [row] = await db
      .select({ title: questions.title, body: questions.body, status: questions.status })
      .from(questions)
      .where(eq(questions.id, questionId));
    expect(row).toEqual({ title: "Düzenlenmiş başlık", body: null, status: "pending" });
  });

  it("başkasının sorusunu güncellemez", async () => {
    const { otherId, questionId } = await setup();
    const ok = await updateOwnQuestion(
      db,
      otherId,
      questionId,
      { title: "kaçırma", body: null },
      "published",
    );
    expect(ok).toBe(false);
  });

  it("removed soru düzenlenemez", async () => {
    const { ownerId, questionId } = await setup();
    await db.update(questions).set({ status: "removed" }).where(eq(questions.id, questionId));
    expect(await getOwnQuestion(db, ownerId, questionId)).toBeNull();
    expect(
      await updateOwnQuestion(db, ownerId, questionId, { title: "x yeterince uzun", body: null }, "published"),
    ).toBe(false);
  });
});

describe("getOwnAnswer / updateOwnAnswer", () => {
  it("sahibine döner ve günceller; başkasına null", async () => {
    const { ownerId, otherId, answerId, questionId } = await setup();
    expect(await getOwnAnswer(db, otherId, answerId)).toBeNull();
    const own = await getOwnAnswer(db, ownerId, answerId);
    expect(own).toMatchObject({ body: "ilk yanıt", questionId });

    const ok = await updateOwnAnswer(db, ownerId, answerId, { body: "düzenlendi" }, "flagged");
    expect(ok).toBe(true);
    const [row] = await db
      .select({ body: answers.body, status: answers.status })
      .from(answers)
      .where(eq(answers.id, answerId));
    expect(row).toEqual({ body: "düzenlendi", status: "flagged" });
  });

  it("başkasının yanıtını güncellemez", async () => {
    const { otherId, answerId } = await setup();
    expect(await updateOwnAnswer(db, otherId, answerId, { body: "kaçırma" }, "published")).toBe(
      false,
    );
  });
});
