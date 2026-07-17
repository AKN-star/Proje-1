/**
 * Doğrulanmış profesyonel rozeti (Faz 6 T3). Kullanıcı adının yanında
 * ✔ gösterir; proBadge boşsa hiçbir şey render etmez.
 */
const BADGE_LABELS: Record<string, string> = {
  doctor: "Doğrulanmış doktor",
  pharmacist: "Doğrulanmış eczacı",
};

export function ProBadge({ proBadge }: { proBadge: string | null }) {
  if (!proBadge) return null;
  const label = BADGE_LABELS[proBadge] ?? "Doğrulanmış sağlık profesyoneli";
  return (
    <span
      title={label}
      aria-label={label}
      className="ml-1 inline-flex items-center text-sky-600 dark:text-sky-400"
    >
      ✔
    </span>
  );
}
