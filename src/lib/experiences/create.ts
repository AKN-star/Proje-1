/**
 * Deneyim insert'inin saf çekirdeği (T5, spec adım 3). Server action bu
 * fonksiyonu çağırır; test de doğrudan bunu kullanır (PGlite entegrasyon).
 * Moderasyon/doğrulama BURADA yapılmaz — çağıran taraf sorumludur; bu
 * fonksiyon yalnız zaten doğrulanmış veriyi status ile birlikte yazar.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { experiences, experienceSideEffects, topics } from "@/db/schema";
import type { ExperienceInput } from "@/lib/validation/experience";
import type { ModerationVerdict } from "@/lib/ai/moderate";

export type ExperienceStatus = "published" | "flagged" | "pending";

export interface InsertExperienceResult {
  id: string;
  status: ExperienceStatus;
}

/**
 * Moderasyon verdict'ini deneyim status'üne çevirir. 'block' burada
 * çağrılmamalı — çağıran taraf 'block' durumunda insert'i hiç tetiklemez.
 */
export function statusForVerdict(verdict: ModerationVerdict): ExperienceStatus {
  if (verdict === "flag") return "flagged";
  if (verdict === "timeout") return "pending";
  return "published";
}

/**
 * Doğrulanmış deneyim girdisini `experiences` tablosuna ve seçilen yan
 * etkileri `experience_side_effects` join tablosuna sırayla ekler
 * (transaction gerekmez — spec adım 2).
 */
export async function insertExperience(
  db: Db,
  input: ExperienceInput,
  userId: string,
  topicId: string,
  status: ExperienceStatus,
): Promise<InsertExperienceResult> {
  const [row] = await db
    .insert(experiences)
    .values({
      topicId,
      userId,
      purpose: input.purpose,
      durationDays: input.durationDays,
      effectiveness: input.effectiveness,
      body: input.body,
      status,
    })
    .returning({ id: experiences.id });

  if (!row) {
    throw new Error("Deneyim eklenemedi.");
  }

  if (input.sideEffectIds.length > 0) {
    await db.insert(experienceSideEffects).values(
      input.sideEffectIds.map((termId) => ({
        experienceId: row.id,
        termId,
      })),
    );
  }

  return { id: row.id, status };
}

export interface OwnExperienceForEdit {
  id: string;
  topicId: string;
  topicSlug: string;
  purpose: string;
  durationDays: number | null;
  effectiveness: number;
  body: string;
  sideEffectIds: string[];
}

/**
 * Düzenleme formu için kullanıcının kendi (removed olmayan) deneyimini
 * yan etki seçimleriyle döner; sahibi değilse/yoksa null (Faz 9 T3).
 */
export async function getOwnExperience(
  db: Db,
  userId: string,
  experienceId: string,
): Promise<OwnExperienceForEdit | null> {
  const [row] = await db
    .select({
      id: experiences.id,
      topicId: experiences.topicId,
      topicSlug: topics.slug,
      purpose: experiences.purpose,
      durationDays: experiences.durationDays,
      effectiveness: experiences.effectiveness,
      body: experiences.body,
      status: experiences.status,
    })
    .from(experiences)
    .innerJoin(topics, eq(topics.id, experiences.topicId))
    .where(and(eq(experiences.id, experienceId), eq(experiences.userId, userId)))
    .limit(1);
  if (!row || row.status === "removed") return null;

  const sideEffectRows = await db
    .select({ termId: experienceSideEffects.termId })
    .from(experienceSideEffects)
    .where(eq(experienceSideEffects.experienceId, experienceId));

  return {
    id: row.id,
    topicId: row.topicId,
    topicSlug: row.topicSlug,
    purpose: row.purpose,
    durationDays: row.durationDays,
    effectiveness: row.effectiveness,
    body: row.body,
    sideEffectIds: sideEffectRows.map((r) => r.termId),
  };
}

/**
 * Kullanıcının kendi deneyimini günceller (Faz 9 T3). Doğrulama ve
 * moderasyon ÇAĞIRANDA (kural #3 — düzenlenen içerik yeniden
 * moderate'ten geçer); burada sahiplik kontrolü + alan güncellemesi +
 * yan etki join'inin değiştirilmesi yapılır. Sahibi değilse/removed ise
 * false döner; topic_stats'ı çağıran yeniden hesaplar.
 */
export async function updateOwnExperience(
  db: Db,
  userId: string,
  experienceId: string,
  input: ExperienceInput,
  status: ExperienceStatus,
): Promise<boolean> {
  const [existing] = await db
    .select({ status: experiences.status })
    .from(experiences)
    .where(and(eq(experiences.id, experienceId), eq(experiences.userId, userId)))
    .limit(1);
  if (!existing || existing.status === "removed") return false;

  await db
    .update(experiences)
    .set({
      purpose: input.purpose,
      durationDays: input.durationDays,
      effectiveness: input.effectiveness,
      body: input.body,
      status,
    })
    .where(eq(experiences.id, experienceId));

  await db
    .delete(experienceSideEffects)
    .where(eq(experienceSideEffects.experienceId, experienceId));
  if (input.sideEffectIds.length > 0) {
    await db.insert(experienceSideEffects).values(
      input.sideEffectIds.map((termId) => ({ experienceId, termId })),
    );
  }

  return true;
}
