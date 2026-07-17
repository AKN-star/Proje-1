import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { topics } from "@/db/schema";
import { siteUrl } from "@/lib/launch";

// Canlı DB verisi; istek anında üretilir (Faz 7 T2).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const db = await getDb();

  const activeTopics = await db
    .select({ slug: topics.slug })
    .from(topics)
    .where(eq(topics.status, "active"));

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/kvkk`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/kullanim-sartlari`, changeFrequency: "yearly", priority: 0.2 },
    ...activeTopics.map((topic) => ({
      url: `${base}/baslik/${topic.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
