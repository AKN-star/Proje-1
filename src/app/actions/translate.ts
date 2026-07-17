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
import { isLocale } from "@/lib/locales";
import { appendQuery, safeInternalPath } from "@/lib/url";
import { UUID_RE } from "@/lib/validate";

const TARGET_TYPES = ["experience", "question", "answer"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

function isTargetType(value: string): value is TargetType {
  return (TARGET_TYPES as readonly string[]).includes(value);
}

export async function requestTranslation(formData: FormData): Promise<void> {
  const returnPath = safeInternalPath(formData.get("returnPath"));

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
      // Başlık ve gövde bağımsız — paralel çevrilir (yarı yarıya latency).
      const [titleText, bodyText] = await Promise.all([
        getOrCreateTranslation(db, {
          targetType: "question",
          targetId,
          field: "title",
          locale,
          sourceText: row.title,
        }),
        row.body
          ? getOrCreateTranslation(db, {
              targetType: "question",
              targetId,
              field: "body",
              locale,
              sourceText: row.body,
            })
          : Promise.resolve(""),
      ]);
      ok = titleText !== null && bodyText !== null;
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
    redirect(appendQuery(returnPath, "cevirHata=1"));
  }

  redirect(appendQuery(returnPath, `cevir=${targetType}:${targetId}&dil=${locale}`));
}
