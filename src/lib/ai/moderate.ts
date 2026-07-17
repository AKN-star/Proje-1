/**
 * Moderasyon sözleşmesi (kritik kural #3, docs/specs/faz-1-yuruyen-iskelet.md T2).
 *
 * Bu imza Faz 3'e kadar SABİTTİR: `moderate(content, kind) ->
 * {verdict, reasons}`. Faz 1'de gerçek bir AI çağrısı yapılmaz; her zaman
 * `{verdict: 'ok', reasons: []}` döner (no-op stub). Faz 3'te bu fonksiyonun
 * içi gerçek bir AI moderasyon çağrısıyla değiştirilecek; çağıran taraflar
 * (örn. deneyim yazma server action'ı) bu imzaya göre kodlanmalı ve
 * değişmemeli.
 *
 * Davranış sözleşmesi: AI çağrısı timeout olursa (Faz 3+) `moderate` hata
 * fırlatmaz; çağıran taraf bu durumda içeriği 'pending' status'üyle
 * kaydeder ve insan incelemesine bırakır. Faz 1'de timeout senaryosu
 * mevcut değildir çünkü gerçek bir çağrı yapılmıyor.
 */

export type ModerationKind = "experience" | "question" | "answer";

export type ModerationVerdict = "ok" | "flag" | "block";

export interface ModerationResult {
  verdict: ModerationVerdict;
  reasons: string[];
}

export async function moderate(
  content: string,
  kind: ModerationKind,
): Promise<ModerationResult> {
  void content;
  void kind;
  return { verdict: "ok", reasons: [] };
}
