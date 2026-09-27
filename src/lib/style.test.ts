import {
  DEFAULT_FORMALITY,
  DEFAULT_STYLE,
  TRANSLATION_STYLES,
  formalityOptions,
  normalizeFormality,
  styleInstructions,
} from "./style";

const NATURAL =
  "Translate naturally: convey the meaning the way a native speaker would say it, adapting idioms and sentence structure where needed.";
const LITERAL =
  "Translate literally: stay as close to the original wording and sentence structure as the target language's grammar allows, without adding or leaving out anything.";
const STANDARD = "Keep the level of formality of the original text.";

describe("defaults", () => {
  it("uses natural style and standard formality", () => {
    expect(DEFAULT_STYLE).toBe("natural");
    expect(DEFAULT_FORMALITY).toBe("standard");
  });
});

describe("TRANSLATION_STYLES", () => {
  it("lists natural then literal with titles and instructions", () => {
    expect(TRANSLATION_STYLES).toEqual([
      { id: "natural", title: "Natural", instruction: NATURAL },
      { id: "literal", title: "Literal", instruction: LITERAL },
    ]);
  });
});

describe("formalityOptions", () => {
  it("returns the generic options for other languages", () => {
    expect(formalityOptions("fr")).toEqual([
      { id: "standard", title: "Standard", instruction: STANDARD },
      { id: "formal", title: "Formal", instruction: "Use a formal, polite register." },
      { id: "informal", title: "Informal", instruction: "Use a casual, informal register." },
    ]);
    expect(formalityOptions("en").map((o) => o.id)).toEqual(["standard", "formal", "informal"]);
  });

  it("returns 您/你 options for zh-Hant and zh-Hans", () => {
    for (const lang of ["zh-Hant", "zh-Hans"]) {
      expect(formalityOptions(lang).map((o) => [o.id, o.title])).toEqual([
        ["standard", "Standard"],
        ["formal", "Formal (您)"],
        ["informal", "Informal (你)"],
      ]);
    }
  });

  it("does not use the Chinese options for yue, nan or hak", () => {
    for (const lang of ["yue", "nan", "hak"]) {
      expect(formalityOptions(lang).map((o) => o.title)).toEqual(["Standard", "Formal", "Informal"]);
    }
  });

  it("returns the Japanese keigo options for ja and ja-*", () => {
    const expected = [
      ["standard", "Standard"],
      ["sonkeigo", "Sonkeigo (尊敬語)"],
      ["kenjougo", "Kenjōgo (謙譲語)"],
      ["teineigo", "Teineigo (丁寧語)"],
      ["bikago", "Bikago (美化語)"],
      ["informal", "Informal (タメ口)"],
    ];
    expect(formalityOptions("ja").map((o) => [o.id, o.title])).toEqual(expected);
    expect(formalityOptions("ja-JP").map((o) => [o.id, o.title])).toEqual(expected);
  });

  it("returns the Korean options for ko and ko-*", () => {
    const expected = [
      ["standard", "Standard"],
      ["formal", "Formal (존댓말)"],
      ["informal", "Informal (반말)"],
    ];
    expect(formalityOptions("ko").map((o) => [o.id, o.title])).toEqual(expected);
    expect(formalityOptions("ko-KR").map((o) => [o.id, o.title])).toEqual(expected);
  });

  it("does not treat codes that merely start with ja/ko letters as Japanese/Korean", () => {
    expect(formalityOptions("jv").map((o) => o.id)).toEqual(["standard", "formal", "informal"]);
    expect(formalityOptions("kok").map((o) => o.title)).toEqual(["Standard", "Formal", "Informal"]);
  });
});

describe("normalizeFormality", () => {
  it("keeps an id that is valid for the target", () => {
    expect(normalizeFormality("fr", "formal")).toBe("formal");
    expect(normalizeFormality("ja", "sonkeigo")).toBe("sonkeigo");
    expect(normalizeFormality("ko", "informal")).toBe("informal");
  });

  it("falls back to standard for ids not offered for the target", () => {
    expect(normalizeFormality("fr", "sonkeigo")).toBe("standard");
    expect(normalizeFormality("ja", "formal")).toBe("standard");
    expect(normalizeFormality("en", "nonsense")).toBe("standard");
  });

  it("falls back to standard when undefined", () => {
    expect(normalizeFormality("en", undefined)).toBe("standard");
  });
});

describe("styleInstructions", () => {
  it("returns the style and generic formality instructions", () => {
    expect(styleInstructions("en", "natural", "standard")).toEqual([NATURAL, STANDARD]);
    expect(styleInstructions("fr", "literal", "formal")).toEqual([LITERAL, "Use a formal, polite register."]);
  });

  it("uses the 您 instruction for zh-Hans formal", () => {
    expect(styleInstructions("zh-Hans", "natural", "formal")).toEqual([
      NATURAL,
      "Use a formal register and address the reader with the polite 「您」 rather than 「你」.",
    ]);
  });

  it("uses the Japanese keigo instruction", () => {
    expect(styleInstructions("ja", "literal", "kenjougo")).toEqual([
      LITERAL,
      "Use kenjōgo (謙譲語): lower the speaker's own actions with humble forms such as 参る, 申す, いただく and お〜する.",
    ]);
    expect(styleInstructions("ja", "natural", "sonkeigo")[1]).toBe(
      "Use sonkeigo (尊敬語): raise the person being addressed or discussed with respectful forms such as いらっしゃる, おっしゃる, 召し上がる and お〜になる.",
    );
    expect(styleInstructions("ja", "natural", "teineigo")[1]).toBe(
      "Use teineigo (丁寧語): the polite です/ます forms throughout.",
    );
    expect(styleInstructions("ja", "natural", "bikago")[1]).toBe(
      "Use bikago (美化語): refined wording with the beautifying お/ご prefixes where natural (for example お茶, ご飯), together with です/ます.",
    );
    expect(styleInstructions("ja", "natural", "informal")[1]).toBe(
      "Use casual Japanese (タメ口): plain forms without です/ます.",
    );
  });

  it("uses the Korean instructions", () => {
    expect(styleInstructions("ko", "natural", "informal")).toEqual([
      NATURAL,
      "Use casual Korean (반말) with plain, non-honorific endings and no -요 or -습니다.",
    ]);
    expect(styleInstructions("ko", "natural", "formal")[1]).toBe(
      "Use formal polite Korean (합쇼체 with -습니다/-ㅂ니다 endings).",
    );
  });

  it("falls back to the standard instruction for an invalid formality", () => {
    expect(styleInstructions("ja", "natural", "formal")).toEqual([NATURAL, STANDARD]);
    expect(styleInstructions("fr", "literal", "bikago")).toEqual([LITERAL, STANDARD]);
  });
});
