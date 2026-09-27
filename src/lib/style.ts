export type TranslationStyle = "natural" | "literal";

export interface StyleOption<T extends string = string> {
  id: T;
  title: string;
  instruction: string;
}

export const DEFAULT_STYLE: TranslationStyle = "natural";
export const DEFAULT_FORMALITY = "standard";

export const TRANSLATION_STYLES: StyleOption<TranslationStyle>[] = [
  {
    id: "natural",
    title: "Natural",
    instruction:
      "Translate naturally: convey the meaning the way a native speaker would say it, adapting idioms and sentence structure where needed.",
  },
  {
    id: "literal",
    title: "Literal",
    instruction:
      "Translate literally: stay as close to the original wording and sentence structure as the target language's grammar allows, without adding or leaving out anything.",
  },
];

const STANDARD_FORMALITY: StyleOption = {
  id: DEFAULT_FORMALITY,
  title: "Standard",
  instruction: "Keep the level of formality of the original text.",
};

const GENERIC_FORMALITY: StyleOption[] = [
  STANDARD_FORMALITY,
  { id: "formal", title: "Formal", instruction: "Use a formal, polite register." },
  { id: "informal", title: "Informal", instruction: "Use a casual, informal register." },
];

const CHINESE_FORMALITY: StyleOption[] = [
  STANDARD_FORMALITY,
  {
    id: "formal",
    title: "Formal (您)",
    instruction: "Use a formal register and address the reader with the polite 「您」 rather than 「你」.",
  },
  {
    id: "informal",
    title: "Informal (你)",
    instruction: "Use a casual register and address the reader with 「你」 rather than 「您」.",
  },
];

const JAPANESE_FORMALITY: StyleOption[] = [
  STANDARD_FORMALITY,
  {
    id: "sonkeigo",
    title: "Sonkeigo (尊敬語)",
    instruction:
      "Use sonkeigo (尊敬語): raise the person being addressed or discussed with respectful forms such as いらっしゃる, おっしゃる, 召し上がる and お〜になる.",
  },
  {
    id: "kenjougo",
    title: "Kenjōgo (謙譲語)",
    instruction:
      "Use kenjōgo (謙譲語): lower the speaker's own actions with humble forms such as 参る, 申す, いただく and お〜する.",
  },
  {
    id: "teineigo",
    title: "Teineigo (丁寧語)",
    instruction: "Use teineigo (丁寧語): the polite です/ます forms throughout.",
  },
  {
    id: "bikago",
    title: "Bikago (美化語)",
    instruction:
      "Use bikago (美化語): refined wording with the beautifying お/ご prefixes where natural (for example お茶, ご飯), together with です/ます.",
  },
  {
    id: "informal",
    title: "Informal (タメ口)",
    instruction: "Use casual Japanese (タメ口): plain forms without です/ます.",
  },
];

const KOREAN_FORMALITY: StyleOption[] = [
  STANDARD_FORMALITY,
  {
    id: "formal",
    title: "Formal (존댓말)",
    instruction: "Use formal polite Korean (합쇼체 with -습니다/-ㅂ니다 endings).",
  },
  {
    id: "informal",
    title: "Informal (반말)",
    instruction: "Use casual Korean (반말) with plain, non-honorific endings and no -요 or -습니다.",
  },
];

/** True when `code` is `lang` itself or a subtag of it (e.g. "ja-JP" for "ja"). */
function isLanguage(code: string, lang: string): boolean {
  return code === lang || code.startsWith(`${lang}-`);
}

/** Formality levels offered for a target language; the first entry is always the standard level. */
export function formalityOptions(targetLang: string): StyleOption[] {
  if (targetLang === "zh-Hant" || targetLang === "zh-Hans") return CHINESE_FORMALITY;
  if (isLanguage(targetLang, "ja")) return JAPANESE_FORMALITY;
  if (isLanguage(targetLang, "ko")) return KOREAN_FORMALITY;
  return GENERIC_FORMALITY;
}

/** Returns `formality` if the target language offers it, otherwise DEFAULT_FORMALITY. */
export function normalizeFormality(targetLang: string, formality: string | undefined): string {
  const match = formalityOptions(targetLang).find((option) => option.id === formality);
  return match ? match.id : DEFAULT_FORMALITY;
}

/** Prompt instructions for the chosen style and formality, in that order. */
export function styleInstructions(targetLang: string, style: TranslationStyle, formality: string): string[] {
  const styleOption = TRANSLATION_STYLES.find((option) => option.id === style) ?? TRANSLATION_STYLES[0];
  const formalityId = normalizeFormality(targetLang, formality);
  const formalityOption =
    formalityOptions(targetLang).find((option) => option.id === formalityId) ?? STANDARD_FORMALITY;
  return [styleOption.instruction, formalityOption.instruction];
}
