// SPDX-License-Identifier: AGPL-3.0-or-later
import { minutesOf } from '../i18n/formatDuration'
import type { ActiveIntention } from '../shared/IntentionContract'
import type { IntentionSummary, StatsLevelIndex, TodayStats } from '../shared/StatsContract'
import type { MinutesByLevel } from '../ui/LevelIndex'

export type PopupWarning = 'incognito' | 'permissions'

export interface TopSiteRow {
  domain: string
  minutes: number
  level: StatsLevelIndex
}

export interface PopupViewModel {
  pulse: number | null
  trackedSeconds: number
  minutesByLevel: MinutesByLevel
  uncategorisedMinutes: number
  topSites: TopSiteRow[]
  intentions: IntentionSummary
  /** Nothing tracked yet today. */
  emptyDay: boolean
  /** Shown only when the intention gate provides one. */
  activeIntention: ActiveIntention | null
  warnings: PopupWarning[]
}

export interface PopupInputs {
  today: TodayStats
  /** `null` when the check failed: no warning is better than a wrong one. */
  incognitoAllowed: boolean | null
  /** Host permissions the rules need but the browser does not grant. */
  missingOrigins: readonly string[]
  activeIntention: ActiveIntention | null
}

/** Today's numbers as the popup shows them: minutes, at most five sites, the warnings. */
export function popupViewModel({
  today,
  incognitoAllowed,
  missingOrigins,
  activeIntention,
}: PopupInputs): PopupViewModel {
  const { levels } = today
  const warnings: PopupWarning[] = []
  if (incognitoAllowed === false) warnings.push('incognito')
  if (missingOrigins.length > 0) warnings.push('permissions')
  return {
    pulse: today.pulse,
    trackedSeconds: today.totalSeconds,
    minutesByLevel: [
      minutesOf(levels[0]),
      minutesOf(levels[1]),
      minutesOf(levels[2]),
      minutesOf(levels[3]),
      minutesOf(levels[4]),
    ],
    uncategorisedMinutes: minutesOf(today.uncategorisedSeconds),
    topSites: today.topActivities.slice(0, 5).map((activity) => ({
      domain: activity.activityKey,
      minutes: minutesOf(activity.seconds),
      level: activity.level,
    })),
    intentions: today.intentions,
    emptyDay: today.totalSeconds === 0,
    activeIntention,
    warnings,
  }
}
