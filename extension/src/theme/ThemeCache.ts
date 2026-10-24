// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseThemePreference, type ThemePreference } from './ThemePreference'

const CACHE_KEY = 'monki-focus.theme'

type SyncStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Synchronous copy of the theme preference in the extension origin's
 * `localStorage`. `browser.storage.local` (the source of truth) is async, so
 * a page reads this copy first to set `data-theme` before its first paint,
 * then corrects it once storage answers. Losing the copy only costs one
 * frame in the system theme, so every failure is swallowed.
 */
export function readCachedTheme(storage: SyncStorage = localStorage): ThemePreference {
  try {
    return parseThemePreference(storage.getItem(CACHE_KEY))
  } catch {
    return 'system'
  }
}

export function cacheTheme(preference: ThemePreference, storage: SyncStorage = localStorage) {
  try {
    storage.setItem(CACHE_KEY, preference)
  } catch {
    // Storage blocked (private profile policy): the next page boots in `system`.
  }
}
