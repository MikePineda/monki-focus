// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import en from '../../../src/i18n/catalogs/en.json'
import es from '../../../src/i18n/catalogs/es.json'
import { UI_PREFERENCE_KEYS } from '../../../src/shared/UiPreferences'
import { cacheTheme, readCachedTheme } from '../../../src/theme/ThemeCache'
import { startPage } from '../../../src/ui/startPage'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  root.id = 'app'
  document.body.append(root)
  return root
}

describe('startPage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    localStorage.clear()
  })

  afterEach(() => {
    document.body.replaceChildren()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('lang')
  })

  it('page_follows_navigator_languages_without_a_stored_choice', async () => {
    await startPage({ titleKey: 'popup.title', root: mountRoot(), navigatorLanguages: ['es-MX'] })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(es['popup.title'])
    expect(document.documentElement.lang).toBe('es')
    expect(document.title).toBe(es['popup.title'])
  })

  it('stored_language_overrides_navigator_languages', async () => {
    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.language]: 'en' })

    await startPage({ titleKey: 'popup.title', root: mountRoot(), navigatorLanguages: ['es-MX'] })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en['popup.title'])
    expect(document.documentElement.lang).toBe('en')
  })

  it('page_applies_the_stored_theme_and_caches_it_for_the_next_first_paint', async () => {
    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.theme]: 'dark' })

    await startPage({ titleKey: 'popup.title', root: mountRoot() })

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(readCachedTheme()).toBe('dark')
  })

  it('page_paints_the_cached_theme_before_storage_answers', async () => {
    cacheTheme('dark')
    let release: () => void = () => undefined
    const slowStorage = {
      get: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          release = () => resolve({ [UI_PREFERENCE_KEYS.theme]: 'light' })
        }),
    }

    const started = startPage({ titleKey: 'popup.title', root: mountRoot(), storage: slowStorage })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    release()
    await started
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('page_follows_a_theme_change_made_on_another_page', async () => {
    await startPage({ titleKey: 'popup.title', root: mountRoot() })
    expect(document.documentElement).not.toHaveAttribute('data-theme')

    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.theme]: 'light' })

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'))
  })

  it('unreadable_storage_still_renders_the_page_in_the_system_theme', async () => {
    const brokenStorage = { get: () => Promise.reject(new Error('storage unavailable')) }

    await startPage({ titleKey: 'popup.title', root: mountRoot(), storage: brokenStorage })

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('missing_root_is_a_boot_error', async () => {
    await expect(startPage({ titleKey: 'popup.title', root: null })).rejects.toThrow(/#app/)
  })

  it('page_switches_language_when_the_preference_changes', async () => {
    await startPage({ titleKey: 'options.title', root: mountRoot(), navigatorLanguages: ['en'] })

    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.language]: 'es' })

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(es['options.title'])
    )
    expect(document.documentElement.lang).toBe('es')
    expect(document.title).toBe(es['options.title'])
    expect(en['options.title']).not.toBe(es['options.title'])
  })
})
