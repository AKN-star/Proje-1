import { describe, expect, it } from "vitest";
import { validateExperienceInput } from "./experience";

const validUuid = "11111111-1111-1111-1111-111111111111";
const validUuid2 = "22222222-2222-2222-2222-222222222222";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    purpose: "Baş ağrısı",
    body: "Bu ilacı düzenli kullandım.",
    effectiveness: 4,
    durationDays: 10,
    sideEffectIds: [validUuid],
    ...overrides,
  };
}

describe("validateExperienceInput", () => {
  it("geçerli girdiyi kabul eder", () => {
    const result = validateExperienceInput(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.purpose).toBe("Baş ağrısı");
      expect(result.data.sideEffectIds).toEqual([validUuid]);
    }
  });

  it("durationDays null olabilir", () => {
    const result = validateExperienceInput(baseInput({ durationDays: null }));
    expect(result.ok).toBe(true);
  });

  it("sideEffectIds boş liste olabilir", () => {
    const result = validateExperienceInput(baseInput({ sideEffectIds: [] }));
    expect(result.ok).toBe(true);
  });

  it("sideEffectIds atlanabilir (undefined)", () => {
    const { sideEffectIds, ...rest } = baseInput();
    void sideEffectIds;
    const result = validateExperienceInput(rest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sideEffectIds).toEqual([]);
    }
  });

  it("çok kısa purpose'u reddeder", () => {
    const result = validateExperienceInput(baseInput({ purpose: "ab" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.purpose).toBeDefined();
    }
  });

  it("çok uzun purpose'u reddeder", () => {
    const result = validateExperienceInput(
      baseInput({ purpose: "a".repeat(201) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.purpose).toBeDefined();
    }
  });

  it("3 karakter purpose sınırını kabul eder", () => {
    const result = validateExperienceInput(baseInput({ purpose: "abc" }));
    expect(result.ok).toBe(true);
  });

  it("200 karakter purpose sınırını kabul eder", () => {
    const result = validateExperienceInput(
      baseInput({ purpose: "a".repeat(200) }),
    );
    expect(result.ok).toBe(true);
  });

  it("çok kısa body'yi reddeder", () => {
    const result = validateExperienceInput(baseInput({ body: "kısa" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("çok uzun body'yi reddeder", () => {
    const result = validateExperienceInput(
      baseInput({ body: "a".repeat(5001) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("effectiveness 0'ı reddeder", () => {
    const result = validateExperienceInput(baseInput({ effectiveness: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.effectiveness).toBeDefined();
    }
  });

  it("effectiveness 6'yı reddeder", () => {
    const result = validateExperienceInput(baseInput({ effectiveness: 6 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.effectiveness).toBeDefined();
    }
  });

  it("effectiveness 1.5 (tam sayı olmayan) değeri reddeder", () => {
    const result = validateExperienceInput(baseInput({ effectiveness: 1.5 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.effectiveness).toBeDefined();
    }
  });

  it("durationDays 0'ı reddeder", () => {
    const result = validateExperienceInput(baseInput({ durationDays: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.durationDays).toBeDefined();
    }
  });

  it("durationDays 3651'i reddeder", () => {
    const result = validateExperienceInput(
      baseInput({ durationDays: 3651 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.durationDays).toBeDefined();
    }
  });

  it("geçersiz uuid içeren sideEffectIds'i reddeder", () => {
    const result = validateExperienceInput(
      baseInput({ sideEffectIds: ["not-a-uuid"] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.sideEffectIds).toBeDefined();
    }
  });

  it("11 yan etkiyi reddeder (maks 10)", () => {
    const ids = Array.from({ length: 11 }, (_, i) =>
      i % 2 === 0 ? validUuid : validUuid2,
    );
    const result = validateExperienceInput(baseInput({ sideEffectIds: ids }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.sideEffectIds).toBeDefined();
    }
  });

  it("10 yan etkiyi kabul eder (sınır)", () => {
    const ids = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? validUuid : validUuid2,
    );
    const result = validateExperienceInput(baseInput({ sideEffectIds: ids }));
    expect(result.ok).toBe(true);
  });

  it("null veya object olmayan girdiyi reddeder", () => {
    const result = validateExperienceInput(null);
    expect(result.ok).toBe(false);
  });
});
