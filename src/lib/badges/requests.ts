/**
 * Profesyonel rozet başvurusu çekirdeği (Faz 6 T2,
 * docs/specs/faz-6-rozet-oauth.md). Belge yükleme yok — beyan
 * (institution + document_note); içerik yayınlanmaz, yalnız admin görür
 * (moderate() kapsamı dışı — kural #3 yayın API'lerini bağlar).
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { badgeRequests, users } from "@/db/schema";

export const CLAIMED_ROLES = ["doctor", "pharmacist"] as const;
export type ClaimedRole = (typeof CLAIMED_ROLES)[number];

/** Rol sözlüğünün Türkçe etiketleri — tek sahip burası (admin paneli,
 * başvuru formu ve rozet bileşeni buradan türetir). */
export const CLAIMED_ROLE_LABELS: Record<ClaimedRole, string> = {
  doctor: "Doktor",
  pharmacist: "Eczacı",
};

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

  const [[user], [pending]] = await Promise.all([
    db
      .select({ proBadge: users.proBadge })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ id: badgeRequests.id })
      .from(badgeRequests)
      .where(
        and(eq(badgeRequests.userId, userId), eq(badgeRequests.status, "pending")),
      )
      .limit(1),
  ]);
  if (!user) return { ok: false, error: "invalid" };
  if (user.proBadge) return { ok: false, error: "already" };
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
 * claimed_role, role 'user' ise 'pro' (admin/mod düşürülmez). Tek
 * geçişlilik DB derinliğinde: koşullu UPDATE ... WHERE status='pending'
 * — eşzamanlı onay/red yarışında yalnız ilk karar işlenir, ikincisi
 * false döner (Faz 4 slug yarışı deseniyle aynı yaklaşım).
 */
export async function reviewBadgeRequest(
  db: Db,
  requestId: string,
  reviewerId: string,
  decision: "approve" | "reject",
): Promise<boolean> {
  const [updated] = await db
    .update(badgeRequests)
    .set({
      status: decision === "approve" ? "approved" : "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(
      and(eq(badgeRequests.id, requestId), eq(badgeRequests.status, "pending")),
    )
    .returning({
      userId: badgeRequests.userId,
      claimedRole: badgeRequests.claimedRole,
    });
  if (!updated) return false;

  if (decision === "approve") {
    // Rol tek koşullu UPDATE ile: read-modify-write yarışı yok, tek
    // round-trip (eşzamanlı admin:grant bayat rolle ezilmez).
    await db
      .update(users)
      .set({
        proBadge: updated.claimedRole,
        role: sql`CASE WHEN ${users.role} = 'user' THEN 'pro' ELSE ${users.role} END`,
      })
      .where(eq(users.id, updated.userId));
  }
  return true;
}
