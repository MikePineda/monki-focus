// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { PreferenceService } from '../../../../src/background/preferences/PreferenceService'
import { readTrackingSettings } from '../../../../src/background/tracking/TrackingSettings'
import { readUiPreferences } from '../../../../src/shared/UiPreferences'

describe('PreferenceService', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('defaults_follow_the_system_keep_titles_off_and_charts_first', async () => {
    expect(await new PreferenceService(fakeBrowser.storage.local).get()).toEqual({
      theme: 'system',
      language: 'system',
      storeTitles: false,
      countAudibleWhileIdle: true,
      chartViews: { todayLevels: 'chart', weekPulse: 'chart', weekHeatmap: 'chart' },
    })
  })

  it('writes_the_keys_the_pages_and_the_tracker_already_read', async () => {
    const service = new PreferenceService(fakeBrowser.storage.local)

    await service.set({ key: 'ui.theme', value: 'dark' })
    await service.set({ key: 'ui.language', value: 'es' })
    await service.set({ key: 'privacy.storeTitles', value: true })
    const preferences = await service.set({ key: 'tracking.countAudibleWhileIdle', value: false })

    expect(await readUiPreferences(fakeBrowser.storage.local)).toEqual({
      theme: 'dark',
      language: 'es',
    })
    expect(await readTrackingSettings(fakeBrowser.storage.local)).toEqual({
      storeTitles: true,
      countAudibleWhileIdle: false,
    })
    expect(preferences).toMatchObject({ storeTitles: true, countAudibleWhileIdle: false })
  })

  it('remembers_the_view_of_each_chart_on_its_own', async () => {
    const service = new PreferenceService(fakeBrowser.storage.local)

    const preferences = await service.set({ key: 'ui.chartView.weekPulse', value: 'table' })

    expect(preferences.chartViews).toEqual({
      todayLevels: 'chart',
      weekPulse: 'table',
      weekHeatmap: 'chart',
    })
  })
})
