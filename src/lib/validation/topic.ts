/**
 * Başlık önerisi el yazımı doğrulayıcısı (T4, spec adım 1). zod yok
 * (kritik kural — yeni bağımlılık yasak). Kalıp src/lib/validation/qa.ts
 * ile aynı: ok/errors yapısı. `type` yalnız 'condition'|'treatment'
 * olabilir — 'drug' asla kullanıcıdan önerilemez (spec T4 notu).
 */

import { slugify } from "@/lib/topics/propose";

export interface TopicProposalInput {
  name: string;
  type: "condition" | "treatment";
  summary: string | null;
}

export type ValidateTopicProposalResult =
  | { ok: true; data: TopicProposalInput }
  | { ok: false; errors: Record<string, string> };

export function validateTopicProposalInput(
  input: unknown,
): ValidateTopicProposalResult {
  const errors: Record<string, string> = {};

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _root: "Geçersiz veri." } };
  }

  const raw = input as Record<string, unknown>;

  // name
  const name = raw.name;
  if (typeof name !== "string" || name.length < 3 || name.length > 100) {
    errors.name = "Başlık adı 3 ile 100 karakter arasında olmalıdır.";
  } else if (slugify(name) === "") {
    // "???" gibi yalnız sembollerden oluşan ad boş slug üretir —
    // /baslik/ altında kırık rota olurdu.
    errors.name = "Başlık adı en az bir harf veya rakam içermelidir.";
  }

  // type: yalnız condition|treatment (drug asla önerilemez)
  const type = raw.type;
  if (type !== "condition" && type !== "treatment") {
    errors.type = "Tür 'durum' veya 'tedavi' olmalıdır.";
  }

  // summary: boş serbest ("" | null | undefined), doluysa 0-500
  const summary = raw.summary;
  let normalizedSummary: string | null = null;
  if (summary !== undefined && summary !== null && summary !== "") {
    if (typeof summary !== "string" || summary.length > 500) {
      errors.summary = "Özet en fazla 500 karakter olabilir.";
    } else {
      normalizedSummary = summary;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name: name as string,
      type: type as "condition" | "treatment",
      summary: normalizedSummary,
    },
  };
}
