export type ProviderId = "claude" | "codex" | "gemini" | "copilot" | "custom";

export interface ProviderInfo {
  id: ProviderId;
  title: string;
  /** Default executable name; empty for the custom command provider */
  binary: string;
  installHint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "claude", title: "Claude Code", binary: "claude", installHint: "npm install -g @anthropic-ai/claude-code" },
  { id: "codex", title: "Codex", binary: "codex", installHint: "npm install -g @openai/codex" },
  { id: "gemini", title: "Gemini CLI", binary: "gemini", installHint: "npm install -g @google/gemini-cli" },
  { id: "copilot", title: "Copilot CLI", binary: "copilot", installHint: "npm install -g @github/copilot" },
  { id: "custom", title: "Custom Command", binary: "", installHint: "Set a custom command in preferences" },
];

export function getProvider(id: string): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
}

export interface ProviderOptions {
  model?: string;
  binaryPath?: string;
  extraArgs?: string;
  customCommand?: string;
  shell?: string;
}

export type OutputFormat = "claude-stream-json" | "text";

export interface Invocation {
  command: string;
  args: string[];
  stdin: string;
  output: OutputFormat;
}

const DEFAULT_SHELL = "/bin/zsh";

/**
 * Split a command-line string into arguments, roughly following POSIX shell rules:
 * whitespace separates arguments, '...' is literal, "..." honours \" and \\ escapes,
 * and a backslash outside quotes escapes the next character.
 */
export function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inArg = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      if (inArg) {
        args.push(current);
        current = "";
        inArg = false;
      }
      i++;
    } else if (ch === "'") {
      inArg = true;
      const close = input.indexOf("'", i + 1);
      const end = close === -1 ? input.length : close;
      current += input.slice(i + 1, end);
      i = end + 1;
    } else if (ch === '"') {
      inArg = true;
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && (input[i + 1] === '"' || input[i + 1] === "\\")) {
          current += input[i + 1];
          i += 2;
        } else {
          current += input[i];
          i++;
        }
      }
      i++;
    } else if (ch === "\\") {
      inArg = true;
      if (i + 1 < input.length) current += input[i + 1];
      i += 2;
    } else {
      inArg = true;
      current += ch;
      i++;
    }
  }

  if (inArg) args.push(current);
  return args;
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildInvocation(
  provider: ProviderId,
  prompt: { system: string; user: string },
  options: ProviderOptions = {},
): Invocation {
  const combined = `${prompt.system}\n\n${prompt.user}`;
  const model = nonBlank(options.model);
  const extra = splitArgs(nonBlank(options.extraArgs) ?? "");
  const command = nonBlank(options.binaryPath) ?? getProvider(provider).binary;

  switch (provider) {
    case "claude":
      return {
        command,
        args: [
          "-p",
          "--system-prompt",
          prompt.system,
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
          ...(model ? ["--model", model] : []),
          ...extra,
        ],
        stdin: prompt.user,
        output: "claude-stream-json",
      };
    case "codex":
      return {
        command,
        args: [
          "exec",
          "--skip-git-repo-check",
          "--ephemeral",
          "-s",
          "read-only",
          "--color",
          "never",
          ...(model ? ["-m", model] : []),
          ...extra,
          // Read the prompt from stdin; must stay last.
          "-",
        ],
        stdin: combined,
        output: "text",
      };
    case "gemini":
      return {
        command,
        args: ["-o", "text", ...(model ? ["-m", model] : []), ...extra, combined],
        stdin: "",
        output: "text",
      };
    case "copilot":
      return {
        command,
        args: [
          "-p",
          combined,
          "-s",
          "--no-color",
          "--no-custom-instructions",
          "--stream",
          "on",
          ...(model ? ["--model", model] : []),
          ...extra,
        ],
        stdin: "",
        output: "text",
      };
    case "custom": {
      const customCommand = nonBlank(options.customCommand);
      if (!customCommand) {
        throw new Error("Custom command is not configured. Set it in the extension preferences.");
      }
      return {
        command: nonBlank(options.shell) ?? DEFAULT_SHELL,
        args: ["-lc", customCommand],
        stdin: combined,
        output: "text",
      };
    }
  }
}

export interface OutputParser {
  push(chunk: string): void;
  end(): void;
  readonly text: string;
  readonly error: string | undefined;
}

class TextParser implements OutputParser {
  text = "";
  readonly error = undefined;

  push(chunk: string): void {
    this.text += chunk;
  }

  end(): void {}
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class ClaudeStreamJsonParser implements OutputParser {
  text = "";
  error: string | undefined = undefined;
  private buffer = "";

  push(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline !== -1) {
      this.handleLine(this.buffer.slice(0, newline));
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf("\n");
    }
  }

  end(): void {
    const rest = this.buffer;
    this.buffer = "";
    this.handleLine(rest);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!isRecord(message)) return;

    if (message.type === "stream_event" && isRecord(message.event)) {
      this.handleStreamEvent(message.event);
    } else if (message.type === "result") {
      this.handleResult(message);
    }
  }

  private handleStreamEvent(event: JsonRecord): void {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      // A new text block after earlier text: keep paragraphs apart.
      if (isRecord(block) && block.type === "text" && this.text) this.text += "\n\n";
    } else if (event.type === "content_block_delta") {
      const delta = event.delta;
      if (isRecord(delta) && delta.type === "text_delta" && typeof delta.text === "string") {
        this.text += delta.text;
      }
    }
  }

  private handleResult(message: JsonRecord): void {
    const subtype = typeof message.subtype === "string" ? message.subtype : "";
    const result = typeof message.result === "string" ? message.result : undefined;
    if (message.is_error === true || subtype.startsWith("error")) {
      const errors = Array.isArray(message.errors) ? message.errors.map(String).filter(Boolean) : [];
      this.error = result || (errors.length ? errors.join("\n") : "Claude CLI returned an error");
      return;
    }
    if (!this.text && result) this.text = result;
  }
}

export function createOutputParser(format: OutputFormat): OutputParser {
  return format === "claude-stream-json" ? new ClaudeStreamJsonParser() : new TextParser();
}
