import { environment } from "@raycast/api";
import { mkdirSync } from "fs";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildPrompt, TranslateMode } from "../lib/prompt";
import { buildInvocation, ProviderId, ProviderOptions } from "../lib/providers";
import { runInvocation } from "../lib/runner";
import { getCliEnv } from "../lib/shell-env";

export interface TranslationRequest {
  text: string;
  /** Resolved source language (never "auto") */
  source: string;
  target: string;
  mode: TranslateMode;
  provider: ProviderId;
  options: ProviderOptions;
}

export interface TranslationState {
  /** Translation text; partial while streaming */
  text: string;
  isLoading: boolean;
  error?: Error;
  /** The request the current text/error belongs to */
  request?: TranslationRequest;
  isWordMode: boolean;
  elapsedMs?: number;
}

export interface UseTranslationOptions {
  /** Start automatically when the request changes (after `debounceMs`); otherwise wait for `translate()` */
  auto: boolean;
  debounceMs: number;
  timeoutMs: number;
}

const EMPTY_STATE: TranslationState = { text: "", isLoading: false, isWordMode: false };

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
  const cache = useRef(new Map<string, { text: string; isWordMode: boolean; elapsedMs: number }>());

  const key = JSON.stringify(request);
  const hasText = request.text.trim().length > 0;
  const triggered = trigger?.key === key;
  const shouldRun = hasText && (auto || triggered);

  useEffect(() => {
    if (!hasText) {
      setState(EMPTY_STATE);
      return;
    }
    const cached = cache.current.get(key);
    if (cached) {
      setState({ ...cached, isLoading: false, request });
      return;
    }
    if (!shouldRun) {
      return;
    }

    const controller = new AbortController();
    // Keep showing the previous result while the user is still typing.
    setState((previous) => ({ ...previous, isLoading: true, error: undefined }));

    const timer = setTimeout(
      async () => {
        const started = Date.now();
        try {
          const prompt = buildPrompt({
            text: request.text,
            sourceLang: request.source,
            targetLang: request.target,
            mode: request.mode,
          });
          const invocation = buildInvocation(request.provider, prompt, request.options);
          const env = await getCliEnv();
          if (controller.signal.aborted) return;
          setState({ text: "", isLoading: true, request, isWordMode: prompt.isWordMode });
          const text = await runInvocation(invocation, {
            env,
            cwd: workspaceDir(),
            timeoutMs,
            signal: controller.signal,
            onProgress: (partial) =>
              setState({ text: partial, isLoading: true, request, isWordMode: prompt.isWordMode }),
          });
          const result = { text, isWordMode: prompt.isWordMode, elapsedMs: Date.now() - started };
          cache.current.set(key, result);
          setState({ ...result, isLoading: false, request });
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({
            text: "",
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
            request,
            isWordMode: false,
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

  /** Starts (or restarts, bypassing the cache) the translation of the current request. */
  const translate = useCallback(() => {
    cache.current.delete(key);
    setTrigger((previous) => ({ key, nonce: (previous?.nonce ?? 0) + 1 }));
  }, [key]);

  return { ...state, translate };
}
