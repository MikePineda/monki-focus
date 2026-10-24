// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolveLocale, SUPPORTED_LOCALES, type Locale } from './locale'

/** The user's language choice: a supported locale, or follow the browser. */
export type LanguagePreference = Locale | 'system'

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system'

/** Anything stored that is not a supported locale means "follow the browser". */
export function parseLanguagePreference(value: unknown): LanguagePreference {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LANGUAGE_PREFERENCE
}

/** An explicit choice wins over `navigator.languages`. */
export function preferredLocale(
  preference: LanguagePreference,
  navigatorLanguages: readonly string[]
): Locale {
  return resolveLocale(
    preference === 'system' ? navigatorLanguages : [preference, ...navigatorLanguages]
  )
}
