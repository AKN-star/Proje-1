"use server";

/**
 * Kullanıcı ayarları server action'ı (Faz 5 T3, docs/specs/faz-5-cok-dillilik.md).
 * Kalıp diğer action'larla (onboarding.ts, translate.ts) birebir: session
 * → onboarding guard → doğrulama → users.locale güncelle → revalidate →
 * redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";

const LOCALES = ["tr", "en"] as const;
type Locale = (typeof LOCALES)[number];

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export async function updateLocale(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fayarlar");
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Fayarlar");
  }

  const localeRaw = String(formData.get("locale") ?? "");
  if (!isLocale(localeRaw)) {
    redirect("/ayarlar");
  }

  await db.update(users).set({ locale: localeRaw }).where(eq(users.id, session.user.id));

  revalidatePath("/ayarlar");
  redirect("/ayarlar?kaydedildi=1");
}
