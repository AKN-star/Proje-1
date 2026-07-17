import { describe, expect, it } from "vitest";
import { moderate } from "./moderate";

describe("moderate", () => {
  it("Faz 1'de her zaman ok döner (deneyim)", async () => {
    const result = await moderate("herhangi bir içerik", "experience");
    expect(result).toEqual({ verdict: "ok", reasons: [] });
  });

  it("Faz 1'de her zaman ok döner (soru)", async () => {
    const result = await moderate("herhangi bir soru", "question");
    expect(result).toEqual({ verdict: "ok", reasons: [] });
  });

  it("Faz 1'de her zaman ok döner (cevap)", async () => {
    const result = await moderate("herhangi bir cevap", "answer");
    expect(result).toEqual({ verdict: "ok", reasons: [] });
  });

  it("boş içerikte de ok döner", async () => {
    const result = await moderate("", "experience");
    expect(result.verdict).toBe("ok");
    expect(result.reasons).toEqual([]);
  });

  it("bir Promise döner (async sözleşme)", () => {
    const result = moderate("x", "experience");
    expect(result).toBeInstanceOf(Promise);
  });
});
