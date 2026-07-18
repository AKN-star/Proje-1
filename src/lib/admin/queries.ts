/**
 * Admin kuyruğu sorguları (T4, faz-3-moderasyon-admin.md). Salt okunur;
 * yazma eylemleri src/app/actions/admin.ts'te.
 */
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import {
  answers,
  experiences,
  moderationLog,
  questions,
  reports,
  topicI18n,
  topics,
  users,
} from "@/db/schema";

const proposers = alias(users, "proposers");

const reporters = alias(users, "reporters");

const AI_LOG_ACTIONS = ["ai_flag", "ai_timeout", "ai_block"] as const;
const REPORT_BODY_PREVIEW_LEN = 160;

export interface ModerationQueueItem {
  id: string;
  body: string;
  purpose: string;
  status: "flagged" | "pending";
  createdAt: Date;
  authorId: string;
  authorUsername: string;
  topicSlug: string;
  topicName: string;
  aiReasons: string[];
}

/**
 * status='flagged'|'pending' deneyimleri, yazar/topic bilgisiyle ve en
 * güncel AI moderasyon log'unun (ai_flag/ai_timeout/ai_block) gerekçeleriyle
 * döner. En yeni deneyim üstte.
 */
export async function listModerationQueue(db: Db): Promise<ModerationQueueItem[]> {
  const rows = await db
    .select({
      id: experiences.id,
      body: experiences.body,
      purpose: experiences.purpose,
      status: experiences.status,
      createdAt: experiences.createdAt,
      authorId: users.id,
      authorUsername: users.username,
      topicSlug: topics.slug,
      topicCanonicalName: topics.canonicalName,
      topicName: topicI18n.name,
    })
    .from(experiences)
    .innerJoin(users, eq(users.id, experiences.userId))
    .innerJoin(topics, eq(topics.id, experiences.topicId))
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, "tr")),
    )
    .where(or(eq(experiences.status, "flagged"), eq(experiences.status, "pending")))
    .orderBy(desc(experiences.createdAt));

  if (rows.length === 0) return [];

  const experienceIds = rows.map((row) => row.id);
  const logRows = await db
    .select({
      targetId: moderationLog.targetId,
      action: moderationLog.action,
      detail: moderationLog.detail,
      createdAt: moderationLog.createdAt,
    })
    .from(moderationLog)
    .where(
      and(
        eq(moderationLog.targetType, "experience"),
        inArray(moderationLog.targetId, experienceIds),
        inArray(moderationLog.action, AI_LOG_ACTIONS),
      ),
    )
    .orderBy(desc(moderationLog.createdAt));

  // logRows en yeniden en eskiye sıralı; her hedef için ilk görülen kayıt
  // en güncelidir.
  const latestReasonsByTarget = new Map<string, string[]>();
  for (const log of logRows) {
    if (!latestReasonsByTarget.has(log.targetId)) {
      latestReasonsByTarget.set(log.targetId, log.detail?.reasons ?? []);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    purpose: row.purpose,
    status: row.status as "flagged" | "pending",
    createdAt: row.createdAt,
    authorId: row.authorId,
    authorUsername: row.authorUsername ?? "anonim",
    topicSlug: row.topicSlug,
    topicName: row.topicName ?? row.topicCanonicalName,
    aiReasons: latestReasonsByTarget.get(row.id) ?? [],
  }));
}

export interface OpenReportItem {
  id: string;
  reason: string;
  createdAt: Date;
  reporterUsername: string;
  targetExperienceId: string;
  targetBodyPreview: string;
  targetAuthorId: string;
  targetAuthorUsername: string;
  targetTopicSlug: string;
  targetStatus: string;
}

/**
 * status='open' raporları, raporlayan ve hedef deneyim önizlemesiyle
 * döner. En yeni rapor üstte.
 */
export async function listOpenReports(db: Db): Promise<OpenReportItem[]> {
  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reporterUsername: reporters.username,
      targetExperienceId: experiences.id,
      targetBody: experiences.body,
      targetAuthorId: users.id,
      targetAuthorUsername: users.username,
      targetTopicSlug: topics.slug,
      targetStatus: experiences.status,
    })
    .from(reports)
    .innerJoin(reporters, eq(reporters.id, reports.reporterId))
    .innerJoin(experiences, eq(experiences.id, reports.targetId))
    .innerJoin(users, eq(users.id, experiences.userId))
    .innerJoin(topics, eq(topics.id, experiences.topicId))
    .where(and(eq(reports.status, "open"), eq(reports.targetType, "experience")))
    .orderBy(desc(reports.createdAt));

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    createdAt: row.createdAt,
    reporterUsername: row.reporterUsername ?? "anonim",
    targetExperienceId: row.targetExperienceId,
    targetBodyPreview:
      row.targetBody.length > REPORT_BODY_PREVIEW_LEN
        ? `${row.targetBody.slice(0, REPORT_BODY_PREVIEW_LEN)}…`
        : row.targetBody,
    targetAuthorId: row.targetAuthorId,
    targetAuthorUsername: row.targetAuthorUsername ?? "anonim",
    targetTopicSlug: row.targetTopicSlug,
    targetStatus: row.targetStatus,
  }));
}

export interface AdminUserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  bannedAt: Date | null;
  experienceCount: number;
  questionCount: number;
  answerCount: number;
}

const USER_SEARCH_LIMIT = 20;

/**
 * Admin kullanıcı araması (Faz 9 T7): takma ad veya e-posta üzerinde
 * ilike; içerik sayılarıyla döner. LIKE jokerleri kaçırılır (listTopics
 * kalıbı). En fazla 20 sonuç.
 */
export async function searchUsers(db: Db, q: string): Promise<AdminUserItem[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(or(ilike(users.username, pattern), ilike(users.email, pattern)))
    .orderBy(users.email)
    .limit(USER_SEARCH_LIMIT);

  if (rows.length === 0) return [];

  const userIds = rows.map((row) => row.id);
  const [experienceCounts, questionCounts, answerCounts] = await Promise.all([
    db
      .select({ userId: experiences.userId, total: count() })
      .from(experiences)
      .where(inArray(experiences.userId, userIds))
      .groupBy(experiences.userId),
    db
      .select({ userId: questions.userId, total: count() })
      .from(questions)
      .where(inArray(questions.userId, userIds))
      .groupBy(questions.userId),
    db
      .select({ userId: answers.userId, total: count() })
      .from(answers)
      .where(inArray(answers.userId, userIds))
      .groupBy(answers.userId),
  ]);

  const toMap = (list: { userId: string; total: number }[]) =>
    new Map(list.map((row) => [row.userId, row.total]));
  const expBy = toMap(experienceCounts);
  const qBy = toMap(questionCounts);
  const ansBy = toMap(answerCounts);

  return rows.map((row) => ({
    id: row.id,
    username: row.username ?? "anonim",
    email: row.email,
    role: row.role,
    bannedAt: row.bannedAt,
    experienceCount: expBy.get(row.id) ?? 0,
    questionCount: qBy.get(row.id) ?? 0,
    answerCount: ansBy.get(row.id) ?? 0,
  }));
}

export interface PendingTopicProposalItem {
  id: string;
  name: string;
  type: "drug" | "condition" | "treatment";
  proposerUsername: string;
}

/**
 * status='pending' topic'leri (kullanıcı önerileri), tr i18n adı ve
 * önerici kullanıcı adıyla döner. NOT: `topics` tablosunda createdAt
 * alanı yok (veri modeli sözleşmesi — kickoff'ta buna karar verilmiş,
 * burada değiştirilmez), bu yüzden öneri tarihi gösterilmez; sıralama
 * i18n adına göre deterministiktir.
 */
export async function listPendingTopicProposals(
  db: Db,
): Promise<PendingTopicProposalItem[]> {
  const rows = await db
    .select({
      id: topics.id,
      type: topics.type,
      name: topicI18n.name,
      canonicalName: topics.canonicalName,
      proposerUsername: proposers.username,
    })
    .from(topics)
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, "tr")),
    )
    .leftJoin(proposers, eq(proposers.id, topics.createdBy))
    .where(eq(topics.status, "pending"))
    .orderBy(topicI18n.name);

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.canonicalName,
    type: row.type,
    proposerUsername: row.proposerUsername ?? "anonim",
  }));
}
