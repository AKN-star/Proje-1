/**
 * Çeviri önbellek çekirdeği (Faz 5 T2, docs/specs/faz-5-cok-dillilik.md).
 *
 * PK (target_type, target_id, field, locale) — source_hash içerik
 * düzenlenince bayat çevirinin servis edilmemesini sağlar (kickoff
 * kararı #8). Yalnız başarılı çeviriler önbelleğe yazılır.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { translations } from "@/db/schema";
import { translateText } from "@/lib/ai/translate";

export type TranslationTargetType = "experience" | "question" | "answer";

export interface TranslationRequest {
  targetType: TranslationTargetType;
  targetId: string;
  field: string;
  locale: "tr" | "en";
  sourceText: string;
}

export function hashSourceText(sourceText: string): string {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
}

/** Var olan önbellek satırını döner (hash kontrolü yapılmadan). */
export async function getCachedTranslation(
  db: Db,
  targetType: TranslationTargetType,
  targetId: string,
  field: string,
  locale: "tr" | "en",
): Promise<{ text: string; sourceHash: string } | null> {
  const [row] = await db
    .select({ text: translations.text, sourceHash: translations.sourceHash })
    .from(translations)
    .where(
      and(
        eq(translations.targetType, targetType),
        eq(translations.targetId, targetId),
        eq(translations.field, field),
        eq(translations.locale, locale),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Önbellekte hash eşleşen bir satır varsa onu döner; yoksa (veya kaynak
 * metin değiştiyse) `translateText` çağırır, başarılıysa upsert edip
 * metni döner. Çeviri başarısız olursa null döner ve hiçbir şey
 * yazılmaz (başarısızlıklar asla önbelleğe alınmaz).
 */
export async function getOrCreateTranslation(
  db: Db,
  request: TranslationRequest,
): Promise<string | null> {
  const { targetType, targetId, field, locale, sourceText } = request;
  const sourceHash = hashSourceText(sourceText);

  const existing = await getCachedTranslation(db, targetType, targetId, field, locale);
  if (existing && existing.sourceHash === sourceHash) {
    return existing.text;
  }

  const result = await translateText(sourceText, locale);
  if (!result.ok) {
    return null;
  }

  await db
    .insert(translations)
    .values({
      targetType,
      targetId,
      field,
      locale,
      text: result.text,
      model: result.model,
      sourceHash,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        translations.targetType,
        translations.targetId,
        translations.field,
        translations.locale,
      ],
      set: {
        text: result.text,
        model: result.model,
        sourceHash,
        createdAt: new Date(),
      },
    });

  return result.text;
}
