import { FlashBanner } from "@/components/flash-banner";
import { RATE_LIMIT_ERROR_MESSAGE } from "@/lib/rate-limit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getQuestion, getQuestionMeta } from "@/lib/qa/questions";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { submitAnswer, voteAnswer } from "@/app/actions/qa";
import { getFreshTranslation } from "@/lib/translations/cache";
import { TranslateButton, TranslationBlock } from "@/components/translation";
import { ProBadge } from "@/components/pro-badge";
import { JsonLd } from "@/components/json-ld";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ReportForm } from "@/components/report-form";
import { normalizeLocale, isLocale, type Locale } from "@/lib/locales";
import { UUID_RE } from "@/lib/validate";
import { cn, formatDate } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  body: "Metin 2 ile 5000 karakter arasında olmalıdır.",
  moderasyon: "İçerik yayınlanamadı, lütfen metni gözden geçirin.",
  limit: RATE_LIMIT_ERROR_MESSAGE,
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};


/** SEO (Faz 7 T2): soru başlığı title/description. Ağır yanıt sorgusu
 * değil, tek satırlık meta sorgusu kullanılır. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return {};
  const db = await getDb();
  const meta = await getQuestionMeta(db, id);
  if (!meta) return {};
  return {
    title: meta.title,
    description: `${meta.topicName} hakkında soru: ${meta.title}`,
  };
}

export default async function SoruPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    hata?: string;
    cevir?: string;
    dil?: string;
    cevirHata?: string;
    bildirildi?: string;
  }>;
}) {
  const { id } = await params;
  const { hata, cevir, dil, cevirHata, bildirildi } = await searchParams;

  // uuid olmayan id sorguda PG hatasına (22P02) dönüşmesin — 404.
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const db = await getDb();
  const session = await auth();
  const result = await getQuestion(db, id, session?.user?.id);

  if (!result) {
    notFound();
  }

  const { question, answers } = result;

  // Çevir butonu yalnız action'ın kabul edeceği kullanıcıya gösterilir
  // (girişli + onboarded + banlı değil).
  let onboarded = false;
  let userLocale: Locale | null = null;
  if (session?.user) {
    const profile = await getOnboardingProfile(db, session.user.id);
    onboarded = isOnboarded(profile);
    if (onboarded && !profile?.bannedAt) {
      userLocale = normalizeLocale(profile?.locale);
    }
  }

  // hata tek seferlik flash — returnPath'e taşınmaz.
  const returnPath = `/soru/${id}`;

  const [cevirType, cevirId] = cevir ? cevir.split(":") : [undefined, undefined];
  const cevirLocale = dil && isLocale(dil) ? dil : undefined;

  // Çeviriler yalnız sayfadaki gerçek satırlar üstünden ve hash güncelse
  // okunur; soru bloğu ancak tüm alanları (başlık + varsa gövde)
  // çevrilmişse gösterilir — yarım çeviri tam gibi sunulmaz.
  const wantQuestion =
    cevirType === "question" && cevirId === question.id && cevirLocale
      ? cevirLocale
      : undefined;
  const [questionTitleTr, questionBodyTr] = wantQuestion
    ? await Promise.all([
        getFreshTranslation(db, {
          targetType: "question",
          targetId: question.id,
          field: "title",
          locale: wantQuestion,
          sourceText: question.title,
        }),
        question.body
          ? getFreshTranslation(db, {
              targetType: "question",
              targetId: question.id,
              field: "body",
              locale: wantQuestion,
              sourceText: question.body,
            })
          : Promise.resolve(null),
      ])
    : [null, null];
  const questionTranslation =
    questionTitleTr && (!question.body || questionBodyTr)
      ? { title: questionTitleTr, body: questionBodyTr }
      : null;

  const cevirAnswer =
    cevirType === "answer" && cevirId
      ? answers.find((a) => a.id === cevirId)
      : undefined;
  const translatedAnswerBody =
    cevirAnswer && cevirLocale
      ? await getFreshTranslation(db, {
          targetType: "answer",
          targetId: cevirAnswer.id,
          field: "body",
          locale: cevirLocale,
          sourceText: cevirAnswer.body,
        })
      : null;

  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;

  // QAPage JSON-LD (Faz 9 T4). YMYL temkinli: yalnız soru-cevap yapısı
  // işaretlenir, tıbbi iddia/derecelendirme işaretlemesi yok (spec).
  const qaJsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question.title,
      text: question.body ?? question.title,
      answerCount: answers.length,
      author: { "@type": "Person", name: question.authorUsername },
      dateCreated: question.createdAt.toISOString(),
      suggestedAnswer: answers.map((answer) => ({
        "@type": "Answer",
        text: answer.body,
        author: { "@type": "Person", name: answer.authorUsername },
        dateCreated: answer.createdAt.toISOString(),
        upvoteCount: answer.score,
      })),
    },
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <JsonLd data={qaJsonLd} />
      <div className="flex flex-col gap-1">
        <Link
          href={`/baslik/${question.topicSlug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {question.topicName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            @{question.authorUsername}
            <ProBadge proBadge={question.authorProBadge} />
          </span>
          <span>{formatDate(question.createdAt)}</span>
          <CopyLinkButton />
          <ReportForm targetType="question" targetId={question.id} returnPath={returnPath} />
        </div>
        {question.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm">{question.body}</p>
        )}

        {userLocale && question.lang !== userLocale && (
          <TranslateButton
            targetType="question"
            targetId={question.id}
            locale={userLocale}
            returnPath={returnPath}
            className="mt-2"
          />
        )}

        {questionTranslation && wantQuestion && (
          <TranslationBlock locale={wantQuestion} className="mt-2">
            <p className="font-medium">{questionTranslation.title}</p>
            {questionTranslation.body && (
              <p className="whitespace-pre-wrap">{questionTranslation.body}</p>
            )}
          </TranslationBlock>
        )}
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

      {bildirildi === "1" && <FlashBanner>Bildiriminiz alındı, teşekkürler.</FlashBanner>}

      {cevirHata === "1" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          Çeviri oluşturulamadı, lütfen tekrar deneyin.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Yanıtlar</h2>
        {answers.length === 0 ? (
          <p className="text-muted-foreground">Henüz yanıt yok.</p>
        ) : (
          answers.map((answer) => (
            <Card key={answer.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    @{answer.authorUsername}
                    <ProBadge proBadge={answer.authorProBadge} />
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(answer.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="whitespace-pre-wrap text-sm">{answer.body}</p>

                {userLocale && answer.lang !== userLocale && (
                  <TranslateButton
                    targetType="answer"
                    targetId={answer.id}
                    locale={userLocale}
                    returnPath={returnPath}
                  />
                )}

                {cevirAnswer?.id === answer.id &&
                  cevirLocale &&
                  translatedAnswerBody && (
                    <TranslationBlock locale={cevirLocale}>
                      <p className="whitespace-pre-wrap">{translatedAnswerBody}</p>
                    </TranslationBlock>
                  )}

                <div className="flex items-center gap-1 text-sm">
                  <form action={voteAnswer}>
                    <input type="hidden" name="answerId" value={answer.id} />
                    <input type="hidden" name="value" value="1" />
                    <input type="hidden" name="questionId" value={question.id} />
                    <button
                      type="submit"
                      aria-label="Yukarı oyla"
                      aria-pressed={answer.myVote === 1}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-7",
                        answer.myVote === 1 ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      ▲
                    </button>
                  </form>
                  <span className="min-w-6 text-center font-medium">{answer.score}</span>
                  <form action={voteAnswer}>
                    <input type="hidden" name="answerId" value={answer.id} />
                    <input type="hidden" name="value" value="-1" />
                    <input type="hidden" name="questionId" value={question.id} />
                    <button
                      type="submit"
                      aria-label="Aşağı oyla"
                      aria-pressed={answer.myVote === -1}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-7",
                        answer.myVote === -1 ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      ▼
                    </button>
                  </form>
                  <div className="ml-auto">
                    <ReportForm
                      targetType="answer"
                      targetId={answer.id}
                      returnPath={returnPath}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {session?.user && onboarded ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yanıt yaz</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitAnswer} className="flex flex-col gap-5">
              <input type="hidden" name="questionId" value={question.id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="body" className="text-sm font-medium">
                  Yanıtınız
                </label>
                <textarea
                  id="body"
                  name="body"
                  required
                  minLength={2}
                  maxLength={5000}
                  rows={6}
                  className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                  placeholder="Deneyiminize dayanarak yanıt verin..."
                />
              </div>
              <button
                type="submit"
                className={buttonVariants({ variant: "default", className: "w-fit" })}
              >
                Yanıtı paylaş
              </button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Link
          href={`/giris?next=${encodeURIComponent(`/soru/${question.id}`)}`}
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
        >
          Yanıtlamak için giriş yapın
        </Link>
      )}
    </main>
  );
}
