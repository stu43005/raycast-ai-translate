import { execFile } from "child_process";
import { userInfo } from "os";
import { extractMarkedPath, fallbackPathDirs, getCliEnv, mergePathLists } from "./shell-env";

jest.mock("child_process");

describe("getCliEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Raycast launches extensions without USER / LOGNAME and with a minimal PATH.
    process.env = { HOME: "/Users/me", PATH: "/usr/bin:/bin" };
    jest.mocked(execFile).mockImplementation(((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
      callback(null, "__AI_CLI_TRANSLATE_PATH__/Users/me/.nvm/bin:/opt/homebrew/bin__AI_CLI_TRANSLATE_PATH__", "");
    }) as unknown as typeof execFile);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prepends the login shell PATH", async () => {
    const env = await getCliEnv();
    expect(env.PATH?.split(":").slice(0, 3)).toEqual(["/Users/me/.nvm/bin", "/opt/homebrew/bin", "/usr/bin"]);
  });

  it("fills in USER and LOGNAME, which CLIs need to read their credentials from the keychain", async () => {
    const env = await getCliEnv();
    expect(env.USER).toBe(userInfo().username);
    expect(env.LOGNAME).toBe(userInfo().username);
  });

  it("keeps USER and LOGNAME when they are already set", async () => {
    process.env = { ...process.env, USER: "alice", LOGNAME: "alice" };
    const env = await getCliEnv();
    expect(env.USER).toBe("alice");
    expect(env.LOGNAME).toBe("alice");
  });
});

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
