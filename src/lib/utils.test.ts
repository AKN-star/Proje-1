import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("çakışan Tailwind sınıflarında sonuncuyu kazandırır", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("koşullu sınıfları eler", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
