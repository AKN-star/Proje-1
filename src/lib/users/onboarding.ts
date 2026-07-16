/**
 * Takma ad + KVKK onboarding çekirdeği (master plan: username NULL =
 * onboarding bekliyor; kvkk_consent_at rıza anı). Server action bu
 * fonksiyonları çağırır; testler doğrudan kullanır.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { users } from "@/db/schema";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/** null döner = geçerli; string döner = hata alanı kodu. */
export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) return "username";
  return null;
}

export interface OnboardingProfile {
  username: string | null;
  kvkkConsentAt: Date | null;
  bannedAt: Date | null;
}

/** Yazma eylemleri öncesi kontrol edilen profil alanları. */
export async function getOnboardingProfile(
  db: Db,
  userId: string,
): Promise<OnboardingProfile | null> {
  const [row] = await db
    .select({
      username: users.username,
      kvkkConsentAt: users.kvkkConsentAt,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export function isOnboarded(profile: OnboardingProfile | null): boolean {
  return Boolean(profile?.username && profile?.kvkkConsentAt);
}

/**
 * Takma adı ve KVKK rıza anını yazar. Username unique çakışmasında
 * "taken" döner (PG 23505); diğer hatalar fırlatılır.
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
  username: string,
): Promise<"ok" | "taken"> {
  try {
    await db
      .update(users)
      .set({ username, kvkkConsentAt: new Date() })
      .where(eq(users.id, userId));
    return "ok";
  } catch (err) {
    if (isUniqueViolation(err)) return "taken";
    throw err;
  }
}

export function isUniqueViolation(err: unknown): boolean {
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
