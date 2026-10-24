// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, type ComponentChildren } from 'preact'
import { useContext, useMemo } from 'preact/hooks'
import { DEFAULT_LOCALE, type Locale } from './locale'
import { createTranslator, type Translate } from './t'

export interface I18n {
  locale: Locale
  t: Translate
}

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
})

export interface I18nProviderProps {
  locale: Locale
  children?: ComponentChildren
}

/**
 * Gives the components below it their locale and translator. Components
 * that own copy (units, level names, counters) read it with `useI18n()`;
 * everything else receives already translated strings as props. Nesting
 * providers lets one page show both languages (the dev page does).
 */
export function I18nProvider({ locale, children }: I18nProviderProps) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  return useContext(I18nContext)
}
