import { spawn } from "child_process";
import { createOutputParser, Invocation } from "./providers";

/** Thrown when the CLI executable cannot be found on PATH. */
export class CliNotFoundError extends Error {
  constructor(readonly command: string) {
    super(`Command not found: ${command}`);
    this.name = "CliNotFoundError";
  }
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Called with the full text received so far whenever new output arrives. */
  onProgress?: (text: string) => void;
}

const MAX_STDERR_LENGTH = 20_000;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

function abortError(): Error {
  const error = new Error("The translation was cancelled");
  error.name = "AbortError";
  return error;
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function errorMessageFrom(stderr: string): string {
  return stripAnsi(stderr).trim().slice(-MAX_ERROR_MESSAGE_LENGTH);
}

/** Runs a CLI invocation, streaming its parsed output, and resolves with the final trimmed text. */
export function runInvocation(invocation: Invocation, options: RunOptions = {}): Promise<string> {
  const { env, cwd, timeoutMs, signal, onProgress } = options;
  const { command } = invocation;
  if (signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise((resolve, reject) => {
    const parser = createOutputParser(invocation.output);
    let stderr = "";
    let settled = false;

    const child = spawn(command, invocation.args, { env, cwd, stdio: ["pipe", "pipe", "pipe"] });

    const onAbort = () => fail(abortError(), true);
    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(
            () => fail(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)} seconds`), true),
            timeoutMs,
          )
        : undefined;

    function cleanup() {
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    function fail(error: Error, kill = false) {
      if (settled) return;
      cleanup();
      if (kill) child.kill("SIGTERM");
      reject(error);
    }

    signal?.addEventListener("abort", onAbort);

    child.on("error", (error: NodeJS.ErrnoException) => {
      fail(error.code === "ENOENT" ? new CliNotFoundError(command) : error);
    });

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (settled) return;
      const before = parser.text;
      parser.push(chunk);
      if (parser.text !== before) onProgress?.(parser.text);
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-MAX_STDERR_LENGTH);
    });

    child.on("close", (code: number | null) => {
      if (settled) return;
      parser.end();
      if (parser.error) {
        fail(new Error(parser.error));
        return;
      }
      if (code !== 0) {
        fail(new Error(errorMessageFrom(stderr) || `${command} exited with code ${code}`));
        return;
      }
      const text = parser.text.trim();
      if (!text) {
        fail(new Error(errorMessageFrom(stderr) || `${command} returned no output`));
        return;
      }
      cleanup();
      resolve(text);
    });

    // The CLI may exit before reading stdin (e.g. bad flags); ignore EPIPE and rely on "close".
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(invocation.stdin);
  });
}
