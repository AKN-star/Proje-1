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
import { after } from "next/server";
import { answers, questions, topics } from "@/db/schema";
import { notifyQuestionOwner } from "@/lib/qa/notify";
import {
  validateQuestionInput,
  validateAnswerInput,
} from "@/lib/validation/qa";
import { moderate } from "@/lib/ai/moderate";
import { createAnswer, createQuestion } from "@/lib/qa/questions";
import {
  getOwnAnswer,
  getOwnQuestion,
  updateOwnAnswer,
  updateOwnQuestion,
} from "@/lib/qa/edit";
import { statusForVerdict } from "@/lib/experiences/create";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile } from "@/lib/users/onboarding";
import { requireOnboardedUser } from "@/lib/users/guards";
import { logModeration } from "@/lib/moderation/log";
import { castVote } from "@/lib/votes/vote";
import { UUID_RE } from "@/lib/validate";

const QUESTION_FIELD_ORDER = ["title", "body"] as const;

export async function submitQuestion(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const returnPath = `/baslik/${slug}/soru-sor`;

  const { db, userId } = await requireOnboardedUser(
    slug ? returnPath : "/",
    `${returnPath}?hata=_root`,
  );

  if (!slug) {
    redirect(`${returnPath}?hata=_root`);
  }

  if (!(await checkRateLimit(db, userId, "question"))) {
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
  const result = await createQuestion(db, validation.data, userId, topic.id, status);

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

  const { db, userId } = await requireOnboardedUser(
    UUID_RE.test(questionId) ? returnPath : "/",
    `${returnPath}?hata=_root`,
  );

  if (!UUID_RE.test(questionId)) {
    redirect("/");
  }

  if (!(await checkRateLimit(db, userId, "answer"))) {
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
  const result = await createAnswer(db, validation.data, userId, question.id, status);

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "answer",
      targetId: result.id,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons },
      actorType: "ai",
    });
  }

  // Yanıt anında yayınlandıysa soru sahibine bildir. `after`: Resend
  // round-trip'i kullanıcının redirect'ini bekletmez (yanıt zaten
  // yazıldı); kuyruktan sonradan onaylanan yanıt bildirim üretmez
  // (spec bilinen sınırı). Guard'lar ve kompozisyon lib'de tek yerde.
  if (result.status === "published") {
    after(() => notifyQuestionOwner(db, question.id, userId));
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

/**
 * Kendi sorusunu düzenler (Faz 10 T3). updateExperience ile aynı sıra:
 * guard → doğrulama → YENİDEN moderasyon (kural #3) → güncelle →
 * user_edit izi → redirect. Block'ta içerik ESKİ haliyle kalır.
 */
export async function updateQuestion(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "");
  const returnPath = `/soru-duzenle/${questionId}`;

  const { db, userId } = await requireOnboardedUser(
    UUID_RE.test(questionId) ? returnPath : "/profil",
    `${returnPath}?hata=_root`,
  );
  if (!UUID_RE.test(questionId)) {
    redirect("/profil");
  }

  if (!(await checkRateLimit(db, userId, "contentEdit"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  const existing = await getOwnQuestion(db, userId, questionId);
  if (!existing) {
    redirect("/profil");
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
    await logModeration(db, {
      targetType: "question",
      targetId: questionId,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "edit-blocked" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const updated = await updateOwnQuestion(db, userId, questionId, validation.data, status);
  if (!updated) {
    redirect("/profil");
  }

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "question",
      targetId: questionId,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons, note: "edit" },
      actorType: "ai",
    });
  }

  await logModeration(db, {
    targetType: "question",
    targetId: questionId,
    action: "user_edit",
    actorType: "user",
    actorId: userId,
  });

  revalidatePath(`/soru/${questionId}`);
  revalidatePath("/profil");
  redirect(`/soru/${questionId}`);
}

/** Kendi yanıtını düzenler (Faz 10 T3). updateQuestion ile aynı akış. */
export async function updateAnswer(formData: FormData): Promise<void> {
  const answerId = String(formData.get("answerId") ?? "");
  const returnPath = `/yanit-duzenle/${answerId}`;

  const { db, userId } = await requireOnboardedUser(
    UUID_RE.test(answerId) ? returnPath : "/profil",
    `${returnPath}?hata=_root`,
  );
  if (!UUID_RE.test(answerId)) {
    redirect("/profil");
  }

  if (!(await checkRateLimit(db, userId, "contentEdit"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  const existing = await getOwnAnswer(db, userId, answerId);
  if (!existing) {
    redirect("/profil");
  }

  const validation = validateAnswerInput({ body: String(formData.get("body") ?? "") });
  if (!validation.ok) {
    redirect(`${returnPath}?hata=body`);
  }

  const moderation = await moderate(validation.data.body, "answer");
  if (moderation.verdict === "block") {
    await logModeration(db, {
      targetType: "answer",
      targetId: answerId,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "edit-blocked" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const updated = await updateOwnAnswer(db, userId, answerId, validation.data, status);
  if (!updated) {
    redirect("/profil");
  }

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "answer",
      targetId: answerId,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons, note: "edit" },
      actorType: "ai",
    });
  }

  await logModeration(db, {
    targetType: "answer",
    targetId: answerId,
    action: "user_edit",
    actorType: "user",
    actorId: userId,
  });

  revalidatePath(`/soru/${existing.questionId}`);
  revalidatePath("/profil");
  redirect(`/soru/${existing.questionId}`);
}
