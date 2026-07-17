"use server";

/**
 * Soru/yanıt/oylama server action'ları (T2, spec adım 2). Kalıp
 * src/app/actions/experience.ts ve src/app/actions/vote.ts ile birebir:
 * session → onboarding+ban guard → doğrulama → moderasyon → verdict
 * eşleme + log → insert → revalidate → redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { answers, questions, topics } from "@/db/schema";
import {
  validateQuestionInput,
  validateAnswerInput,
} from "@/lib/validation/qa";
import { moderate } from "@/lib/ai/moderate";
import { createAnswer, createQuestion } from "@/lib/qa/questions";
import { statusForVerdict } from "@/lib/experiences/create";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { logModeration } from "@/lib/moderation/log";
import { castVote } from "@/lib/votes/vote";

const QUESTION_FIELD_ORDER = ["title", "body"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitQuestion(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const returnPath = `/baslik/${slug}/soru-sor`;

  const session = await auth();
  if (!session?.user) {
    redirect(slug ? `/giris?next=${encodeURIComponent(returnPath)}` : "/giris");
  }

  if (!slug) {
    redirect(`${returnPath}?hata=_root`);
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(returnPath)}`);
  }

  if (profile?.bannedAt) {
    redirect(`${returnPath}?hata=_root`);
  }

  if (!(await checkRateLimit(db, session.user.id, "question"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.slug, slug), eq(topics.status, "active")))
    .limit(1);
  if (!topic) {
    redirect(`${returnPath}?hata=_root`);
  }

  const rawInput = {
    title: String(formData.get("title") ?? ""),
    body: formData.get("body") === null ? null : String(formData.get("body")),
  };

  const validation = validateQuestionInput(rawInput);
  if (!validation.ok) {
    const firstField =
      QUESTION_FIELD_ORDER.find((field) => validation.errors[field]) ?? "_root";
    redirect(`${returnPath}?hata=${firstField}`);
  }

  const content = validation.data.body
    ? `${validation.data.title}\n\n${validation.data.body}`
    : validation.data.title;
  const moderation = await moderate(content, "question");

  if (moderation.verdict === "block") {
    // Insert yapılmadığı için soru id'si yok — hedef topic'tir.
    await logModeration(db, {
      targetType: "topic",
      targetId: topic.id,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "blocked-before-insert" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const result = await createQuestion(
    db,
    validation.data,
    session.user.id,
    topic.id,
    status,
  );

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "question",
      targetId: result.id,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons },
      actorType: "ai",
    });
  }

  revalidatePath(`/baslik/${slug}`);
  redirect(`/baslik/${slug}`);
}

export async function submitAnswer(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "");
  const returnPath = `/soru/${questionId}`;

  const session = await auth();
  if (!session?.user) {
    redirect(
      UUID_RE.test(questionId)
        ? `/giris?next=${encodeURIComponent(returnPath)}`
        : "/giris",
    );
  }

  if (!UUID_RE.test(questionId)) {
    redirect("/");
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(returnPath)}`);
  }

  if (profile?.bannedAt) {
    redirect(`${returnPath}?hata=_root`);
  }

  if (!(await checkRateLimit(db, session.user.id, "answer"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.status, "published")))
    .limit(1);
  if (!question) {
    redirect(`${returnPath}?hata=_root`);
  }

  const rawInput = {
    body: String(formData.get("body") ?? ""),
  };

  const validation = validateAnswerInput(rawInput);
  if (!validation.ok) {
    redirect(`${returnPath}?hata=body`);
  }

  const moderation = await moderate(validation.data.body, "answer");

  if (moderation.verdict === "block") {
    // Insert yapılmadığı için yanıt id'si yok — hedef sorudur.
    await logModeration(db, {
      targetType: "question",
      targetId: question.id,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "answer-blocked-before-insert" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const result = await createAnswer(
    db,
    validation.data,
    session.user.id,
    question.id,
    status,
  );

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "answer",
      targetId: result.id,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons },
      actorType: "ai",
    });
  }

  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function voteAnswer(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "");
  const returnPath = UUID_RE.test(questionId) ? `/soru/${questionId}` : "/";

  const session = await auth();
  if (!session?.user) {
    redirect(
      UUID_RE.test(questionId)
        ? `/giris?next=${encodeURIComponent(returnPath)}`
        : "/giris",
    );
  }

  const answerId = String(formData.get("answerId") ?? "");
  const rawValue = String(formData.get("value") ?? "");

  if (!UUID_RE.test(questionId)) {
    redirect("/");
  }

  if ((rawValue !== "1" && rawValue !== "-1") || !UUID_RE.test(answerId)) {
    redirect(returnPath);
  }
  const value = rawValue === "1" ? 1 : -1;

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (profile?.bannedAt) {
    redirect(returnPath);
  }

  const [answer] = await db
    .select({ id: answers.id })
    .from(answers)
    .where(
      and(
        eq(answers.id, answerId),
        // questionId eşleşmesi: sahte questionId ile başka sayfaya
        // revalidate/redirect edilmesin.
        eq(answers.questionId, questionId),
        eq(answers.status, "published"),
      ),
    )
    .limit(1);
  if (!answer) {
    redirect(returnPath);
  }

  await castVote(db, session.user.id, "answer", answerId, value);

  revalidatePath(returnPath);
  redirect(returnPath);
}
