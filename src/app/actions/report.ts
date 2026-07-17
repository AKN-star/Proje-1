"use server";

/**
 * Deneyim raporlama server action'ı (T3, faz-3-moderasyon-admin.md).
 * Sıra vote.ts kalıbını izler: session kontrolü → alan doğrulama →
 * deneyim var + published kontrolü → createReport → redirect. Sonuç
 * ok/duplicate farkı kullanıcıya gösterilmez (spec: "sessiz başarı").
 */
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { experiences } from "@/db/schema";
import { createReport, isValidReportReason } from "@/lib/reports/report";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile } from "@/lib/users/onboarding";
import { UUID_RE } from "@/lib/validate";

export async function reportExperience(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");

  const session = await auth();
  if (!session?.user) {
    redirect(
      slug ? `/giris?next=${encodeURIComponent(`/baslik/${slug}`)}` : "/giris",
    );
  }

  if (!slug) {
    redirect("/");
  }

  const returnPath = `/baslik/${slug}`;

  const experienceId = String(formData.get("experienceId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!UUID_RE.test(experienceId) || !isValidReportReason(reason)) {
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

  const [experience] = await db
    .select({ id: experiences.id })
    .from(experiences)
    .where(and(eq(experiences.id, experienceId), eq(experiences.status, "published")))
    .limit(1);
  if (!experience) {
    redirect(returnPath);
  }

  await createReport(db, session.user.id, "experience", experienceId, reason);

  redirect(`${returnPath}?bildirildi=1`);
}
