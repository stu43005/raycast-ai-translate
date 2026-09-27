import { LanguageSelection, resolveLanguages } from "./resolve";

const base: LanguageSelection = {
  text: "Hello, how are you today?",
  source: "auto",
  target: "zh-Hant",
  secondTarget: "en",
  mode: "translate",
};

describe("resolveLanguages", () => {
  it("detects the source language when set to auto", () => {
    expect(resolveLanguages(base)).toEqual({
      source: "en",
      target: "zh-Hant",
      sourceDetected: true,
      targetSwitched: false,
    });
  });

  it("keeps an explicitly selected source language", () => {
    expect(resolveLanguages({ ...base, source: "fr" })).toEqual({
      source: "fr",
      target: "zh-Hant",
      sourceDetected: false,
      targetSwitched: false,
    });
  });

  it("switches to the second target when the detected source equals the target", () => {
    expect(resolveLanguages({ ...base, text: "今天天氣很好，我們去散步。" })).toEqual({
      source: "zh-Hant",
      target: "en",
      sourceDetected: true,
      targetSwitched: true,
    });
  });

  it("treats Simplified and Traditional Chinese as the same language when detected", () => {
    const resolved = resolveLanguages({ ...base, text: "今天天气很好，我们去散步。" });
    expect(resolved.source).toBe("zh-Hans");
    expect(resolved.target).toBe("en");
  });

  it("treats regional variants as the same language", () => {
    const resolved = resolveLanguages({ ...base, target: "en-US", secondTarget: "ja" });
    expect(resolved.target).toBe("ja");
  });

  it("resolves ambiguous Chinese towards the target variant", () => {
    const resolved = resolveLanguages({ ...base, text: "中文", target: "zh-Hans", secondTarget: "en" });
    expect(resolved.source).toBe("zh-Hans");
  });

  it("does not switch the target when the source was chosen explicitly", () => {
    const resolved = resolveLanguages({ ...base, text: "今天天氣很好", source: "zh-Hans" });
    expect(resolved.target).toBe("zh-Hant");
    expect(resolved.targetSwitched).toBe(false);
  });

  it("does not switch the target outside translate mode", () => {
    const resolved = resolveLanguages({ ...base, text: "今天天氣很好，我們去散步。", mode: "summarize" });
    expect(resolved.target).toBe("zh-Hant");
  });

  it("falls back to another language when the second target is also the source language", () => {
    expect(resolveLanguages({ ...base, target: "en", secondTarget: "en" }).target).toBe("zh-Hant");
    expect(resolveLanguages({ ...base, text: "今天天氣很好", secondTarget: "zh-Hans" }).target).toBe("en");
  });
});
