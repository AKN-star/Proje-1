/** Ortak giriş doğrulama desenleri. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** LIKE/ILIKE jokerlerini kaçırır (%%% tüm tabloyu döndürmesin) —
 * arama ve admin araması aynı semantiği paylaşır (Faz 9). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** ?sayfa= param'ını güvenli sayfa numarasına çevirir (tek kaynak). */
export function parsePage(raw: string | undefined): number {
  return Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
}
