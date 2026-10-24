// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ThemePreference } from './ThemePreference'

/**
 * Pins the theme on `target` (the document element, or the host of a shadow
 * root overlay). `system` removes the attribute so `prefers-color-scheme`
 * decides, as the generated tokens.css expects.
 */
export function applyTheme(
  preference: ThemePreference,
  target: Element = document.documentElement
): void {
  if (preference === 'system') target.removeAttribute('data-theme')
  else target.setAttribute('data-theme', preference)
}
