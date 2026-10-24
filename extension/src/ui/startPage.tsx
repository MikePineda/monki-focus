// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, type ComponentChildren } from 'preact'
import { browser } from 'wxt/browser'
import { I18nProvider } from '../i18n/I18nContext'
import { preferredLocale } from '../i18n/LanguagePreference'
import { createTranslator, type SimpleKey } from '../i18n/t'
import { readUiPreferences, watchUiPreferences, type UiPreferences } from '../shared/UiPreferences'
import { applyTheme } from '../theme/applyTheme'
import { cacheTheme, readCachedTheme } from '../theme/ThemeCache'
import '../theme/tokens.css'
import { PageShell } from './PageShell'

type ThemeCacheStorage = Parameters<typeof readCachedTheme>[0]

export interface StartPageOptions {
  titleKey: SimpleKey
  /** Page body under the heading; receives the page's I18nProvider. */
  content?: ComponentChildren
  /**
   * `false` renders `content` without the PageShell heading: a page that
   * lays out its own `<main>` and heading (the intention gate).
   */
  shell?: boolean
  root?: HTMLElement | null
  /** Seams for tests; production uses the extension's storage and browser. */
  storage?: Parameters<typeof readUiPreferences>[0]
  storageChanged?: Parameters<typeof watchUiPreferences>[0]
  navigatorLanguages?: readonly string[]
  themeCache?: ThemeCacheStorage
}

const SYSTEM_PREFERENCES: UiPreferences = { theme: 'system', language: 'system' }

/**
 * Boots an extension page: paints the cached theme at once (no flash), reads
 * the stored theme and language (an explicit language wins over
 * `navigator.languages`), sets `<html lang>`, `data-theme` and the document
 * title, follows later theme changes and renders the page into `#app`.
 */
export async function startPage({
  titleKey,
  content,
  shell = true,
  root = document.getElementById('app'),
  storage = browser.storage.local,
  storageChanged = browser.storage.onChanged,
  navigatorLanguages = navigator.languages,
  themeCache = localStorage,
}: StartPageOptions): Promise<void> {
  if (!root) throw new Error('startPage: missing #app root element')
  applyTheme(readCachedTheme(themeCache))

  const preferences = await readUiPreferences(storage).catch(() => SYSTEM_PREFERENCES)
  const followTheme = (theme: UiPreferences['theme']) => {
    applyTheme(theme)
    cacheTheme(theme, themeCache)
  }
  followTheme(preferences.theme)
  watchUiPreferences(storageChanged, { onTheme: followTheme })

  const locale = preferredLocale(preferences.language, navigatorLanguages)
  const t = createTranslator(locale)
  document.documentElement.lang = locale
  document.title = t(titleKey)
  render(
    <I18nProvider locale={locale}>
      {shell ? <PageShell title={t(titleKey)}>{content}</PageShell> : content}
    </I18nProvider>,
    root
  )
}
