import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getTopicBySlug } from "@/lib/queries/topics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { submitQuestion } from "@/app/actions/qa";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  title: "Başlık 5 ile 150 karakter arasında olmalıdır.",
  body: "Metin boş bırakılabilir veya 2 ile 5000 karakter arasında olmalıdır.",
  moderasyon: "İçerik yayınlanamadı, lütfen metni gözden geçirin.",
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

export default async function SoruSorPage({
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
      `/hosgeldin?next=${encodeURIComponent(`/baslik/${slug}/soru-sor`)}`,
    );
  }

  const result = await getTopicBySlug(db, slug, "tr");
  if (!result) {
    notFound();
  }

  const { topic } = result;
  const displayName = topic.name ?? topic.canonicalName;

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
          {displayName} hakkında soru sor
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
          <CardTitle className="text-base">Soru formu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitQuestion} className="flex flex-col gap-5">
            <input type="hidden" name="slug" value={topic.slug} />

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
                placeholder="Sorunuzu kısaca özetleyin"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="body" className="text-sm font-medium">
                Detay (opsiyonel)
              </label>
              <textarea
                id="body"
                name="body"
                minLength={2}
                maxLength={5000}
                rows={6}
                className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                placeholder="Sorunuzu detaylandırmak isterseniz buraya yazın..."
              />
            </div>

            <button
              type="submit"
              className={buttonVariants({ variant: "default", className: "w-fit" })}
            >
              Soruyu paylaş
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
