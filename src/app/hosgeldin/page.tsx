import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { brand } from "@/config/brand";
import { generateUsername } from "@/lib/auth/username";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { submitOnboarding } from "@/app/actions/onboarding";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  username:
    "Takma ad 3-30 karakter olmalı; küçük harf, rakam, tire ve alt çizgi kullanılabilir.",
  alinmis: "Bu takma ad alınmış, lütfen başka bir tane deneyin.",
  kvkk: "Devam etmek için açık rıza kutusunu işaretlemeniz gerekiyor.",
};

export default async function HosgeldinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; hata?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris");
  }

  const { next = "/", hata } = await searchParams;
  const db = await getDb();
  const profile = await getOnboardingProfile(db, session.user.id);
  if (isOnboarded(profile)) {
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }

  const suggestion =
    profile?.username ?? generateUsername(session.user.email ?? "");
  const errorMessage = hata ? ERROR_MESSAGES[hata] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Hoş geldiniz</h1>
        <p className="text-sm text-muted-foreground">
          Paylaşımlarınız bu takma adla görünür; gerçek adınız hiçbir yerde
          gösterilmez.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {errorMessage}
        </p>
      )}

      <form action={submitOnboarding} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            Takma ad
          </label>
          <Input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            defaultValue={suggestion}
            autoComplete="off"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="kvkk" required className="mt-0.5" />
          <span>
            Paylaşacağım ilaç/tedavi deneyimlerinin sağlık verisi içerdiğini
            biliyor, bu verilerin {brand.name} üzerinde takma adımla
            yayınlanması ve hizmetin sunulması için işlenmesine açık rıza
            veriyorum. (Aydınlatma metni yayına kadar eklenecektir.)
          </span>
        </label>
        <Button type="submit">Devam et</Button>
      </form>
    </main>
  );
}
