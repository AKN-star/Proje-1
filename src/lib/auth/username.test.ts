import { describe, expect, it } from "vitest";
import { generateUsername } from "./username";

describe("generateUsername", () => {
  it("e-posta local-part'ından alfanumerik olmayanları temizler", () => {
    const name = generateUsername("ali.veli+test@example.com", () => 0.1234);
    expect(name).toBe("alivelitest-1234");
  });

  it("her zaman 4 haneli rastgele son ek üretir", () => {
    const name = generateUsername("a@example.com", () => 0.5);
    expect(name).toMatch(/^a-\d{4}$/);
  });

  it("sıfıra yakın rastgele değer soldan sıfırlarla doldurur", () => {
    const name = generateUsername("kisi@example.com", () => 0.0001);
    expect(name).toBe("kisi-0001");
  });

  it("local-part boşsa varsayılan taban kullanır", () => {
    const name = generateUsername("@example.com", () => 0.5);
    expect(name).toMatch(/^kullanici-\d{4}$/);
  });

  it("büyük harfleri küçültür", () => {
    const name = generateUsername("Ahmet@example.com", () => 0);
    expect(name).toBe("ahmet-0000");
  });
});
