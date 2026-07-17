import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moderate } from "./moderate";

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

function mockFetchOnce(response: Response | (() => Promise<Response>)) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (typeof response === "function") return response();
      return response;
    }),
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    { status: 200 },
  );
}

describe("moderate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
    }
  });

  describe("anahtar yokken (dev modu)", () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("her zaman ok döner, reasons no-api-key içerir", async () => {
      const result = await moderate("herhangi bir içerik", "experience");
      expect(result).toEqual({ verdict: "ok", reasons: ["no-api-key"] });
    });

    it("gerçek fetch çağrısı yapmaz", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await moderate("içerik", "question");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("anahtar varken", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
    });

    it("ok verdict'i döner", async () => {
      mockFetchOnce(jsonResponse({ verdict: "ok", reasons: [] }));
      const result = await moderate("normal bir deneyim metni", "experience");
      expect(result).toEqual({ verdict: "ok", reasons: [] });
    });

    it("flag verdict'i döner", async () => {
      mockFetchOnce(jsonResponse({ verdict: "flag", reasons: ["personal_data"] }));
      const result = await moderate("şüpheli içerik", "experience");
      expect(result).toEqual({ verdict: "flag", reasons: ["personal_data"] });
    });

    it("block verdict'i döner", async () => {
      mockFetchOnce(jsonResponse({ verdict: "block", reasons: ["drug_sale"] }));
      const result = await moderate("ilaç satıyorum", "experience");
      expect(result).toEqual({ verdict: "block", reasons: ["drug_sale"] });
    });

    it("bozuk JSON yanıtında flag döner (temkinli)", async () => {
      mockFetchOnce(
        new Response(
          JSON.stringify({ content: [{ type: "text", text: "bu JSON değil {{{" }] }),
          { status: 200 },
        ),
      );
      const result = await moderate("içerik", "experience");
      expect(result).toEqual({ verdict: "flag", reasons: ["parse-error"] });
    });

    it("beklenmeyen verdict alanında flag döner", async () => {
      mockFetchOnce(jsonResponse({ verdict: "unknown", reasons: [] }));
      const result = await moderate("içerik", "experience");
      expect(result).toEqual({ verdict: "flag", reasons: ["parse-error"] });
    });

    it("AbortError (timeout) durumunda timeout verdict'i döner", async () => {
      mockFetchOnce(() => {
        const err = new DOMException("The operation was aborted.", "AbortError");
        return Promise.reject(err);
      });
      const result = await moderate("içerik", "experience");
      expect(result).toEqual({ verdict: "timeout", reasons: ["timeout"] });
    });

    it("ağ hatasında timeout verdict'i döner", async () => {
      mockFetchOnce(() => Promise.reject(new Error("network down")));
      const result = await moderate("içerik", "experience");
      expect(result).toEqual({ verdict: "timeout", reasons: ["timeout"] });
    });

    it("API 4xx/5xx döndüğünde timeout verdict'i döner", async () => {
      mockFetchOnce(new Response("hata", { status: 500 }));
      const result = await moderate("içerik", "experience");
      expect(result).toEqual({ verdict: "timeout", reasons: ["timeout"] });
    });
  });
});
