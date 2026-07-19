/**
 * Soru/yanıt el yazımı doğrulayıcıları (zod yok — yeni bağımlılık yasak,
 * kritik kural). Kurallar docs/specs/faz-4-soru-cevap.md T2'den birebir.
 * Kalıp src/lib/validation/experience.ts ile aynı: ok/errors yapısı.
 */

/** Soru/yanıt form hata metinleri — tek kaynak (soru-sor + edit
 * sayfaları); doğrulama sınırı değişince yalnız burası güncellenir. */
export const QA_ERROR_MESSAGES: Record<string, string> = {
  title: "Başlık 5 ile 150 karakter arasında olmalıdır.",
  body: "Metin boş bırakılabilir veya 2 ile 5000 karakter arasında olmalıdır.",
  moderasyon: "İçerik yayınlanamadı, lütfen metni gözden geçirin.",
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

export interface QuestionInput {
  title: string;
  body: string | null;
}

export type ValidateQuestionResult =
  | { ok: true; data: QuestionInput }
  | { ok: false; errors: Record<string, string> };

export function validateQuestionInput(input: unknown): ValidateQuestionResult {
  const errors: Record<string, string> = {};

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _root: "Geçersiz veri." } };
  }

  const raw = input as Record<string, unknown>;

  // title
  const title = raw.title;
  if (typeof title !== "string" || title.length < 5 || title.length > 150) {
    errors.title = "Başlık 5 ile 150 karakter arasında olmalıdır.";
  }

  // body: boş serbest ("" | null | undefined), doluysa 2-5000
  const body = raw.body;
  let normalizedBody: string | null = null;
  if (body !== undefined && body !== null && body !== "") {
    if (typeof body !== "string" || body.length < 2 || body.length > 5000) {
      errors.body = "Metin boş bırakılabilir veya 2 ile 5000 karakter arasında olmalıdır.";
    } else {
      normalizedBody = body;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title: title as string,
      body: normalizedBody,
    },
  };
}

export interface AnswerInput {
  body: string;
}

export type ValidateAnswerResult =
  | { ok: true; data: AnswerInput }
  | { ok: false; errors: Record<string, string> };

export function validateAnswerInput(input: unknown): ValidateAnswerResult {
  const errors: Record<string, string> = {};

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _root: "Geçersiz veri." } };
  }

  const raw = input as Record<string, unknown>;

  const body = raw.body;
  if (typeof body !== "string" || body.length < 2 || body.length > 5000) {
    errors.body = "Metin 2 ile 5000 karakter arasında olmalıdır.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      body: body as string,
    },
  };
}
