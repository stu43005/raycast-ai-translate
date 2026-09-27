import { execFile } from "child_process";
import { homedir, userInfo } from "os";

const PATH_MARKER = "__AI_CLI_TRANSLATE_PATH__";

/** Directories where AI CLIs are commonly installed; used when the login shell PATH is unavailable. */
export function fallbackPathDirs(home = homedir()): string[] {
  return [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    `${home}/.local/bin`,
    `${home}/.npm-global/bin`,
    `${home}/.bun/bin`,
    `${home}/.volta/bin`,
    `${home}/.claude/local`,
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
}

/** Extracts the PATH printed between markers, ignoring any noise emitted by shell startup files. */
export function extractMarkedPath(output: string): string | undefined {
  const start = output.indexOf(PATH_MARKER);
  if (start < 0) {
    return undefined;
  }
  const end = output.indexOf(PATH_MARKER, start + PATH_MARKER.length);
  if (end < 0) {
    return undefined;
  }
  return output.slice(start + PATH_MARKER.length, end) || undefined;
}

/** Joins PATH-like lists, dropping empty entries and duplicates while keeping the first occurrence. */
export function mergePathLists(...lists: (string | undefined)[]): string {
  const dirs = lists.flatMap((list) => (list ? list.split(":") : [])).filter((dir) => dir.length > 0);
  return [...new Set(dirs)].join(":");
}

let cachedShellPath: Promise<string | undefined> | undefined;

function readLoginShellPath(): Promise<string | undefined> {
  const shell = process.env.SHELL || "/bin/zsh";
  return new Promise((resolve) => {
    execFile(
      shell,
      // Braces are required: the marker starts with "_", which would otherwise extend the variable name.
      ["-ilc", `printf '%s' "${PATH_MARKER}\${PATH}${PATH_MARKER}"`],
      { timeout: 5000, env: process.env },
      (error, stdout) => {
        resolve(error && !stdout ? undefined : extractMarkedPath(String(stdout)));
      },
    );
  });
}

/**
 * Environment for spawning CLIs. Raycast starts extensions with a minimal PATH and without USER / LOGNAME;
 * borrow the login shell's PATH and restore the user name, which e.g. Claude Code needs to find its
 * credentials in the macOS keychain (otherwise it reports "Not logged in").
 */
export async function getCliEnv(): Promise<NodeJS.ProcessEnv> {
  cachedShellPath ??= readLoginShellPath();
  const shellPath = await cachedShellPath;
  const username = process.env.USER || process.env.LOGNAME || userInfo().username;
  return {
    ...process.env,
    USER: username,
    LOGNAME: process.env.LOGNAME || username,
    PATH: mergePathLists(shellPath, process.env.PATH, fallbackPathDirs().join(":")),
    NO_COLOR: "1",
  };
}
