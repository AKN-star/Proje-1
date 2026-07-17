import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { submitTopicProposal } from "@/app/actions/topic";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";

// Canlı DB verisi gösterir (onboarding profili); build sırasında
// prerender edilmez — bkz. src/app/baslik/[slug]/deneyim-yaz/page.tsx.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  name: "Başlık adı 3 ile 100 karakter arasında olmalıdır.",
  type: "Tür 'durum' veya 'tedavi' olmalıdır.",
  summary: "Özet en fazla 500 karakter olabilir.",
  moderasyon: "Öneri gönderilemedi, lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

export default async function BaslikOnerPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; gonderildi?: string }>;
}) {
  const { hata, gonderildi } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fbaslik-oner");
  }

  const db = await getDb();

  // Takma ad + KVKK rızası tamamlanmadan öneri ekranı açılmaz.
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Fbaslik-oner");
  }

  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;
  const showSuccess = gonderildi === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Başlık öner</h1>
        <p className="text-sm text-muted-foreground">
          Aradığınız ilaç veya tedavi başlığı yoksa öneri gönderebilirsiniz.
          Öneriniz yayınlanmadan önce admin onayından geçer.
        </p>
      </div>

      <MedicalDisclaimer />

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {showSuccess && (
        <p
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          Öneriniz gönderildi, incelemeye alındı.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Başlık öneri formu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitTopicProposal} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Başlık adı
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                minLength={3}
                maxLength={100}
                placeholder="Örn. migren"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="type" className="text-sm font-medium">
                Tür
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue="condition"
                className="border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
              >
                <option value="condition">Durum / hastalık</option>
                <option value="treatment">Tedavi</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="summary" className="text-sm font-medium">
                Kısa özet (opsiyonel)
              </label>
              <textarea
                id="summary"
                name="summary"
                maxLength={500}
                rows={4}
                className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                placeholder="Bu başlık ne hakkında?"
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Öneriyi gönder
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
