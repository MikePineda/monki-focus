// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from 'preact'
import { I18nProvider } from '../i18n/I18nContext'
import { preferredLocale } from '../i18n/LanguagePreference'
import { readUiPreferences, type UiPreferences } from '../shared/UiPreferences'
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'
import { applyTheme } from '../theme/applyTheme'
import { FeedPlaceholder } from './FeedPlaceholder'
import type { PlaceholderRenderer } from './PlaceholderMount'

export interface FeedPlaceholderRendererOptions {
  site: SiteFeedProfile
  window: Window
  storage: Parameters<typeof readUiPreferences>[0]
}

const SYSTEM_PREFERENCES: UiPreferences = { theme: 'system', language: 'system' }

/**
 * Renders `FeedPlaceholder` into the shadow root with the user's theme and
 * language (explicit choice first, then the browser), both set on the
 * container inside the shadow root, never on the host the page can see.
 */
export function feedPlaceholderRenderer({
  site,
  window,
  storage,
}: FeedPlaceholderRendererOptions): PlaceholderRenderer {
  return (container) => {
    let mounted = true
    void readUiPreferences(storage)
      .catch(() => SYSTEM_PREFERENCES)
      .then((preferences) => {
        if (!mounted) return
        applyTheme(preferences.theme, container)
        const locale = preferredLocale(preferences.language, window.navigator.languages)
        container.setAttribute('lang', locale)
        render(
          <I18nProvider locale={locale}>
            <FeedPlaceholder
              site={site}
              navigate={(path) => window.location.assign(new URL(path, window.location.origin))}
              activateTab={(selector) =>
                window.document.querySelector<HTMLElement>(selector)?.click()
              }
            />
          </I18nProvider>,
          container
        )
      })
    return () => {
      mounted = false
      render(null, container)
    }
  }
}
