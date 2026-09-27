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
