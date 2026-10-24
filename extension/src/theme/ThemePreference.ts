// SPDX-License-Identifier: AGPL-3.0-or-later

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
/** `system` follows `prefers-color-scheme`; `light` and `dark` pin a theme. */
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export function parseThemePreference(value: unknown): ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
    ? (value as ThemePreference)
    : DEFAULT_THEME_PREFERENCE
}
