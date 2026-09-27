import { CHINESE_CODES, findLanguage, getLanguageTitle, LANGUAGES } from "./languages";

describe("LANGUAGES", () => {
  it("does not list writing styles as languages", () => {
    const codes = LANGUAGES.map((language) => language.code);
    expect(codes).not.toContain("lzh");
    expect(codes).not.toContain("xdbhw");
    expect(codes).not.toContain("ko-banmal");
    expect(CHINESE_CODES).not.toContain("lzh");
    expect(CHINESE_CODES).not.toContain("xdbhw");
  });

  it("has unique codes", () => {
    const codes = LANGUAGES.map((language) => language.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes Taiwanese Hokkien as a source and target language", () => {
    expect(findLanguage("nan")).toEqual({
      code: "nan",
      name: "臺灣話",
      nameEn: "Taiwanese Hokkien",
      phoneticNotation: "Tâi-lô",
      aliases: ["閩南語", "台語", "臺語", "Hokkien", "Taiwanese"],
      writingNote:
        "Write Taiwanese Hokkien in Han characters following the Taiwan Ministry of Education's recommended characters (臺灣台語推薦用字), using Taiwanese vocabulary and grammar rather than Mandarin wording.",
      isSource: true,
      isTarget: true,
    });
  });

  it("includes Hakka as a source and target language", () => {
    expect(findLanguage("hak")).toEqual({
      code: "hak",
      name: "客家話",
      nameEn: "Hakka",
      phoneticNotation: "Taiwanese Hakka Pinyin",
      aliases: ["客語", "客家語"],
      writingNote:
        "Write Taiwanese Hakka (Sixian dialect unless the text suggests another) in Han characters following the Taiwan Ministry of Education's recommended characters (臺灣客家語書寫推薦用字), using Hakka vocabulary and grammar rather than Mandarin wording.",
      isSource: true,
      isTarget: true,
    });
  });

  it("gives Cantonese a writing note for colloquial written Cantonese", () => {
    expect(findLanguage("yue")?.writingNote).toBe(
      "Write colloquial written Cantonese in Traditional Chinese characters (for example 係, 唔, 嘅, 咗) rather than Standard Written Chinese.",
    );
  });

  it("places Taiwanese Hokkien and Hakka right after Cantonese", () => {
    const codes = LANGUAGES.map((language) => language.code);
    const yueIndex = codes.indexOf("yue");
    expect(codes.slice(yueIndex, yueIndex + 3)).toEqual(["yue", "nan", "hak"]);
  });

  it("treats Taiwanese Hokkien and Hakka as Chinese", () => {
    expect(CHINESE_CODES).toEqual(["zh-Hans", "zh-Hant", "yue", "nan", "hak"]);
  });

  it("titles Taiwanese Hokkien with its English and native names", () => {
    expect(getLanguageTitle("nan")).toBe("Taiwanese Hokkien (臺灣話)");
  });
});
