/**
 * Çeviri UI parçaları (Faz 5 T3) — iki sayfada (baslik/[slug], soru/[id])
 * üç kartta kullanılır; kopya JSX yerine tek kaynak.
 */
import type { ReactNode } from "react";
import { requestTranslation } from "@/app/actions/translate";
import type { TranslationTargetType } from "@/lib/translations/cache";
import { TRANSLATION_NOTES, type Locale } from "@/lib/locales";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TranslateButton({
  targetType,
  targetId,
  locale,
  returnPath,
  className,
}: {
  targetType: TranslationTargetType;
  targetId: string;
  locale: Locale;
  returnPath: string;
  className?: string;
}) {
  return (
    <form action={requestTranslation} className={className}>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <button
        type="submit"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
      >
        {locale === "en" ? "Translate (TR)" : "Çevir (EN)"}
      </button>
    </form>
  );
}

export function TranslationBlock({
  locale,
  className,
  children,
}: {
  locale: Locale;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950",
        className,
      )}
    >
      {children}
      <p className="text-xs text-muted-foreground">{TRANSLATION_NOTES[locale]}</p>
    </div>
  );
}
