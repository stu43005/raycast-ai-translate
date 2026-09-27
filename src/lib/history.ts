import { ProviderId, ProviderOptions } from "./providers";

export const MAX_HISTORY_ENTRIES = 200;

/** Everything that affects the translation output; two requests with the same key produce the same result. */
export interface TranslationRequest {
  text: string;
  /** Resolved source language (never "auto") */
  source: string;
  target: string;
  provider: ProviderId;
  options: ProviderOptions;
}

export interface HistoryEntry {
  key: string;
  text: string;
  source: string;
  target: string;
  provider: ProviderId;
  model?: string;
  result: string;
  isWordMode: boolean;
  elapsedMs: number;
  /** Epoch milliseconds of the last translation */
  createdAt: number;
}

/** Stable identity of a request: exact (trimmed) text plus every option that reaches the CLI. */
export function requestKey(request: TranslationRequest): string {
  const options = Object.entries(request.options)
    .map(([name, value]) => [name, typeof value === "string" ? value.trim() : value] as const)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    request.text.trim(),
    request.source,
    request.target,
    request.provider,
    Object.fromEntries(options),
  ]);
}

/** Adds or refreshes an entry (matched by key), newest first, keeping at most `max` entries. */
export function upsertEntry(history: HistoryEntry[], entry: HistoryEntry, max = MAX_HISTORY_ENTRIES): HistoryEntry[] {
  return [entry, ...history.filter((item) => item.key !== entry.key)].slice(0, max);
}

export function findEntry(history: HistoryEntry[], key: string): HistoryEntry | undefined {
  return history.find((item) => item.key === key);
}

export function removeEntry(history: HistoryEntry[], key: string): HistoryEntry[] {
  return history.filter((item) => item.key !== key);
}
