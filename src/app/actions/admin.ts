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
import { reviewBadgeRequest } from "@/lib/badges/requests";
import { logModeration } from "@/lib/moderation/log";
import { recalcTopicStats } from "@/lib/stats/topic-stats";
import { UUID_RE } from "@/lib/validate";

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

  // Yalnız kuyruktaki (flagged/pending) ya da kaldırılmış kayıt geri
  // yayınlanabilir; zaten published olana no-op.
  const [experience] = await db
    .select({ id: experiences.id, topicId: experiences.topicId, status: experiences.status })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);
  if (!experience || experience.status === "published") {
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
    .select({ id: experiences.id, topicId: experiences.topicId, status: experiences.status })
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);
  if (!experience || experience.status === "removed") {
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
 * Kullanıcıyı banlar (users.bannedAt=now) ve 'mod_ban' logu yazar
 * (enum Faz 4'te genişletildi — Faz 3 sapma notunun kapanışı).
 * Zaten banlıysa dokunmaz.
 */
export async function banUser(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const userId = String(formData.get("userId") ?? "");
  if (!UUID_RE.test(userId)) {
    redirect("/admin");
  }

  const [user] = await db
    .select({ id: users.id, bannedAt: users.bannedAt, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Kendini veya başka bir mod/admin'i banlamak panelden mümkün olmasın
  // (yanlış tık koruması; rol düşürme ayrı bir insan kararıdır).
  if (user && (user.id === actor.id || user.role === "mod" || user.role === "admin")) {
    redirect("/admin");
  }

  if (user && !user.bannedAt) {
    await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
    await logModeration(db, {
      targetType: "user",
      targetId: userId,
      action: "mod_ban",
      actorType: "user",
      actorId: actor.id,
    });
  }

  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Bekleyen bir başlık önerisini onaylar (status→'active'). Yalnız
 * status='pending' olan kayda etki eder (T4, spec adım 1: admin'e
 * "Başlık önerileri" bölümü).
 */
export async function approveTopic(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const topicId = String(formData.get("topicId") ?? "");
  if (!UUID_RE.test(topicId)) {
    redirect("/admin");
  }

  const [topic] = await db
    .select({ id: topics.id, status: topics.status })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  if (!topic || topic.status !== "pending") {
    redirect("/admin");
  }

  await db.update(topics).set({ status: "active" }).where(eq(topics.id, topicId));

  await logModeration(db, {
    targetType: "topic",
    targetId: topicId,
    action: "mod_restore",
    detail: { note: "topic-proposal" },
    actorType: "user",
    actorId: actor.id,
  });

  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Bekleyen bir başlık önerisini reddeder (status→'rejected'). Yalnız
 * status='pending' olan kayda etki eder.
 */
export async function rejectTopic(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const topicId = String(formData.get("topicId") ?? "");
  if (!UUID_RE.test(topicId)) {
    redirect("/admin");
  }

  const [topic] = await db
    .select({ id: topics.id, status: topics.status })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  if (!topic || topic.status !== "pending") {
    redirect("/admin");
  }

  await db.update(topics).set({ status: "rejected" }).where(eq(topics.id, topicId));

  await logModeration(db, {
    targetType: "topic",
    targetId: topicId,
    action: "mod_remove",
    detail: { note: "topic-proposal" },
    actorType: "user",
    actorId: actor.id,
  });

  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Bekleyen bir rozet başvurusunu sonuçlandırır (Faz 6 T3). Onay/red
 * mantığı çekirdekte (reviewBadgeRequest); yalnız pending kayda etki eder.
 */
export async function reviewBadge(formData: FormData): Promise<void> {
  const db = await getDb();
  const actor = await requireActor(db);

  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!UUID_RE.test(requestId) || (decision !== "approve" && decision !== "reject")) {
    redirect("/admin");
  }

  await reviewBadgeRequest(db, requestId, actor.id, decision);

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
