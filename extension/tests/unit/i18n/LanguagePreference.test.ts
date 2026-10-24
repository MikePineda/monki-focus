// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseLanguagePreference, preferredLocale } from '../../../src/i18n/LanguagePreference'

describe('LanguagePreference', () => {
  it('stored_language_overrides_navigator_languages', () => {
    expect(preferredLocale('es', ['en-US', 'en'])).toBe('es')
    expect(preferredLocale('en', ['es-419'])).toBe('en')
  })

  it('system_language_follows_navigator_languages', () => {
    expect(preferredLocale('system', ['es-MX', 'en'])).toBe('es')
    expect(preferredLocale('system', ['fr-FR'])).toBe('en')
  })

  it('unknown_stored_language_is_treated_as_system', () => {
    expect(parseLanguagePreference('fr')).toBe('system')
    expect(parseLanguagePreference(undefined)).toBe('system')
    expect(parseLanguagePreference(42)).toBe('system')
    expect(parseLanguagePreference('es')).toBe('es')
  })
})
