// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { probeTab } from '../../src/index.ts'
import type { TabProbeInput } from '../../src/index.ts'
import { catalogOf } from '../factories/ActivityFactory.ts'

const catalog = catalogOf()

function input(overrides: Partial<TabProbeInput> = {}): TabProbeInput {
  return {
    now: '2026-10-26T19:00:00+10:00',
    windowFocused: true,
    idleState: 'active',
    tab: { url: 'https://example.org/docs/page?q=private#top', audible: false, incognito: false },
    settings: { countAudibleWhileIdle: true, storeTitles: false },
    ...overrides,
  }
}

describe('TabProbe', () => {
  it('heartbeat_is_written_in_utc_without_the_query', () => {
    expect(probeTab(input(), catalog)).toStrictEqual({
      timestamp: '2026-10-26T09:00:00Z',
      duration: 0,
      data: {
        domain: 'example.org',
        path: '/docs/page',
        surface: null,
        audible: false,
        incognito: false,
      },
    })
  })

  it('a_url_without_a_valid_host_counts_nothing', () => {
    const tab = { url: 'http://192.168.1.10/admin', audible: false, incognito: false }
    expect(probeTab(input({ tab }), catalog)).toBeNull()
  })

  it('no_tab_counts_nothing', () => {
    expect(probeTab(input({ tab: null }), catalog)).toBeNull()
  })

  it('audible_idle_tab_counts_nothing_when_the_setting_is_off', () => {
    const tab = { url: 'https://example.org/', audible: true, incognito: false }
    const settings = { countAudibleWhileIdle: false, storeTitles: false }
    expect(probeTab(input({ idleState: 'idle', tab, settings }), catalog)).toBeNull()
  })

  it('title_is_stored_only_when_the_user_opted_in', () => {
    const tab = { url: 'https://example.org/', audible: false, incognito: false, title: 'Docs' }
    const settings = { countAudibleWhileIdle: true, storeTitles: true }
    expect(probeTab(input({ tab, settings }), catalog)?.data).toMatchObject({ title: 'Docs' })
    expect(probeTab(input({ tab }), catalog)?.data).not.toHaveProperty('title')
  })

  it('opted_in_titles_stay_absent_when_the_tab_has_none', () => {
    const settings = { countAudibleWhileIdle: true, storeTitles: true }
    expect(probeTab(input({ settings }), catalog)?.data).not.toHaveProperty('title')
  })
})
