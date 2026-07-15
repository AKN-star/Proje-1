"use server";

/**
 * Deneyim yazma server action'ı (T5, spec adım 2). Sıra: session kontrolü
 * → doğrulama → moderasyon → insert → revalidate → redirect. Aşırı
 * mühendislik yok — useActionState kullanılmaz, hata ilk alan adıyla
 * query param'ında forma geri taşınır (`?hata=<alan>`).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { validateExperienceInput } from "@/lib/validation/experience";
import { moderate } from "@/lib/ai/moderate";
import { insertExperience, statusForVerdict } from "@/lib/experiences/create";

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
  const topicId = String(formData.get("topicId") ?? "");
  const returnPath = `/baslik/${slug}/deneyim-yaz`;

  if (!slug || !topicId) {
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

  const moderation = await moderate(validation.data.body, "experience");
  if (moderation.verdict === "block") {
    redirect(`${returnPath}?hata=moderasyon`);
  }

  const db = await getDb();
  const status = statusForVerdict(moderation.verdict);
  await insertExperience(db, validation.data, session.user.id, topicId, status);

  revalidatePath(`/baslik/${slug}`);
  redirect(`/baslik/${slug}`);
}
