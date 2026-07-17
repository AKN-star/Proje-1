import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import {
  CLAIMED_ROLES,
  CLAIMED_ROLE_LABELS,
  DOCUMENT_NOTE_MAX,
  INSTITUTION_MAX,
  getLatestBadgeRequest,
} from "@/lib/badges/requests";
import { requestBadge } from "@/app/actions/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

const inputClass =
  "border-input flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export default async function RozetBasvuruPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Frozet-basvuru");
  }

  const db = await getDb();
  const [profile, latest] = await Promise.all([
    getOnboardingProfile(db, session.user.id),
    getLatestBadgeRequest(db, session.user.id),
  ]);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Frozet-basvuru");
  }

  const { hata } = await searchParams;
  // Gerçeklik kaynağı users.pro_badge (createBadgeRequest'in kontrol
  // ettiği alan); başvuru satırı yalnız 'inceleniyor' durumunu belirler.
  // SQL ile rozet geri alınsa bile form yeniden açılır.
  const hasBadge = Boolean(profile?.proBadge);
  const hasPending = !hasBadge && latest?.status === "pending";
  const isBanned = Boolean(profile?.bannedAt);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Profesyonel rozet başvurusu
        </h1>
        <p className="text-sm text-muted-foreground">
          Doktor veya eczacıysanız beyanınızla başvurun; başvurunuz yönetici
          tarafından incelenir, onaylanırsa adınızın yanında ✔ rozeti görünür.
          Belge yüklenmez — gerekirse e-postayla ek bilgi istenir.
        </p>
      </div>

      {(hata === "1" || hata === "limit") && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {hata === "limit"
            ? "Çok sık başvuru yaptınız; lütfen bir süre sonra tekrar deneyin."
            : "Başvuru alınamadı. Alanları kontrol edin; bekleyen bir başvurunuz veya mevcut bir rozetiniz varsa yeni başvuru açılamaz."}
        </p>
      )}

      {isBanned ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Hesabınız askıya alındığı için rozet başvurusu yapamazsınız.
        </p>
      ) : hasBadge ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Rozetiniz onaylı — adınızın yanında ✔ olarak görünüyor.
        </p>
      ) : hasPending ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Başvurunuz inceleniyor. Sonuçlandığında rozet durumunuz bu sayfada
          ve Ayarlar&apos;da güncellenir.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Başvuru formu</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={requestBadge} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="claimedRole" className="text-sm font-medium">
                  Meslek
                </label>
                <select id="claimedRole" name="claimedRole" className={inputClass}>
                  {CLAIMED_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {CLAIMED_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="institution" className="text-sm font-medium">
                  Kurum
                </label>
                <input
                  id="institution"
                  name="institution"
                  required
                  maxLength={INSTITUTION_MAX}
                  placeholder="Çalıştığınız hastane / eczane / kurum"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="documentNote" className="text-sm font-medium">
                  Beyan
                </label>
                <textarea
                  id="documentNote"
                  name="documentNote"
                  required
                  rows={4}
                  maxLength={DOCUMENT_NOTE_MAX}
                  placeholder="Diploma/sicil numaranız ve doğrulamaya yardımcı bilgiler"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className={buttonVariants({ variant: "default", className: "w-fit" })}
              >
                Başvur
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
