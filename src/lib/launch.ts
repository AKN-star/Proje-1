/**
 * Yayın anahtarı (Faz 7 T2, docs/specs/faz-7-yayin.md). SITE_LAUNCHED=1
 * olana kadar site arama motorlarına kapalıdır (noindex header +
 * metadata.robots + robots.txt disallow). Launch insan adımıdır: koda
 * dokunmadan Vercel'de env değiştirilir.
 */
export function isLaunched(): boolean {
  return process.env.SITE_LAUNCHED === "1";
}

/** Mutlak URL üretimi (sitemap/OG). Launch'ta gerçek domain'e döner. */
export function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}
