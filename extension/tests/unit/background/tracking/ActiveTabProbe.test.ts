// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { ActiveTabProbe } from '../../../../src/background/tracking/ActiveTabProbe'
import { IdleWatcher } from '../../../../src/background/tracking/IdleWatcher'
import {
  readTrackingSettings,
  TRACKING_SETTING_NAMES,
} from '../../../../src/background/tracking/TrackingSettings'
import { WindowFocusGrace } from '../../../../src/background/tracking/WindowFocusGrace'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { FakeTrackingBrowser } from '../../../support/FakeTrackingBrowser'

const NOW = Date.parse('2026-01-05T09:00:00.700Z')

describe('ActiveTabProbe', () => {
  let browser: FakeTrackingBrowser
  let focus: WindowFocusGrace
  let probe: ActiveTabProbe

  beforeEach(() => {
    fakeBrowser.reset()
    browser = new FakeTrackingBrowser()
    focus = new WindowFocusGrace(2_000)
    probe = new ActiveTabProbe({
      windows: browser.api.windows,
      tabs: browser.api.tabs,
      idle: new IdleWatcher(browser.api.idle),
      focus,
      settings: () => readTrackingSettings(fakeBrowser.storage.local),
      catalog: bundledRulesCatalog(),
    })
  })

  it('focused_active_tab_is_a_heartbeat_with_domain_and_path_only', async () => {
    browser.activate({ url: 'https://www.news.example/world/today?id=7#top', title: 'Today' })

    expect(await probe.probe(NOW)).toEqual({
      timestamp: '2026-01-05T09:00:00Z',
      duration: 0,
      data: {
        domain: 'news.example',
        path: '/world/today',
        surface: null,
        audible: false,
        incognito: false,
      },
    })
  })

  it('titles_are_not_stored_by_default', async () => {
    browser.activate({ url: 'https://news.example/', title: 'A private headline' })

    const heartbeat = await probe.probe(NOW)

    expect(heartbeat?.data).not.toHaveProperty('title')
  })

  it('titles_are_stored_only_when_the_user_turns_store_titles_on', async () => {
    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.storeTitles]: true })
    browser.activate({ url: 'https://news.example/', title: 'A headline' })

    const heartbeat = await probe.probe(NOW)

    expect(heartbeat?.data).toHaveProperty('title', 'A headline')
  })

  it('unfocused_browser_counts_nothing', async () => {
    browser.activate({ url: 'https://news.example/' })
    browser.blur()
    focus.focusLost(NOW - 5_000)

    expect(await probe.probe(NOW)).toBeNull()
  })

  it('window_none_within_the_grace_still_counts', async () => {
    browser.activate({ url: 'https://news.example/' })
    browser.blur()
    focus.focusLost(NOW - 1_500)

    expect(await probe.probe(NOW)).not.toBeNull()
  })

  it('idle_user_on_a_silent_tab_counts_nothing', async () => {
    browser.activate({ url: 'https://news.example/' })
    browser.setIdle('idle')

    expect(await probe.probe(NOW)).toBeNull()
  })

  it('audible_active_tab_counts_while_idle', async () => {
    browser.activate({ url: 'https://lectures.example/talk', audible: true })
    browser.setIdle('idle')

    const heartbeat = await probe.probe(NOW)

    expect(heartbeat?.data).toMatchObject({ domain: 'lectures.example', audible: true })
  })

  it('audible_tab_stops_counting_while_idle_when_the_user_turns_it_off', async () => {
    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.countAudibleWhileIdle]: false })
    browser.activate({ url: 'https://lectures.example/talk', audible: true })
    browser.setIdle('idle')

    expect(await probe.probe(NOW)).toBeNull()
  })

  it('locked_screen_counts_nothing_even_with_sound', async () => {
    browser.activate({ url: 'https://lectures.example/talk', audible: true })
    browser.setIdle('locked')

    expect(await probe.probe(NOW)).toBeNull()
  })

  it.each([
    'chrome://settings/',
    'chrome-extension://abc/popup.html',
    'file:///tmp/a.html',
    'about:blank',
  ])('non_http_page_%s_counts_nothing', async (url) => {
    browser.activate({ url })

    expect(await probe.probe(NOW)).toBeNull()
  })

  it('incognito_tab_counts_by_domain_only_and_never_keeps_a_title', async () => {
    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.storeTitles]: true })
    browser.activate({
      url: 'https://www.youtube.com/watch?v=abc',
      title: 'Private video',
      incognito: true,
    })

    expect((await probe.probe(NOW))?.data).toEqual({
      domain: 'youtube.com',
      path: '/',
      surface: null,
      audible: false,
      incognito: true,
    })
  })
})
