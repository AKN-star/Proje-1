import { FlashBanner } from "@/components/flash-banner";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getTopicBySlug, getTopicMeta, type TopicSort } from "@/lib/queries/topics";
import { getTopicStats } from "@/lib/stats/topic-stats";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { sideEffectTerms } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { voteExperience } from "@/app/actions/vote";
import { ReportForm } from "@/components/report-form";
import { listQuestions } from "@/lib/qa/questions";
import { getFreshTranslation } from "@/lib/translations/cache";
import { TranslateButton, TranslationBlock } from "@/components/translation";
import { ProBadge } from "@/components/pro-badge";
import { CopyLinkButton } from "@/components/copy-link-button";
import { normalizeLocale, isLocale, type Locale } from "@/lib/locales";
import { buildReturnPath } from "@/lib/url";
import { parsePage } from "@/lib/validate";
import { cn, formatDate } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  drug: "İlaç",
  condition: "Hastalık",
  treatment: "Tedavi",
};

/** SEO (Faz 7 T2): başlık sayfası title/description + OG. Ağır deneyim
 * sorgusu değil, tek satırlık meta sorgusu (getTopicMeta) kullanılır —
 * sayfa gövdesi kendi tam sorgusunu zaten koşuyor. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();
  const meta = await getTopicMeta(db, slug);
  if (!meta) return {};

  const name = meta.name ?? meta.canonicalName;
  const title = `${name} kullanıcı deneyimleri`;
  const description =
    meta.summary ??
    `${name} hakkında gerçek kullanıcı deneyimleri, etki puanları ve yan etki istatistikleri.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
  };
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
  searchParams: Promise<{
    sirala?: string;
    bildirildi?: string;
    cevir?: string;
    dil?: string;
    cevirHata?: string;
    amac?: string;
    sayfa?: string;
  }>;
}) {
  const { slug } = await params;
  const { sirala, bildirildi, cevir, dil, cevirHata, amac, sayfa } = await searchParams;
  const sort: TopicSort = sirala === "oy" ? "oy" : "yeni";

  const db = await getDb();
  const session = await auth();
  const result = await getTopicBySlug(db, slug, "tr", sort, session?.user?.id);

  if (!result) {
    notFound();
  }

  const { topic, experiences: allExperiences } = result;

  // Amaç filtresi (Faz 8 T4): seçenekler sayfadaki gerçek deneyimlerden
  // türetilir; istatistik kartı bilinçle DOKUNULMAZ (topic_stats bütünü
  // gösterir). Bilinmeyen ?amac= değeri filtre uygulamaz.
  const purposes = [...new Set(allExperiences.map((e) => e.purpose))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const activePurpose = amac && purposes.includes(amac) ? amac : undefined;
  const filteredExperiences = activePurpose
    ? allExperiences.filter((e) => e.purpose === activePurpose)
    : allExperiences;

  // Render dilimlemesi (Faz 9 T2): oy sıralaması skorları JS'te
  // birleştirdiğinden SQL sayfalaması sırayı bozar — sorgu seviyesine
  // geçiş, skorun SQL'e taşınması refactor'ıyla birlikte (spec notu).
  const EXPERIENCE_PAGE_SIZE = 20;
  const expPage = parsePage(sayfa);
  const hasMoreExperiences =
    filteredExperiences.length > expPage * EXPERIENCE_PAGE_SIZE;
  const experiences = filteredExperiences.slice(
    (expPage - 1) * EXPERIENCE_PAGE_SIZE,
    expPage * EXPERIENCE_PAGE_SIZE,
  );

  // Girişli + onboarded + banlı olmayan kullanıcının çeviri locale
  // tercihi; aksi halde Çevir butonu hiç gösterilmez (action'daki
  // guard'larla aynı koşul — buton tıklanınca sessizce sekmesin).
  let userLocale: Locale | null = null;
  if (session?.user) {
    const profile = await getOnboardingProfile(db, session.user.id);
    if (isOnboarded(profile) && !profile?.bannedAt) {
      userLocale = normalizeLocale(profile?.locale);
    }
  }

  // bildirildi tek seferlik flash — returnPath'e taşınmaz. sayfa
  // taşınır: 2+. sayfadan Çevir/Bildir yapan kullanıcı aynı dilime
  // dönsün, çeviri bloğu görünür kalsın (review bulgusu).
  const returnPath = buildReturnPath(`/baslik/${slug}`, {
    sirala,
    amac: activePurpose,
    sayfa: expPage > 1 ? String(expPage) : undefined,
  });

  const [cevirType, cevirId] = cevir ? cevir.split(":") : [undefined, undefined];
  const cevirLocale = dil && isLocale(dil) ? dil : undefined;

  // Çeviri yalnız sayfadaki gerçek satır üstünden okunur (rastgele
  // ?cevir= id'si sorguya inmez) ve hash güncel değilse gösterilmez.
  // Filtresiz listede aranır: paylaşılan çeviri linkine sonradan farklı
  // ?amac= eklense de çeviri kaybolmasın (kart görünmüyorsa blok da
  // render edilmez, zararsız).
  const cevirExperience =
    cevirType === "experience" && cevirId
      ? allExperiences.find((e) => e.id === cevirId)
      : undefined;
  const translatedExperienceBody =
    cevirExperience && cevirLocale
      ? await getFreshTranslation(db, {
          targetType: "experience",
          targetId: cevirExperience.id,
          field: "body",
          locale: cevirLocale,
          sourceText: cevirExperience.body,
        })
      : null;
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
          <div className="flex items-center gap-2">
            <CopyLinkButton />
            <Badge variant="secondary">{TYPE_LABELS[topic.type] ?? topic.type}</Badge>
          </div>
        </div>
        {detailParts.length > 0 && (
          <p className="text-muted-foreground">{detailParts.join(" · ")}</p>
        )}
        {topic.summary && <p className="text-muted-foreground">{topic.summary}</p>}
      </div>

      {bildirildi === "1" && <FlashBanner>Bildiriminiz alındı, teşekkürler.</FlashBanner>}

      {cevirHata === "1" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          Çeviri oluşturulamadı, lütfen tekrar deneyin.
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
            {/* Sıralama değişince sayfa 1'e dönülür ama amaç filtresi
                korunur (review bulgusu: sort linkleri amac'ı düşürüyordu). */}
            <Link
              href={buildReturnPath(`/baslik/${topic.slug}`, {
                sirala: "yeni",
                amac: activePurpose,
              })}
              className={cn(
                "hover:underline",
                sort === "yeni" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              En yeni
            </Link>
            <Link
              href={buildReturnPath(`/baslik/${topic.slug}`, {
                sirala: "oy",
                amac: activePurpose,
              })}
              className={cn(
                "hover:underline",
                sort === "oy" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              En çok oy
            </Link>
          </div>
        </div>
        {purposes.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Kullanım amacı:</span>
            <Link
              href={buildReturnPath(`/baslik/${topic.slug}`, { sirala })}
              className={cn(
                "rounded-full border px-3 py-0.5 hover:bg-accent/50",
                !activePurpose && "border-foreground font-medium",
              )}
            >
              Tümü
            </Link>
            {purposes.map((purpose) => (
              <Link
                key={purpose}
                href={buildReturnPath(`/baslik/${topic.slug}`, { sirala, amac: purpose })}
                className={cn(
                  "rounded-full border px-3 py-0.5 hover:bg-accent/50",
                  activePurpose === purpose && "border-foreground font-medium",
                )}
              >
                {purpose}
              </Link>
            ))}
          </div>
        )}
        {filteredExperiences.length === 0 ? (
          <p className="text-muted-foreground">Henüz deneyim paylaşılmamış.</p>
        ) : experiences.length === 0 ? (
          // Aralık dışı ?sayfa= — sessiz boşluk yerine yönlendirme.
          <p className="text-muted-foreground">
            Bu sayfada kayıt yok.{" "}
            <Link
              href={buildReturnPath(`/baslik/${topic.slug}`, {
                sirala,
                amac: activePurpose,
              })}
              className="underline underline-offset-2"
            >
              İlk sayfaya dönün
            </Link>
          </p>
        ) : (
          experiences.map((experience) => (
            <Card key={experience.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    @{experience.authorUsername}
                    <ProBadge proBadge={experience.authorProBadge} />
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

                {userLocale && experience.lang !== userLocale && (
                  <TranslateButton
                    targetType="experience"
                    targetId={experience.id}
                    locale={userLocale}
                    returnPath={returnPath}
                  />
                )}

                {cevirExperience?.id === experience.id &&
                  cevirLocale &&
                  translatedExperienceBody && (
                    <TranslationBlock locale={cevirLocale}>
                      <p className="whitespace-pre-wrap">{translatedExperienceBody}</p>
                    </TranslationBlock>
                  )}

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
                  <ReportForm
                    targetType="experience"
                    targetId={experience.id}
                    returnPath={returnPath}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {(expPage > 1 || hasMoreExperiences) && (
          <div className="flex items-center justify-center gap-4 text-sm">
            {expPage > 1 && (
              <Link
                href={buildReturnPath(`/baslik/${topic.slug}`, {
                  sirala,
                  amac: activePurpose,
                  sayfa: expPage === 2 ? undefined : String(expPage - 1),
                })}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                ← Önceki
              </Link>
            )}
            {hasMoreExperiences && (
              <Link
                href={buildReturnPath(`/baslik/${topic.slug}`, {
                  sirala,
                  amac: activePurpose,
                  sayfa: String(expPage + 1),
                })}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Sonraki →
              </Link>
            )}
          </div>
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
