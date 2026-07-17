/**
 * Deneyim insert'inin saf çekirdeği (T5, spec adım 3). Server action bu
 * fonksiyonu çağırır; test de doğrudan bunu kullanır (PGlite entegrasyon).
 * Moderasyon/doğrulama BURADA yapılmaz — çağıran taraf sorumludur; bu
 * fonksiyon yalnız zaten doğrulanmış veriyi status ile birlikte yazar.
 */
import type { Db } from "@/db";
import { experiences, experienceSideEffects } from "@/db/schema";
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
