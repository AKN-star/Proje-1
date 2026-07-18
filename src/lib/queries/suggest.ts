/**
 * "Şunu mu demek istediniz?" önerisi (Faz 8 T5). pg_trgm bilinçli
 * kullanılmıyor (PGlite test ortamı + bağımlılık riski — spec kararı);
 * sıfır sonuçta aktif başlık adları üzerinde JS Levenshtein koşulur.
 * TİTCK importu sonrası ölçek sorun olursa pg_trgm'e geçilir.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { topicI18n, topics } from "@/db/schema";

/** Klasik iki satırlı Levenshtein; kısa ilaç adları için yeterli. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = current;
  }
  return prev[b.length];
}

export interface TopicSuggestion {
  slug: string;
  name: string;
}

/** Normalize edilmiş mesafe eşiği: uzunluğun %40'ı (en az 1). */
const THRESHOLD_RATIO = 0.4;
const MAX_SUGGESTIONS = 3;

/**
 * Sorguya en yakın aktif başlıkları döner (en yakın önce, en fazla 3).
 * Karşılaştırma Türkçe küçük harfle; ad ve kanonik adın iyi olanı
 * kullanılır. Eşiği aşan hiçbir aday yoksa boş liste.
 */
export async function suggestTopics(db: Db, q: string): Promise<TopicSuggestion[]> {
  const needle = q.trim().toLocaleLowerCase("tr-TR");
  if (needle.length < 3) return [];

  const rows = await db
    .select({ slug: topics.slug, canonicalName: topics.canonicalName, name: topicI18n.name })
    .from(topics)
    .leftJoin(topicI18n, eq(topicI18n.topicId, topics.id))
    .where(eq(topics.status, "active"));

  const threshold = Math.max(1, Math.floor(needle.length * THRESHOLD_RATIO));

  const bySlug = new Map<string, { name: string; distance: number }>();
  for (const row of rows) {
    const display = row.name ?? row.canonicalName;
    const candidates = [row.canonicalName, row.name].filter(
      (v): v is string => Boolean(v),
    );
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      best = Math.min(best, levenshtein(needle, candidate.toLocaleLowerCase("tr-TR")));
    }
    if (best > threshold) continue;
    const existing = bySlug.get(row.slug);
    if (!existing || best < existing.distance) {
      bySlug.set(row.slug, { name: display, distance: best });
    }
  }

  return [...bySlug.entries()]
    .sort((a, b) => a[1].distance - b[1].distance)
    .slice(0, MAX_SUGGESTIONS)
    .map(([slug, { name }]) => ({ slug, name }));
}
