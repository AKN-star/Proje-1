#!/usr/bin/env node
/**
 * Tek seferlik insan adımı (T4, faz-3-moderasyon-admin.md): e-postasıyla
 * bir kullanıcıyı role='admin' yapar. Kullanım:
 *   npm run admin:grant -- kullanici@example.com
 *
 * Bağımlılık eklemez — mevcut @neondatabase/serverless (prod,
 * DATABASE_URL varsa) veya @electric-sql/pglite (dev, .pglite/) kullanır.
 * src/db/index.ts:getDb() ile aynı seçim mantığı (TS import edilemediği
 * için burada elle tekrarlanır — script derlenmeden node ile çalışır).
 */
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";

const email = process.argv[2];
if (!email) {
  console.error("Kullanım: npm run admin:grant -- <email>");
  process.exit(1);
}

async function grantWithNeon(databaseUrl, targetEmail) {
  const sql = neon(databaseUrl);
  const rows = await sql`
    UPDATE users SET role = 'admin' WHERE email = ${targetEmail}
    RETURNING id, email, role
  `;
  return rows;
}

async function grantWithPglite(targetEmail) {
  const client = new PGlite(".pglite/");
  try {
    const result = await client.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
      [targetEmail],
    );
    return result.rows;
  } finally {
    await client.close();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const rows = databaseUrl
    ? await grantWithNeon(databaseUrl, email)
    : await grantWithPglite(email);

  if (rows.length === 0) {
    console.error(`Kullanıcı bulunamadı: ${email}`);
    process.exit(1);
  }

  console.log(`role='admin' yapıldı: ${JSON.stringify(rows[0])}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
