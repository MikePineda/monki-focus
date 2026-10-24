// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'
import { parseLanguagePreference, type LanguagePreference } from '../i18n/LanguagePreference'
import { parseThemePreference, type ThemePreference } from '../theme/ThemePreference'

/**
 * `browser.storage.local` keys of the appearance preferences. The options
 * page changes them through `preferences.set` (the service worker writes);
 * every page only reads them here.
 */
export const UI_PREFERENCE_KEYS = {
  theme: 'ui.theme',
  language: 'ui.language',
} as const

export interface UiPreferences {
  theme: ThemePreference
  language: LanguagePreference
}

type StorageReader = Pick<Browser.storage.StorageArea, 'get'>
type ChangeListener = (
  changes: Record<string, Browser.storage.StorageChange>,
  areaName: string
) => void
/** The slice of `browser.storage.onChanged` this module uses. */
interface StorageChangedEvent {
  addListener(listener: ChangeListener): void
  removeListener(listener: ChangeListener): void
}

export async function readUiPreferences(storage: StorageReader): Promise<UiPreferences> {
  const stored = await storage.get([UI_PREFERENCE_KEYS.theme, UI_PREFERENCE_KEYS.language])
  return {
    theme: parseThemePreference(stored[UI_PREFERENCE_KEYS.theme]),
    language: parseLanguagePreference(stored[UI_PREFERENCE_KEYS.language]),
  }
}

export interface UiPreferenceListeners {
  onTheme?: (theme: ThemePreference) => void
  onLanguage?: (language: LanguagePreference) => void
}

/** Reports theme and language changes (from any page); returns the unsubscribe. */
export function watchUiPreferences(
  onChanged: StorageChangedEvent,
  { onTheme, onLanguage }: UiPreferenceListeners
): () => void {
  const listener: ChangeListener = (changes, areaName) => {
    if (areaName !== 'local') return
    const theme = changes[UI_PREFERENCE_KEYS.theme]
    if (theme && onTheme) onTheme(parseThemePreference(theme.newValue))
    const language = changes[UI_PREFERENCE_KEYS.language]
    if (language && onLanguage) onLanguage(parseLanguagePreference(language.newValue))
  }
  onChanged.addListener(listener)
  return () => onChanged.removeListener(listener)
}
