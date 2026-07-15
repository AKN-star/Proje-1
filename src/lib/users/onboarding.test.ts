import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";
import {
  completeOnboarding,
  getOnboardingProfile,
  isOnboarded,
  validateUsername,
} from "./onboarding";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../drizzle");

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.exec(statement);
    }
  }
});

afterEach(async () => {
  await client.close();
});

describe("validateUsername", () => {
  it("geçerli takma adları kabul eder", () => {
    expect(validateUsername("yazar1234")).toBeNull();
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("a1-b2_c3")).toBeNull();
  });

  it("kısa, uzun ve geçersiz karakterli adları reddeder", () => {
    expect(validateUsername("ab")).toBe("username");
    expect(validateUsername("a".repeat(31))).toBe("username");
    expect(validateUsername("Büyük")).toBe("username");
    expect(validateUsername("boşluk lu")).toBe("username");
    expect(validateUsername("-tirele")).toBe("username");
    expect(validateUsername("")).toBe("username");
  });
});

describe("completeOnboarding", () => {
  it("username'siz kullanıcı onboarded değildir; tamamlanınca olur", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "yeni@example.com" })
      .returning({ id: users.id });

    let profile = await getOnboardingProfile(db, user.id);
    expect(isOnboarded(profile)).toBe(false);

    const result = await completeOnboarding(db, user.id, "yeni-yazar");
    expect(result).toBe("ok");

    profile = await getOnboardingProfile(db, user.id);
    expect(profile?.username).toBe("yeni-yazar");
    expect(profile?.kvkkConsentAt).toBeInstanceOf(Date);
    expect(isOnboarded(profile)).toBe(true);
  });

  it("alınmış takma adda 'taken' döner ve rıza yazılmaz", async () => {
    await db
      .insert(users)
      .values({ email: "ilk@example.com", username: "ayni-ad" });
    const [ikinci] = await db
      .insert(users)
      .values({ email: "ikinci@example.com" })
      .returning({ id: users.id });

    const result = await completeOnboarding(db, ikinci.id, "ayni-ad");
    expect(result).toBe("taken");

    const profile = await getOnboardingProfile(db, ikinci.id);
    expect(isOnboarded(profile)).toBe(false);
  });
});
