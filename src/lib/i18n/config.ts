/** Supported UI languages. Korean is the default; English is available from the top bar. */
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_COOKIE = "qajoo_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl formatters. */
export const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", en: "en-US" };
