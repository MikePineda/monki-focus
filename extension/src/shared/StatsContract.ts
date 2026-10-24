// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Read-only answers of the `stats.*` commands, computed by the service worker
 * from the local 5-minute blocks. Every number is seconds; the pages format
 * them. Levels are indices 0..4 (Distracting .. Focus), i.e. the analytics
 * level (0, 25, 50, 75, 100) divided by 25, the same scale as the UI kit's
 * `LevelIndex`.
 */
export type StatsLevelIndex = 0 | 1 | 2 | 3 | 4

export type SecondsByLevelIndex = Record<StatsLevelIndex, number>

export interface TopActivity {
  /** Normalised domain (never a URL, a path or a title). */
  activityKey: string
  seconds: number
  /** The level the activity spent most of its time at today. */
  level: StatsLevelIndex
}

export interface IntentionSummary {
  total: number
  kept: number
  broken: number
  closes: number
}

export interface TodayStats {
  /** Local date (`YYYY-MM-DD`) in the rule set's pinned time zone. */
  date: string
  /** RescueTime-style focus pulse 0..100, `null` without tracked time. */
  pulse: number | null
  totalSeconds: number
  /** Categorised seconds per level; uncategorised time is reported apart. */
  levels: SecondsByLevelIndex
  /** Seconds without a category (they count as Neutral in the pulse). */
  uncategorisedSeconds: number
  /** At most five, most seconds first. */
  topActivities: TopActivity[]
  /** Today's intentions from the gate's log (E6): commitments, kept, broken, closes. */
  intentions: IntentionSummary
}

export interface DailyPulse {
  date: string
  pulse: number | null
  totalSeconds: number
}

export interface HourlyCell {
  /** Monday = 0 … Sunday = 6, in the pinned time zone. */
  weekday: number
  /** Local hour 0..23. */
  hour: number
  /** Tracked seconds in that hour, averaged over the weeks of the window. */
  averageSeconds: number
  /** Pulse of all the time tracked in that weekday-hour, `null` without time. */
  pulse: number | null
}

export interface WeekStats {
  /** The last seven local dates, oldest first, today last. */
  days: DailyPulse[]
  /** Weeks the hourly averages cover (each weekday-hour divides by this). */
  weeks: number
  /** 7 × 24 cells, weekday-major, hour-minor. */
  hourly: HourlyCell[]
}

export interface IncognitoAccess {
  /** Whether the user let the extension run in incognito windows. */
  allowed: boolean
}
