// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'

/** `YYYY-MM-DD`, a calendar date in the user's time zone. */
export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface LocalDateRange {
  /** The local dates of the range, ascending. */
  readonly dates: readonly string[]
  /** UTC instant of the first date's local midnight (inclusive). */
  readonly from: DateTime
  /** UTC instant of the local midnight after the last date (exclusive). */
  readonly to: DateTime
}

/** Whether `value` is a real calendar date (`2026-02-30` is not). */
export function isLocalDate(value: string): boolean {
  return LOCAL_DATE_PATTERN.test(value) && DateTime.fromISO(value, { zone: 'utc' }).isValid
}

/**
 * `days` local dates starting at `start` in `timeZone`, with the UTC bounds
 * of their local midnights (a 23- or 25-hour day keeps its real length).
 */
export function localDateRange(start: string, days: number, timeZone: string): LocalDateRange {
  const first = DateTime.fromISO(start, { zone: timeZone }).startOf('day')
  if (!isLocalDate(start) || !first.isValid) {
    throw new RangeError('Invalid local date or time zone')
  }
  const dates = Array.from({ length: days }, (_, index) => first.plus({ days: index }).toISODate()!)
  return { dates, from: first.toUTC(), to: first.plus({ days }).startOf('day').toUTC() }
}
