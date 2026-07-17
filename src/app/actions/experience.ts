"use server";

/**
 * Deneyim yazma server action'ı (T5, spec adım 2). Sıra: session kontrolü
 * → doğrulama → moderasyon → insert → revalidate → redirect. Aşırı
 * mühendislik yok — useActionState kullanılmaz, hata ilk alan adıyla
 * query param'ında forma geri taşınır (`?hata=<alan>`).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { topics } from "@/db/schema";
import { validateExperienceInput } from "@/lib/validation/experience";
import { moderate } from "@/lib/ai/moderate";
import { insertExperience, statusForVerdict } from "@/lib/experiences/create";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { recalcTopicStats } from "@/lib/stats/topic-stats";
import { logModeration } from "@/lib/moderation/log";

const FIELD_ORDER = [
  "purpose",
  "body",
  "effectiveness",
  "durationDays",
  "sideEffectIds",
] as const;

function parseNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export async function submitExperience(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris");
  }

  const slug = String(formData.get("slug") ?? "");
  const returnPath = `/baslik/${slug}/deneyim-yaz`;

  if (!slug) {
    redirect(`${returnPath}?hata=_root`);
  }

  const db = await getDb();

  // Takma ad + KVKK rızası olmadan yazma yok (master plan sözleşmesi).
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(returnPath)}`);
  }

  // Banlı kullanıcı yazamaz (master plan sözleşmesi). SAPMA KAYDI (T2):
  // deneyim-yaz sayfasındaki ERROR_MESSAGES sözlüğü T3/W3 kapsamında ve bu
  // worktree'den dokunulamıyor; özel bir "banli" alanı eklemek yerine
  // mevcut "_root" genel hata mesajı kullanılır.
  if (profile?.bannedAt) {
    redirect(`${returnPath}?hata=_root`);
  }

  if (!(await checkRateLimit(db, session.user.id, "experience"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  // topicId form'dan alınmaz: sahte id ile başka/pasif bir başlığa
  // yazılamasın diye slug'dan yalnız aktif topic server-side çözülür.
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.slug, slug), eq(topics.status, "active")))
    .limit(1);
  if (!topic) {
    redirect(`${returnPath}?hata=_root`);
  }

  const rawInput = {
    purpose: String(formData.get("purpose") ?? ""),
    body: String(formData.get("body") ?? ""),
    effectiveness: parseNumber(formData.get("effectiveness")),
    durationDays: parseNumber(formData.get("durationDays")) ?? null,
    sideEffectIds: formData.getAll("sideEffectIds").map(String),
  };

  const validation = validateExperienceInput(rawInput);
  if (!validation.ok) {
    const firstField = FIELD_ORDER.find((field) => validation.errors[field]) ?? "_root";
    redirect(`${returnPath}?hata=${firstField}`);
  }

  // purpose da yayınlanan serbest metindir — body ile birlikte tek
  // çağrıda moderasyondan geçer (kritik kural #3).
  const moderation = await moderate(
    `${validation.data.purpose}\n\n${validation.data.body}`,
    "experience",
  );
  if (moderation.verdict === "block") {
    // Insert yapılmadığı için deneyim id'si yok — hedef topic'tir;
    // targetType "experience" YAZILMAZ (admin kuyruğu experience id'siyle
    // eşliyor, topic id'si yanlış karta yapışabilirdi).
    await logModeration(db, {
      targetType: "topic",
      targetId: topic.id,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "blocked-before-insert" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const result = await insertExperience(db, validation.data, session.user.id, topic.id, status);

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "experience",
      targetId: result.id,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons },
      actorType: "ai",
    });
  }

  // SAPMA KAYDI (spec T2): master plan aynı transaction'da recalc ister;
  // neon-http driver transaction desteklemez → aynı istek içinde ardışık
  // çağrı. Faz 7'de driver websocket'e geçerse transaction'a alınır.
  await recalcTopicStats(db, topic.id);

  revalidatePath(`/baslik/${slug}`);
  redirect(`/baslik/${slug}`);
}
