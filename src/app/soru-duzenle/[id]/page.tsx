import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getOwnQuestion } from "@/lib/qa/edit";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { updateQuestion } from "@/app/actions/qa";
import { UUID_RE } from "@/lib/validate";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  title: "Başlık 5 ile 150 karakter arasında olmalıdır.",
  body: "Metin boş bırakılabilir veya 2 ile 5000 karakter arasında olmalıdır.",
  moderasyon:
    "Düzenleme yayınlanamadı, içerik önceki haliyle kaldı — lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

export default async function SoruDuzenlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect(`/giris?next=${encodeURIComponent(`/soru-duzenle/${id}`)}`);
  }

  const db = await getDb();
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(`/soru-duzenle/${id}`)}`);
  }

  const question = await getOwnQuestion(db, session.user.id, id);
  if (!question) {
    notFound();
  }

  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/profil" className="text-sm text-muted-foreground hover:underline">
          ← Profilim
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Soruyu düzenle</h1>
        <p className="text-sm text-muted-foreground">
          Düzenlenen içerik yayınlanmadan önce yeniden incelemeden geçer.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soru</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateQuestion} className="flex flex-col gap-5">
            <input type="hidden" name="questionId" value={question.id} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium">
                Başlık
              </label>
              <Input
                id="title"
                name="title"
                type="text"
                required
                minLength={5}
                maxLength={150}
                defaultValue={question.title}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="body" className="text-sm font-medium">
                Ayrıntı (opsiyonel)
              </label>
              <textarea
                id="body"
                name="body"
                maxLength={5000}
                rows={6}
                defaultValue={question.body ?? ""}
                className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Değişiklikleri kaydet
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
