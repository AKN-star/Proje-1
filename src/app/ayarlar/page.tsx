import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { normalizeLocale } from "@/lib/locales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { updateLocale } from "@/app/actions/settings";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<{ kaydedildi?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fayarlar");
  }

  const db = await getDb();
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Fayarlar");
  }

  const { kaydedildi } = await searchParams;

  const currentLocale = normalizeLocale(profile?.locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

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
    </main>
  );
}
