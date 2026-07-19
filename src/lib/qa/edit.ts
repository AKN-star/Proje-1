/**
 * Soru/yanıt düzenleme çekirdeği (Faz 10 T3) — deneyim düzenlemeyle
 * (lib/experiences/create.ts) simetrik. Yalnız sahibi, removed olmayan
 * kaydı düzenler; doğrulama ve YENİDEN moderasyon ÇAĞIRANDA (kural #3).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { answers, questions } from "@/db/schema";
import type { QaStatus } from "@/lib/qa/questions";

export interface OwnQuestionForEdit {
  id: string;
  title: string;
  body: string | null;
}

/** Kullanıcının kendi (removed olmayan) sorusunu döner; değilse null. */
export async function getOwnQuestion(
  db: Db,
  userId: string,
  questionId: string,
): Promise<OwnQuestionForEdit | null> {
  const [row] = await db
    .select({
      id: questions.id,
      title: questions.title,
      body: questions.body,
      status: questions.status,
    })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.userId, userId)))
    .limit(1);
  if (!row || row.status === "removed") return null;
  return { id: row.id, title: row.title, body: row.body };
}

/** Kendi sorusunu günceller; sahibi değilse/removed ise false. */
export async function updateOwnQuestion(
  db: Db,
  userId: string,
  questionId: string,
  input: { title: string; body: string | null },
  status: QaStatus,
): Promise<boolean> {
  const [existing] = await db
    .select({ status: questions.status })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.userId, userId)))
    .limit(1);
  if (!existing || existing.status === "removed") return false;

  await db
    .update(questions)
    .set({ title: input.title, body: input.body, status })
    .where(eq(questions.id, questionId));
  return true;
}

export interface OwnAnswerForEdit {
  id: string;
  body: string;
  questionId: string;
}

/** Kullanıcının kendi (removed olmayan) yanıtını döner; değilse null. */
export async function getOwnAnswer(
  db: Db,
  userId: string,
  answerId: string,
): Promise<OwnAnswerForEdit | null> {
  const [row] = await db
    .select({
      id: answers.id,
      body: answers.body,
      questionId: answers.questionId,
      status: answers.status,
    })
    .from(answers)
    .where(and(eq(answers.id, answerId), eq(answers.userId, userId)))
    .limit(1);
  if (!row || row.status === "removed") return null;
  return { id: row.id, body: row.body, questionId: row.questionId };
}

/** Kendi yanıtını günceller; sahibi değilse/removed ise false. */
export async function updateOwnAnswer(
  db: Db,
  userId: string,
  answerId: string,
  input: { body: string },
  status: QaStatus,
): Promise<boolean> {
  const [existing] = await db
    .select({ status: answers.status })
    .from(answers)
    .where(and(eq(answers.id, answerId), eq(answers.userId, userId)))
    .limit(1);
  if (!existing || existing.status === "removed") return false;

  await db
    .update(answers)
    .set({ body: input.body, status })
    .where(eq(answers.id, answerId));
  return true;
}
