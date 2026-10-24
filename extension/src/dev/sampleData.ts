// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LevelIndex, MinutesByLevel } from '../ui/LevelIndex'

/*
 * Synthetic data for the UI kit gallery: real shapes, invented values and
 * reserved `.example` hosts. Never real browsing history.
 */

export const SAMPLE_SITE = 'news.example'

export const SAMPLE_PULSE = 56
export const SAMPLE_TRACKED = '4 h 12 min'

export const SAMPLE_MINUTES_BY_LEVEL: MinutesByLevel = [42, 18, 31, 25, 61]
export const SAMPLE_UNCATEGORISED_MINUTES = 9

export interface SampleSite {
  host: string
  minutes: number
  level: LevelIndex
  visits: number
}

export const SAMPLE_TOP_SITES: readonly SampleSite[] = [
  { host: 'news.example', minutes: 42, level: 0, visits: 3 },
  { host: 'docs.example', minutes: 37, level: 4, visits: 1 },
  { host: 'video.example', minutes: 18, level: 1, visits: 2 },
]

export const SAMPLE_CLOSES_TODAY = 4
export const SAMPLE_INTENTION_MINUTES = 10
export const SAMPLE_PAUSE_SECONDS = 30
export const SAMPLE_PAUSE_ELAPSED_SECONDS = 12
/** The gallery countdown restarts from this many seconds. */
export const SAMPLE_COUNTDOWN_SECONDS = 90
export const SAMPLE_DURATIONS = ['5', '10', '15'] as const
