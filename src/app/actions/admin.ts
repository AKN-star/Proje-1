"use server";

/**
 * Admin/mod eylemleri (T4, faz-3-moderasyon-admin.md). Her fonksiyon
 * session + requireModerator ile başlar; yetkisizse "/" e redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import type { Db } from "@/db";
import { experiences, reports, topics, users } from "@/db/schema";
import { requireModerator, type ModeratorActor } from "@/lib/admin/guard";
import { logModeration } from "@/lib/moderation/log";
import { recalcTopicStats } from "@/lib/stats/topic-stats";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireActor(db: Db): Promise<ModeratorActor> {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const actor = await requireModerator(db, session.user.id);
  if (!actor) {
    redirect("/");
  }
  return actor;
}

export async function approveExperience(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const experienceId = String(formData.get("experienceId") ?? "");
  if (!UUID_RE.test(experienceId)) {
    redirect("/admin");
  }

  const [experience] = await db
    .select({ id: experiences.id, topicId: experiences.topicId })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);
  if (!experience) {
    redirect("/admin");
  }

  await db
    .update(experiences)
    .set({ status: "published" })
    .where(eq(experiences.id, experienceId));

  await recalcTopicStats(db, experience.topicId);

  await logModeration(db, {
    targetType: "experience",
    targetId: experienceId,
    action: "mod_restore",
    actorType: "user",
    actorId: actor.id,
  });

  await revalidateAfterExperienceChange(db, experience.topicId);
}

export async function removeExperience(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const experienceId = String(formData.get("experienceId") ?? "");
  if (!UUID_RE.test(experienceId)) {
    redirect("/admin");
  }

  const [experience] = await db
    .select({ id: experiences.id, topicId: experiences.topicId })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);
  if (!experience) {
    redirect("/admin");
  }

  await db
    .update(experiences)
    .set({ status: "removed" })
    .where(eq(experiences.id, experienceId));

  await recalcTopicStats(db, experience.topicId);

  await logModeration(db, {
    targetType: "experience",
    targetId: experienceId,
    action: "mod_remove",
    actorType: "user",
    actorId: actor.id,
  });

  await revalidateAfterExperienceChange(db, experience.topicId);
}

export async function resolveReport(formData: FormData): Promise<void> {
  const db = await getDb();
  await requireActor(db);

  const reportId = String(formData.get("reportId") ?? "");
  if (!UUID_RE.test(reportId)) {
    redirect("/admin");
  }

  await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, reportId));

  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Kullanıcıyı banlar (users.bannedAt=now). Zaten banlıysa dokunmaz.
 * KARAR: moderation_log.action enum'unda ban için ayrı bir değer yok
 * ('mod_remove' anlam kaymasına yol açar) — spec T4 bunu açıkça 'mod_remove
 * DEĞİL' diye işaretliyor. Şema Faz 3 sözleşmesinde sabit ve bu worktree'den
 * migration'a dokunulamaz (CLAUDE.md NEVER). Bu yüzden ban eylemi
 * moderation_log'a hiç yazmaz; iz users.bannedAt kolonunun kendisidir.
 */
export async function banUser(formData: FormData): Promise<void> {
  const db = await getDb();
  await requireActor(db);

  const userId = String(formData.get("userId") ?? "");
  if (!UUID_RE.test(userId)) {
    redirect("/admin");
  }

  const [user] = await db
    .select({ id: users.id, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user && !user.bannedAt) {
    await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
  }

  revalidatePath("/admin");
  redirect("/admin");
}

async function revalidateAfterExperienceChange(db: Db, topicId: string): Promise<void> {
  const [topic] = await db
    .select({ slug: topics.slug })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);

  revalidatePath("/admin");
  if (topic) {
    revalidatePath(`/baslik/${topic.slug}`);
  }
  redirect("/admin");
}
