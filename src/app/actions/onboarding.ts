"use server";

/**
 * Takma ad + KVKK onboarding server action'ı. Master plan: yazma
 * eylemleri username ve kvkk_consent_at dolmadan mümkün olmaz.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  completeOnboarding,
  validateUsername,
} from "@/lib/users/onboarding";

/** Açık redirect'i engelle: yalnız site içi yollar. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function submitOnboarding(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris");
  }

  const next = safeNext(formData.get("next"));
  const returnPath = `/hosgeldin?next=${encodeURIComponent(next)}`;

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  if (validateUsername(username) !== null) {
    redirect(`${returnPath}&hata=username`);
  }

  // KVKK açık rızası zorunlu (sağlık verisi = özel nitelikli veri).
  if (formData.get("kvkk") !== "on") {
    redirect(`${returnPath}&hata=kvkk`);
  }

  const db = await getDb();
  const result = await completeOnboarding(db, session.user.id, username);
  if (result === "taken") {
    redirect(`${returnPath}&hata=alinmis`);
  }

  redirect(next);
}
