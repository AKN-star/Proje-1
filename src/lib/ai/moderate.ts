/**
 * Moderasyon sözleşmesi (kritik kural #3, docs/specs/faz-3-moderasyon-admin.md T2).
 *
 * Bu imza SABİTTİR: `moderate(content, kind) -> {verdict, reasons}`.
 * Faz 3'ten itibaren gerçek bir AI moderasyon çağrısı yapılır
 * (src/lib/ai/client.ts üzerinden). Anahtar yoksa dev modu: her zaman
 * `{verdict:'ok', reasons:['no-api-key']}` döner (spec kararı — canlı
 * yayın deployment protection arkasında, Faz 7 öncesi noindex).
 *
 * Davranış sözleşmesi: AI çağrısı timeout/ağ hatası olursa `moderate`
 * hata fırlatmaz; `{verdict:'timeout', reasons:['timeout']}` döner.
 * Çağıran taraf bu durumda içeriği 'pending' status'üyle kaydeder ve
 * insan incelemesine bırakır. Beklenmeyen/parse edilemeyen yanıt →
 * temkinli olarak `{verdict:'flag', reasons:['parse-error']}`.
 */
import { callClaude, getAnthropicApiKey } from "./client";

export type ModerationKind = "experience" | "question" | "answer";

export type ModerationVerdict = "ok" | "flag" | "block" | "timeout";

export interface ModerationResult {
  verdict: ModerationVerdict;
  reasons: string[];
}

const TIMEOUT_MS = 5_000;
const MAX_TOKENS = 200;

const SYSTEM_PROMPT = `Sen bir ilaç/tedavi deneyimi platformu için içerik moderatörüsün. Kullanıcı içeriğini şu sınıflara göre değerlendir:
(a) ilaç satışı/ticareti/tedariki
(b) tehlikeli doz/kullanım tavsiyesi
(c) spam/reklam/link
(d) kişisel veri (ad-soyad, telefon, TC kimlik no, adres)
(e) nefret/istismar

Yalnız şu JSON formatında yanıt ver, başka hiçbir metin ekleme:
{"verdict":"ok"|"flag"|"block","reasons":["..."]}

Kurallar: açık satış/ticaret veya ağır tehlikeli tavsiye içeriyorsa "block".
Şüpheli/belirsiz durumlarda "flag". Hiçbir sorun yoksa "ok" ve boş reasons.`;

function parseModerationResponse(text: string): ModerationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { verdict: "flag", reasons: ["parse-error"] };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("verdict" in parsed) ||
    !["ok", "flag", "block"].includes((parsed as { verdict: unknown }).verdict as string)
  ) {
    return { verdict: "flag", reasons: ["parse-error"] };
  }

  const verdict = (parsed as { verdict: "ok" | "flag" | "block" }).verdict;
  const reasonsRaw = (parsed as { reasons?: unknown }).reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.filter((r): r is string => typeof r === "string")
    : [];

  return { verdict, reasons };
}

export async function moderate(
  content: string,
  kind: ModerationKind,
): Promise<ModerationResult> {
  void kind;

  if (!getAnthropicApiKey()) {
    return { verdict: "ok", reasons: ["no-api-key"] };
  }

  try {
    const text = await callClaude(SYSTEM_PROMPT, content, {
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });
    return parseModerationResponse(text);
  } catch {
    return { verdict: "timeout", reasons: ["timeout"] };
  }
}
