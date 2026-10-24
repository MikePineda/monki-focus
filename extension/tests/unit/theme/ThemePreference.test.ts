// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseThemePreference } from '../../../src/theme/ThemePreference'

describe('ThemePreference', () => {
  it('known_theme_preferences_are_kept', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('unknown_theme_preference_follows_the_system', () => {
    expect(parseThemePreference('sepia')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference(undefined)).toBe('system')
  })
})
