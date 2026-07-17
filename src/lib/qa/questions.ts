/**
 * Soru/yanıt çekirdeği (T2, spec adım 2). Saf insert'ler + published
 * sorgular. Moderasyon/doğrulama BURADA yapılmaz — çağıran taraf
 * (server action) sorumludur; bkz. src/lib/experiences/create.ts kalıbı.
 */
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { answers, questions, topics, users } from "@/db/schema";
import type { QuestionInput, AnswerInput } from "@/lib/validation/qa";
import { getScores } from "@/lib/votes/vote";

export type QaStatus = "published" | "pending" | "flagged" | "removed";

export interface CreateResult {
  id: string;
  status: QaStatus;
}

/** Doğrulanmış soru girdisini `questions` tablosuna ekler. */
export async function createQuestion(
  db: Db,
  input: QuestionInput,
  userId: string,
  topicId: string,
  status: QaStatus,
): Promise<CreateResult> {
  const [row] = await db
    .insert(questions)
    .values({
      topicId,
      userId,
      title: input.title,
      body: input.body,
      status,
    })
    .returning({ id: questions.id });

  if (!row) {
    throw new Error("Soru eklenemedi.");
  }

  return { id: row.id, status };
}

/** Doğrulanmış yanıt girdisini `answers` tablosuna ekler. */
export async function createAnswer(
  db: Db,
  input: AnswerInput,
  userId: string,
  questionId: string,
  status: QaStatus,
): Promise<CreateResult> {
  const [row] = await db
    .insert(answers)
    .values({
      questionId,
      userId,
      body: input.body,
      status,
    })
    .returning({ id: answers.id });

  if (!row) {
    throw new Error("Yanıt eklenemedi.");
  }

  return { id: row.id, status };
}

export interface QuestionListItem {
  id: string;
  title: string;
  authorUsername: string;
  createdAt: Date;
  answerCount: number;
}

/**
 * Bir topic altındaki yayınlanmış soruları, yazar adı ve yayınlanmış
 * yanıt sayısıyla birlikte döner (en yeni üstte).
 */
export async function listQuestions(
  db: Db,
  topicId: string,
): Promise<QuestionListItem[]> {
  const questionRows = await db
    .select({
      id: questions.id,
      title: questions.title,
      authorUsername: users.username,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .where(and(eq(questions.topicId, topicId), eq(questions.status, "published")))
    .orderBy(desc(questions.createdAt));

  const questionIds = questionRows.map((row) => row.id);
  const answerCounts = new Map<string, number>();

  if (questionIds.length > 0) {
    const answerRows = await db
      .select({ questionId: answers.questionId, total: count() })
      .from(answers)
      .where(
        and(
          eq(answers.status, "published"),
          inArray(answers.questionId, questionIds),
        ),
      )
      .groupBy(answers.questionId);

    for (const row of answerRows) {
      answerCounts.set(row.questionId, row.total);
    }
  }

  return questionRows.map((row) => ({
    ...row,
    authorUsername: row.authorUsername ?? "anonim",
    answerCount: answerCounts.get(row.id) ?? 0,
  }));
}

export interface QuestionDetail {
  id: string;
  title: string;
  body: string | null;
  lang: string;
  authorUsername: string;
  createdAt: Date;
  topicId: string;
  topicSlug: string;
  topicName: string | null;
}

export interface AnswerListItem {
  id: string;
  body: string;
  lang: string;
  authorUsername: string;
  createdAt: Date;
  score: number;
  myVote: 1 | -1 | null;
}

export interface QuestionWithAnswers {
  question: QuestionDetail;
  answers: AnswerListItem[];
}

/**
 * Yayınlanmış bir soruyu, topic bilgisiyle ve yayınlanmış yanıtlarıyla
 * (skor sıralı: skor desc, eşitlikte yeni üstte) döner. Soru yoksa veya
 * published değilse `null` döner.
 */
export async function getQuestion(
  db: Db,
  questionId: string,
  currentUserId?: string,
): Promise<QuestionWithAnswers | null> {
  const [questionRow] = await db
    .select({
      id: questions.id,
      title: questions.title,
      body: questions.body,
      lang: questions.lang,
      authorUsername: users.username,
      createdAt: questions.createdAt,
      topicId: questions.topicId,
      topicSlug: topics.slug,
      topicName: topics.canonicalName,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.status, "published"),
        // Topic sonradan pasifleştirilirse soruları da kamuya kapansın.
        eq(topics.status, "active"),
      ),
    )
    .limit(1);

  if (!questionRow) return null;

  const answerRows = await db
    .select({
      id: answers.id,
      body: answers.body,
      lang: answers.lang,
      authorUsername: users.username,
      createdAt: answers.createdAt,
    })
    .from(answers)
    .innerJoin(users, eq(users.id, answers.userId))
    .where(and(eq(answers.questionId, questionId), eq(answers.status, "published")))
    .orderBy(desc(answers.createdAt));

  const answerIds = answerRows.map((row) => row.id);
  const scores = await getScores(db, "answer", answerIds, currentUserId);

  const items: AnswerListItem[] = answerRows.map((row) => {
    const scoreEntry = scores.get(row.id);
    return {
      ...row,
      authorUsername: row.authorUsername ?? "anonim",
      score: scoreEntry?.score ?? 0,
      myVote: scoreEntry?.myVote ?? null,
    };
  });

  // Skor desc; eşitlikte createdAt zaten azalan (yeni üstte) geldiği için
  // stable sort sırayı korur.
  items.sort((a, b) => b.score - a.score);

  return {
    question: {
      ...questionRow,
      authorUsername: questionRow.authorUsername ?? "anonim",
    },
    answers: items,
  };
}
