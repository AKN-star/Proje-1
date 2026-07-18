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
import { topics } from "@/db/schema";
import { validateExperienceInput } from "@/lib/validation/experience";
import { moderate } from "@/lib/ai/moderate";
import {
  getOwnExperience,
  insertExperience,
  statusForVerdict,
  updateOwnExperience,
} from "@/lib/experiences/create";
import { UUID_RE } from "@/lib/validate";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireOnboardedUser } from "@/lib/users/guards";
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
  const slug = String(formData.get("slug") ?? "");
  const returnPath = `/baslik/${slug}/deneyim-yaz`;

  // Guard zinciri tek kaynaktan (Faz 10 T2). Banlıya "_root" genel
  // hatası gösterilir (Faz 1 SAPMA kaydıyla aynı davranış).
  const { db, userId } = await requireOnboardedUser(
    returnPath,
    `${returnPath}?hata=_root`,
  );

  if (!slug) {
    redirect(`${returnPath}?hata=_root`);
  }

  if (!(await checkRateLimit(db, userId, "experience"))) {
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
  const result = await insertExperience(db, validation.data, userId, topic.id, status);

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

/**
 * Kendi deneyimini düzenler (Faz 9 T3). submitExperience ile aynı sıra:
 * guard → doğrulama → YENİDEN moderasyon (kural #3) → güncelle →
 * recalc → redirect. Block verdict'te içerik ESKİ haliyle kalır.
 */
export async function updateExperience(formData: FormData): Promise<void> {
  const experienceId = String(formData.get("experienceId") ?? "");
  const returnPath = `/deneyim-duzenle/${experienceId}`;

  const { db, userId } = await requireOnboardedUser(
    UUID_RE.test(experienceId) ? returnPath : "/profil",
    `${returnPath}?hata=_root`,
  );

  if (!UUID_RE.test(experienceId)) {
    redirect("/profil");
  }

  // Her düzenleme ücretli moderate() çağrısıdır — pencere user_edit
  // denetim kayıtlarından sayılır (Faz 9 review bulgusu).
  if (!(await checkRateLimit(db, userId, "contentEdit"))) {
    redirect(`${returnPath}?hata=limit`);
  }

  // Sahiplik (ve topic slug'ı) çekirdek sorgusuyla doğrulanır.
  const existing = await getOwnExperience(db, userId, experienceId);
  if (!existing) {
    redirect("/profil");
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

  const moderation = await moderate(
    `${validation.data.purpose}\n\n${validation.data.body}`,
    "experience",
  );
  if (moderation.verdict === "block") {
    await logModeration(db, {
      targetType: "experience",
      targetId: experienceId,
      action: "ai_block",
      detail: { reasons: moderation.reasons, note: "edit-blocked" },
      actorType: "ai",
    });
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const status = statusForVerdict(moderation.verdict);
  const updated = await updateOwnExperience(
    db,
    userId,
    experienceId,
    validation.data,
    status,
  );
  if (!updated) {
    redirect("/profil");
  }

  if (moderation.verdict === "flag" || moderation.verdict === "timeout") {
    await logModeration(db, {
      targetType: "experience",
      targetId: experienceId,
      action: moderation.verdict === "flag" ? "ai_flag" : "ai_timeout",
      detail: { reasons: moderation.reasons, note: "edit" },
      actorType: "ai",
    });
  }

  // Denetim izi + experienceEdit rate-limit sayacı (her başarılı edit).
  await logModeration(db, {
    targetType: "experience",
    targetId: experienceId,
    action: "user_edit",
    actorType: "user",
    actorId: userId,
  });

  await recalcTopicStats(db, existing.topicId);

  revalidatePath(`/baslik/${existing.topicSlug}`);
  revalidatePath("/profil");
  redirect(`/baslik/${existing.topicSlug}`);
}
