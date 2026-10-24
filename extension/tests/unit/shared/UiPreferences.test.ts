// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  readUiPreferences,
  UI_PREFERENCE_KEYS,
  watchUiPreferences,
} from '../../../src/shared/UiPreferences'

describe('UiPreferences', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('ui_preferences_default_to_system_when_nothing_is_stored', async () => {
    expect(await readUiPreferences(browser.storage.local)).toEqual({
      theme: 'system',
      language: 'system',
    })
  })

  it('ui_preferences_read_the_stored_theme_and_language', async () => {
    await browser.storage.local.set({
      [UI_PREFERENCE_KEYS.theme]: 'dark',
      [UI_PREFERENCE_KEYS.language]: 'es',
    })
    expect(await readUiPreferences(browser.storage.local)).toEqual({
      theme: 'dark',
      language: 'es',
    })
  })

  it('malformed_ui_preferences_fall_back_to_system', async () => {
    await browser.storage.local.set({
      [UI_PREFERENCE_KEYS.theme]: 'neon',
      [UI_PREFERENCE_KEYS.language]: { code: 'es' },
    })
    expect(await readUiPreferences(browser.storage.local)).toEqual({
      theme: 'system',
      language: 'system',
    })
  })

  it('a_stored_theme_change_is_reported_parsed', async () => {
    const onTheme = vi.fn()
    const stop = watchUiPreferences(browser.storage.onChanged, { onTheme })

    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.theme]: 'light' })
    await browser.storage.local.set({ unrelated: 1 })
    stop()
    await browser.storage.local.set({ [UI_PREFERENCE_KEYS.theme]: 'dark' })

    expect(onTheme).toHaveBeenCalledTimes(1)
    expect(onTheme).toHaveBeenCalledWith('light')
  })
})
