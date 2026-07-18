import { FlashBanner } from "@/components/flash-banner";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { listMyContent } from "@/lib/users/my-content";
import { deleteAccount, removeMyContent } from "@/app/actions/profile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ProBadge } from "@/components/pro-badge";
import { cn, formatDate } from "@/lib/utils";

// Oturuma bağlı canlı veri; prerender edilmez.
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  experience: "Deneyim",
  question: "Soru",
  answer: "Yanıt",
};

const STATUS_LABELS: Record<string, string> = {
  published: "Yayında",
  pending: "İncelemede",
  flagged: "İncelemede",
  removed: "Kaldırıldı",
};


export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ kaldirildi?: string; hata?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/giris?next=%2Fprofil");
  }

  const db = await getDb();
  const [profile, items] = await Promise.all([
    getOnboardingProfile(db, session.user.id),
    listMyContent(db, session.user.id),
  ]);
  if (!isOnboarded(profile)) {
    redirect("/hosgeldin?next=%2Fprofil");
  }

  const { kaldirildi, hata } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          @{profile?.username}
          <ProBadge proBadge={profile?.proBadge ?? null} />
        </h1>
        <Link href="/ayarlar" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ayarlar
        </Link>
      </div>

      {kaldirildi === "1" && <FlashBanner>İçerik kaldırıldı.</FlashBanner>}
      {hata === "onay" && (
        <FlashBanner tone="error">
          Hesabı silmek için onay kutusunu işaretlemeniz gerekiyor.
        </FlashBanner>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Paylaşımlarım</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground">Henüz paylaşımınız yok.</p>
        ) : (
          items.map((item) => (
            <Card key={`${item.kind}-${item.id}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={item.href} className="hover:underline">
                      {item.title}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{KIND_LABELS[item.kind]}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "removed"
                          ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                          : item.status === "published"
                            ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                            : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                      }
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatDate(item.createdAt)}</span>
                {item.status !== "removed" && (
                  <div className="flex items-center gap-2">
                    {item.kind === "experience" && (
                      <Link
                        href={`/deneyim-duzenle/${item.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Düzenle
                      </Link>
                    )}
                    <form action={removeMyContent}>
                      <input type="hidden" name="kind" value={item.kind} />
                      <input type="hidden" name="targetId" value={item.id} />
                      <button
                        type="submit"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Kaldır
                      </button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-red-200 p-4 dark:border-red-900">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          Hesabı sil
        </h2>
        <p className="text-sm text-muted-foreground">
          Hesabınız silindiğinde kimlik bilgileriniz (e-posta, takma ad,
          rozet) kalıcı olarak kaldırılır ve tüm oturumlarınız kapatılır.
          Yayınlanmış içerikleriniz &quot;anonim&quot; imzasıyla kalır; isterseniz
          önce yukarıdan tek tek kaldırabilirsiniz. Bu işlem geri alınamaz.
        </p>
        <form action={deleteAccount} className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="onay" value="1" className="mt-0.5" />
            <span>Hesabımın kalıcı olarak silineceğini anladım.</span>
          </label>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "destructive", className: "w-fit" }))}
          >
            Hesabımı sil
          </button>
        </form>
      </section>
    </main>
  );
}
