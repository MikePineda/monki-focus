// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf, localTimeAt, type LocalTime } from '@monki-focus/engine'

/**
 * Local calendar facts of a block start in the pinned zone. A block never
 * straddles local midnight: every zone in use today has an offset that is a
 * multiple of 5 minutes, so a 5-minute block lies in one local day and hour.
 */
export function localTimeOfBlock(blockStart: string, timeZone: string): LocalTime {
  return localTimeAt(epochSecondsOf(blockStart), timeZone)
}

/** `YYYY-MM-DD` of a local day number (days since 1970-01-01). */
export function localDateOfDayNumber(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)
}
