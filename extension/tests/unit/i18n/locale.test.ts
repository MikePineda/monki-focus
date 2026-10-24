// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, resolveLocale } from '../../../src/i18n/locale'

describe('resolveLocale', () => {
  it('regional_spanish_resolves_to_es', () => {
    expect(resolveLocale(['es-419', 'en'])).toBe('es')
  })

  it('first_supported_preference_wins', () => {
    expect(resolveLocale(['fr-FR', 'en-GB', 'es'])).toBe('en')
  })

  it('unsupported_preferences_fall_back_to_english', () => {
    expect(resolveLocale(['de-DE', 'ja'])).toBe(DEFAULT_LOCALE)
    expect(resolveLocale([])).toBe('en')
  })

  it('matching_ignores_case', () => {
    expect(resolveLocale(['ES-mx'])).toBe('es')
  })
})
