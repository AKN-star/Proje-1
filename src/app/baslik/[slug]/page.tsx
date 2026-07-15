import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getTopicBySlug } from "@/lib/queries/topics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
// T2 merge sonrası: import { MedicalDisclaimer } from "@/components/medical-disclaimer";

const TYPE_LABELS: Record<string, string> = {
  drug: "İlaç",
  condition: "Hastalık",
  treatment: "Tedavi",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function EffectivenessStars({ value }: { value: number }) {
  return (
    <span aria-label={`Etki: 5 üzerinden ${value}`} className="text-amber-500">
      {"★".repeat(value)}
      <span className="text-muted-foreground">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();
  const result = await getTopicBySlug(db, slug, "tr");

  if (!result) {
    notFound();
  }

  const { topic, experiences } = result;
  const displayName = topic.name ?? topic.canonicalName;
  const detailParts = [topic.activeIngredient, topic.form, topic.strength].filter(
    Boolean,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
          <Badge variant="secondary">{TYPE_LABELS[topic.type] ?? topic.type}</Badge>
        </div>
        {detailParts.length > 0 && (
          <p className="text-muted-foreground">{detailParts.join(" · ")}</p>
        )}
        {topic.summary && <p className="text-muted-foreground">{topic.summary}</p>}
      </div>

      {/* T2 merge sonrası: <MedicalDisclaimer /> */}

      <Link
        href={`/baslik/${topic.slug}/deneyim-yaz`}
        className={buttonVariants({ variant: "default", className: "w-fit" })}
      >
        Deneyim yaz
      </Link>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Deneyimler</h2>
        {experiences.length === 0 ? (
          <p className="text-muted-foreground">Henüz deneyim paylaşılmamış.</p>
        ) : (
          experiences.map((experience) => (
            <Card key={experience.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    @{experience.authorUsername}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(experience.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span>
                    <strong>Amaç:</strong> {experience.purpose}
                  </span>
                  {experience.durationDays != null && (
                    <span>
                      <strong>Süre:</strong> {experience.durationDays} gün
                    </span>
                  )}
                  <EffectivenessStars value={experience.effectiveness} />
                </div>
                {experience.sideEffects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {experience.sideEffects.map((effect) => (
                      <Badge key={effect} variant="outline">
                        {effect}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm">{experience.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
