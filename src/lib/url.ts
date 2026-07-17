/**
 * Site-içi yönlendirme yardımcıları. Kullanıcıdan gelen her ?next= /
 * returnPath değeri buradan geçer: '/' ile başlamalı, '//' ile
 * başlamamalı ve '\' içermemeli (tarayıcılar '\'yi '/'ye çevirdiğinden
 * '/\evil.com' protokolsüz açık yönlendirmeye dönüşür).
 */
export function safeInternalPath(raw: unknown, fallback = "/"): string {
  const value = String(raw ?? "");
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return fallback;
}

/** Path'te query olup olmadığına göre '?' veya '&' ile param ekler. */
export function appendQuery(path: string, query: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/**
 * Verilen kalıcı query param'larını koruyarak dönüş yolunu kurar.
 * Tek seferlik flash param'lar (bildirildi, hata, cevirHata...) buraya
 * verilmez — dönüş sonrası bayat banner göstermesinler.
 */
export function buildReturnPath(
  pathname: string,
  searchParams: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (!value) continue;
    sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
