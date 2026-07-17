/**
 * Yayın anahtarı (Faz 7 T2, docs/specs/faz-7-yayin.md). SITE_LAUNCHED=1
 * olana kadar site arama motorlarına kapalıdır (noindex header +
 * metadata.robots + robots.txt disallow). Launch insan adımıdır: koda
 * dokunmadan Vercel'de env değiştirilir.
 */
export function isLaunched(): boolean {
  return process.env.SITE_LAUNCHED === "1";
}

/**
 * Mutlak URL üretimi (sitemap/robots). Öncelik: SITE_URL → Vercel'in
 * kendi prod domain env'i (insan SITE_LAUNCHED'ı açıp SITE_URL'ü
 * unutursa sitemap localhost göstermesin) → yerel geliştirme.
 */
export function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
