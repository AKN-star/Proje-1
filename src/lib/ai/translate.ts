/**
 * Çeviri çekirdeği (Faz 5 T2, docs/specs/faz-5-cok-dillilik.md).
 *
 * moderate.ts kalıbını izler: anahtar yoksa/ağ hatası/timeout olursa
 * hata fırlatmaz, sonucu ok:false ile döner. Çağıran taraf
 * (src/lib/translations/cache.ts) başarısızlığı önbelleğe yazmaz.
 */
import { callClaude, getAnthropicApiKey, MODEL } from "./client";
import type { Locale } from "@/lib/locales";

const TIMEOUT_MS = 8_000;
const MAX_TOKENS = 2_000;

const LOCALE_NAME: Record<Locale, string> = {
  tr: "Türkçe",
  en: "İngilizce",
};

function buildSystemPrompt(targetLocale: Locale): string {
  return `Sen bir ilaç/tedavi deneyimi platformu için çevirmensin. Kullanıcının sağlıkla ilgili içeriğini ${LOCALE_NAME[targetLocale]} diline sadık biçimde çevir. Tıbbi terimleri koru, anlamı değiştirme. Yalnızca çevrilmiş metni döndür — açıklama, yorum veya tırnak işareti ekleme.`;
}

export type TranslateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: string };

export async function translateText(
  text: string,
  targetLocale: Locale,
): Promise<TranslateResult> {
  if (!getAnthropicApiKey()) {
    return { ok: false, reason: "no-api-key" };
  }

  try {
    const translated = await callClaude(buildSystemPrompt(targetLocale), text, {
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });
    const trimmed = translated.trim();
    if (!trimmed) {
      return { ok: false, reason: "empty-response" };
    }
    return { ok: true, text: trimmed, model: MODEL };
  } catch {
    return { ok: false, reason: "translate-error" };
  }
}
