// SPDX-License-Identifier: AGPL-3.0-or-later
import { SUPPORTED_LOCALES } from '../i18n/locale'
import type { LanguagePreference } from '../i18n/LanguagePreference'
import { THEME_PREFERENCES, type ThemePreference } from '../theme/ThemePreference'
import type { ChartView } from '../ui/ChartTableToggle'

/**
 * Preferences the options page and the popup change with `preferences.set`
 * (the service worker writes `storage.local`; pages only read). The keys are
 * the ones the readers already use: `ui.theme` and `ui.language`
 * (UiPreferences), `privacy.storeTitles` and `tracking.countAudibleWhileIdle`
 * (TrackingSettings), plus the remembered chart/table view of each chart.
 */
export const CHART_IDS = ['todayLevels', 'weekPulse', 'weekHeatmap'] as const
export type ChartId = (typeof CHART_IDS)[number]

export function chartViewKey(chart: ChartId): `ui.chartView.${ChartId}` {
  return `ui.chartView.${chart}`
}

export interface Preferences {
  theme: ThemePreference
  language: LanguagePreference
  storeTitles: boolean
  countAudibleWhileIdle: boolean
  chartViews: Record<ChartId, ChartView>
}

export type PreferenceChange =
  | { key: 'ui.theme'; value: ThemePreference }
  | { key: 'ui.language'; value: LanguagePreference }
  | { key: 'privacy.storeTitles'; value: boolean }
  | { key: 'tracking.countAudibleWhileIdle'; value: boolean }
  | { key: `ui.chartView.${ChartId}`; value: ChartView }

const LANGUAGES: readonly unknown[] = ['system', ...SUPPORTED_LOCALES]
const CHART_VIEWS: readonly unknown[] = ['chart', 'table']

/** Payload guard of `preferences.set`: a known key with a value of its type. */
export function isPreferenceChange(value: unknown): value is PreferenceChange {
  if (typeof value !== 'object' || value === null) return false
  const { key, value: next, ...rest } = value as Record<string, unknown>
  if (Object.keys(rest).length > 0) return false
  switch (key) {
    case 'ui.theme':
      return (THEME_PREFERENCES as readonly unknown[]).includes(next)
    case 'ui.language':
      return LANGUAGES.includes(next)
    case 'privacy.storeTitles':
    case 'tracking.countAudibleWhileIdle':
      return typeof next === 'boolean'
    default:
      return CHART_IDS.some((chart) => chartViewKey(chart) === key) && CHART_VIEWS.includes(next)
  }
}
