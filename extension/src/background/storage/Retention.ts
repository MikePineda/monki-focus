// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf, utcInstantOf } from '@monki-focus/engine'
import type { EventRepository } from './EventRepository'

/** Raw events are kept this many days; 5-minute blocks are kept without limit. */
export const RAW_EVENT_RETENTION_DAYS = 30

const DAY_SECONDS = 86_400

/** The first instant that is still kept at `now`. */
export function retentionCutoff(now: string): string {
  return utcInstantOf(epochSecondsOf(now) - RAW_EVENT_RETENTION_DAYS * DAY_SECONDS)
}

/** Purges raw events older than the retention window. */
export class Retention {
  constructor(private readonly events: EventRepository) {}

  /** Deletes events that started before `now − 30 days`; answers how many. */
  purge(now: string): Promise<number> {
    return this.events.deleteBefore(retentionCutoff(now))
  }
}
