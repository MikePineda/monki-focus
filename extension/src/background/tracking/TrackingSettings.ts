// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'

/** `browser.storage.local` keys of the tracking and privacy settings. */
export const TRACKING_SETTING_NAMES = {
  /** Store page titles with events. Off by default; titles never sync. */
  storeTitles: 'privacy.storeTitles',
  /** An audible active tab counts while the user is idle (a lecture, a talk). */
  countAudibleWhileIdle: 'tracking.countAudibleWhileIdle',
} as const

export interface TrackingSettings {
  storeTitles: boolean
  countAudibleWhileIdle: boolean
}

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  storeTitles: false,
  countAudibleWhileIdle: true,
}

type StorageReader = Pick<Browser.storage.StorageArea, 'get'>

/** Only an explicit boolean changes a default; anything else keeps it. */
export async function readTrackingSettings(storage: StorageReader): Promise<TrackingSettings> {
  const stored = await storage.get([
    TRACKING_SETTING_NAMES.storeTitles,
    TRACKING_SETTING_NAMES.countAudibleWhileIdle,
  ])
  const storeTitles = stored[TRACKING_SETTING_NAMES.storeTitles]
  const countAudible = stored[TRACKING_SETTING_NAMES.countAudibleWhileIdle]
  return {
    storeTitles: storeTitles === true,
    countAudibleWhileIdle:
      typeof countAudible === 'boolean'
        ? countAudible
        : DEFAULT_TRACKING_SETTINGS.countAudibleWhileIdle,
  }
}
