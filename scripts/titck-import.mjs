#!/usr/bin/env node
/**
 * TİTCK ruhsatlı ürünler CSV import'u (Faz 7 T4). Kullanım:
 *   npm run titck:import -- <dosya.csv> [--dry-run]
 *
 * Veri OTOMATİK ÇEKİLMEZ: TİTCK sitesindeki xlsx'i insan indirir,
 * "ad;etkin madde;form;doz" başlıklı CSV'ye çevirir ve yolunu verir
 * (lisans notu: docs/specs/faz-7-yayin.md). make-admin.mjs kalıbı:
 * TS import edilemediği için ayrıştırma/upsert mantığı burada elle
 * tekrarlanır; davranışın referansı ve testi src/lib/titck/import.ts.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";

const file = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("Kullanım: npm run titck:import -- <dosya.csv> [--dry-run]");
  process.exit(1);
}

// src/lib/topics/propose.ts:slugify ile birebir aynı davranış.
const TR_MAP = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
};
function slugify(name) {
  const transliterated = name
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("");
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const parseLine = (line) => {
    const cells = [];
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
    return [{ name, activeIngredient: activeIngredient || null, form: form || null, strength: strength || null }];
  });
}

async function run(query) {
  const rows = parseCsv(readFileSync(file, "utf-8"));
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const slug = slugify(row.name);
    if (!slug) {
      skipped++;
      continue;
    }
    const existing = await query("SELECT id FROM topics WHERE slug = $1 LIMIT 1", [slug]);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      const topicRows = await query(
        "INSERT INTO topics (slug, type, status, canonical_name) VALUES ($1, 'drug', 'active', $2) RETURNING id",
        [slug, row.name],
      );
      const topicId = topicRows[0].id;
      await query(
        "INSERT INTO topic_i18n (topic_id, locale, name) VALUES ($1, 'tr', $2)",
        [topicId, row.name],
      );
      await query(
        "INSERT INTO drug_details (topic_id, active_ingredient, form, strength, source) VALUES ($1, $2, $3, $4, 'titck')",
        [topicId, row.activeIngredient, row.form, row.strength],
      );
    }
    inserted++;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}eklendi: ${inserted}, atlandı (mevcut/boş slug): ${skipped}`,
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const sql = neon(databaseUrl);
    await run((text, params) => sql.query(text, params));
  } else {
    const client = new PGlite(".pglite/");
    try {
      await run(async (text, params) => (await client.query(text, params)).rows);
    } finally {
      await client.close();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
