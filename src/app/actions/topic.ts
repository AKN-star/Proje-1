"use server";

/**
 * Başlık önerisi server action'ı (T4, spec adım 1). Kalıp
 * src/app/actions/qa.ts submitQuestion ile birebir: session → onboarding
 * +ban guard → doğrulama → moderasyon → insert (öneriler her zaman
 * status 'pending' — verdict'ten bağımsız, admin onayı bekler) →
 * redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { validateTopicProposalInput } from "@/lib/validation/topic";
import { moderate } from "@/lib/ai/moderate";
import { proposeTopic } from "@/lib/topics/propose";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { logModeration } from "@/lib/moderation/log";

const RETURN_PATH = "/baslik-oner";
const FIELD_ORDER = ["name", "type", "summary"] as const;

export async function submitTopicProposal(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/giris?next=${encodeURIComponent(RETURN_PATH)}`);
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(RETURN_PATH)}`);
  }

  if (profile?.bannedAt) {
    redirect(`${RETURN_PATH}?hata=_root`);
  }

  const rawInput = {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    summary:
      formData.get("summary") === null ? null : String(formData.get("summary")),
  };

  const validation = validateTopicProposalInput(rawInput);
  if (!validation.ok) {
    const firstField =
      FIELD_ORDER.find((field) => validation.errors[field]) ?? "_root";
    redirect(`${RETURN_PATH}?hata=${firstField}`);
  }

  const content = validation.data.summary
    ? `${validation.data.name}\n\n${validation.data.summary}`
    : validation.data.name;
  const moderation = await moderate(content, "topic");

  if (moderation.verdict === "block") {
    // Insert yapılmadığı için henüz topic id'si yok — moderation_log
    // targetId NOT NULL olduğundan hedef olarak öneriyi yapan kullanıcı
    // kaydedilir (bkz. qa.ts'te topic.id kullanımının analogu).
    await logModeration(db, {
      targetType: "user",
      targetId: session.user.id,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "topic-proposal-blocked-before-insert" },
      actorType: "ai",
    });
    redirect(`${RETURN_PATH}?hata=moderasyon`);
  }

  // Öneriler moderasyon verdict'inden bağımsız her zaman 'pending' ile
  // eklenir — admin onayı bekler (spec T4).
  const result = await proposeTopic(
    db,
    validation.data,
    session.user.id,
    "pending",
  );

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "topic",
      targetId: result.id,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons },
      actorType: "ai",
    });
  }

  revalidatePath(RETURN_PATH);
  redirect(`${RETURN_PATH}?gonderildi=1`);
}
