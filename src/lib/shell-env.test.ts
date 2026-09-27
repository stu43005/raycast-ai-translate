import { extractMarkedPath, fallbackPathDirs, mergePathLists } from "./shell-env";

describe("extractMarkedPath", () => {
  it("returns the PATH between markers and ignores shell startup noise", () => {
    const output = "Welcome to zsh!\n__AI_CLI_TRANSLATE_PATH__/opt/homebrew/bin:/usr/bin__AI_CLI_TRANSLATE_PATH__\nbye";
    expect(extractMarkedPath(output)).toBe("/opt/homebrew/bin:/usr/bin");
  });

  it("returns undefined when markers are missing or PATH is empty", () => {
    expect(extractMarkedPath("no markers here")).toBeUndefined();
    expect(extractMarkedPath("__AI_CLI_TRANSLATE_PATH____AI_CLI_TRANSLATE_PATH__")).toBeUndefined();
  });
});

describe("mergePathLists", () => {
  it("keeps the first occurrence order and drops duplicates and empty entries", () => {
    expect(mergePathLists("/a:/b", undefined, "/b::/c", "", "/a:/d")).toBe("/a:/b:/c:/d");
  });
});

describe("fallbackPathDirs", () => {
  it("includes Homebrew, user-local and system directories", () => {
    const dirs = fallbackPathDirs("/Users/me");
    expect(dirs).toEqual(
      expect.arrayContaining(["/opt/homebrew/bin", "/usr/local/bin", "/Users/me/.local/bin", "/usr/bin", "/bin"]),
    );
  });
});
