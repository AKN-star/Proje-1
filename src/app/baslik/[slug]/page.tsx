import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getTopicBySlug, type TopicSort } from "@/lib/queries/topics";
import { getTopicStats } from "@/lib/stats/topic-stats";
import { sideEffectTerms } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { voteExperience } from "@/app/actions/vote";
import { reportExperience } from "@/app/actions/report";
import { REPORT_REASONS } from "@/lib/reports/report";
import { listQuestions } from "@/lib/qa/questions";
import { cn } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sirala?: string; bildirildi?: string }>;
}) {
  const { slug } = await params;
  const { sirala, bildirildi } = await searchParams;
  const sort: TopicSort = sirala === "oy" ? "oy" : "yeni";

  const db = await getDb();
  const session = await auth();
  const result = await getTopicBySlug(db, slug, "tr", sort, session?.user?.id);

  if (!result) {
    notFound();
  }

  const { topic, experiences } = result;
  const displayName = topic.name ?? topic.canonicalName;
  const detailParts = [topic.activeIngredient, topic.form, topic.strength].filter(
    Boolean,
  );

  const questionsList = await listQuestions(db, topic.id);

  const stats = await getTopicStats(db, topic.id);
  let topSideEffectNames: string[] = [];
  if (stats && stats.topSideEffects.length > 0) {
    const top3 = stats.topSideEffects.slice(0, 3);
    const termRows = await db
      .select({ id: sideEffectTerms.id, nameTr: sideEffectTerms.nameTr })
      .from(sideEffectTerms)
      .where(inArray(sideEffectTerms.id, top3.map((t) => t.termId)));
    const nameById = new Map(termRows.map((row) => [row.id, row.nameTr]));
    topSideEffectNames = top3
      .map((t) => nameById.get(t.termId))
      .filter((name): name is string => Boolean(name));
  }

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

      {bildirildi === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Bildiriminiz alındı, teşekkürler.
        </p>
      )}

      {stats && stats.experienceCount > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                <strong>{stats.experienceCount}</strong> deneyim
              </span>
              {stats.avgEffectiveness != null && (
                <span>
                  <span className="text-amber-500">★</span>{" "}
                  {stats.avgEffectiveness.toFixed(1)} ortalama etki
                </span>
              )}
              {stats.effectivePct != null && (
                <span>%{stats.effectivePct} etkili buldu</span>
              )}
            </div>
            {topSideEffectNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {topSideEffectNames.map((name) => (
                  <Badge key={name} variant="outline">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <MedicalDisclaimer />

      <Link
        href={`/baslik/${topic.slug}/deneyim-yaz`}
        className={buttonVariants({ variant: "default", className: "w-fit" })}
      >
        Deneyim yaz
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Deneyimler</h2>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/baslik/${topic.slug}?sirala=yeni`}
              className={cn(
                "hover:underline",
                sort === "yeni" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              En yeni
            </Link>
            <Link
              href={`/baslik/${topic.slug}?sirala=oy`}
              className={cn(
                "hover:underline",
                sort === "oy" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              En çok oy
            </Link>
          </div>
        </div>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-sm">
                    <form action={voteExperience}>
                      <input type="hidden" name="experienceId" value={experience.id} />
                      <input type="hidden" name="value" value="1" />
                      <input type="hidden" name="slug" value={topic.slug} />
                      <button
                        type="submit"
                        aria-label="Yukarı oyla"
                        aria-pressed={experience.myVote === 1}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "size-7",
                          experience.myVote === 1 ? "text-emerald-600" : "text-muted-foreground",
                        )}
                      >
                        ▲
                      </button>
                    </form>
                    <span className="min-w-6 text-center font-medium">{experience.score}</span>
                    <form action={voteExperience}>
                      <input type="hidden" name="experienceId" value={experience.id} />
                      <input type="hidden" name="value" value="-1" />
                      <input type="hidden" name="slug" value={topic.slug} />
                      <button
                        type="submit"
                        aria-label="Aşağı oyla"
                        aria-pressed={experience.myVote === -1}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "size-7",
                          experience.myVote === -1 ? "text-red-600" : "text-muted-foreground",
                        )}
                      >
                        ▼
                      </button>
                    </form>
                  </div>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none hover:text-foreground">
                      Bildir
                    </summary>
                    <form
                      action={reportExperience}
                      className="mt-2 flex flex-col items-end gap-1.5"
                    >
                      <input type="hidden" name="experienceId" value={experience.id} />
                      <input type="hidden" name="slug" value={topic.slug} />
                      <select
                        name="reason"
                        defaultValue=""
                        required
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Sebep seçin
                        </option>
                        {REPORT_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-7 text-xs",
                        )}
                      >
                        Gönder
                      </button>
                    </form>
                  </details>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Sorular</h2>
          <Link
            href={
              session?.user
                ? `/baslik/${topic.slug}/soru-sor`
                : `/giris?next=${encodeURIComponent(`/baslik/${topic.slug}/soru-sor`)}`
            }
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Soru sor
          </Link>
        </div>
        {questionsList.length === 0 ? (
          <p className="text-muted-foreground">Henüz soru sorulmamış.</p>
        ) : (
          questionsList.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`/soru/${question.id}`} className="hover:underline">
                      {question.title}
                    </Link>
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(question.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>@{question.authorUsername}</span>
                  <span>{question.answerCount} yanıt</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
