/**
 * Flash bildirim bandı (Faz 10 cleanup — 5+ kopyanın tek kaynağı).
 * `tone`: success (yeşil) | error (kırmızı) | info (amber).
 */
const TONES = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  info: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
} as const;

export function FlashBanner({
  tone = "success",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${TONES[tone]}`}>{children}</p>
  );
}
