/**
 * Sabit tıbbi sorumluluk reddi metinleri. Marka string'i içermez (kritik
 * kural #1) — i18n'e hazır, locale bazlı sabit metinler.
 */
export const medicalDisclaimer = {
  tr: "Bu platformdaki içerikler kullanıcı deneyimleridir, tıbbi tavsiye değildir. İlaç kullanımıyla ilgili kararlar için mutlaka doktorunuza veya eczacınıza danışın.",
  en: "The content on this platform consists of user experiences, not medical advice. Always consult your doctor or pharmacist for decisions about medication use.",
} as const;

export type DisclaimerLocale = keyof typeof medicalDisclaimer;
