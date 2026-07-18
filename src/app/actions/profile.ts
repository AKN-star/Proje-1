"use server";

/**
 * Profil eylemleri (Faz 8 T1): kendi içeriğini kaldırma + hesap silme
 * (anonimleştirme). Kalıp diğer action'larla birebir: session →
 * doğrulama → çekirdek → revalidate → redirect.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { getDb } from "@/db";
import { anonymizeAccount, removeOwnContent } from "@/lib/users/my-content";
import { UUID_RE } from "@/lib/validate";

const KINDS = ["experience", "question", "answer"] as const;
type Kind = (typeof KINDS)[number];

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export async function removeMyContent(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fprofil");
  }

  const kind = String(formData.get("kind") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!isKind(kind) || !UUID_RE.test(targetId)) {
    redirect("/profil");
  }

  const db = await getDb();
  const affectedPath = await removeOwnContent(db, session.user.id, kind, targetId);

  if (affectedPath) {
    revalidatePath(affectedPath);
  }
  revalidatePath("/profil");
  redirect("/profil?kaldirildi=1");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fprofil");
  }

  // Yanlış tık koruması: onay kutusu işaretli gelmek zorunda.
  if (formData.get("onay") !== "1") {
    redirect("/profil?hata=onay");
  }

  const db = await getDb();
  await anonymizeAccount(db, session.user.id);

  // Geçerli oturum da dahil hepsi kapatıldı; çerezi de düşür.
  await signOut({ redirectTo: "/" });
}
