// SPDX-License-Identifier: AGPL-3.0-or-later

export const SUPPORTED_LOCALES = ['en', 'es'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Picks the first supported locale from BCP 47 preferences (an explicit user
 * choice first, then `navigator.languages`), matching on the primary
 * subtag: `es-419` and `es-MX` resolve to `es`.
 */
export function resolveLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const primary = preference.split('-')[0]?.toLowerCase() ?? ''
    if (isLocale(primary)) return primary
  }
  return DEFAULT_LOCALE
}
