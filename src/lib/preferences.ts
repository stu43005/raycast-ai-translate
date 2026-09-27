import { getPreferenceValues } from "@raycast/api";
import { ProviderId, ProviderOptions } from "./providers";

export interface ExtensionPreferences {
  provider: ProviderId;
  claudeModel?: string;
  codexModel?: string;
  geminiModel?: string;
  copilotModel?: string;
  customCommand?: string;
  cliPath?: string;
  extraArgs?: string;
  defaultTargetLanguage: string;
  secondTargetLanguage: string;
  autoTranslate: boolean;
  debounceMs?: string;
  useSelectedText: boolean;
  timeoutSeconds?: string;
}

export function getPreferences(): ExtensionPreferences {
  return getPreferenceValues<ExtensionPreferences>();
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getDebounceMs(preferences: ExtensionPreferences): number {
  return positiveNumber(preferences.debounceMs, 800);
}

export function getTimeoutMs(preferences: ExtensionPreferences): number {
  return positiveNumber(preferences.timeoutSeconds, 120) * 1000;
}

export function getModel(preferences: ExtensionPreferences, provider: ProviderId): string | undefined {
  switch (provider) {
    case "claude":
      return preferences.claudeModel;
    case "codex":
      return preferences.codexModel;
    case "gemini":
      return preferences.geminiModel;
    case "copilot":
      return preferences.copilotModel;
    case "custom":
      return undefined;
  }
}

/**
 * CLI path override and extra arguments are configured for the provider chosen in preferences,
 * so they only apply while that provider is in use (switching providers in the UI drops them).
 */
export function getProviderOptions(preferences: ExtensionPreferences, provider: ProviderId): ProviderOptions {
  const isPreferred = provider === preferences.provider;
  return {
    model: getModel(preferences, provider),
    binaryPath: isPreferred ? preferences.cliPath : undefined,
    extraArgs: isPreferred ? preferences.extraArgs : undefined,
    customCommand: preferences.customCommand,
    shell: process.env.SHELL,
  };
}
