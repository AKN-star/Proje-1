import Link from "next/link";
import { auth } from "@/auth";
import { brand } from "@/config/brand";
import { getDb } from "@/db";
import { listTopics } from "@/lib/queries/topics";
import { suggestTopics } from "@/lib/queries/suggest";
import { listRecentQuestions } from "@/lib/qa/questions";
import { siteUrl } from "@/lib/launch";
import { JsonLd } from "@/components/json-ld";
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

const PAGE_SIZE = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sayfa?: string }>;
}) {
  const { q, sayfa } = await searchParams;
  const db = await getDb();
  const session = await auth();

  // SQL sayfalaması yalnız aramasız listede (Faz 9 T2): arama sonuçları
  // ilgililiğe göre JS'te sıralandığından ve küçük olduğundan sayfalanmaz.
  const page = Math.max(1, Number.parseInt(sayfa ?? "1", 10) || 1);
  const rawList = await listTopics(db, {
    q,
    locale: "tr",
    ...(q ? {} : { limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
  });
  const hasMore = !q && rawList.length > PAGE_SIZE;
  const topicList = hasMore ? rawList.slice(0, PAGE_SIZE) : rawList;
  // Yalnız sıfır sonuçta yazım önerisi aranır (Faz 8 T5).
  const suggestions =
    q && topicList.length === 0 ? await suggestTopics(db, q) : [];

  // Boş durum bölümleri (Faz 9 T6): yalnız aramasız ilk sayfada.
  const showHighlights = !q && page === 1;
  const [featured, recentQuestions] = showHighlights
    ? await Promise.all([
        Promise.resolve(
          topicList
            .filter((t) => t.experienceCount > 0)
            .slice()
            .sort((a, b) => b.experienceCount - a.experienceCount)
            .slice(0, 5),
        ),
        listRecentQuestions(db, 5),
      ])
    : [[], []];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: brand.name,
          url: siteUrl(),
          potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl()}/?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
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

      {showHighlights && (featured.length > 0 || recentQuestions.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {featured.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Öne çıkan başlıklar
              </h2>
              {featured.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/baslik/${topic.slug}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <span>{topic.name ?? topic.canonicalName}</span>
                  <span className="text-muted-foreground">
                    {topic.experienceCount} deneyim
                  </span>
                </Link>
              ))}
            </section>
          )}
          {recentQuestions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Son sorular
              </h2>
              {recentQuestions.map((question) => (
                <Link
                  key={question.id}
                  href={`/soru/${question.id}`}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <span className="line-clamp-1">{question.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {question.topicName}
                  </span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {topicList.length === 0 ? (
          <div className="flex flex-col gap-2 text-center text-muted-foreground">
            <p>
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
            {suggestions.length > 0 && (
              <p>
                Şunu mu demek istediniz?{" "}
                {suggestions.map((s, i) => (
                  <span key={s.slug}>
                    {i > 0 && ", "}
                    <Link
                      href={`/baslik/${s.slug}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {s.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
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

      {!q && (page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link
              href={page === 2 ? "/" : `/?sayfa=${page - 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              ← Önceki
            </Link>
          )}
          {hasMore && (
            <Link
              href={`/?sayfa=${page + 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
