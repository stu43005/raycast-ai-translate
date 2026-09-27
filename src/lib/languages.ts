export const AUTO_DETECT = "auto";

export interface LanguageConfig {
  code: string;
  /** Native name, e.g. "繁體中文" */
  name: string;
  /** English name, e.g. "Traditional Chinese" */
  nameEn: string;
  /** Transcription system used in dictionary-style answers, `false` when not applicable */
  phoneticNotation: string | false;
  /** Extra search keywords for the language picker */
  aliases?: string[];
  /** Extra instruction appended to prompts when this language is the target */
  writingNote?: string;
  isSource: boolean;
  isTarget: boolean;
}

type LanguageSeed = Pick<LanguageConfig, "code" | "name" | "nameEn"> &
  Partial<Omit<LanguageConfig, "code" | "name" | "nameEn">>;

function languageLabel(config: Pick<LanguageConfig, "name" | "nameEn">): string {
  return config.name === config.nameEn ? config.nameEn : `${config.nameEn} (${config.name})`;
}

function defineLanguage(seed: LanguageSeed): LanguageConfig {
  return { phoneticNotation: "transcription", isSource: true, isTarget: true, ...seed };
}

export const LANGUAGES: LanguageConfig[] = [
  defineLanguage({ code: "en", name: "English", nameEn: "English", phoneticNotation: "IPA" }),
  defineLanguage({
    code: "en-US",
    name: "American English",
    nameEn: "English (US)",
    phoneticNotation: "IPA",
    isSource: false,
  }),
  defineLanguage({
    code: "en-GB",
    name: "British English",
    nameEn: "English (UK)",
    phoneticNotation: "IPA",
    isSource: false,
  }),
  defineLanguage({ code: "zh-Hant", name: "繁體中文", nameEn: "Traditional Chinese", phoneticNotation: "Bopomofo" }),
  defineLanguage({ code: "zh-Hans", name: "简体中文", nameEn: "Simplified Chinese", phoneticNotation: "Pinyin" }),
  defineLanguage({
    code: "yue",
    name: "粵語",
    nameEn: "Cantonese",
    phoneticNotation: "Jyutping",
    writingNote:
      "Write colloquial written Cantonese in Traditional Chinese characters (for example 係, 唔, 嘅, 咗) rather than Standard Written Chinese.",
    isSource: false,
  }),
  defineLanguage({
    code: "nan",
    name: "臺灣話",
    nameEn: "Taiwanese Hokkien",
    phoneticNotation: "Tâi-lô",
    aliases: ["閩南語", "台語", "臺語", "Hokkien", "Taiwanese"],
    writingNote:
      "Write Taiwanese Hokkien in Han characters following the Taiwan Ministry of Education's recommended characters (臺灣台語推薦用字), using Taiwanese vocabulary and grammar rather than Mandarin wording.",
  }),
  defineLanguage({
    code: "hak",
    name: "客家話",
    nameEn: "Hakka",
    phoneticNotation: "Taiwanese Hakka Pinyin",
    aliases: ["客語", "客家語"],
    writingNote:
      "Write Taiwanese Hakka (Sixian dialect unless the text suggests another) in Han characters following the Taiwan Ministry of Education's recommended characters (臺灣客家語書寫推薦用字), using Hakka vocabulary and grammar rather than Mandarin wording.",
  }),
  defineLanguage({ code: "ja", name: "日本語", nameEn: "Japanese", phoneticNotation: "hiragana" }),
  defineLanguage({ code: "ko", name: "한국어", nameEn: "Korean", phoneticNotation: "Revised Romanization" }),
  defineLanguage({ code: "fr", name: "Français", nameEn: "French", phoneticNotation: "IPA" }),
  defineLanguage({ code: "de", name: "Deutsch", nameEn: "German", phoneticNotation: "IPA" }),
  defineLanguage({ code: "es", name: "Español", nameEn: "Spanish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "it", name: "Italiano", nameEn: "Italian", phoneticNotation: "IPA" }),
  defineLanguage({ code: "pt", name: "Português", nameEn: "Portuguese", phoneticNotation: "IPA" }),
  defineLanguage({ code: "ru", name: "Русский", nameEn: "Russian", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "uk", name: "Українська", nameEn: "Ukrainian", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "nl", name: "Nederlands", nameEn: "Dutch", phoneticNotation: "IPA" }),
  defineLanguage({ code: "pl", name: "Polski", nameEn: "Polish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "cs", name: "Čeština", nameEn: "Czech", phoneticNotation: "IPA" }),
  defineLanguage({ code: "sv", name: "Svenska", nameEn: "Swedish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "da", name: "Dansk", nameEn: "Danish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "fi", name: "Suomi", nameEn: "Finnish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "no", name: "Norsk", nameEn: "Norwegian", phoneticNotation: "IPA" }),
  defineLanguage({ code: "el", name: "Ελληνικά", nameEn: "Greek", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "tr", name: "Türkçe", nameEn: "Turkish", phoneticNotation: "IPA" }),
  defineLanguage({ code: "hu", name: "Magyar", nameEn: "Hungarian", phoneticNotation: "IPA" }),
  defineLanguage({ code: "ro", name: "Română", nameEn: "Romanian", phoneticNotation: "IPA" }),
  defineLanguage({ code: "bg", name: "Български", nameEn: "Bulgarian", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "ar", name: "العربية", nameEn: "Arabic", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "he", name: "עברית", nameEn: "Hebrew", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "fa", name: "فارسی", nameEn: "Persian", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "hi", name: "हिन्दी", nameEn: "Hindi", phoneticNotation: "IAST" }),
  defineLanguage({ code: "bn", name: "বাংলা", nameEn: "Bengali", phoneticNotation: "Latin transcription" }),
  defineLanguage({ code: "th", name: "ไทย", nameEn: "Thai", phoneticNotation: "RTGS" }),
  defineLanguage({ code: "vi", name: "Tiếng Việt", nameEn: "Vietnamese", phoneticNotation: false }),
  defineLanguage({ code: "id", name: "Bahasa Indonesia", nameEn: "Indonesian", phoneticNotation: false }),
  defineLanguage({ code: "ms", name: "Bahasa Melayu", nameEn: "Malay", phoneticNotation: false }),
  defineLanguage({ code: "tl", name: "Filipino", nameEn: "Filipino", phoneticNotation: false }),
];

const LANGUAGE_MAP = new Map(LANGUAGES.map((language) => [language.code, language]));

export const SOURCE_LANGUAGES = LANGUAGES.filter((language) => language.isSource);
export const TARGET_LANGUAGES = LANGUAGES.filter((language) => language.isTarget);

/** Codes whose output is some form of Chinese; used to pick Chinese-specific prompts. */
export const CHINESE_CODES = ["zh-Hans", "zh-Hant", "yue", "nan", "hak"];

export function isChinese(code: string): boolean {
  return CHINESE_CODES.includes(code);
}

export function findLanguage(code: string): LanguageConfig | undefined {
  return LANGUAGE_MAP.get(code);
}

/** Returns the config for `code`, or a generic config that uses the code itself as the name. */
export function getLanguage(code: string): LanguageConfig {
  return findLanguage(code) ?? defineLanguage({ code, name: code, nameEn: code });
}

export function getLanguageTitle(code: string): string {
  if (code === AUTO_DETECT) {
    return "Auto Detect";
  }
  return languageLabel(getLanguage(code));
}
