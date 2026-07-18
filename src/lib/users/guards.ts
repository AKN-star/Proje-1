/**
 * Yazma action'larının ortak guard zinciri (Faz 10 T2 — üç review'dur
 * işaretlenen sürüklenmenin kapanışı): session → onboarding → ban.
 * Her action guard setini açık parametrelerle seçer; kopyala-yapıştır
 * sırası hatası mümkün olmaz. profile.ts bilinçli istisnadır (KVKK
 * hakları — dosyasında kayıtlı).
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import type { Db } from "@/db";
import {
  getOnboardingProfile,
  isOnboarded,
  type OnboardingProfile,
} from "@/lib/users/onboarding";

export interface OnboardedUserContext {
  db: Db;
  userId: string;
  profile: OnboardingProfile;
}

/**
 * Girişli + onboarded + banlı olmayan kullanıcıyı döner; aksi durumda
 * redirect eder (fonksiyon geri dönmez).
 * - girişsiz → /giris?next=<next>
 * - onboarding eksik → /hosgeldin?next=<next>
 * - banlı → onBannedRedirect (action'ın kendi hata sayfası/flash'i)
 */
export async function requireOnboardedUser(
  next: string,
  onBannedRedirect: string,
): Promise<OnboardedUserContext> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/giris?next=${encodeURIComponent(next)}`);
  }

  const db = await getDb();
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile) || !profile) {
    redirect(`/hosgeldin?next=${encodeURIComponent(next)}`);
  }
  if (profile.bannedAt) {
    redirect(onBannedRedirect);
  }

  return { db, userId: session.user.id, profile };
}
