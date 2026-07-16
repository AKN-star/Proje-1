"use server";

/**
 * Çeviri talebi server action'ı (Faz 5 T2, docs/specs/faz-5-cok-dillilik.md).
 * Kalıp diğer action'larla (qa.ts, report.ts) birebir: session →
 * onboarding+ban guard → doğrulama → hedef satır + published kontrolü →
 * getOrCreateTranslation → redirect.
 */
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { answers, experiences, questions } from "@/db/schema";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { getOrCreateTranslation } from "@/lib/translations/cache";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TARGET_TYPES = ["experience", "question", "answer"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

const LOCALES = ["tr", "en"] as const;
type Locale = (typeof LOCALES)[number];

function isTargetType(value: string): value is TargetType {
  return (TARGET_TYPES as readonly string[]).includes(value);
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Açık yönlendirme koruması: yalnız site-içi göreli yol kabul edilir. */
function safeReturnPath(raw: string): string {
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

export async function requestTranslation(formData: FormData): Promise<void> {
  const rawReturnPath = String(formData.get("returnPath") ?? "");
  const returnPath = safeReturnPath(rawReturnPath);

  const session = await auth();
  if (!session?.user) {
    redirect(`/giris?next=${encodeURIComponent(returnPath)}`);
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(returnPath)}`);
  }

  if (profile?.bannedAt) {
    redirect(returnPath);
  }

  const targetTypeRaw = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const localeRaw = String(formData.get("locale") ?? "");

  if (
    !isTargetType(targetTypeRaw) ||
    !UUID_RE.test(targetId) ||
    !isLocale(localeRaw)
  ) {
    redirect(returnPath);
  }
  const targetType = targetTypeRaw;
  const locale = localeRaw;

  let ok = false;

  if (targetType === "experience") {
    const [row] = await db
      .select({ body: experiences.body })
      .from(experiences)
      .where(and(eq(experiences.id, targetId), eq(experiences.status, "published")))
      .limit(1);
    if (row) {
      const text = await getOrCreateTranslation(db, {
        targetType: "experience",
        targetId,
        field: "body",
        locale,
        sourceText: row.body,
      });
      ok = text !== null;
    }
  } else if (targetType === "question") {
    const [row] = await db
      .select({ title: questions.title, body: questions.body })
      .from(questions)
      .where(and(eq(questions.id, targetId), eq(questions.status, "published")))
      .limit(1);
    if (row) {
      const titleText = await getOrCreateTranslation(db, {
        targetType: "question",
        targetId,
        field: "title",
        locale,
        sourceText: row.title,
      });
      let bodyOk = true;
      if (row.body) {
        const bodyText = await getOrCreateTranslation(db, {
          targetType: "question",
          targetId,
          field: "body",
          locale,
          sourceText: row.body,
        });
        bodyOk = bodyText !== null;
      }
      ok = titleText !== null && bodyOk;
    }
  } else {
    const [row] = await db
      .select({ body: answers.body })
      .from(answers)
      .where(and(eq(answers.id, targetId), eq(answers.status, "published")))
      .limit(1);
    if (row) {
      const text = await getOrCreateTranslation(db, {
        targetType: "answer",
        targetId,
        field: "body",
        locale,
        sourceText: row.body,
      });
      ok = text !== null;
    }
  }

  if (!ok) {
    redirect(`${returnPath}?cevirHata=1`);
  }

  redirect(`${returnPath}?cevir=${targetType}:${targetId}&dil=${locale}`);
}
