// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ActivityWatch heartbeat merging (SEMANTICS.md §10.1): a heartbeat with
 * deep-equal data that starts inside `[last.timestamp, last end + pulsetime]`
 * extends the last event; anything else opens a new event.
 */
import type { ActivityEvent } from '@monki-focus/rules'
import { sameData } from './EventData.ts'
import { epochSecondsOf } from './Instant.ts'

/**
 * The last event extended by `next`, or `null` when `next` must open a new
 * event. Pure: neither argument is modified.
 */
export function heartbeat(
  last: ActivityEvent | null,
  next: ActivityEvent,
  pulsetime: number
): ActivityEvent | null {
  if (last === null || !sameData(last.data, next.data)) return null
  const lastStart = epochSecondsOf(last.timestamp)
  const nextStart = epochSecondsOf(next.timestamp)
  if (nextStart < lastStart || nextStart > lastStart + last.duration + pulsetime) return null
  return {
    timestamp: last.timestamp,
    duration: Math.max(last.duration, nextStart + next.duration - lastStart),
    data: last.data,
  }
}

/** Applies `heartbeats` in order to a bucket's `events`, as aw-server does. */
export function mergeHeartbeats(
  events: readonly ActivityEvent[],
  heartbeats: readonly ActivityEvent[],
  pulsetime: number
): ActivityEvent[] {
  const result = [...events]
  for (const next of heartbeats) {
    const merged = heartbeat(result.at(-1) ?? null, next, pulsetime)
    if (merged === null) result.push(next)
    else result[result.length - 1] = merged
  }
  return result
}
