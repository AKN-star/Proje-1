import { TriangleAlert } from "lucide-react";
import { medicalDisclaimer, type DisclaimerLocale } from "@/config/disclaimer";

export interface MedicalDisclaimerProps {
  locale?: DisclaimerLocale;
}

/**
 * Her içerik sayfasında görünmesi gereken sabit tıbbi uyarı bandı
 * (kritik kural #8). Metin src/config/disclaimer.ts'ten gelir.
 */
export function MedicalDisclaimer({ locale = "tr" }: MedicalDisclaimerProps) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <TriangleAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <p>{medicalDisclaimer[locale]}</p>
    </div>
  );
}
