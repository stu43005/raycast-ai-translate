import { spawn } from "child_process";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { Invocation } from "./providers";
import { CliNotFoundError, runInvocation } from "./runner";

jest.mock("child_process");

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = jest.fn(() => true);
  stdinText = "";

  constructor() {
    super();
    this.stdin.on("data", (chunk) => (this.stdinText += String(chunk)));
  }

  finish(code: number | null) {
    this.stdout.end();
    this.stderr.end();
    // Let pending stream data events flush before "close", as Node does.
    setImmediate(() => this.emit("close", code));
  }
}

let child: FakeChild;

beforeEach(() => {
  child = new FakeChild();
  jest.mocked(spawn).mockReset();
  jest.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
});

const textInvocation: Invocation = { command: "codex", args: ["exec", "-"], stdin: "PROMPT", output: "text" };

describe("runInvocation", () => {
  it("spawns the command with args, env and cwd, and writes stdin", async () => {
    const env = { PATH: "/opt/homebrew/bin" };
    const promise = runInvocation(textInvocation, { env, cwd: "/tmp" });
    child.stdout.write("  早安\n");
    child.finish(0);

    await expect(promise).resolves.toBe("早安");
    expect(spawn).toHaveBeenCalledWith("codex", ["exec", "-"], expect.objectContaining({ env, cwd: "/tmp" }));
    expect(child.stdinText).toBe("PROMPT");
  });

  it("reports streamed progress as the accumulated text", async () => {
    const progress: string[] = [];
    const promise = runInvocation(
      { command: "claude", args: [], stdin: "", output: "claude-stream-json" },
      { onProgress: (text) => progress.push(text) },
    );
    const delta = (text: string) =>
      JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text } },
      }) + "\n";
    child.stdout.write(delta("Hel"));
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.write(delta("lo"));
    child.finish(0);

    await expect(promise).resolves.toBe("Hello");
    expect(progress).toEqual(["Hel", "Hello"]);
  });

  it("rejects with the parser error for claude error results", async () => {
    const promise = runInvocation({ command: "claude", args: [], stdin: "", output: "claude-stream-json" });
    child.stdout.write(JSON.stringify({ type: "result", is_error: true, result: "Not logged in" }) + "\n");
    child.finish(1);

    await expect(promise).rejects.toThrow("Not logged in");
  });

  it("rejects with stderr (without ANSI colors) when the process exits non-zero", async () => {
    const promise = runInvocation(textInvocation);
    child.stderr.write("\u001b[31mError: quota exceeded\u001b[0m\n");
    child.finish(2);

    await expect(promise).rejects.toThrow(/^Error: quota exceeded$/);
  });

  it("falls back to the exit code when stderr is empty", async () => {
    const promise = runInvocation(textInvocation);
    child.finish(3);

    await expect(promise).rejects.toThrow("codex exited with code 3");
  });

  it("rejects when the CLI succeeds without output, surfacing stderr", async () => {
    const promise = runInvocation(textInvocation);
    child.stderr.write("This account requires setting the GOOGLE_CLOUD_PROJECT env var.\n");
    child.finish(0);

    await expect(promise).rejects.toThrow("This account requires setting the GOOGLE_CLOUD_PROJECT env var.");
  });

  it("rejects with CliNotFoundError when the executable is missing", async () => {
    const promise = runInvocation(textInvocation);
    child.emit("error", Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" }));

    await expect(promise).rejects.toBeInstanceOf(CliNotFoundError);
    await expect(promise).rejects.toMatchObject({ command: "codex" });
  });

  it("kills the process and rejects with AbortError when aborted", async () => {
    const controller = new AbortController();
    const promise = runInvocation(textInvocation, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(child.kill).toHaveBeenCalled();
  });

  it("rejects immediately without spawning when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(runInvocation(textInvocation, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("kills the process and rejects when it exceeds the timeout", async () => {
    jest.useFakeTimers();
    try {
      const promise = runInvocation(textInvocation, { timeoutMs: 5000 });
      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow("codex timed out after 5 seconds");
      expect(child.kill).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
