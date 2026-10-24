// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  DEFAULT_TRACKING_SETTINGS,
  readTrackingSettings,
  TRACKING_SETTING_NAMES,
} from '../../../../src/background/tracking/TrackingSettings'

describe('tracking settings', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('titles_are_off_and_audible_time_counts_by_default', async () => {
    expect(await readTrackingSettings(fakeBrowser.storage.local)).toEqual({
      storeTitles: false,
      countAudibleWhileIdle: true,
    })
    expect(DEFAULT_TRACKING_SETTINGS.storeTitles).toBe(false)
  })

  it('only_an_explicit_true_turns_titles_on', async () => {
    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.storeTitles]: 'yes' })
    expect((await readTrackingSettings(fakeBrowser.storage.local)).storeTitles).toBe(false)

    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.storeTitles]: true })
    expect((await readTrackingSettings(fakeBrowser.storage.local)).storeTitles).toBe(true)
  })

  it('the_user_can_stop_counting_audible_time_while_idle', async () => {
    await fakeBrowser.storage.local.set({ [TRACKING_SETTING_NAMES.countAudibleWhileIdle]: false })

    expect((await readTrackingSettings(fakeBrowser.storage.local)).countAudibleWhileIdle).toBe(
      false
    )
  })
})
