import { findEntry, HistoryEntry, removeEntry, requestKey, TranslationRequest, upsertEntry } from "./history";

const request: TranslationRequest = {
  text: "Good morning",
  source: "en",
  target: "zh-Hant",
  mode: "translate",
  provider: "claude",
  options: { model: "haiku", shell: "/bin/zsh" },
};

function entry(key: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    key,
    text: key,
    source: "en",
    target: "zh-Hant",
    mode: "translate",
    provider: "claude",
    result: `result of ${key}`,
    isWordMode: false,
    elapsedMs: 1000,
    createdAt: 1,
    ...overrides,
  };
}

describe("requestKey", () => {
  it("is identical for identical requests", () => {
    expect(requestKey(request)).toBe(requestKey({ ...request, options: { ...request.options } }));
  });

  it("ignores surrounding whitespace in the text", () => {
    expect(requestKey({ ...request, text: "  Good morning \n" })).toBe(requestKey(request));
  });

  it("does not depend on the order of option properties", () => {
    expect(requestKey({ ...request, options: { shell: "/bin/zsh", model: "haiku" } })).toBe(requestKey(request));
  });

  it("treats blank options the same as missing ones", () => {
    expect(requestKey({ ...request, options: { ...request.options, extraArgs: "  ", binaryPath: undefined } })).toBe(
      requestKey(request),
    );
  });

  it("changes when any option that affects the output changes", () => {
    const base = requestKey(request);
    expect(requestKey({ ...request, text: "Good morning!" })).not.toBe(base);
    expect(requestKey({ ...request, source: "fr" })).not.toBe(base);
    expect(requestKey({ ...request, target: "ja" })).not.toBe(base);
    expect(requestKey({ ...request, mode: "summarize" })).not.toBe(base);
    expect(requestKey({ ...request, provider: "codex" })).not.toBe(base);
    expect(requestKey({ ...request, options: { ...request.options, model: "sonnet" } })).not.toBe(base);
    expect(requestKey({ ...request, options: { ...request.options, extraArgs: "--effort low" } })).not.toBe(base);
  });

  it("is case sensitive for the text", () => {
    expect(requestKey({ ...request, text: "good morning" })).not.toBe(requestKey(request));
  });
});

describe("upsertEntry", () => {
  it("prepends new entries", () => {
    expect(upsertEntry([entry("a")], entry("b")).map((item) => item.key)).toEqual(["b", "a"]);
  });

  it("moves an existing key to the top and replaces it", () => {
    const history = [entry("a"), entry("b"), entry("c")];
    const updated = upsertEntry(history, entry("b", { result: "new", createdAt: 5 }));
    expect(updated.map((item) => item.key)).toEqual(["b", "a", "c"]);
    expect(updated[0]).toMatchObject({ result: "new", createdAt: 5 });
  });

  it("keeps at most `max` entries, dropping the oldest", () => {
    const history = [entry("a"), entry("b"), entry("c")];
    expect(upsertEntry(history, entry("d"), 3).map((item) => item.key)).toEqual(["d", "a", "b"]);
  });

  it("does not mutate the original list", () => {
    const history = [entry("a")];
    upsertEntry(history, entry("b"));
    expect(history.map((item) => item.key)).toEqual(["a"]);
  });
});

describe("findEntry / removeEntry", () => {
  const history = [entry("a"), entry("b")];

  it("finds an entry by key", () => {
    expect(findEntry(history, "b")?.result).toBe("result of b");
    expect(findEntry(history, "z")).toBeUndefined();
  });

  it("removes an entry by key", () => {
    expect(removeEntry(history, "a").map((item) => item.key)).toEqual(["b"]);
    expect(history).toHaveLength(2);
  });
});
