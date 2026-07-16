/**
 * Kullanıcı başlık önerisi çekirdeği (T4, spec adım 1). Saf insert —
 * moderasyon/doğrulama BURADA yapılmaz; çağıran taraf (server action)
 * sorumludur (bkz. src/lib/qa/questions.ts kalıbı).
 */
import { eq, like } from "drizzle-orm";
import type { Db } from "@/db";
import { topicI18n, topics } from "@/db/schema";
import { isUniqueViolation } from "@/lib/users/onboarding";
import type { TopicProposalInput } from "@/lib/validation/topic";

export type TopicStatus = "active" | "pending" | "rejected";

export interface ProposeTopicResult {
  id: string;
  slug: string;
  status: TopicStatus;
}

const TURKISH_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

/**
 * Başlık adından slug üretir: küçük harf, Türkçe karakter dönüşümü
 * (ç→c ğ→g ı→i ö→o ş→s ü→u), harf/rakam dışı her şey tireye çevrilir,
 * baştaki/sondaki tireler kırpılır.
 */
export function slugify(name: string): string {
  const transliterated = name
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("");

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Verilen taban slug ile çakışmayan bir slug üretir; çakışmada -2, -3...
 * eki eklenir (topics tablosunda sırayla kontrol edilir).
 */
async function resolveUniqueSlug(db: Db, baseSlug: string): Promise<string> {
  const existing = await db
    .select({ slug: topics.slug })
    .from(topics)
    .where(like(topics.slug, `${baseSlug}%`));

  const taken = new Set(existing.map((row) => row.slug));

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let n = 2;
  while (taken.has(`${baseSlug}-${n}`)) {
    n += 1;
  }
  return `${baseSlug}-${n}`;
}

/**
 * Kullanıcı başlık önerisini `topics` (status ile) + `topic_i18n` (tr)
 * satırı olarak ekler. `status` çağıran tarafça belirlenir (spec: her
 * zaman 'pending' — moderasyon verdict'inden bağımsız, admin onayı
 * bekler).
 */
export async function proposeTopic(
  db: Db,
  input: TopicProposalInput,
  userId: string,
  status: TopicStatus,
): Promise<ProposeTopicResult> {
  const baseSlug = slugify(input.name);
  if (baseSlug === "") {
    // Doğrulayıcı da reddediyor; burada savunma amaçlı ikinci kapı —
    // boş slug asla topics'e yazılmamalı ("/baslik/" kırık rota olur).
    throw new Error("Başlık adından geçerli bir slug üretilemedi.");
  }

  // Eşzamanlı aynı-adlı önerilerde check-then-insert yarışı unique
  // ihlaline düşebilir; ihlalde slug yeniden çözülüp tekrar denenir.
  let topicRow: { id: string } | undefined;
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5 && !topicRow; attempt++) {
    slug = await resolveUniqueSlug(db, baseSlug);
    try {
      [topicRow] = await db
        .insert(topics)
        .values({
          slug,
          type: input.type,
          status,
          createdBy: userId,
          canonicalName: input.name,
        })
        .returning({ id: topics.id });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  if (!topicRow) {
    throw new Error("Başlık önerisi eklenemedi.");
  }

  await db.insert(topicI18n).values({
    topicId: topicRow.id,
    locale: "tr",
    name: input.name,
    summary: input.summary,
  });

  return { id: topicRow.id, slug, status };
}

/** Bekleyen (status='pending') bir başlık önerisinin durumunu değiştirir. */
export async function setTopicStatus(
  db: Db,
  topicId: string,
  status: TopicStatus,
): Promise<void> {
  await db.update(topics).set({ status }).where(eq(topics.id, topicId));
}
