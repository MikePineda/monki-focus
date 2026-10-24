// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `isScheduleActive(schedules, workHours, now, timeZone)` (SEMANTICS.md §6.1):
 * a list of schedules is active when the local wall time falls in one of their
 * windows; an empty list is always active. `{ref: "workHours"}` resolves to the
 * rule set's work hours.
 */
import type { Instant, RuleSchedule, Schedule, TimeZone } from '@monki-focus/rules'
import { occurrenceAt } from './DailyWindow.ts'
import { epochSecondsOf } from './Instant.ts'
import { localTimeAt } from './ZonedTime.ts'

/** Replaces every `{ref: "workHours"}` with the work hours themselves. */
export function resolveSchedules(
  schedules: readonly RuleSchedule[],
  workHours: Schedule
): Schedule[] {
  return schedules.map((schedule) => ('ref' in schedule ? workHours : schedule))
}

/** Same as `isScheduleActive` for an instant already in epoch seconds. */
export function isScheduleActiveAt(
  schedules: readonly RuleSchedule[],
  workHours: Schedule,
  epochSeconds: number,
  timeZone: TimeZone
): boolean {
  if (schedules.length === 0) return true
  const local = localTimeAt(epochSeconds, timeZone)
  return resolveSchedules(schedules, workHours).some(
    (schedule) => occurrenceAt(schedule, local) !== null
  )
}

export function isScheduleActive(
  schedules: readonly RuleSchedule[],
  workHours: Schedule,
  now: Instant,
  timeZone: TimeZone
): boolean {
  return isScheduleActiveAt(schedules, workHours, epochSecondsOf(now), timeZone)
}
