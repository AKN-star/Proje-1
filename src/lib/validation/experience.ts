/**
 * El yazımı deneyim doğrulayıcı (zod yok — yeni bağımlılık yasak, kritik
 * kural). Kurallar docs/specs/faz-1-yuruyen-iskelet.md T2'den birebir.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Form hata metinlerinin tek kaynağı (yaz + düzenle sayfaları);
 * doğrulama sınırları değişince yalnız burası güncellenir (Faz 9). */
export const EXPERIENCE_ERROR_MESSAGES: Record<string, string> = {
  purpose: "Amaç 3 ile 200 karakter arasında olmalıdır.",
  body: "Metin 10 ile 5000 karakter arasında olmalıdır.",
  effectiveness: "Etki 1 ile 5 arasında seçilmelidir.",
  durationDays: "Süre boş bırakılabilir veya 1 ile 3650 gün arasında olmalıdır.",
  sideEffectIds: "Yan etki seçimi geçersiz.",
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

export interface ExperienceInput {
  purpose: string;
  body: string;
  effectiveness: number;
  durationDays: number | null;
  sideEffectIds: string[];
}

export type ValidateExperienceResult =
  | { ok: true; data: ExperienceInput }
  | { ok: false; errors: Record<string, string> };

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function validateExperienceInput(
  input: unknown,
): ValidateExperienceResult {
  const errors: Record<string, string> = {};

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _root: "Geçersiz veri." } };
  }

  const raw = input as Record<string, unknown>;

  // purpose
  const purpose = raw.purpose;
  if (typeof purpose !== "string" || purpose.length < 3 || purpose.length > 200) {
    errors.purpose = "Amaç 3 ile 200 karakter arasında olmalıdır.";
  }

  // body
  const body = raw.body;
  if (typeof body !== "string" || body.length < 10 || body.length > 5000) {
    errors.body = "Metin 10 ile 5000 karakter arasında olmalıdır.";
  }

  // effectiveness
  const effectiveness = raw.effectiveness;
  if (!isInteger(effectiveness) || effectiveness < 1 || effectiveness > 5) {
    errors.effectiveness = "Etki 1 ile 5 arasında tam sayı olmalıdır.";
  }

  // durationDays
  const durationDays = raw.durationDays;
  if (
    durationDays !== null &&
    durationDays !== undefined &&
    (!isInteger(durationDays) || durationDays < 1 || durationDays > 3650)
  ) {
    errors.durationDays =
      "Süre boş bırakılabilir veya 1 ile 3650 gün arasında tam sayı olmalıdır.";
  }

  // sideEffectIds
  const sideEffectIds = raw.sideEffectIds;
  if (sideEffectIds !== undefined && sideEffectIds !== null) {
    if (!Array.isArray(sideEffectIds)) {
      errors.sideEffectIds = "Yan etkiler bir liste olmalıdır.";
    } else if (sideEffectIds.length > 10) {
      errors.sideEffectIds = "En fazla 10 yan etki seçilebilir.";
    } else if (
      !sideEffectIds.every((id) => typeof id === "string" && UUID_RE.test(id))
    ) {
      errors.sideEffectIds = "Yan etki kimlikleri geçerli uuid olmalıdır.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      purpose: purpose as string,
      body: body as string,
      effectiveness: effectiveness as number,
      durationDays:
        durationDays === undefined || durationDays === null
          ? null
          : (durationDays as number),
      sideEffectIds: (sideEffectIds as string[] | undefined) ?? [],
    },
  };
}
