# AI CLI Translate

Translate text in Raycast using the AI subscription you already pay for. The extension calls a local AI CLI and needs no API keys:

| Provider           | CLI       | Install                                               |
| ------------------ | --------- | ----------------------------------------------------- |
| Claude Code        | `claude`  | `npm install -g @anthropic-ai/claude-code`            |
| OpenAI Codex       | `codex`   | `npm install -g @openai/codex`                        |
| Gemini CLI         | `gemini`  | `npm install -g @google/gemini-cli`                   |
| GitHub Copilot CLI | `copilot` | `npm install -g @github/copilot`                      |
| Custom Command     | any       | e.g. `ollama run llama3.2` (the prompt goes to stdin) |

Sign in to the CLI once from a terminal before you use it here.

## Features

- **Two-pane layout**: each row on the left is one translation. The current input is at the top, labelled `Source → Target`, and your translation history follows. The right pane shows the selected translation above its source text. The translation streams in as the CLI writes it.
- **Translation history**: every successful translation is saved (the latest 200). If you enter exactly the same text with the same options (languages, style, formality, CLI, model, arguments), the saved translation is shown right away and the CLI is not called. `⌘R` forces a fresh translation. On a history row: `⌘E` loads it back into the input, `⌃D` deletes it, and `⌃⇧D` clears all history.
- **Language selection**: pick the target language from the search bar dropdown (or press `⌘L`). Pick the source language with `⌘⇧L`, where Auto Detect is the default. Swap the two with `⌘⇧X`.
- **Auto-switching target**: when auto-detected text is already in the target language (for example Chinese text with a Chinese target), it is translated to the _Second Target Language_ instead, like Raycast's built-in Translate.
- **Translation style** (`⌘⇧N`): _Natural_ (idiomatic) or _Literal_ (close to the original wording).
- **Formality** (`⌘⇧F`), remembered per target language:
  - most languages: Standard (keep the original's register), Formal or Informal
  - Chinese: Standard, Formal (您) or Informal (你)
  - Japanese: Standard, Sonkeigo (尊敬語), Kenjōgo (謙譲語), Teineigo (丁寧語), Bikago (美化語) or Informal (タメ口)
  - Korean: Standard, Formal (존댓말) or Informal (반말)
- **Taiwanese Hokkien (臺灣話) and Hakka (客家話)**: written in Han characters following the Taiwan Ministry of Education's recommended characters. Cantonese is written as colloquial written Cantonese.
- **Dictionary mode**: a single word gets a dictionary-style answer with phonetics, senses, example sentences and etymology.
- **Switch CLI on the fly** (`⌘⇧P`), retranslate with `⌘R`, copy with `⏎` and paste with `⌘⏎`.
- The selected text in the frontmost app is used as the initial input. You can also pass text as the command argument or as fallback text.

## Preferences

| Preference                              | Description                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AI CLI Provider                         | The CLI used by default                                                                        |
| Claude / Codex / Gemini / Copilot Model | Model passed to that CLI. Empty means the CLI's default. Claude defaults to `haiku` for speed. |
| Custom Command                          | Shell command for the Custom Command provider                                                  |
| CLI Path Override                       | Absolute path to the CLI if it is not found automatically                                      |
| Extra CLI Arguments                     | Extra arguments appended to the command line                                                   |
| Default / Second Target Language        | See _Auto-switching target_ above                                                              |
| Translate automatically while typing    | Turn this off to translate only when you press `⏎`                                             |
| Typing Delay (ms)                       | How long to wait after typing stops before calling the CLI (default 800)                       |
| Timeout (seconds)                       | The CLI is stopped after this long (default 120)                                               |

## How it works

- Raycast starts extensions with a minimal environment. The extension takes `PATH` from your login shell, so CLIs installed with Homebrew, nvm, bun or `~/.local/bin` are found. It also restores `USER`/`LOGNAME`, which Claude Code needs to read its keychain credentials.
- Every CLI runs in an empty working directory with tools disabled where the CLI supports it. For Claude, that means `--tools ""`, `--setting-sources ""` and `--strict-mcp-config`, so your projects, `CLAUDE.md` and MCP servers don't affect the translation.
- The source text is always treated as content to translate, never as instructions.

## Credits

Dictionary mode and the short-phrase alternatives are inspired by [nextai-translator](https://github.com/nextai-translator/nextai-translator). The prompts in this extension are written from scratch. The UI takes ideas from the [iTranslate](https://github.com/raycast/extensions/tree/main/extensions/itranslate) and Google Translate Raycast extensions.

## Development

```bash
npm install
npm run dev        # load the extension into Raycast
npm test           # unit tests (Jest)
npm run typecheck
npm run lint
```
