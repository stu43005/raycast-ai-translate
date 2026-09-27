import { CHINESE_CODES, LANGUAGES } from "./languages";

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
});
