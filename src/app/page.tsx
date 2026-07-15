import Link from "next/link";
import { brand } from "@/config/brand";
import { getDb } from "@/db";
import { listTopics } from "@/lib/queries/topics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const topicList = await listTopics(db, { q, locale: "tr" });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{brand.name}</h1>
        <p className="text-muted-foreground">{brand.tagline.tr}</p>
      </div>

      <form method="GET" className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="İlaç, hastalık veya tedavi ara..."
          aria-label="Ara"
        />
        <Button type="submit">Ara</Button>
      </form>

      <div className="flex flex-col gap-3">
        {topicList.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {q ? `"${q}" için sonuç bulunamadı.` : "Henüz konu eklenmemiş."}
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
