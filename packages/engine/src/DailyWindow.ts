// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A weekly `{days, start, end}` window in local wall-clock minutes
 * (SEMANTICS.md §6.1): for each listed day `d`, `[d + start, d + start + length)`
 * with `length = (end − start) mod 24 h` and `0` meaning 24 hours. A window that
 * crosses midnight belongs to the day it starts on. Used by schedules,
 * `workHours` and bedtime alike.
 */
import type { Weekday } from '@monki-focus/rules'
import type { LocalTime } from './ZonedTime.ts'

export const MINUTES_PER_DAY = 1440

const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface DailyWindowSpec {
  days: readonly Weekday[]
  start: string
  end: string
}

/** One occurrence of a window: the local day it starts on and its minutes. */
export interface WindowOccurrence {
  startDayNumber: number
  startMinute: number
  lengthMinutes: number
}

/** Minutes since midnight of a `HH:MM` time of day. */
export function minutesOfTimeOfDay(timeOfDay: string): number {
  return Number(timeOfDay.slice(0, 2)) * 60 + Number(timeOfDay.slice(3, 5))
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(day: Weekday): number {
  return WEEKDAYS.indexOf(day)
}

export function windowStartMinute(spec: DailyWindowSpec): number {
  return minutesOfTimeOfDay(spec.start)
}

export function windowLengthMinutes(spec: DailyWindowSpec): number {
  const length =
    (minutesOfTimeOfDay(spec.end) - minutesOfTimeOfDay(spec.start) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY
  return length === 0 ? MINUTES_PER_DAY : length
}

function startsOn(spec: DailyWindowSpec, weekday: number): boolean {
  return spec.days.some((day) => weekdayIndex(day) === weekday)
}

/**
 * The occurrence of the window that contains the local time, if any. Windows
 * last at most 24 hours, so only the previous and the current local day can
 * contain it.
 */
export function occurrenceAt(spec: DailyWindowSpec, local: LocalTime): WindowOccurrence | null {
  const start = windowStartMinute(spec)
  const length = windowLengthMinutes(spec)
  for (const daysBack of [1, 0]) {
    const minute = local.minuteOfDay + daysBack * MINUTES_PER_DAY
    const weekday = (local.weekday - daysBack + 7) % 7
    if (startsOn(spec, weekday) && minute >= start && minute < start + length) {
      return {
        startDayNumber: local.dayNumber - daysBack,
        startMinute: start,
        lengthMinutes: length,
      }
    }
  }
  return null
}

/**
 * Whether the local time falls in `[start − minutesBefore, start)` of a
 * listed day (the bedtime warning, §6.2). The lead may reach into the
 * previous local day.
 */
export function isInLeadUp(
  spec: DailyWindowSpec,
  local: LocalTime,
  minutesBefore: number
): boolean {
  const start = windowStartMinute(spec)
  for (const daysAhead of [0, 1]) {
    const minute = local.minuteOfDay - daysAhead * MINUTES_PER_DAY
    const weekday = (local.weekday + daysAhead) % 7
    if (startsOn(spec, weekday) && minute >= start - minutesBefore && minute < start) return true
  }
  return false
}
