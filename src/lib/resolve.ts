import { detectLanguage } from "./detect";
import { AUTO_DETECT } from "./languages";

export interface LanguageSelection {
  text: string;
  /** Selected source code, or AUTO_DETECT */
  source: string;
  target: string;
  /** Used instead of `target` when the detected source is already in the target language */
  secondTarget: string;
}

export interface ResolvedLanguages {
  source: string;
  target: string;
  sourceDetected: boolean;
  /** True when `target` was replaced by the second target language */
  targetSwitched: boolean;
}

/** Language family used to decide whether two codes are "the same language" (zh-Hant ~ zh-Hans, en ~ en-US). */
function languageFamily(code: string): string {
  return code.split("-")[0];
}

function sameFamily(a: string, b: string): boolean {
  return languageFamily(a) === languageFamily(b);
}

/** Resolves the concrete source/target languages for a request. */
export function resolveLanguages(selection: LanguageSelection): ResolvedLanguages {
  const { text, target, secondTarget } = selection;
  const sourceDetected = selection.source === AUTO_DETECT;
  const source = sourceDetected
    ? detectLanguage(text, { ambiguousChinese: target === "zh-Hans" ? "zh-Hans" : "zh-Hant" })
    : selection.source;

  // Like Raycast's built-in Translate: typing in the target language translates the other way.
  if (sourceDetected && sameFamily(source, target)) {
    const fallback = sameFamily(source, secondTarget) ? (sameFamily(source, "en") ? "zh-Hant" : "en") : secondTarget;
    return { source, target: fallback, sourceDetected, targetSwitched: true };
  }
  return { source, target, sourceDetected, targetSwitched: false };
}
