// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'
import { parseLanguagePreference } from '../../i18n/LanguagePreference'
import {
  CHART_IDS,
  chartViewKey,
  type ChartId,
  type PreferenceChange,
  type Preferences,
} from '../../shared/PreferenceContract'
import { UI_PREFERENCE_KEYS } from '../../shared/UiPreferences'
import { parseThemePreference } from '../../theme/ThemePreference'
import type { ChartView } from '../../ui/ChartTableToggle'
import { readTrackingSettings } from '../tracking/TrackingSettings'

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set'>

/**
 * The service worker side of `preferences.get` / `preferences.set`: the only
 * writer of the preference keys in `storage.local`. Readers elsewhere
 * (`readUiPreferences`, `readTrackingSettings`) keep their own defaults.
 */
export class PreferenceService {
  constructor(private readonly storage: StorageArea) {}

  async get(): Promise<Preferences> {
    const keys = [
      UI_PREFERENCE_KEYS.theme,
      UI_PREFERENCE_KEYS.language,
      ...CHART_IDS.map(chartViewKey),
    ]
    const [stored, tracking] = await Promise.all([
      this.storage.get(keys),
      readTrackingSettings(this.storage),
    ])
    const chartViews = Object.fromEntries(
      CHART_IDS.map((chart) => [chart, stored[chartViewKey(chart)] === 'table' ? 'table' : 'chart'])
    ) as Record<ChartId, ChartView>
    return {
      theme: parseThemePreference(stored[UI_PREFERENCE_KEYS.theme]),
      language: parseLanguagePreference(stored[UI_PREFERENCE_KEYS.language]),
      storeTitles: tracking.storeTitles,
      countAudibleWhileIdle: tracking.countAudibleWhileIdle,
      chartViews,
    }
  }

  /** `change` was checked by the command guard (`isPreferenceChange`). */
  async set(change: PreferenceChange): Promise<Preferences> {
    await this.storage.set({ [change.key]: change.value })
    return this.get()
  }
}
