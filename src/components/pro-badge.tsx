/**
 * Doğrulanmış profesyonel rozeti (Faz 6 T3). Kullanıcı adının yanında
 * ✔ gösterir; proBadge boşsa hiçbir şey render etmez. Rol etiketleri
 * tek kaynaktan (CLAIMED_ROLE_LABELS) türetilir.
 */
import { CLAIMED_ROLE_LABELS, isClaimedRole } from "@/lib/badges/requests";

export function ProBadge({ proBadge }: { proBadge: string | null }) {
  if (!proBadge) return null;
  const label = isClaimedRole(proBadge)
    ? `Doğrulanmış ${CLAIMED_ROLE_LABELS[proBadge].toLocaleLowerCase("tr")}`
    : "Doğrulanmış sağlık profesyoneli";
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
