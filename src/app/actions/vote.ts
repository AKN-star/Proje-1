"use server";

/**
 * Deneyim oylama server action'ı (T3, spec adım 2). Onboarding kontrolü
 * ŞART DEĞİL — oy sağlık verisi yayınlamaz (spec notu). Sıra: session
 * kontrolü → alan doğrulama → deneyim var + published kontrolü →
 * castVote → revalidate → redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { experiences } from "@/db/schema";
import { castVote } from "@/lib/votes/vote";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function voteExperience(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris");
  }

  const slug = String(formData.get("slug") ?? "");
  const experienceId = String(formData.get("experienceId") ?? "");
  const rawValue = String(formData.get("value") ?? "");

  if (!slug) {
    redirect("/");
  }

  const returnPath = `/baslik/${slug}`;

  if ((rawValue !== "1" && rawValue !== "-1") || !UUID_RE.test(experienceId)) {
    redirect(returnPath);
  }
  const value = rawValue === "1" ? 1 : -1;

  const db = await getDb();

  const [experience] = await db
    .select({ id: experiences.id })
    .from(experiences)
    .where(and(eq(experiences.id, experienceId), eq(experiences.status, "published")))
    .limit(1);
  if (!experience) {
    redirect(returnPath);
  }

  await castVote(db, session.user.id, "experience", experienceId, value);

  revalidatePath(returnPath);
  redirect(returnPath);
}
