// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'

/** Raw events of one bucket, keyed by an id the store assigns. */
export interface EventRepository {
  /** Stores a new event and answers its id. */
  add(bucketId: string, event: ActivityEvent): Promise<number>
  /** Replaces the event with `id` (a heartbeat extended it). */
  replace(id: number, bucketId: string, event: ActivityEvent): Promise<void>
  /** Events of the bucket whose `timestamp` is in `[from, to)`, oldest first. */
  between(bucketId: string, from: string, to: string): Promise<ActivityEvent[]>
  /** Deletes every event (any bucket) with `timestamp < before`; answers how many. */
  deleteBefore(before: string): Promise<number>
}
