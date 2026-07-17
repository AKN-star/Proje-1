import type { MetadataRoute } from "next";
import { isLaunched, siteUrl } from "@/lib/launch";

// Launch anahtarına bağlı: yayın öncesi tümü kapalı (Faz 7 T2).
export default function robots(): MetadataRoute.Robots {
  if (!isLaunched()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/ayarlar", "/hosgeldin", "/giris"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
