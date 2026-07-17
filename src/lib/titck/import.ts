/**
 * TİTCK ruhsatlı ürünler listesi import çekirdeği (Faz 7 T4,
 * docs/specs/faz-7-yayin.md). Veri OTOMATİK ÇEKİLMEZ — lisans şartları
 * açık olmadığından (spec notu) dosyayı insan indirir, CSV'ye çevirir ve
 * scripts/titck-import.mjs ile yükler. Bu modül saf ve testtir edilebilir
 * kısımdır: CSV ayrıştırma + upsert.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { drugDetails, topicI18n, topics } from "@/db/schema";
import { slugify } from "@/lib/topics/propose";

export interface TitckDrugRow {
  name: string;
  activeIngredient: string | null;
  form: string | null;
  strength: string | null;
}

/**
 * Basit CSV ayrıştırıcı (başlıklı; ayraç `;` veya `,` otomatik):
 * beklenen sütunlar ad, etkin madde, form, doz — TİTCK xlsx'inden
 * dışa aktarılan sırayla. Tırnaklı hücre desteklenir; satır içi yeni
 * satır desteklenmez (listede yok).
 */
export function parseTitckCsv(text: string): TitckDrugRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  return lines.slice(1).flatMap((line) => {
    const [name, activeIngredient, form, strength] = parseLine(line);
    if (!name) return [];
    return [
      {
        name,
        activeIngredient: activeIngredient || null,
        form: form || null,
        strength: strength || null,
      },
    ];
  });
}

export interface ImportResult {
  inserted: number;
  skipped: number;
}

/**
 * Satırları topics(type='drug', status='active') + topic_i18n(tr) +
 * drug_details(source='titck') olarak ekler. Slug çakışmasında mevcut
 * kayıt KORUNUR ve satır atlanır (kullanıcı önerileriyle/elle girilmiş
 * başlıklarla yarışmaz). dryRun'da yazmadan sayar.
 */
export async function importDrugRows(
  db: Db,
  rows: TitckDrugRow[],
  options: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const slug = slugify(row.name);
    if (!slug) {
      skipped++;
      continue;
    }

    const [existing] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }

    if (!options.dryRun) {
      const [topic] = await db
        .insert(topics)
        .values({
          slug,
          type: "drug",
          status: "active",
          canonicalName: row.name,
        })
        .returning({ id: topics.id });

      await db.insert(topicI18n).values({
        topicId: topic.id,
        locale: "tr",
        name: row.name,
      });

      await db.insert(drugDetails).values({
        topicId: topic.id,
        activeIngredient: row.activeIngredient,
        form: row.form,
        strength: row.strength,
        source: "titck",
      });
    }
    inserted++;
  }

  return { inserted, skipped };
}

/** dryRun raporunda kullanılmak üzere mevcut titck kayıt sayısı. */
export async function countTitckDrugs(db: Db): Promise<number> {
  const rows = await db
    .select({ topicId: drugDetails.topicId })
    .from(drugDetails)
    .where(eq(drugDetails.source, "titck"));
  return rows.length;
}
