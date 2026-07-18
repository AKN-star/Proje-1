/**
 * Profil sayfası çekirdeği (Faz 8 T1): kullanıcının kendi içeriği,
 * kendi içeriğini kaldırması (soft delete: status='removed') ve hesap
 * anonimleştirme. Kararlar: docs/specs/faz-8-kullanici-iyilestirmeleri.md.
 */
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { accounts, sessions } from "@/db/auth-schema";
import { answers, experiences, questions, topics, users } from "@/db/schema";
import { logModeration } from "@/lib/moderation/log";
import { recalcTopicStats } from "@/lib/stats/topic-stats";

export interface MyContentItem {
  id: string;
  kind: "experience" | "question" | "answer";
  /** Deneyim: amaç; soru: başlık; yanıt: gövde kısaltması. */
  title: string;
  status: string;
  createdAt: Date;
  /** Deneyim/soru: topic slug'ı; yanıt: soru id'si (link için). */
  href: string;
}

const PREVIEW_LEN = 80;

/** Kullanıcının tüm içeriği (removed dahil — durum rozetiyle gösterilir),
 * en yeni üstte. */
export async function listMyContent(db: Db, userId: string): Promise<MyContentItem[]> {
  const [experienceRows, questionRows, answerRows] = await Promise.all([
    db
      .select({
        id: experiences.id,
        purpose: experiences.purpose,
        status: experiences.status,
        createdAt: experiences.createdAt,
        topicSlug: topics.slug,
      })
      .from(experiences)
      .innerJoin(topics, eq(topics.id, experiences.topicId))
      .where(eq(experiences.userId, userId))
      .orderBy(desc(experiences.createdAt)),
    db
      .select({
        id: questions.id,
        title: questions.title,
        status: questions.status,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .where(eq(questions.userId, userId))
      .orderBy(desc(questions.createdAt)),
    db
      .select({
        id: answers.id,
        body: answers.body,
        status: answers.status,
        createdAt: answers.createdAt,
        questionId: answers.questionId,
      })
      .from(answers)
      .where(eq(answers.userId, userId))
      .orderBy(desc(answers.createdAt)),
  ]);

  const items: MyContentItem[] = [
    ...experienceRows.map((row) => ({
      id: row.id,
      kind: "experience" as const,
      title: row.purpose,
      status: row.status,
      createdAt: row.createdAt,
      href: `/baslik/${row.topicSlug}`,
    })),
    ...questionRows.map((row) => ({
      id: row.id,
      kind: "question" as const,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt,
      href: `/soru/${row.id}`,
    })),
    ...answerRows.map((row) => ({
      id: row.id,
      kind: "answer" as const,
      title:
        row.body.length > PREVIEW_LEN
          ? `${row.body.slice(0, PREVIEW_LEN)}…`
          : row.body,
      status: row.status,
      createdAt: row.createdAt,
      href: `/soru/${row.questionId}`,
    })),
  ];

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Kullanıcının KENDİ içeriğini kaldırır (status='removed' + mod_remove
 * logu, actor kullanıcı). Yalnız sahibi olduğu ve removed olmayan kayda
 * etki eder; deneyimde topic_stats yeniden hesaplanır. Başarıda
 * revalidate edilecek path'i döner, aksi halde null.
 */
export async function removeOwnContent(
  db: Db,
  userId: string,
  kind: "experience" | "question" | "answer",
  targetId: string,
): Promise<string | null> {
  if (kind === "experience") {
    const [row] = await db
      .select({ id: experiences.id, status: experiences.status, topicId: experiences.topicId, slug: topics.slug })
      .from(experiences)
      .innerJoin(topics, eq(topics.id, experiences.topicId))
      .where(and(eq(experiences.id, targetId), eq(experiences.userId, userId)))
      .limit(1);
    if (!row || row.status === "removed") return null;
    await db.update(experiences).set({ status: "removed" }).where(eq(experiences.id, targetId));
    await recalcTopicStats(db, row.topicId);
    await logModeration(db, {
      targetType: "experience",
      targetId,
      action: "mod_remove",
      detail: { note: "self-remove" },
      actorType: "user",
      actorId: userId,
    });
    return `/baslik/${row.slug}`;
  }

  if (kind === "question") {
    const [row] = await db
      .select({ id: questions.id, status: questions.status })
      .from(questions)
      .where(and(eq(questions.id, targetId), eq(questions.userId, userId)))
      .limit(1);
    if (!row || row.status === "removed") return null;
    await db.update(questions).set({ status: "removed" }).where(eq(questions.id, targetId));
    await logModeration(db, {
      targetType: "question",
      targetId,
      action: "mod_remove",
      detail: { note: "self-remove" },
      actorType: "user",
      actorId: userId,
    });
    return `/soru/${targetId}`;
  }

  const [row] = await db
    .select({ id: answers.id, status: answers.status, questionId: answers.questionId })
    .from(answers)
    .where(and(eq(answers.id, targetId), eq(answers.userId, userId)))
    .limit(1);
  if (!row || row.status === "removed") return null;
  await db.update(answers).set({ status: "removed" }).where(eq(answers.id, targetId));
  await logModeration(db, {
    targetType: "answer",
    targetId,
    action: "mod_remove",
    detail: { note: "self-remove" },
    actorType: "user",
    actorId: userId,
  });
  return `/soru/${row.questionId}`;
}

/**
 * Hesap anonimleştirme (Faz 8 kickoff kararı): satır FK'ler nedeniyle
 * silinmez; kimlik alanları temizlenir (email tombstone, username/name/
 * image/proBadge NULL), oturum ve OAuth account satırları silinir.
 * İçerik "anonim" imzasıyla kalır — KVKK metniyle tutarlı. Geri dönüşü
 * yok.
 */
export async function anonymizeAccount(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      email: `silinmis-${userId}@hesap.yerel`,
      emailVerified: null,
      username: null,
      name: null,
      image: null,
      proBadge: null,
      emailOptout: true,
    })
    .where(eq(users.id, userId));

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
}
