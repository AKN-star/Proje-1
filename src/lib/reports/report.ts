/**
 * Kullanıcı raporlama çekirdeği (T3, spec faz-3-moderasyon-admin.md).
 * createReport insert eder; unique (reporter_id, target_type, target_id)
 * ihlalinde sessizce 'duplicate' döner (spec: "zaten bildirdiniz").
 */
import type { Db } from "@/db";
import { reports } from "@/db/schema";

export type ReportTargetType = "experience" | "question" | "answer";

export function isReportTargetType(value: string): value is ReportTargetType {
  return value === "experience" || value === "question" || value === "answer";
}
export type ReportReason =
  | "spam"
  | "medical_misinfo"
  | "personal_data"
  | "abuse"
  | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam / reklam" },
  { value: "medical_misinfo", label: "Tehlikeli/yanlış tıbbi bilgi" },
  { value: "personal_data", label: "Kişisel veri içeriyor" },
  { value: "abuse", label: "Hakaret / istismar" },
  { value: "other", label: "Diğer" },
];

const REPORT_REASON_VALUES = new Set<string>(REPORT_REASONS.map((r) => r.value));

export function isValidReportReason(value: string): value is ReportReason {
  return REPORT_REASON_VALUES.has(value);
}

export type CreateReportResult = "ok" | "duplicate";

/**
 * Rapor ekler. Aynı kullanıcı aynı hedefi ikinci kez raporlarsa (PG
 * 23505, unique reports_reporter_target) 'duplicate' döner; diğer
 * hatalar fırlatılır.
 */
export async function createReport(
  db: Db,
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
): Promise<CreateReportResult> {
  try {
    await db.insert(reports).values({ reporterId, targetType, targetId, reason });
    return "ok";
  } catch (err) {
    if (isUniqueViolation(err)) return "duplicate";
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}
