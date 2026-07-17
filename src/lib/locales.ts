/**
 * Desteklenen içerik locale'leri — tek kaynak (Faz 5). Yeni locale
 * eklemek yalnız bu dosyayı genişletir; action/cache/UI buradan tüketir.
 */
export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** users.locale ham değerini bilinen bir locale'e indirger. */
export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "tr";
}

export const TRANSLATION_NOTES: Record<Locale, string> = {
  tr: "Otomatik çeviri — hatalı olabilir",
  en: "Automatic translation — may contain errors",
};
