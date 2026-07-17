import { describe, expect, it } from "vitest";
import { appendQuery, buildReturnPath, safeInternalPath } from "./url";

describe("safeInternalPath", () => {
  it("site içi göreli yolu aynen döner", () => {
    expect(safeInternalPath("/baslik/parol?sirala=oy")).toBe("/baslik/parol?sirala=oy");
  });

  it("mutlak URL, protokolsüz '//' ve ters bölü hilelerini fallback'e düşürür", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
    expect(safeInternalPath("/a\\b")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });
});

describe("appendQuery", () => {
  it("query'siz yola '?', query'li yola '&' ile ekler", () => {
    expect(appendQuery("/soru/1", "cevirHata=1")).toBe("/soru/1?cevirHata=1");
    expect(appendQuery("/baslik/parol?sirala=oy", "dil=en")).toBe(
      "/baslik/parol?sirala=oy&dil=en",
    );
  });
});

describe("buildReturnPath", () => {
  it("dolu param'ları korur, boş/undefined'ı atlar", () => {
    expect(buildReturnPath("/baslik/parol", { sirala: "oy", bos: "" })).toBe(
      "/baslik/parol?sirala=oy",
    );
    expect(buildReturnPath("/soru/1", {})).toBe("/soru/1");
  });
});
