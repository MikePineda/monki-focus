// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * When a waiting rule change takes effect (SEMANTICS.md §8):
 *
 * 1. the next local midnight after `now` (the later one across both zones
 *    while a zone change waits);
 * 2. the first instant at or after it that lies in no old window of a
 *    waiting part (in either zone): the end of the union of the half-open
 *    windows that chain from it, however many there are. This is a time
 *    bound, never a round count: the result is never later than `now` +
 *    8 days, and exactly that when the union still covers it (24-hour windows
 *    on every day never end);
 * 3. never earlier than the pending change's `effectiveFrom`.
 */
import type { TimeZone } from '@monki-focus/rules'
import { MINUTES_PER_DAY, occurrenceAt } from './DailyWindow.ts'
import type { DailyWindowSpec } from './DailyWindow.ts'
import { firstInstantReachingWall, localTimeAt, nextLocalMidnight } from './ZonedTime.ts'

/** Step 2 never pushes `effectiveFrom` more than 8 days after `now`. */
export const MAX_DEFERRAL_SECONDS = 8 * 86_400

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
  const latest = nowSeconds + MAX_DEFERRAL_SECONDS
  let instant = Math.max(...zones.map((zone) => nextLocalMidnight(nowSeconds, zone)))
  // Each step jumps to the end of a window covering `instant`, so it strictly advances.
  while (instant < latest) {
    const ends = activeWindowEnds(instant, zones, windows)
    if (ends.length === 0) break
    instant = Math.max(...ends)
  }
  const bounded = Math.min(instant, latest)
  return pendingSeconds === null ? bounded : Math.max(bounded, pendingSeconds)
}
