import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { users, experiences } from "@/db/schema";

vi.mock("@/lib/ai/translate", () => ({
  translateText: vi.fn(),
}));

import { translateText } from "@/lib/ai/translate";
import { getCachedTranslation, getOrCreateTranslation } from "./cache";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../drizzle");

beforeEach(async () => {
  vi.mocked(translateText).mockReset();
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

  await seed(db);
});

afterEach(async () => {
  await client.close();
});

async function getParolId(): Promise<string> {
  const parol = await db.query.topics.findFirst({
    where: (t, { eq }) => eq(t.slug, "parol"),
  });
  return parol!.id;
}

async function makeExperience(body: string) {
  const topicId = await getParolId();
  const [user] = await db
    .insert(users)
    .values({ email: `deneyen-${Math.random()}@example.com`, username: `kullanici${Math.floor(Math.random() * 100000)}` })
    .returning();
  const [experience] = await db
    .insert(experiences)
    .values({
      topicId,
      userId: user!.id,
      purpose: "test",
      effectiveness: 3,
      body,
    })
    .returning();
  return experience!;
}

describe("getOrCreateTranslation", () => {
  it("çeviri yoksa translateText çağırır ve önbelleğe yazar", async () => {
    const experience = await makeExperience("Baş ağrım geçti.");
    vi.mocked(translateText).mockResolvedValue({
      ok: true,
      text: "My headache went away.",
      model: "claude-haiku-4-5",
    });

    const result = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: experience.body,
    });

    expect(result).toBe("My headache went away.");
    expect(translateText).toHaveBeenCalledTimes(1);

    const cached = await getCachedTranslation(
      db,
      "experience",
      experience.id,
      "body",
      "en",
    );
    expect(cached?.text).toBe("My headache went away.");
  });

  it("aynı kaynak metin için ikinci çağrıda önbellekten döner, mock tekrar çağrılmaz", async () => {
    const experience = await makeExperience("Mide bulantısı oldu.");
    vi.mocked(translateText).mockResolvedValue({
      ok: true,
      text: "I felt nauseous.",
      model: "claude-haiku-4-5",
    });

    const first = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: experience.body,
    });
    const second = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: experience.body,
    });

    expect(first).toBe("I felt nauseous.");
    expect(second).toBe("I felt nauseous.");
    expect(translateText).toHaveBeenCalledTimes(1);
  });

  it("kaynak metin değişirse (hash uyuşmazlığı) yeniden çevirir ve upsert eder", async () => {
    const experience = await makeExperience("İlk metin.");
    vi.mocked(translateText).mockResolvedValueOnce({
      ok: true,
      text: "First text.",
      model: "claude-haiku-4-5",
    });

    const first = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: "İlk metin.",
    });
    expect(first).toBe("First text.");

    vi.mocked(translateText).mockResolvedValueOnce({
      ok: true,
      text: "Updated text.",
      model: "claude-haiku-4-5",
    });

    const second = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: "Güncellenmiş metin.",
    });

    expect(second).toBe("Updated text.");
    expect(translateText).toHaveBeenCalledTimes(2);

    const cached = await getCachedTranslation(
      db,
      "experience",
      experience.id,
      "body",
      "en",
    );
    expect(cached?.text).toBe("Updated text.");
  });

  it("çeviri başarısız olursa null döner ve hiçbir şey önbelleğe alınmaz", async () => {
    const experience = await makeExperience("Başarısız olacak metin.");
    vi.mocked(translateText).mockResolvedValue({
      ok: false,
      reason: "no-api-key",
    });

    const result = await getOrCreateTranslation(db, {
      targetType: "experience",
      targetId: experience.id,
      field: "body",
      locale: "en",
      sourceText: experience.body,
    });

    expect(result).toBeNull();

    const cached = await getCachedTranslation(
      db,
      "experience",
      experience.id,
      "body",
      "en",
    );
    expect(cached).toBeNull();
  });
});
