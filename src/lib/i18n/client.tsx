"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionary";

const I18nContext = createContext<Locale>("ko");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

/** For client components: `const { t, locale } = useI18n();` */
export function useI18n(): { locale: Locale; t: Dictionary } {
  const locale = useContext(I18nContext);
  return { locale, t: getDictionary(locale) };
}
