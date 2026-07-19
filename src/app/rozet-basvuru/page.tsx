import { FlashBanner } from "@/components/flash-banner";
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
import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
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
        <FlashBanner tone="error">
          {hata === "limit"
            ? RATE_LIMIT_ERROR_MESSAGE
            : "Başvuru alınamadı. Alanları kontrol edin; bekleyen bir başvurunuz veya mevcut bir rozetiniz varsa yeni başvuru açılamaz."}
        </FlashBanner>
      )}

      {isBanned ? (
        <FlashBanner tone="error">
          Hesabınız askıya alındığı için rozet başvurusu yapamazsınız.
        </FlashBanner>
      ) : hasBadge ? (
        <FlashBanner>Rozetiniz onaylı — adınızın yanında ✔ olarak görünüyor.</FlashBanner>
      ) : hasPending ? (
        <FlashBanner tone="info">
          Başvurunuz inceleniyor. Sonuçlandığında rozet durumunuz bu sayfada
          ve Ayarlar&apos;da güncellenir.
        </FlashBanner>
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
