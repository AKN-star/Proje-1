import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { sideEffectTerms } from "@/db/schema";
import { getTopicBySlug } from "@/lib/queries/topics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ExperienceFormFields } from "@/components/experience-form-fields";
import { EXPERIENCE_ERROR_MESSAGES } from "@/lib/validation/experience";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { submitExperience } from "@/app/actions/experience";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  ...EXPERIENCE_ERROR_MESSAGES,
  moderasyon: "İçerik yayınlanamadı, lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
};

export default async function DeneyimYazPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { slug } = await params;
  const { hata } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    redirect("/giris");
  }

  const db = await getDb();

  // Takma ad + KVKK rızası tamamlanmadan yazma ekranı açılmaz.
  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(
      `/hosgeldin?next=${encodeURIComponent(`/baslik/${slug}/deneyim-yaz`)}`,
    );
  }

  const result = await getTopicBySlug(db, slug, "tr");
  if (!result) {
    notFound();
  }

  const { topic } = result;
  const displayName = topic.name ?? topic.canonicalName;
  const terms = await db
    .select({
      id: sideEffectTerms.id,
      nameTr: sideEffectTerms.nameTr,
    })
    .from(sideEffectTerms)
    .orderBy(sideEffectTerms.nameTr);

  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link
          href={`/baslik/${topic.slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {displayName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {displayName} için deneyim yaz
        </h1>
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
          <CardTitle className="text-base">Deneyim formu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitExperience} className="flex flex-col gap-5">
            <input type="hidden" name="slug" value={topic.slug} />
            <ExperienceFormFields terms={terms} />
            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Deneyimi paylaş
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
