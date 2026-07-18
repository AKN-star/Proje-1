import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { sideEffectTerms } from "@/db/schema";
import { getOwnExperience } from "@/lib/experiences/create";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { updateExperience } from "@/app/actions/experience";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { UUID_RE } from "@/lib/validate";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  purpose: "Amaç 3 ile 200 karakter arasında olmalıdır.",
  body: "Metin 10 ile 5000 karakter arasında olmalıdır.",
  effectiveness: "Etki 1 ile 5 arasında seçilmelidir.",
  durationDays: "Süre boş bırakılabilir veya 1 ile 3650 gün arasında olmalıdır.",
  sideEffectIds: "Yan etki seçimi geçersiz.",
  moderasyon:
    "Düzenleme yayınlanamadı, içerik önceki haliyle kaldı — lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
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
  const selected = new Set(experience.sideEffectIds);

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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="purpose" className="text-sm font-medium">
                Amaç
              </label>
              <Input
                id="purpose"
                name="purpose"
                type="text"
                required
                minLength={3}
                maxLength={200}
                defaultValue={experience.purpose}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="durationDays" className="text-sm font-medium">
                Süre (gün, opsiyonel)
              </label>
              <Input
                id="durationDays"
                name="durationDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={experience.durationDays ?? ""}
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">Etki (1-5)</legend>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="effectiveness"
                      value={value}
                      required
                      defaultChecked={value === experience.effectiveness}
                    />
                    {"★".repeat(value)}
                  </label>
                ))}
              </div>
            </fieldset>

            {terms.length > 0 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium">Yan etkiler (varsa)</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {terms.map((term) => (
                    <label key={term.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="sideEffectIds"
                        value={term.id}
                        defaultChecked={selected.has(term.id)}
                      />
                      {term.nameTr}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="body" className="text-sm font-medium">
                Deneyiminizi anlatın
              </label>
              <textarea
                id="body"
                name="body"
                required
                minLength={10}
                maxLength={5000}
                rows={6}
                defaultValue={experience.body}
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
