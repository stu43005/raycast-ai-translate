import { toLiteralMarkdown } from "./layout";

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
