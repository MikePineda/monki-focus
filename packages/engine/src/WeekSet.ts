// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Week sets (SEMANTICS.md §6.1): for comparisons a list of schedules is the
 * set of minutes it covers on the 10 080-minute week starting Monday 00:00,
 * windows wrapping from Sunday into Monday. Empty schedules are the whole
 * week. `{mon 00:30–07:00}` is not contained in `{mon 22:30–07:00}`.
 */
import {
  MINUTES_PER_DAY,
  weekdayIndex,
  windowLengthMinutes,
  windowStartMinute,
} from './DailyWindow.ts'
import type { DailyWindowSpec } from './DailyWindow.ts'

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

export type WeekSet = Uint8Array

export function weekSetOf(windows: readonly DailyWindowSpec[]): WeekSet {
  const set = new Uint8Array(MINUTES_PER_WEEK)
  if (windows.length === 0) return set.fill(1)
  for (const window of windows) {
    const start = windowStartMinute(window)
    const length = windowLengthMinutes(window)
    for (const day of window.days) {
      const first = weekdayIndex(day) * MINUTES_PER_DAY + start
      for (let minute = first; minute < first + length; minute += 1) {
        set[minute % MINUTES_PER_WEEK] = 1
      }
    }
  }
  return set
}

/** Every minute of `inner` is in `outer`. */
export function weekSetContains(outer: WeekSet, inner: WeekSet): boolean {
  return inner.every((covered, minute) => covered === 0 || outer[minute] === 1)
}

export function weekSetsIntersect(a: WeekSet, b: WeekSet): boolean {
  return a.some((covered, minute) => covered === 1 && b[minute] === 1)
}

export function weekSetsEqual(a: WeekSet, b: WeekSet): boolean {
  return weekSetContains(a, b) && weekSetContains(b, a)
}
