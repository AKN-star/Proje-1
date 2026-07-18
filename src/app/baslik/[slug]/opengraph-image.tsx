import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getTopicStats } from "@/lib/stats/topic-stats";
import { and, eq } from "drizzle-orm";
import { topicI18n, topics } from "@/db/schema";
import { brand } from "@/config/brand";

/**
 * Başlık sayfası OG görseli (Faz 9 T5) — next/og (yerleşik, yeni
 * bağımlılık yok). Ad + deneyim sayısı + ortalama puan. Crawler'lar
 * sık çeker — görsel saatte bir yeniden üretilir (revalidate).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Başlık özeti";
export const revalidate = 3600;

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();

  // Tek sorguda id + ad (review: getTopicMeta id düşürüyordu, ikinci
  // select israftı); bilinmeyen slug sayfayla aynı davranışla 404.
  const [topic] = await db
    .select({ id: topics.id, canonicalName: topics.canonicalName, name: topicI18n.name })
    .from(topics)
    .leftJoin(
      topicI18n,
      and(eq(topicI18n.topicId, topics.id), eq(topicI18n.locale, "tr")),
    )
    .where(and(eq(topics.slug, slug), eq(topics.status, "active")))
    .limit(1);
  if (!topic) {
    notFound();
  }

  const stats = await getTopicStats(db, topic.id);
  const statsLine =
    stats && stats.experienceCount > 0
      ? `${stats.experienceCount} deneyim${
          stats.avgEffectiveness
            ? ` · ortalama etki ${stats.avgEffectiveness.toFixed(1)}/5`
            : ""
        }`
      : "";

  const name = topic.name ?? topic.canonicalName;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 16 }}>
          {brand.name}
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
          {name}
        </div>
        {statsLine && (
          <div style={{ fontSize: 36, color: "#38bdf8", marginTop: 28 }}>
            {statsLine}
          </div>
        )}
        <div style={{ fontSize: 24, color: "#a1a1aa", marginTop: 40 }}>
          Gerçek kullanıcı deneyimleri ve istatistikleri
        </div>
      </div>
    ),
    size,
  );
}
