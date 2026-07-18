import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { normalizeLocale } from "@/lib/locales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { updateEmailPref, updateLocale } from "@/app/actions/settings";
import { getLatestBadgeRequest } from "@/lib/badges/requests";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<{ kaydedildi?: string; rozet?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fayarlar");
  }

  const db = await getDb();
  const [profile, badgeRequest] = await Promise.all([
    getOnboardingProfile(db, session.user.id),
    getLatestBadgeRequest(db, session.user.id),
  ]);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Fayarlar");
  }

  const { kaydedildi, rozet } = await searchParams;

  const currentLocale = normalizeLocale(profile?.locale);
  // Gerçeklik kaynağı users.pro_badge; başvuru satırı yalnız
  // 'inceleniyor' bilgisini verir (bkz. /rozet-basvuru notu).
  const hasBadge = Boolean(profile?.proBadge);
  const hasPending = !hasBadge && badgeRequest?.status === "pending";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

      {rozet === "alindi" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Rozet başvurunuz alındı; incelenince sonuç burada görünür.
        </p>
      )}

      {kaydedildi === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Ayarlarınız kaydedildi.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dil tercihi</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateLocale} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="locale" className="text-sm font-medium">
                İçerik çeviri dili
              </label>
              <select
                id="locale"
                name="locale"
                defaultValue={currentLocale}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="tr">Türkçe</option>
                <option value="en">İngilizce</option>
              </select>
            </div>
            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Kaydet
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">E-posta bildirimleri</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateEmailPref} className="flex flex-col gap-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="bildirim"
                value="1"
                defaultChecked={!profile?.emailOptout}
                className="mt-0.5"
              />
              <span>Soruma yanıt geldiğinde e-posta ile haber ver.</span>
            </label>
            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Kaydet
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profesyonel rozet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {hasBadge ? (
            <p>
              Rozetiniz onaylı{" "}
              <span className="text-sky-600 dark:text-sky-400">✔</span> —
              adınızın yanında görünüyor.
            </p>
          ) : hasPending ? (
            <p className="text-muted-foreground">Başvurunuz inceleniyor.</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {badgeRequest?.status === "rejected"
                  ? "Son başvurunuz onaylanmadı; yeniden başvurabilirsiniz."
                  : "Doktor veya eczacıysanız doğrulanmış rozet için başvurabilirsiniz."}
              </p>
              <Link
                href="/rozet-basvuru"
                className={buttonVariants({ variant: "outline", className: "w-fit" })}
              >
                Rozet başvurusu yap
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
