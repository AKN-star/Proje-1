/**
 * İstatistik çekirdeği (Faz 2 T2). Yayınlanmış deneyimlerden topic_stats
 * özet satırını yeniden hesaplar. Kritik sözleşme #3'ün diğer ucu: canlı
 * sorgu değil, yazımla birlikte yeniden hesaplanan özet satırı (spec T2).
 */
import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { experienceSideEffects, experiences, topicStats } from "@/db/schema";

type TopicStatsRow = typeof topicStats.$inferSelect;

const TOP_SIDE_EFFECTS_LIMIT = 5;
const EFFECTIVE_THRESHOLD = 4;

/**
 * topicId için topic_stats satırını yayınlanmış (status='published')
 * deneyimlerden yeniden hesaplar ve upsert eder (PK topicId). Deneyim
 * yoksa count=0, avg/pct null, topSideEffects [] satırı yazılır.
 */
export async function recalcTopicStats(db: Db, topicId: string): Promise<void> {
  const [summary] = await db
    .select({
      experienceCount: count(),
      avgEffectiveness: avg(experiences.effectiveness),
      effectiveCount: sql<number>`count(*) filter (where ${experiences.effectiveness} >= ${EFFECTIVE_THRESHOLD})`,
    })
    .from(experiences)
    .where(and(eq(experiences.topicId, topicId), eq(experiences.status, "published")));

  const experienceCount = Number(summary?.experienceCount ?? 0);
  const avgEffectiveness =
    experienceCount > 0 && summary?.avgEffectiveness != null
      ? Number(summary.avgEffectiveness)
      : null;
  const effectivePct =
    experienceCount > 0
      ? Math.round((Number(summary?.effectiveCount ?? 0) / experienceCount) * 100)
      : null;

  const topSideEffectsRows =
    experienceCount > 0
      ? await db
          .select({
            termId: experienceSideEffects.termId,
            count: count(),
          })
          .from(experienceSideEffects)
          .innerJoin(experiences, eq(experienceSideEffects.experienceId, experiences.id))
          .where(and(eq(experiences.topicId, topicId), eq(experiences.status, "published")))
          .groupBy(experienceSideEffects.termId)
          .orderBy(desc(count()))
          .limit(TOP_SIDE_EFFECTS_LIMIT)
      : [];

  const topSideEffects = topSideEffectsRows.map((row) => ({
    termId: row.termId,
    count: Number(row.count),
  }));

  await db
    .insert(topicStats)
    .values({
      topicId,
      experienceCount,
      avgEffectiveness,
      effectivePct,
      topSideEffects,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: topicStats.topicId,
      set: {
        experienceCount,
        avgEffectiveness,
        effectivePct,
        topSideEffects,
        updatedAt: new Date(),
      },
    });
}

/** Tek topic_stats satırını okur; yoksa null döner. */
export async function getTopicStats(db: Db, topicId: string): Promise<TopicStatsRow | null> {
  const row = await db.query.topicStats.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.topicId, topicId),
  });
  return row ?? null;
}
