import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { sideEffectTerms } from "@/db/schema";
import { getOwnExperience } from "@/lib/experiences/create";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ExperienceFormFields } from "@/components/experience-form-fields";
import { EXPERIENCE_ERROR_MESSAGES } from "@/lib/validation/experience";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { updateExperience } from "@/app/actions/experience";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { UUID_RE } from "@/lib/validate";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  ...EXPERIENCE_ERROR_MESSAGES,
  moderasyon:
    "Düzenleme yayınlanamadı, içerik önceki haliyle kaldı — lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
};

export default async function DeneyimDuzenlePage({
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
    redirect(`/giris?next=${encodeURIComponent(`/deneyim-duzenle/${id}`)}`);
  }

  const db = await getDb();

  const profile = await getOnboardingProfile(db, session.user.id);
  if (!isOnboarded(profile)) {
    redirect(`/hosgeldin?next=${encodeURIComponent(`/deneyim-duzenle/${id}`)}`);
  }

  const experience = await getOwnExperience(db, session.user.id, id);
  if (!experience) {
    notFound();
  }

  const terms = await db
    .select({ id: sideEffectTerms.id, nameTr: sideEffectTerms.nameTr })
    .from(sideEffectTerms)
    .orderBy(sideEffectTerms.nameTr);
  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/profil" className="text-sm text-muted-foreground hover:underline">
          ← Profilim
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Deneyimi düzenle</h1>
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
          <CardTitle className="text-base">Deneyim formu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateExperience} className="flex flex-col gap-5">
            <input type="hidden" name="experienceId" value={experience.id} />
            <ExperienceFormFields terms={terms} defaults={experience} />
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
