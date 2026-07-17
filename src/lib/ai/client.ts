/**
 * Anthropic Messages API için ince bir sarmalayıcı. SDK bağımlılığı
 * YASAK — çıplak `fetch` kullanılır (bkz. src/lib/email/send.ts kalıbı).
 */
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const MODEL = "claude-haiku-4-5";

export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY ?? null;
}

export interface CallClaudeOptions {
  maxTokens: number;
  timeoutMs: number;
}

/**
 * Tek turlu Messages API çağrısı. Yanıtın ilk metin bloğunu döner;
 * anahtar yoksa, ağ hatası olursa veya timeout olursa fırlatır —
 * çağıran taraf (moderate.ts) bunu yakalayıp 'timeout' verdict'ine çevirir.
 */
export async function callClaude(
  system: string,
  userContent: string,
  { maxTokens, timeoutMs }: CallClaudeOptions,
): Promise<string> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API hatası (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((block) => block.type === "text");
    if (!textBlock?.text) {
      throw new Error("Anthropic API yanıtında metin bulunamadı.");
    }
    return textBlock.text;
  } finally {
    clearTimeout(timer);
  }
}
