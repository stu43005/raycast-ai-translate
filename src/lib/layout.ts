const WIDE_CHAR = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]/u;

/** Display width of a single character: 2 for CJK / full-width characters, 1 otherwise. */
export function charWidth(char: string): 1 | 2 {
  return WIDE_CHAR.test(char) ? 2 : 1;
}

function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += charWidth(char);
  }
  return width;
}

/** Splits a line into whitespace runs, Latin words and single wide characters (which may break anywhere). */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let currentIsSpace = false;
  for (const char of line) {
    const isSpace = /\s/.test(char);
    if (!isSpace && charWidth(char) === 2) {
      if (current) tokens.push(current);
      tokens.push(char);
      current = "";
      continue;
    }
    if (current && isSpace !== currentIsSpace) {
      tokens.push(current);
      current = "";
    }
    current += char;
    currentIsSpace = isSpace;
  }
  if (current) tokens.push(current);
  return tokens;
}

function hardBreak(word: string, maxWidth: number): string[] {
  const pieces: string[] = [];
  let piece = "";
  let width = 0;
  for (const char of word) {
    const w = charWidth(char);
    if (piece && width + w > maxWidth) {
      pieces.push(piece);
      piece = "";
      width = 0;
    }
    piece += char;
    width += w;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function wrapLine(line: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  let pendingSpace = "";
  for (const token of tokenize(line)) {
    if (/^\s+$/.test(token)) {
      if (current) pendingSpace += token;
      continue;
    }
    const width = textWidth(token);
    const spaceWidth = textWidth(pendingSpace);
    pendingSpace = "";
    if (current && currentWidth + spaceWidth + width <= maxWidth) {
      current += (spaceWidth ? " ".repeat(spaceWidth) : "") + token;
      currentWidth += spaceWidth + width;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    const pieces = hardBreak(token, maxWidth);
    lines.push(...pieces.slice(0, -1));
    current = pieces[pieces.length - 1] ?? "";
    currentWidth = textWidth(current);
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wraps text into lines no wider than `maxWidth` display columns, so each line fits in one list item title.
 * Existing line breaks are kept (blank lines become ""), Latin text breaks at spaces when possible.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === "") {
    rawLines.pop();
  }
  return rawLines.flatMap((line) => (line.trim() === "" ? [""] : wrapLine(line.trimEnd(), Math.max(1, maxWidth))));
}

function escapeInline(text: string): string {
  return text
    .replace(/[\\`*_[\]]/g, (char) => `\\${char}`)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeLine(line: string): string {
  const match = /^(\s*)(?:([#>+\-=|~])|(\d+)\.(?=\s))?(.*)$/.exec(line);
  if (!match) {
    return escapeInline(line);
  }
  const [, indent, blockMarker, listNumber, rest] = match;
  const prefix = indent.replace(/\t/g, "    ").replace(/ /g, "&nbsp;");
  const marker = blockMarker ? `\\${blockMarker}` : listNumber ? `${listNumber}\\.` : "";
  return prefix + marker + escapeInline(rest);
}

/** Renders plain text as Markdown that displays literally, keeping line breaks. */
export function toLiteralMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines
    .map((line, index) => {
      const escaped = escapeLine(line);
      const next = lines[index + 1];
      if (next === undefined) return escaped;
      return line.trim() !== "" && next.trim() !== "" ? `${escaped}  \n` : `${escaped}\n`;
    })
    .join("");
}
