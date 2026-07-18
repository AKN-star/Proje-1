"use server";

/**
 * İçerik raporlama server action'ı (Faz 3 T3; Faz 10'da deneyim/soru/
 * yanıt için generic'leşti — davranış birebir: sessiz başarı, sessiz
 * limit). Hedefin published olduğu tür bazında doğrulanır.
 */
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import type { Db } from "@/db";
import { answers, experiences, questions } from "@/db/schema";
import {
  createReport,
  isReportTargetType,
  isValidReportReason,
  type ReportTargetType,
} from "@/lib/reports/report";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile } from "@/lib/users/onboarding";
import { UUID_RE } from "@/lib/validate";
import { appendQuery, safeInternalPath } from "@/lib/url";

async function targetIsPublished(
  db: Db,
  targetType: ReportTargetType,
  targetId: string,
): Promise<boolean> {
  if (targetType === "experience") {
    const [row] = await db
      .select({ id: experiences.id })
      .from(experiences)
      .where(and(eq(experiences.id, targetId), eq(experiences.status, "published")))
      .limit(1);
    return Boolean(row);
  }
  if (targetType === "question") {
    const [row] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, targetId), eq(questions.status, "published")))
      .limit(1);
    return Boolean(row);
  }
  const [row] = await db
    .select({ id: answers.id })
    .from(answers)
    .where(and(eq(answers.id, targetId), eq(answers.status, "published")))
    .limit(1);
  return Boolean(row);
}

export async function reportContent(formData: FormData): Promise<void> {
  const returnPath = safeInternalPath(formData.get("returnPath"));

  const session = await auth();
  if (!session?.user) {
    redirect(`/giris?next=${encodeURIComponent(returnPath)}`);
  }

  const targetTypeRaw = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (
    !isReportTargetType(targetTypeRaw) ||
    !UUID_RE.test(targetId) ||
    !isValidReportReason(reason)
  ) {
    redirect(returnPath);
  }

  const db = await getDb();

  // Banlı kullanıcının rapor spam'i admin kuyruğunu kirletmesin.
  const profile = await getOnboardingProfile(db, session.user.id);
  if (profile?.bannedAt) {
    redirect(returnPath);
  }

  // Rapor akışı "sessiz başarı" ilkesinde — limit aşımı da sessiz döner.
  if (!(await checkRateLimit(db, session.user.id, "report"))) {
    redirect(returnPath);
  }

  if (!(await targetIsPublished(db, targetTypeRaw, targetId))) {
    redirect(returnPath);
  }

  await createReport(db, session.user.id, targetTypeRaw, targetId, reason);

  redirect(appendQuery(returnPath, "bildirildi=1"));
}
