import Link from "next/link";
import { auth } from "@/auth";
import { brand } from "@/config/brand";
import { getDb } from "@/db";
import { listTopics } from "@/lib/queries/topics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  drug: "İlaç",
  condition: "Hastalık",
  treatment: "Tedavi",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = await getDb();
  const session = await auth();
  const topicList = await listTopics(db, { q, locale: "tr" });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      {session?.user && (
        <div className="flex justify-end gap-2">
          <Link href="/profil" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Profilim
          </Link>
          <Link href="/ayarlar" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ayarlar
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{brand.name}</h1>
        <p className="text-muted-foreground">{brand.tagline.tr}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <form method="GET" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="İlaç, etken madde veya hastalık ara..."
            aria-label="Ara"
          />
          <Button type="submit">Ara</Button>
        </form>
        <p className="text-right text-sm text-muted-foreground">
          Aradığınız başlık yok mu?{" "}
          <Link href="/baslik-oner" className="underline underline-offset-2 hover:text-foreground">
            Başlık önerin
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {topicList.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {q ? (
              <>
                &quot;{q}&quot; için sonuç bulunamadı.{" "}
                <Link
                  href="/baslik-oner"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Bu başlığı önerin
                </Link>
              </>
            ) : (
              "Henüz konu eklenmemiş."
            )}
          </p>
        ) : (
          topicList.map((topic) => (
            <Link key={topic.id} href={`/baslik/${topic.slug}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{topic.name ?? topic.canonicalName}</CardTitle>
                    <Badge variant="secondary">
                      {TYPE_LABELS[topic.type] ?? topic.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{topic.activeIngredient ?? " "}</span>
                  <span>{topic.experienceCount} deneyim</span>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
