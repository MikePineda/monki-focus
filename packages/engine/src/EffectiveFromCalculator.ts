// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * When a waiting rule change takes effect (SEMANTICS.md §8):
 *
 * 1. the next local midnight after `now` (the later one across both zones
 *    while a zone change waits);
 * 2. while an old bedtime or schedule window of a changed part is active at
 *    that instant (in either zone), move to the end of that window;
 * 3. never earlier than the pending change's `effectiveFrom`.
 *
 * Windows last at most 24 hours, so step 2 normally ends within a few
 * rounds. A set of windows that covers every minute (24-hour windows on every
 * day) would never end: after `MAX_WINDOW_ROUNDS` the instant reached is used.
 */
import type { TimeZone } from '@monki-focus/rules'
import { MINUTES_PER_DAY, occurrenceAt } from './DailyWindow.ts'
import type { DailyWindowSpec } from './DailyWindow.ts'
import { firstInstantReachingWall, localTimeAt, nextLocalMidnight } from './ZonedTime.ts'

export const MAX_WINDOW_ROUNDS = 32

/** End instants of the windows active at `epochSeconds` in any of the zones. */
function activeWindowEnds(
  epochSeconds: number,
  zones: readonly TimeZone[],
  windows: readonly DailyWindowSpec[]
): number[] {
  return zones.flatMap((zone) => {
    const local = localTimeAt(epochSeconds, zone)
    return windows.flatMap((window) => {
      const occurrence = occurrenceAt(window, local)
      if (occurrence === null) return []
      const endMinute =
        occurrence.startDayNumber * MINUTES_PER_DAY +
        occurrence.startMinute +
        occurrence.lengthMinutes
      return [firstInstantReachingWall(epochSeconds, endMinute * 60, zone)]
    })
  })
}

export function effectiveFromOf(
  nowSeconds: number,
  zones: readonly TimeZone[],
  windows: readonly DailyWindowSpec[],
  pendingSeconds: number | null
): number {
  let instant = Math.max(...zones.map((zone) => nextLocalMidnight(nowSeconds, zone)))
  for (let round = 0; round < MAX_WINDOW_ROUNDS; round += 1) {
    const ends = activeWindowEnds(instant, zones, windows)
    if (ends.length === 0) break
    instant = Math.max(...ends)
  }
  return pendingSeconds === null ? instant : Math.max(instant, pendingSeconds)
}
