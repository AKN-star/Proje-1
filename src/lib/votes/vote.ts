/**
 * Oylama çekirdeği (T3, spec). castVote toggle/upsert davranışını
 * uygular: aynı değer tekrar gönderilirse oy SİLİNİR, farklı değer
 * gönderilirse güncellenir. getScores toplu skor + kullanıcının kendi
 * oyunu okur (topic sayfası ve action bunu tüketir).
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { votes } from "@/db/schema";

export type VoteTargetType = "experience" | "answer";
export type VoteResult = "added" | "removed" | "changed";

export interface ScoreEntry {
  score: number;
  myVote: 1 | -1 | null;
}

/**
 * Mevcut oyu okuyup toggle/upsert kararını verir:
 * - oy yok → insert ('added')
 * - oy var, aynı değer → delete ('removed')
 * - oy var, farklı değer → update ('changed')
 */
export async function castVote(
  db: Db,
  userId: string,
  targetType: VoteTargetType,
  targetId: string,
  value: 1 | -1,
): Promise<VoteResult> {
  const [existing] = await db
    .select({ value: votes.value })
    .from(votes)
    .where(
      and(
        eq(votes.userId, userId),
        eq(votes.targetType, targetType),
        eq(votes.targetId, targetId),
      ),
    )
    .limit(1);

  if (!existing) {
    // Yarış koşulu (çift tık): iki istek de "oy yok" görebilir; ikinci
    // insert PK'ye çarpınca 500 yerine mevcut oy güncellenir (atomik).
    await db
      .insert(votes)
      .values({ userId, targetType, targetId, value })
      .onConflictDoUpdate({
        target: [votes.userId, votes.targetType, votes.targetId],
        set: { value },
      });
    return "added";
  }

  if (existing.value === value) {
    await db
      .delete(votes)
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.targetType, targetType),
          eq(votes.targetId, targetId),
        ),
      );
    return "removed";
  }

  await db
    .update(votes)
    .set({ value })
    .where(
      and(
        eq(votes.userId, userId),
        eq(votes.targetType, targetType),
        eq(votes.targetId, targetId),
      ),
    );
  return "changed";
}

/**
 * Verilen hedef id listesi için skor (sum(value), oysuzsa 0) ve
 * currentUserId geçilmişse kullanıcının kendi oyunu okur. Boş dizi
 * için sorgu atmadan boş Map döner.
 */
export async function getScores(
  db: Db,
  targetType: VoteTargetType,
  targetIds: string[],
  currentUserId?: string,
): Promise<Map<string, ScoreEntry>> {
  const result = new Map<string, ScoreEntry>();
  if (targetIds.length === 0) return result;

  for (const id of targetIds) {
    result.set(id, { score: 0, myVote: null });
  }

  const scoreRows = await db
    .select({
      targetId: votes.targetId,
      score: sql<number>`sum(${votes.value})`.mapWith(Number),
    })
    .from(votes)
    .where(and(eq(votes.targetType, targetType), inArray(votes.targetId, targetIds)))
    .groupBy(votes.targetId);

  for (const row of scoreRows) {
    const entry = result.get(row.targetId);
    if (entry) entry.score = row.score;
  }

  if (currentUserId) {
    const myVoteRows = await db
      .select({ targetId: votes.targetId, value: votes.value })
      .from(votes)
      .where(
        and(
          eq(votes.targetType, targetType),
          eq(votes.userId, currentUserId),
          inArray(votes.targetId, targetIds),
        ),
      );
    for (const row of myVoteRows) {
      const entry = result.get(row.targetId);
      if (entry) entry.myVote = row.value as 1 | -1;
    }
  }

  return result;
}
