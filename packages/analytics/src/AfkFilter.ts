// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Active time (SEMANTICS.md §10.3): events are cut to the time not covered
 * by AFK events with status `afk`. Audible web events are kept whole (a
 * lecture playing while the user listens).
 */
import type { ActivityEvent } from '@monki-focus/rules'
import { isAfkData, isWebTabData } from './EventData.ts'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'
import type { Interval } from './IntervalSet.ts'
import { subtractIntervals } from './IntervalSet.ts'

function intervalOf(event: ActivityEvent): Interval {
  const start = epochSecondsOf(event.timestamp)
  return { start, end: start + event.duration }
}

/** Active pieces in timestamp order (stable); zero-length pieces are dropped. */
export function activeTime(
  events: readonly ActivityEvent[],
  afkEvents: readonly ActivityEvent[]
): ActivityEvent[] {
  const away = afkEvents
    .filter((event) => isAfkData(event.data) && event.data.status === 'afk')
    .map(intervalOf)
  const pieces = events.flatMap((event) => {
    const keepWhole = isWebTabData(event.data) && event.data.audible
    return subtractIntervals([intervalOf(event)], keepWhole ? [] : away).map((interval) => ({
      start: interval.start,
      event: {
        timestamp: utcInstantOf(interval.start),
        duration: interval.end - interval.start,
        data: event.data,
      },
    }))
  })
  return pieces.sort((a, b) => a.start - b.start).map((piece) => piece.event)
}
