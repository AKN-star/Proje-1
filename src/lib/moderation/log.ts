/**
 * moderation_log tablosuna ince yazma sarmalayıcısı (T2, spec adım 2).
 * Çağıran taraflar (deneyim yazma action'ı, admin action'ları) bu
 * fonksiyonu kullanır; şemaya doğrudan erişmez.
 */
import type { Db } from "@/db";
import { moderationLog } from "@/db/schema";

export interface LogModerationInput {
  targetType: string;
  targetId: string;
  action: "ai_flag" | "ai_block" | "ai_timeout" | "mod_remove" | "mod_restore" | "mod_ban";
  detail?: { reasons?: string[]; note?: string };
  actorType: "ai" | "user";
  actorId?: string;
}

export async function logModeration(db: Db, input: LogModerationInput): Promise<void> {
  await db.insert(moderationLog).values({
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    detail: input.detail,
    actorType: input.actorType,
    actorId: input.actorId,
  });
}
