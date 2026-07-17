"use server";

/**
 * Rozet başvurusu server action'ı (Faz 6 T2, docs/specs/faz-6-rozet-oauth.md).
 * Kalıp settings.ts ile birebir: session → onboarding guard → çekirdek
 * (createBadgeRequest) → e-posta bildirimi → redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { createBadgeRequest, isClaimedRole } from "@/lib/badges/requests";
import { sendBadgeRequestNotice } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";

export async function requestBadge(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Frozet-basvuru");
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Frozet-basvuru");
  }
  if (profile?.bannedAt) {
    redirect("/rozet-basvuru?hata=1");
  }

  if (!(await checkRateLimit(db, session.user.id, "badge"))) {
    redirect("/rozet-basvuru?hata=limit");
  }

  const claimedRole = String(formData.get("claimedRole") ?? "");
  const institution = String(formData.get("institution") ?? "");
  const documentNote = String(formData.get("documentNote") ?? "");
  if (!isClaimedRole(claimedRole)) {
    redirect("/rozet-basvuru?hata=1");
  }

  const result = await createBadgeRequest(db, session.user.id, {
    claimedRole,
    institution,
    documentNote,
  });
  if (!result.ok) {
    redirect("/rozet-basvuru?hata=1");
  }

  // Bildirim başvurudan sonra; hata sendBadgeRequestNotice içinde
  // yutulur (kayıt DB'de, admin panelde görünür).
  await sendBadgeRequestNotice({
    username: profile?.username ?? "anonim",
    claimedRole,
    institution: institution.trim(),
  });

  revalidatePath("/rozet-basvuru");
  revalidatePath("/ayarlar");
  redirect("/ayarlar?rozet=alindi");
}
