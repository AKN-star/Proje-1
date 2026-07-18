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
import { getScores } from "@/lib/votes/vote";

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
  /** SQL sayfalaması (Faz 9 T2): verilirse limit+1 satır çekilir ve
   * hasMore hesaplanabilsin diye çağıran fazlalığı keser. */
  limit?: number;
  offset?: number;
}

/**
 * Arama ilgililik puanı: tam eşleşme (0) > baştan eşleşme (1) >
 * içerir (2). Ad, kanonik ad ve etken maddenin en iyisi alınır;
 * karşılaştırma Türkçe küçük harfe göredir.
 */
export function searchRank(
  q: string,
  fields: (string | null)[],
): number {
  const needle = q.toLocaleLowerCase("tr-TR");
  let best = 3;
  for (const field of fields) {
    if (!field) continue;
    const value = field.toLocaleLowerCase("tr-TR");
    if (value === needle) return 0;
    if (value.startsWith(needle)) best = Math.min(best, 1);
    else if (value.includes(needle)) best = Math.min(best, 2);
  }
  return best;
}

/**
 * Aktif topic'leri, seçilen locale'deki i18n adıyla ve yayınlanmış
 * deneyim sayısıyla birlikte döner. `q` verilirse canonical_name, i18n
 * adı veya etken madde üzerinde (case-insensitive) `ilike` araması
 * yapılır ve sonuçlar ilgililiğe göre sıralanır (searchRank; eşitlikte
 * alfabetik).
 */
export async function listTopics(
  db: Db,
  options: ListTopicsOptions = {},
): Promise<TopicListItem[]> {
  const locale = options.locale ?? "tr";
  const q = options.q?.trim();

  const whereClauses = [eq(topics.status, "active")];
  if (q) {
    // LIKE jokerleri kullanıcı girdisinden kaçırılır (%%% tüm tabloyu
    // döndürmesin); enjeksiyon yok (parametreli) ama semantik korunur.
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    whereClauses.push(
      or(
        ilike(topics.canonicalName, pattern),
        ilike(topicI18n.name, pattern),
        ilike(drugDetails.activeIngredient, pattern),
      )!,
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
    .orderBy(asc(topics.canonicalName))
    .limit(options.limit ?? Number.MAX_SAFE_INTEGER)
    .offset(options.offset ?? 0);

  const items = rows.map((row) => ({
    ...row,
    experienceCount: Number(row.experienceCount),
  }));

  if (q) {
    // SQL alfabetik getirdi; ilgililik JS'te (sonuç kümesi zaten
    // filtrelenmiş ve küçük). Eşit puanda alfabetik sıra korunur
    // (stable sort).
    items.sort(
      (a, b) =>
        searchRank(q, [a.name, a.canonicalName, a.activeIngredient]) -
        searchRank(q, [b.name, b.canonicalName, b.activeIngredient]),
    );
  }

  return items;
}

/** generateMetadata için tek satırlık hafif sorgu — deneyim/skor
 * zinciri koşulmaz (Faz 7 T2; sayfa gövdesi tam sorguyu ayrıca koşar). */
export async function getTopicMeta(
  db: Db,
  slug: string,
  locale = "tr",
): Promise<{ name: string | null; canonicalName: string; summary: string | null } | null> {
  const [row] = await db
    .select({
      name: topicI18n.name,
      canonicalName: topics.canonicalName,
      summary: topicI18n.summary,
    })
    .from(topics)
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, locale)),
    )
    .where(and(eq(topics.slug, slug), eq(topics.status, "active")))
    .limit(1);
  return row ?? null;
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
  authorProBadge: string | null;
  purpose: string;
  durationDays: number | null;
  effectiveness: number;
  body: string;
  lang: string;
  createdAt: Date;
  sideEffects: string[];
  score: number;
  myVote: 1 | -1 | null;
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
export type TopicSort = "yeni" | "oy";

export async function getTopicBySlug(
  db: Db,
  slug: string,
  locale = "tr",
  sort: TopicSort = "yeni",
  currentUserId?: string,
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
      authorProBadge: users.proBadge,
      purpose: experiences.purpose,
      durationDays: experiences.durationDays,
      effectiveness: experiences.effectiveness,
      body: experiences.body,
      lang: experiences.lang,
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

  const scores = await getScores(db, "experience", experienceIds, currentUserId);

  let items: ExperienceListItem[] = experienceRows.map((row) => {
    const scoreEntry = scores.get(row.id);
    return {
      ...row,
      // Yazma eylemi onboarding (username) şartına bağlı; NULL yalnız
      // teorik durumda kalır ama tip daraltması için güvenli varsayılan.
      authorUsername: row.authorUsername ?? "anonim",
      sideEffects: sideEffectsByExperience.get(row.id) ?? [],
      score: scoreEntry?.score ?? 0,
      myVote: scoreEntry?.myVote ?? null,
    };
  });

  if (sort === "oy") {
    // Skora göre azalan; eşitlikte createdAt zaten azalan sırada geldiği
    // için sıralı kalır (stable sort).
    items = items.slice().sort((a, b) => b.score - a.score);
  }

  return {
    topic: topicRow,
    experiences: items,
  };
}
