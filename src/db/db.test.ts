import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

describe("db altyapı smoke testi", () => {
  it("in-memory PGlite üzerinde Drizzle sorgusu çalıştırır", async () => {
    const client = new PGlite();
    const db = drizzle(client);

    const result = await db.execute<{ sum: number }>(sql`select 1 + 1 as sum`);
    expect(result.rows[0].sum).toBe(2);

    await client.close();
  });
});
