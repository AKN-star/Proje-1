/**
 * Topic listeleme ve detay sorguları (T4, T1'i tüketir).
 * Yalnızca status='active' topic'ler ve status='published' deneyimler
 * kullanıcıya gösterilir.
 */
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@/db";
import {
  drugDetails,
  experiences,
  experienceSideEffects,
  sideEffectTerms,
  topicI18n,
  topics,
  users,
} from "@/db/schema";

export interface TopicListItem {
  id: string;
  slug: string;
  type: "drug" | "condition" | "treatment";
  canonicalName: string;
  name: string | null;
  activeIngredient: string | null;
  experienceCount: number;
}

export interface ListTopicsOptions {
  /** Arama sorgusu (canonical_name veya i18n adı üzerinde ilike). */
  q?: string;
  /** i18n eşleşmesi için locale (varsayılan 'tr'). */
  locale?: string;
}

/**
 * Aktif topic'leri, seçilen locale'deki i18n adıyla ve yayınlanmış
 * deneyim sayısıyla birlikte döner. `q` verilirse canonical_name veya
 * i18n adı üzerinde (case-insensitive) `ilike` araması yapılır.
 */
export async function listTopics(
  db: Db,
  options: ListTopicsOptions = {},
): Promise<TopicListItem[]> {
  const locale = options.locale ?? "tr";
  const q = options.q?.trim();

  const whereClauses = [eq(topics.status, "active")];
  if (q) {
    const pattern = `%${q}%`;
    whereClauses.push(
      or(ilike(topics.canonicalName, pattern), ilike(topicI18n.name, pattern))!,
    );
  }

  const rows = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      type: topics.type,
      canonicalName: topics.canonicalName,
      name: topicI18n.name,
      activeIngredient: drugDetails.activeIngredient,
      experienceCount: count(experiences.id),
    })
    .from(topics)
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, locale)),
    )
    .leftJoin(drugDetails, eq(drugDetails.topicId, topics.id))
    .leftJoin(
      experiences,
      and(eq(experiences.topicId, topics.id), eq(experiences.status, "published")),
    )
    .where(and(...whereClauses))
    .groupBy(
      topics.id,
      topics.slug,
      topics.type,
      topics.canonicalName,
      topicI18n.name,
      drugDetails.activeIngredient,
    )
    .orderBy(asc(topics.canonicalName));

  return rows.map((row) => ({
    ...row,
    experienceCount: Number(row.experienceCount),
  }));
}

export interface TopicDetail {
  id: string;
  slug: string;
  type: "drug" | "condition" | "treatment";
  canonicalName: string;
  name: string | null;
  summary: string | null;
  activeIngredient: string | null;
  form: string | null;
  strength: string | null;
}

export interface ExperienceListItem {
  id: string;
  authorUsername: string;
  purpose: string;
  durationDays: number | null;
  effectiveness: number;
  body: string;
  createdAt: Date;
  sideEffects: string[];
}

export interface TopicWithExperiences {
  topic: TopicDetail;
  experiences: ExperienceListItem[];
}

/**
 * Slug'a göre aktif topic'i, i18n bilgisiyle, ilaç detaylarıyla ve
 * yayınlanmış deneyimleriyle (en yeni üstte) döner. Topic bulunamaz veya
 * aktif değilse `null` döner. Deneyimi olmayan topic boş `experiences`
 * listesiyle döner.
 */
export async function getTopicBySlug(
  db: Db,
  slug: string,
  locale = "tr",
): Promise<TopicWithExperiences | null> {
  const [topicRow] = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      type: topics.type,
      canonicalName: topics.canonicalName,
      name: topicI18n.name,
      summary: topicI18n.summary,
      activeIngredient: drugDetails.activeIngredient,
      form: drugDetails.form,
      strength: drugDetails.strength,
    })
    .from(topics)
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, locale)),
    )
    .leftJoin(drugDetails, eq(drugDetails.topicId, topics.id))
    .where(and(eq(topics.slug, slug), eq(topics.status, "active")))
    .limit(1);

  if (!topicRow) return null;

  const experienceRows = await db
    .select({
      id: experiences.id,
      authorUsername: users.username,
      purpose: experiences.purpose,
      durationDays: experiences.durationDays,
      effectiveness: experiences.effectiveness,
      body: experiences.body,
      createdAt: experiences.createdAt,
    })
    .from(experiences)
    .innerJoin(users, eq(users.id, experiences.userId))
    .where(
      and(eq(experiences.topicId, topicRow.id), eq(experiences.status, "published")),
    )
    .orderBy(desc(experiences.createdAt));

  const experienceIds = experienceRows.map((row) => row.id);
  const sideEffectsByExperience = new Map<string, string[]>();

  if (experienceIds.length > 0) {
    const sideEffectRows = await db
      .select({
        experienceId: experienceSideEffects.experienceId,
        nameTr: sideEffectTerms.nameTr,
      })
      .from(experienceSideEffects)
      .innerJoin(
        sideEffectTerms,
        eq(sideEffectTerms.id, experienceSideEffects.termId),
      )
      .where(
        or(
          ...experienceIds.map((id) => eq(experienceSideEffects.experienceId, id)),
        ),
      );

    for (const row of sideEffectRows) {
      const list = sideEffectsByExperience.get(row.experienceId) ?? [];
      list.push(row.nameTr);
      sideEffectsByExperience.set(row.experienceId, list);
    }
  }

  return {
    topic: topicRow,
    experiences: experienceRows.map((row) => ({
      ...row,
      // Yazma eylemi onboarding (username) şartına bağlı; NULL yalnız
      // teorik durumda kalır ama tip daraltması için güvenli varsayılan.
      authorUsername: row.authorUsername ?? "anonim",
      sideEffects: sideEffectsByExperience.get(row.id) ?? [],
    })),
  };
}
