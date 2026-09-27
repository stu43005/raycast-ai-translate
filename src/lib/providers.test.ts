import { buildInvocation, createOutputParser, getProvider, PROVIDERS, splitArgs } from "./providers";

const prompt = { system: "SYS", user: "Hello" };
const combined = "SYS\n\nHello";

const CLAUDE_BASE = [
  "-p",
  "--system-prompt",
  "SYS",
  "--tools",
  "",
  "--no-session-persistence",
  "--setting-sources",
  "",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--output-format",
  "stream-json",
  "--include-partial-messages",
  "--verbose",
];

function streamDelta(text: string, index = 1): string {
  return JSON.stringify({
    type: "stream_event",
    event: { type: "content_block_delta", index, delta: { type: "text_delta", text } },
    session_id: "abc",
  });
}

function blockStart(type: string, index: number): string {
  return JSON.stringify({
    type: "stream_event",
    event: { type: "content_block_start", index, content_block: { type, text: "" } },
    session_id: "abc",
  });
}

describe("PROVIDERS / getProvider", () => {
  it("lists every provider with title, binary and install hint", () => {
    expect(PROVIDERS.map((p) => [p.id, p.title, p.binary])).toEqual([
      ["claude", "Claude Code", "claude"],
      ["codex", "Codex", "codex"],
      ["gemini", "Gemini CLI", "gemini"],
      ["copilot", "Copilot CLI", "copilot"],
      ["custom", "Custom Command", ""],
    ]);
    expect(getProvider("claude").installHint).toBe("npm install -g @anthropic-ai/claude-code");
    expect(getProvider("codex").installHint).toBe("npm install -g @openai/codex");
    expect(getProvider("gemini").installHint).toBe("npm install -g @google/gemini-cli");
    expect(getProvider("copilot").installHint).toBe("npm install -g @github/copilot");
    expect(getProvider("custom").installHint).toBe("Set a custom command in preferences");
  });

  it("falls back to claude for unknown ids", () => {
    expect(getProvider("nope").id).toBe("claude");
    expect(getProvider("gemini").id).toBe("gemini");
  });
});

describe("buildInvocation", () => {
  it("builds the claude invocation", () => {
    expect(buildInvocation("claude", prompt)).toEqual({
      command: "claude",
      args: CLAUDE_BASE,
      stdin: "Hello",
      output: "claude-stream-json",
    });
  });

  it("appends claude model and extra args, and honours binaryPath", () => {
    const inv = buildInvocation("claude", prompt, {
      model: " sonnet ",
      binaryPath: " /opt/bin/claude ",
      extraArgs: `--foo "a b" 'c d'`,
    });
    expect(inv.command).toBe("/opt/bin/claude");
    expect(inv.args).toEqual([...CLAUDE_BASE, "--model", "sonnet", "--foo", "a b", "c d"]);
  });

  it("builds the codex invocation with '-' last", () => {
    expect(buildInvocation("codex", prompt)).toEqual({
      command: "codex",
      args: ["exec", "--skip-git-repo-check", "--ephemeral", "-s", "read-only", "--color", "never", "-"],
      stdin: combined,
      output: "text",
    });
    const inv = buildInvocation("codex", prompt, { model: "gpt-5", extraArgs: `-c "x=1"` });
    expect(inv.args).toEqual([
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "-s",
      "read-only",
      "--color",
      "never",
      "-m",
      "gpt-5",
      "-c",
      "x=1",
      "-",
    ]);
  });

  it("builds the gemini invocation with the prompt as the last argument", () => {
    expect(buildInvocation("gemini", prompt)).toEqual({
      command: "gemini",
      args: ["-o", "text", combined],
      stdin: "",
      output: "text",
    });
    const inv = buildInvocation("gemini", prompt, { model: "gemini-2.5-flash", extraArgs: "--yolo" });
    expect(inv.args).toEqual(["-o", "text", "-m", "gemini-2.5-flash", "--yolo", combined]);
  });

  it("builds the copilot invocation", () => {
    expect(buildInvocation("copilot", prompt)).toEqual({
      command: "copilot",
      args: ["-p", combined, "-s", "--no-color", "--no-custom-instructions", "--stream", "on"],
      stdin: "",
      output: "text",
    });
    const inv = buildInvocation("copilot", prompt, { model: "gpt-5", extraArgs: "--allow-all-tools" });
    expect(inv.args).toEqual([
      "-p",
      combined,
      "-s",
      "--no-color",
      "--no-custom-instructions",
      "--stream",
      "on",
      "--model",
      "gpt-5",
      "--allow-all-tools",
    ]);
  });

  it("ignores blank model, binaryPath and extraArgs", () => {
    const inv = buildInvocation("copilot", prompt, { model: "  ", binaryPath: " ", extraArgs: "  " });
    expect(inv.command).toBe("copilot");
    expect(inv.args).toEqual(["-p", combined, "-s", "--no-color", "--no-custom-instructions", "--stream", "on"]);
  });

  it("builds the custom invocation through the login shell", () => {
    expect(buildInvocation("custom", prompt, { customCommand: "my-llm --fast" })).toEqual({
      command: "/bin/zsh",
      args: ["-lc", "my-llm --fast"],
      stdin: combined,
      output: "text",
    });
    const inv = buildInvocation("custom", prompt, { customCommand: "x", shell: "/bin/bash", binaryPath: "/ignored" });
    expect(inv.command).toBe("/bin/bash");
  });

  it("throws when the custom command is missing or blank", () => {
    const message = "Custom command is not configured. Set it in the extension preferences.";
    expect(() => buildInvocation("custom", prompt)).toThrow(message);
    expect(() => buildInvocation("custom", prompt, { customCommand: "   " })).toThrow(message);
  });
});

describe("splitArgs", () => {
  it("returns an empty list for empty or blank input", () => {
    expect(splitArgs("")).toEqual([]);
    expect(splitArgs("   \t\n ")).toEqual([]);
  });

  it("splits on any whitespace", () => {
    expect(splitArgs("  a  b\tc\nd ")).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps single-quoted content literal", () => {
    expect(splitArgs(`'a b' 'x\\y "z"'`)).toEqual(["a b", 'x\\y "z"']);
  });

  it("supports escapes inside double quotes", () => {
    expect(splitArgs(`"say \\"hi\\"" "back\\\\slash" "a\\nb"`)).toEqual(['say "hi"', "back\\slash", "a\\nb"]);
  });

  it("supports backslash escapes outside quotes and adjacent quoted parts", () => {
    expect(splitArgs(`a\\ b --k="v w"'x' ""`)).toEqual(["a b", "--k=v wx", ""]);
  });
});

describe("text parser", () => {
  it("concatenates chunks without trimming", () => {
    const parser = createOutputParser("text");
    parser.push(" Hel");
    parser.push("lo\n");
    parser.end();
    expect(parser.text).toBe(" Hello\n");
    expect(parser.error).toBeUndefined();
  });
});

describe("claude-stream-json parser", () => {
  it("accumulates text deltas across arbitrary chunk boundaries and ignores noise", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({ type: "stream_event", event: { type: "message_start" } }),
      JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hmm" } },
      }),
      blockStart("text", 1),
      streamDelta("お"),
      "not json at all",
      "",
      streamDelta("はよう"),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "おはよう" }] } }),
      JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "おはよう" }),
    ];
    const raw = lines.join("\n") + "\n";
    const parser = createOutputParser("claude-stream-json");
    for (let i = 0; i < raw.length; i += 7) parser.push(raw.slice(i, i + 7));
    parser.end();
    expect(parser.text).toBe("おはよう");
    expect(parser.error).toBeUndefined();
  });

  it("exposes partial text while streaming", () => {
    const parser = createOutputParser("claude-stream-json");
    const line = streamDelta("abc");
    parser.push(line.slice(0, 10));
    expect(parser.text).toBe("");
    parser.push(line.slice(10) + "\n");
    expect(parser.text).toBe("abc");
  });

  it("separates consecutive text blocks with a blank line", () => {
    const parser = createOutputParser("claude-stream-json");
    parser.push([blockStart("text", 0), streamDelta("one", 0), blockStart("text", 1), streamDelta("two")].join("\n"));
    parser.end();
    expect(parser.text).toBe("one\n\ntwo");
  });

  it("does not insert a separator before the first text block", () => {
    const parser = createOutputParser("claude-stream-json");
    parser.push([blockStart("thinking", 0), blockStart("text", 1), streamDelta("hi")].join("\n") + "\n");
    parser.end();
    expect(parser.text).toBe("hi");
  });

  it("falls back to the result text when no deltas were received", () => {
    const parser = createOutputParser("claude-stream-json");
    parser.push(
      JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "おはようございます。" }),
    );
    parser.end();
    expect(parser.text).toBe("おはようございます。");
    expect(parser.error).toBeUndefined();
  });

  it("flushes a final unterminated line on end()", () => {
    const parser = createOutputParser("claude-stream-json");
    parser.push(streamDelta("tail"));
    expect(parser.text).toBe("");
    parser.end();
    expect(parser.text).toBe("tail");
  });

  it("reports an error result", () => {
    const parser = createOutputParser("claude-stream-json");
    parser.push(
      JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Invalid API key" }) + "\n",
    );
    parser.end();
    expect(parser.error).toBe("Invalid API key");
  });

  it("reports error subtypes using the errors array or a default message", () => {
    const withErrors = createOutputParser("claude-stream-json");
    withErrors.push(JSON.stringify({ type: "result", subtype: "error_during_execution", errors: ["a", "b"] }));
    withErrors.end();
    expect(withErrors.error).toBe("a\nb");

    const bare = createOutputParser("claude-stream-json");
    bare.push(JSON.stringify({ type: "result", subtype: "error_max_turns" }));
    bare.end();
    expect(bare.error).toBe("Claude CLI returned an error");
  });
});
