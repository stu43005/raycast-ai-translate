import { charWidth, toLiteralMarkdown, wrapText } from "./layout";

describe("charWidth", () => {
  it("counts CJK, kana, hangul and full-width characters as 2 columns", () => {
    expect(charWidth("中")).toBe(2);
    expect(charWidth("あ")).toBe(2);
    expect(charWidth("한")).toBe(2);
    expect(charWidth("，")).toBe(2);
    expect(charWidth("Ａ")).toBe(2);
  });

  it("counts Latin letters, digits and spaces as 1 column", () => {
    expect(charWidth("a")).toBe(1);
    expect(charWidth("é")).toBe(1);
    expect(charWidth("1")).toBe(1);
    expect(charWidth(" ")).toBe(1);
  });
});

describe("wrapText", () => {
  it("breaks Latin text at spaces without exceeding the width", () => {
    expect(wrapText("The quick brown fox jumps over the lazy dog", 16)).toEqual([
      "The quick brown",
      "fox jumps over",
      "the lazy dog",
    ]);
  });

  it("hard-breaks words longer than the width", () => {
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("breaks CJK text by display width", () => {
    expect(wrapText("今天天氣很好我們去公園", 8)).toEqual(["今天天氣", "很好我們", "去公園"]);
  });

  it("keeps existing line breaks and blank lines", () => {
    expect(wrapText("first line\n\nsecond", 20)).toEqual(["first line", "", "second"]);
  });

  it("normalizes CRLF and drops trailing blank lines", () => {
    expect(wrapText("a\r\nb\n\n", 20)).toEqual(["a", "b"]);
  });

  it("returns an empty list for empty text", () => {
    expect(wrapText("", 20)).toEqual([]);
    expect(wrapText("   \n  ", 20)).toEqual([]);
  });
});

describe("toLiteralMarkdown", () => {
  it("escapes Markdown syntax so it renders literally", () => {
    expect(toLiteralMarkdown("# not a heading")).toBe("\\# not a heading");
    expect(toLiteralMarkdown("*bold* and _it_ `code` [link](x)")).toBe(
      "\\*bold\\* and \\_it\\_ \\`code\\` \\[link\\](x)",
    );
    expect(toLiteralMarkdown("- item\n1. item")).toBe("\\- item  \n1\\. item");
    expect(toLiteralMarkdown("> quote <b>")).toBe("\\> quote &lt;b&gt;");
  });

  it("keeps single line breaks as hard breaks and paragraphs as paragraphs", () => {
    expect(toLiteralMarkdown("line one\nline two\n\nnext paragraph")).toBe("line one  \nline two\n\nnext paragraph");
  });
});
