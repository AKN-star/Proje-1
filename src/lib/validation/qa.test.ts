import { describe, expect, it } from "vitest";
import { validateAnswerInput, validateQuestionInput } from "./qa";

describe("validateQuestionInput", () => {
  it("geçerli girdiyi kabul eder (body dolu)", () => {
    const result = validateQuestionInput({
      title: "Aç karnına mı alınır?",
      body: "Sabah kahvaltıdan önce mi sonra mı almalıyım?",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Aç karnına mı alınır?");
      expect(result.data.body).toBe(
        "Sabah kahvaltıdan önce mi sonra mı almalıyım?",
      );
    }
  });

  it("body boş string olabilir (null'a normalize edilir)", () => {
    const result = validateQuestionInput({ title: "Bu ilaç güvenli mi?", body: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBeNull();
    }
  });

  it("body atlanabilir (undefined)", () => {
    const result = validateQuestionInput({ title: "Bu ilaç güvenli mi?" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBeNull();
    }
  });

  it("body null olabilir", () => {
    const result = validateQuestionInput({ title: "Bu ilaç güvenli mi?", body: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBeNull();
    }
  });

  it("4 karakter title'ı reddeder", () => {
    const result = validateQuestionInput({ title: "abcd", body: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
    }
  });

  it("5 karakter title sınırını kabul eder", () => {
    const result = validateQuestionInput({ title: "abcde", body: null });
    expect(result.ok).toBe(true);
  });

  it("150 karakter title sınırını kabul eder", () => {
    const result = validateQuestionInput({ title: "a".repeat(150), body: null });
    expect(result.ok).toBe(true);
  });

  it("151 karakter title'ı reddeder", () => {
    const result = validateQuestionInput({ title: "a".repeat(151), body: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
    }
  });

  it("1 karakter body'yi reddeder", () => {
    const result = validateQuestionInput({ title: "abcde", body: "a" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("2 karakter body sınırını kabul eder", () => {
    const result = validateQuestionInput({ title: "abcde", body: "ab" });
    expect(result.ok).toBe(true);
  });

  it("5000 karakter body sınırını kabul eder", () => {
    const result = validateQuestionInput({ title: "abcde", body: "a".repeat(5000) });
    expect(result.ok).toBe(true);
  });

  it("5001 karakter body'yi reddeder", () => {
    const result = validateQuestionInput({ title: "abcde", body: "a".repeat(5001) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("null veya object olmayan girdiyi reddeder", () => {
    const result = validateQuestionInput(null);
    expect(result.ok).toBe(false);
  });
});

describe("validateAnswerInput", () => {
  it("geçerli girdiyi kabul eder", () => {
    const result = validateAnswerInput({ body: "Sabah kahvaltıdan sonra alınmalı." });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBe("Sabah kahvaltıdan sonra alınmalı.");
    }
  });

  it("1 karakter body'yi reddeder", () => {
    const result = validateAnswerInput({ body: "a" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("2 karakter body sınırını kabul eder", () => {
    const result = validateAnswerInput({ body: "ab" });
    expect(result.ok).toBe(true);
  });

  it("5000 karakter body sınırını kabul eder", () => {
    const result = validateAnswerInput({ body: "a".repeat(5000) });
    expect(result.ok).toBe(true);
  });

  it("5001 karakter body'yi reddeder", () => {
    const result = validateAnswerInput({ body: "a".repeat(5001) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("boş body'yi reddeder", () => {
    const result = validateAnswerInput({ body: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.body).toBeDefined();
    }
  });

  it("null veya object olmayan girdiyi reddeder", () => {
    const result = validateAnswerInput(null);
    expect(result.ok).toBe(false);
  });
});
