import { ImageResponse } from "next/og";
import { getDb } from "@/db";
import { getTopicMeta } from "@/lib/queries/topics";
import { getTopicStats } from "@/lib/stats/topic-stats";
import { eq } from "drizzle-orm";
import { topics } from "@/db/schema";
import { brand } from "@/config/brand";

/**
 * Başlık sayfası OG görseli (Faz 9 T5) — next/og (yerleşik, yeni
 * bağımlılık yok). Ad + deneyim sayısı + ortalama puan.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Başlık özeti";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();
  const meta = await getTopicMeta(db, slug);

  let statsLine = "";
  if (meta) {
    const [topic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);
    const stats = topic ? await getTopicStats(db, topic.id) : null;
    if (stats && stats.experienceCount > 0) {
      statsLine = `${stats.experienceCount} deneyim${
        stats.avgEffectiveness
          ? ` · ortalama etki ${stats.avgEffectiveness.toFixed(1)}/5`
          : ""
      }`;
    }
  }

  const name = meta ? meta.name ?? meta.canonicalName : brand.name;

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
