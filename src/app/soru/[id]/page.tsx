import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { getQuestion } from "@/lib/qa/questions";
import { getOnboardingProfile, isOnboarded } from "@/lib/users/onboarding";
import { answers as answersTable, questions as questionsTable, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { submitAnswer, voteAnswer } from "@/app/actions/qa";
import { requestTranslation } from "@/app/actions/translate";
import { getCachedTranslation } from "@/lib/translations/cache";
import { cn } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (PGlite
// build worker'larında paralel açılamaz, veri de istekte taze olmalı).
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  body: "Metin 2 ile 5000 karakter arasında olmalıdır.",
  moderasyon: "İçerik yayınlanamadı, lütfen metni gözden geçirin.",
  _root: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

const TRANSLATION_NOTES: Record<string, string> = {
  tr: "Otomatik çeviri — hatalı olabilir",
  en: "Automatic translation — may contain errors",
};

/** cevir/dil/cevirHata dışındaki mevcut query param'ları koruyarak
 * dönüş yolunu kurar (Faz 5 T3). */
function buildReturnPath(
  pathname: string,
  searchParams: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (!value) continue;
    if (key === "cevir" || key === "dil" || key === "cevirHata") continue;
    sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
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
  }>;
}) {
  const { id } = await params;
  const { hata, cevir, dil, cevirHata } = await searchParams;

  const db = await getDb();
  const session = await auth();
  const result = await getQuestion(db, id, session?.user?.id);

  if (!result) {
    notFound();
  }

  const { question, answers } = result;

  let onboarded = false;
  let userLocale: "tr" | "en" | null = null;
  if (session?.user) {
    const profile = await getOnboardingProfile(db, session.user.id);
    onboarded = isOnboarded(profile);
    const [profileRow] = await db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    userLocale = profileRow?.locale === "en" ? "en" : "tr";
  }

  const [questionLangRow] = await db
    .select({ lang: questionsTable.lang })
    .from(questionsTable)
    .where(eq(questionsTable.id, question.id))
    .limit(1);
  const questionLang = questionLangRow?.lang ?? "tr";

  const answerLangs = new Map<string, string>();
  if (answers.length > 0) {
    const langRows = await db
      .select({ id: answersTable.id, lang: answersTable.lang })
      .from(answersTable)
      .where(
        inArray(
          answersTable.id,
          answers.map((a) => a.id),
        ),
      );
    for (const row of langRows) {
      answerLangs.set(row.id, row.lang);
    }
  }

  const returnPath = buildReturnPath(`/soru/${id}`, { hata });

  const [cevirType, cevirId] = cevir ? cevir.split(":") : [undefined, undefined];
  const cevirLocale = dil === "en" ? "en" : dil === "tr" ? "tr" : undefined;

  const translatedQuestionTitle =
    cevirType === "question" && cevirId === question.id && cevirLocale
      ? (await getCachedTranslation(db, "question", question.id, "title", cevirLocale))
          ?.text ?? null
      : null;
  const translatedQuestionBody =
    cevirType === "question" && cevirId === question.id && cevirLocale && question.body
      ? (await getCachedTranslation(db, "question", question.id, "body", cevirLocale))
          ?.text ?? null
      : null;

  const translatedAnswerBodies = new Map<string, string>();
  if (cevirType === "answer" && cevirId && cevirLocale) {
    const cached = await getCachedTranslation(db, "answer", cevirId, "body", cevirLocale);
    if (cached) {
      translatedAnswerBodies.set(cevirId, cached.text);
    }
  }

  const errorMessage = hata ? ERROR_MESSAGES[hata] ?? ERROR_MESSAGES._root : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link
          href={`/baslik/${question.topicSlug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {question.topicName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>@{question.authorUsername}</span>
          <span>{formatDate(question.createdAt)}</span>
        </div>
        {question.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm">{question.body}</p>
        )}

        {userLocale && questionLang !== userLocale && (
          <form action={requestTranslation} className="mt-2">
            <input type="hidden" name="targetType" value="question" />
            <input type="hidden" name="targetId" value={question.id} />
            <input type="hidden" name="locale" value={userLocale} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
            >
              {userLocale === "en" ? "Translate (TR)" : "Çevir (EN)"}
            </button>
          </form>
        )}

        {(translatedQuestionTitle || translatedQuestionBody) && (
          <div className="mt-2 flex flex-col gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950">
            {translatedQuestionTitle && (
              <p className="font-medium">{translatedQuestionTitle}</p>
            )}
            {translatedQuestionBody && (
              <p className="whitespace-pre-wrap">{translatedQuestionBody}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {TRANSLATION_NOTES[cevirLocale ?? "tr"]}
            </p>
          </div>
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
                  <CardTitle className="text-base">@{answer.authorUsername}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(answer.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="whitespace-pre-wrap text-sm">{answer.body}</p>

                {userLocale &&
                  answerLangs.get(answer.id) &&
                  answerLangs.get(answer.id) !== userLocale && (
                    <form action={requestTranslation}>
                      <input type="hidden" name="targetType" value="answer" />
                      <input type="hidden" name="targetId" value={answer.id} />
                      <input type="hidden" name="locale" value={userLocale} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <button
                        type="submit"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-7 text-xs",
                        )}
                      >
                        {userLocale === "en" ? "Translate (TR)" : "Çevir (EN)"}
                      </button>
                    </form>
                  )}

                {cevirType === "answer" &&
                  cevirId === answer.id &&
                  cevirLocale &&
                  translatedAnswerBodies.get(answer.id) && (
                    <div className="flex flex-col gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950">
                      <p className="whitespace-pre-wrap">
                        {translatedAnswerBodies.get(answer.id)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TRANSLATION_NOTES[cevirLocale]}
                      </p>
                    </div>
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
