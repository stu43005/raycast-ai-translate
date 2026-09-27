import { environment } from "@raycast/api";
import { mkdirSync } from "fs";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestKey, TranslationRequest } from "../lib/history";
import { buildPrompt } from "../lib/prompt";
import { buildInvocation } from "../lib/providers";
import { runInvocation } from "../lib/runner";
import { getCliEnv } from "../lib/shell-env";

export interface TranslationResult {
  text: string;
  isWordMode: boolean;
  elapsedMs: number;
}

export interface TranslationState {
  /** Translation text; partial while streaming */
  text: string;
  isLoading: boolean;
  error?: Error;
  /** Key of the request the current text/error belongs to */
  key?: string;
  isWordMode: boolean;
  elapsedMs?: number;
  /** True when the result came from the history instead of a CLI run */
  fromHistory: boolean;
}

export interface UseTranslationOptions {
  /** Start automatically when the request changes (after `debounceMs`); otherwise wait for `translate()` */
  auto: boolean;
  debounceMs: number;
  timeoutMs: number;
  /** Returns a previous result for an identical request, which is reused instead of calling the CLI */
  lookup: (key: string) => TranslationResult | undefined;
  /** Called once a CLI run finished successfully */
  onComplete: (key: string, request: TranslationRequest, result: TranslationResult) => void;
}

const EMPTY_STATE: TranslationState = { text: "", isLoading: false, isWordMode: false, fromHistory: false };

/** Empty working directory for the CLIs, so none of them picks up project files or instructions. */
function workspaceDir(): string {
  const dir = join(environment.supportPath, "workspace");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function useTranslation(request: TranslationRequest, options: UseTranslationOptions) {
  const { auto, debounceMs, timeoutMs } = options;
  const [state, setState] = useState<TranslationState>(EMPTY_STATE);
  const [trigger, setTrigger] = useState<{ key: string; nonce: number }>();
  // Key whose next run must skip the history lookup (explicit retranslate).
  const bypassKey = useRef<string>(undefined);
  // Latest callbacks, so the effect does not need to re-run when their identity changes.
  const callbacks = useRef(options);
  callbacks.current = options;

  const key = requestKey(request);
  const hasText = request.text.trim().length > 0;
  const triggered = trigger?.key === key;
  const shouldRun = hasText && (auto || triggered);

  useEffect(() => {
    if (!hasText) {
      setState(EMPTY_STATE);
      return;
    }
    if (bypassKey.current === key) {
      bypassKey.current = undefined;
    } else {
      const previous = callbacks.current.lookup(key);
      if (previous) {
        setState({ ...previous, isLoading: false, key, fromHistory: true });
        return;
      }
    }
    if (!shouldRun) {
      setState({ ...EMPTY_STATE, key });
      return;
    }

    const controller = new AbortController();
    setState({ ...EMPTY_STATE, isLoading: true, key });

    const timer = setTimeout(
      async () => {
        const started = Date.now();
        try {
          const prompt = buildPrompt({
            text: request.text.trim(),
            sourceLang: request.source,
            targetLang: request.target,
            mode: request.mode,
          });
          const invocation = buildInvocation(request.provider, prompt, request.options);
          const env = await getCliEnv();
          if (controller.signal.aborted) return;
          const streaming = { isLoading: true, key, isWordMode: prompt.isWordMode, fromHistory: false };
          setState({ ...streaming, text: "" });
          const text = await runInvocation(invocation, {
            env,
            cwd: workspaceDir(),
            timeoutMs,
            signal: controller.signal,
            onProgress: (partial) => setState({ ...streaming, text: partial }),
          });
          const result = { text, isWordMode: prompt.isWordMode, elapsedMs: Date.now() - started };
          setState({ ...result, isLoading: false, key, fromHistory: false });
          callbacks.current.onComplete(key, request, result);
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({
            ...EMPTY_STATE,
            error: error instanceof Error ? error : new Error(String(error)),
            key,
          });
        }
      },
      auto && !triggered ? debounceMs : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `request` is fully represented by `key`.
  }, [key, shouldRun, trigger?.nonce]);

  /** Starts (or restarts, bypassing the history) the translation of the current request. */
  const translate = useCallback(() => {
    bypassKey.current = key;
    setTrigger((previous) => ({ key, nonce: (previous?.nonce ?? 0) + 1 }));
  }, [key]);

  return { ...state, key, translate };
}
