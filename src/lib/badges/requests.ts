/**
 * Profesyonel rozet başvurusu çekirdeği (Faz 6 T2,
 * docs/specs/faz-6-rozet-oauth.md). Belge yükleme yok — beyan
 * (institution + document_note); içerik yayınlanmaz, yalnız admin görür
 * (moderate() kapsamı dışı — kural #3 yayın API'lerini bağlar).
 */
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { badgeRequests, users } from "@/db/schema";

export const CLAIMED_ROLES = ["doctor", "pharmacist"] as const;
export type ClaimedRole = (typeof CLAIMED_ROLES)[number];

export function isClaimedRole(value: unknown): value is ClaimedRole {
  return CLAIMED_ROLES.includes(value as ClaimedRole);
}

export const INSTITUTION_MAX = 200;
export const DOCUMENT_NOTE_MAX = 2000;

export interface BadgeRequestInput {
  claimedRole: ClaimedRole;
  institution: string;
  documentNote: string;
}

export type CreateBadgeRequestResult =
  | { ok: true; id: string }
  | { ok: false; error: "invalid" | "pending" | "already" };

/**
 * Başvuru oluşturur. Guard'lar: alanlar dolu ve makul uzunlukta,
 * kullanıcının bekleyen başvurusu yok, kullanıcıda zaten rozet yok.
 */
export async function createBadgeRequest(
  db: Db,
  userId: string,
  input: BadgeRequestInput,
): Promise<CreateBadgeRequestResult> {
  const institution = input.institution.trim();
  const documentNote = input.documentNote.trim();
  if (
    !isClaimedRole(input.claimedRole) ||
    !institution ||
    institution.length > INSTITUTION_MAX ||
    !documentNote ||
    documentNote.length > DOCUMENT_NOTE_MAX
  ) {
    return { ok: false, error: "invalid" };
  }

  const [user] = await db
    .select({ proBadge: users.proBadge })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: "invalid" };
  if (user.proBadge) return { ok: false, error: "already" };

  const [pending] = await db
    .select({ id: badgeRequests.id })
    .from(badgeRequests)
    .where(
      and(eq(badgeRequests.userId, userId), eq(badgeRequests.status, "pending")),
    )
    .limit(1);
  if (pending) return { ok: false, error: "pending" };

  const [row] = await db
    .insert(badgeRequests)
    .values({ userId, claimedRole: input.claimedRole, institution, documentNote })
    .returning({ id: badgeRequests.id });
  return { ok: true, id: row.id };
}

/** Kullanıcının en güncel başvurusu (/rozet-basvuru ve /ayarlar durumu). */
export async function getLatestBadgeRequest(
  db: Db,
  userId: string,
): Promise<{ status: "pending" | "approved" | "rejected"; claimedRole: ClaimedRole } | null> {
  const [row] = await db
    .select({ status: badgeRequests.status, claimedRole: badgeRequests.claimedRole })
    .from(badgeRequests)
    .where(eq(badgeRequests.userId, userId))
    .orderBy(desc(badgeRequests.createdAt))
    .limit(1);
  return row ?? null;
}

export interface PendingBadgeRequestItem {
  id: string;
  username: string;
  email: string;
  claimedRole: ClaimedRole;
  institution: string;
  documentNote: string;
  createdAt: Date;
}

/** Admin paneli: bekleyen başvurular, en yeni üstte. */
export async function listPendingBadgeRequests(
  db: Db,
): Promise<PendingBadgeRequestItem[]> {
  const rows = await db
    .select({
      id: badgeRequests.id,
      username: users.username,
      email: users.email,
      claimedRole: badgeRequests.claimedRole,
      institution: badgeRequests.institution,
      documentNote: badgeRequests.documentNote,
      createdAt: badgeRequests.createdAt,
    })
    .from(badgeRequests)
    .innerJoin(users, eq(users.id, badgeRequests.userId))
    .where(eq(badgeRequests.status, "pending"))
    .orderBy(desc(badgeRequests.createdAt));

  return rows.map((row) => ({ ...row, username: row.username ?? "anonim" }));
}

/**
 * Bekleyen başvuruyu sonuçlandırır. approve: users.pro_badge =
 * claimed_role, role 'user' ise 'pro' (admin/mod düşürülmez). Yalnız
 * status='pending' kayda etki eder; değilse false döner.
 */
export async function reviewBadgeRequest(
  db: Db,
  requestId: string,
  reviewerId: string,
  decision: "approve" | "reject",
): Promise<boolean> {
  const [request] = await db
    .select({
      id: badgeRequests.id,
      userId: badgeRequests.userId,
      claimedRole: badgeRequests.claimedRole,
      status: badgeRequests.status,
    })
    .from(badgeRequests)
    .where(eq(badgeRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "pending") return false;

  await db
    .update(badgeRequests)
    .set({
      status: decision === "approve" ? "approved" : "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(badgeRequests.id, requestId));

  if (decision === "approve") {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);
    await db
      .update(users)
      .set({
        proBadge: request.claimedRole,
        role: target?.role === "user" ? "pro" : target?.role,
      })
      .where(eq(users.id, request.userId));
  }
  return true;
}
