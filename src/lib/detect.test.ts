import { detectLanguage, isTraditionalChinese } from "./detect";
import { findLanguage } from "./languages";

describe("isTraditionalChinese", () => {
  it("returns true for traditional-leaning text", () => {
    expect(isTraditionalChinese("這個問題我們明天再來討論")).toBe(true);
  });

  it("returns false for simplified-leaning text", () => {
    expect(isTraditionalChinese("这个问题我们明天再来讨论")).toBe(false);
  });

  it("returns false when there are no distinguishing characters", () => {
    expect(isTraditionalChinese("中文")).toBe(false);
    expect(isTraditionalChinese("")).toBe(false);
  });

  it("follows the majority when both scripts appear", () => {
    expect(isTraditionalChinese("這個們來說会")).toBe(true);
    expect(isTraditionalChinese("这个们来說")).toBe(false);
  });
});

describe("detectLanguage", () => {
  it.each([
    ["English", "The quick brown fox jumps over the lazy dog.", "en"],
    ["Traditional Chinese", "這是一個關於電腦軟體開發的問題，請幫我看看。", "zh-Hant"],
    ["Simplified Chinese", "这是一个关于电脑软件开发的问题，请帮我看看。", "zh-Hans"],
    ["Japanese with kana", "今日は天気がいいので、公園に散歩に行きました。", "ja"],
    ["Japanese katakana only", "コンピューター", "ja"],
    ["Korean", "안녕하세요, 오늘 날씨가 정말 좋네요.", "ko"],
    ["Russian", "Привет, как у тебя дела сегодня?", "ru"],
    ["Ukrainian", "Привіт, як твої справи? Я їду додому.", "uk"],
    ["Greek", "Καλημέρα, τι κάνεις σήμερα;", "el"],
    ["Arabic", "مرحبا، كيف حالك اليوم؟", "ar"],
    ["Persian", "سلام، امروز چطور هستی؟ من به خانه می‌روم.", "fa"],
    ["Hebrew", "שלום, מה שלומך היום?", "he"],
    ["Hindi", "नमस्ते, आप कैसे हैं?", "hi"],
    ["Bengali", "আমি বাংলায় কথা বলি।", "bn"],
    ["Thai", "สวัสดีครับ วันนี้อากาศดีมาก", "th"],
    ["Vietnamese", "Xin chào, hôm nay bạn có khỏe không?", "vi"],
    ["French", "Je ne sais pas si c'est une bonne idée, mais la réunion est à midi.", "fr"],
    ["German", "Ich weiß nicht, ob das eine gute Idee ist, aber die Straße ist schön.", "de"],
    ["Spanish", "¿Dónde está la biblioteca? El niño que vive aquí es muy simpático.", "es"],
    ["Portuguese", "Eu não sei se isso é uma boa ideia, mas a situação está difícil.", "pt"],
    ["Italian", "Il ragazzo che abita qui è molto simpatico e sono contento della sua visita.", "it"],
    ["mixed Chinese and English", "我用 iPhone 拍照", "zh-Hant"],
    ["mixed simplified Chinese and English", "我们用 iPhone 拍照发给朋友", "zh-Hans"],
  ])("detects %s", (_label, text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
  });

  it("uses ambiguousChinese for Chinese text without distinguishing characters", () => {
    expect(detectLanguage("中文")).toBe("zh-Hant");
    expect(detectLanguage("中文", { ambiguousChinese: "zh-Hans" })).toBe("zh-Hans");
    expect(detectLanguage("中文", { ambiguousChinese: "zh-Hant" })).toBe("zh-Hant");
  });

  it("ignores ambiguousChinese when the text has a clear signal", () => {
    expect(detectLanguage("这是简体中文", { ambiguousChinese: "zh-Hant" })).toBe("zh-Hans");
    expect(detectLanguage("這是繁體中文", { ambiguousChinese: "zh-Hans" })).toBe("zh-Hant");
  });

  it("defaults to English for empty, whitespace or letterless text", () => {
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("   \n\t ")).toBe("en");
    expect(detectLanguage("12345 !?.,")).toBe("en");
  });

  it("picks the dominant script", () => {
    expect(detectLanguage("Hello 世界, this is a long English sentence")).toBe("en");
    expect(detectLanguage("Привет world")).toBe("ru");
  });

  it("only looks at the beginning of long text", () => {
    const text = "a".repeat(1000) + "這是一個很長的中文句子".repeat(20);
    expect(detectLanguage(text)).toBe("en");
  });

  it("always returns a known language code", () => {
    const samples = ["", "hello", "這個", "这个", "こんにちは", "안녕", "Привет", "สวัสดี", "Xin chào"];
    for (const sample of samples) {
      expect(findLanguage(detectLanguage(sample))).toBeDefined();
    }
  });
});
