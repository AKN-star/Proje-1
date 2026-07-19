/**
 * Bildir formu (Faz 10 T1): deneyim/soru/yanıt kartlarında ortak.
 * reportContent action'ına gider; sessiz başarı ilkesi action'da.
 */
import { reportContent } from "@/app/actions/report";
import { REPORT_REASONS, type ReportTargetType } from "@/lib/reports/report";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReportForm({
  targetType,
  targetId,
  returnPath,
}: {
  targetType: ReportTargetType;
  targetId: string;
  returnPath: string;
}) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none hover:text-foreground">
        Bildir
      </summary>
      <form action={reportContent} className="mt-2 flex flex-col items-end gap-1.5">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnPath" value={returnPath} />
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
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
        >
          Gönder
        </button>
      </form>
    </details>
  );
}
