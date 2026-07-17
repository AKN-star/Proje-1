/**
 * Postgres-içi sliding window rate limiting (Faz 7 T1,
 * docs/specs/faz-7-yayin.md). Ayrı sayaç tablosu YOK — pencere, mevcut
 * içerik tablolarının created_at (+ user_id) alanları üzerinden COUNT
 * ile hesaplanır; kayıt zaten atomik yazıldığından ek durum tutulmaz.
 * Çeviri limiti globaldir (translations'ta user_id yok — sözleşme
 * değişmeden kullanıcı bazlı yapılamaz, spec kickoff notu).
 */
import { and, count, eq, gt } from "drizzle-orm";
import type { Db } from "@/db";
import {
  answers,
  badgeRequests,
  experiences,
  questions,
  reports,
  topics,
  translations,
} from "@/db/schema";

export type RateLimitKind =
  | "experience"
  | "question"
  | "answer"
  | "report"
  | "topic"
  | "badge"
  | "translation";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MINUTE = 60 * 1000;

/** kind → pencere (ms) ve tavan; spec'teki tek eşleme burası. `topic`
 * pencereli DEĞİLDİR (topics'te created_at yok — sözleşme): aynı anda en
 * fazla `maxPending` bekleyen öneri; onay/red pencereden düşürür. Tip bu
 * farkı taşır ki config bir pencere vaat edip etmediğini yalan söylemesin. */
export const RATE_LIMITS = {
  experience: { windowMs: HOUR, max: 5 },
  question: { windowMs: HOUR, max: 5 },
  answer: { windowMs: HOUR, max: 20 },
  report: { windowMs: HOUR, max: 10 },
  topic: { maxPending: 3 },
  badge: { windowMs: DAY, max: 3 },
  translation: { windowMs: MINUTE, max: 30 },
} as const satisfies Record<
  RateLimitKind,
  { windowMs: number; max: number } | { maxPending: number }
>;

/** Limit aşımında sayfalarda gösterilen tek mesaj (5 kopya olmasın). */
export const RATE_LIMIT_ERROR_MESSAGE =
  "Çok sık işlem yaptınız; lütfen bir süre sonra tekrar deneyin.";

/**
 * Pencere içindeki kayıt sayısı tavanın altındaysa true (izin) döner.
 * `translation` kind'ı user bazlı değildir; userId yok sayılır.
 */
export async function checkRateLimit(
  db: Db,
  userId: string,
  kind: RateLimitKind,
): Promise<boolean> {
  if (kind === "topic") {
    // Pencere yok: bekleyen öneri sayısı tavanı (bkz. RATE_LIMITS notu).
    const [row] = await db
      .select({ total: count() })
      .from(topics)
      .where(and(eq(topics.createdBy, userId), eq(topics.status, "pending")));
    return row.total < RATE_LIMITS.topic.maxPending;
  }

  const { windowMs, max } = RATE_LIMITS[kind];
  const since = new Date(Date.now() - windowMs);

  let total: number;
  switch (kind) {
    case "experience": {
      const [row] = await db
        .select({ total: count() })
        .from(experiences)
        .where(and(eq(experiences.userId, userId), gt(experiences.createdAt, since)));
      total = row.total;
      break;
    }
    case "question": {
      const [row] = await db
        .select({ total: count() })
        .from(questions)
        .where(and(eq(questions.userId, userId), gt(questions.createdAt, since)));
      total = row.total;
      break;
    }
    case "answer": {
      const [row] = await db
        .select({ total: count() })
        .from(answers)
        .where(and(eq(answers.userId, userId), gt(answers.createdAt, since)));
      total = row.total;
      break;
    }
    case "report": {
      const [row] = await db
        .select({ total: count() })
        .from(reports)
        .where(and(eq(reports.reporterId, userId), gt(reports.createdAt, since)));
      total = row.total;
      break;
    }
    case "badge": {
      const [row] = await db
        .select({ total: count() })
        .from(badgeRequests)
        .where(
          and(eq(badgeRequests.userId, userId), gt(badgeRequests.createdAt, since)),
        );
      total = row.total;
      break;
    }
    case "translation": {
      const [row] = await db
        .select({ total: count() })
        .from(translations)
        .where(gt(translations.createdAt, since));
      total = row.total;
      break;
    }
  }

  return total < max;
}
