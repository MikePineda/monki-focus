// SPDX-License-Identifier: AGPL-3.0-or-later
import { heartbeat, type ActivityEvent } from '@monki-focus/analytics'
import type { Browser } from 'wxt/browser'
import type { EventRepository } from '../storage/EventRepository'

/** `browser.storage.session` key of the open (still growing) event. */
export const OPEN_HEARTBEAT_STORAGE_NAME = 'tracking.openHeartbeat'

interface OpenHeartbeat {
  id: number
  bucketId: string
  event: ActivityEvent
}

type SessionArea = Pick<Browser.storage.StorageArea, 'get' | 'set' | 'remove'>

function isOpenHeartbeat(value: unknown): value is OpenHeartbeat {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<OpenHeartbeat>
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.bucketId === 'string' &&
    typeof candidate.event?.timestamp === 'string' &&
    typeof candidate.event.duration === 'number' &&
    typeof candidate.event.data === 'object'
  )
}

/**
 * Merges heartbeats into events (ActivityWatch semantics, `pulsetime`) and
 * writes every change through to the event store. The open event and its row
 * id live in `storage.session`, so a service worker that dies and restarts
 * keeps extending the same row: at most the pulse in flight is lost.
 */
export class HeartbeatRecorder {
  constructor(
    private readonly session: SessionArea,
    private readonly events: EventRepository,
    private readonly bucketId: string,
    private readonly pulsetimeSeconds: number
  ) {}

  /**
   * Applies one pulse. `next` is the probed heartbeat (`null`: nothing to
   * count). `closeAt`, when known, is the instant the previous state ended (a
   * tab switch, a navigation, focus leaving): an open event that `next` does
   * not extend is first extended to it, within pulsetime.
   */
  async record(next: ActivityEvent | null, closeAt: string | null): Promise<void> {
    const open = await this.load()
    if (open !== null && next !== null) {
      const merged = heartbeat(open.event, next, this.pulsetimeSeconds)
      if (merged !== null) {
        await this.store(open.id, merged)
        return
      }
    }
    if (open !== null && closeAt !== null) {
      const closing: ActivityEvent = { timestamp: closeAt, duration: 0, data: open.event.data }
      const closed = heartbeat(open.event, closing, this.pulsetimeSeconds)
      if (closed !== null && closed.duration !== open.event.duration) {
        await this.events.replace(open.id, this.bucketId, closed)
      }
    }
    if (next === null) {
      await this.session.remove(OPEN_HEARTBEAT_STORAGE_NAME)
      return
    }
    const id = await this.events.add(this.bucketId, next)
    await this.save({ id, bucketId: this.bucketId, event: next })
  }

  /** The open event, if this bucket has one. */
  async load(): Promise<OpenHeartbeat | null> {
    const stored = (await this.session.get(OPEN_HEARTBEAT_STORAGE_NAME))[
      OPEN_HEARTBEAT_STORAGE_NAME
    ]
    return isOpenHeartbeat(stored) && stored.bucketId === this.bucketId ? stored : null
  }

  private async store(id: number, event: ActivityEvent): Promise<void> {
    await this.events.replace(id, this.bucketId, event)
    await this.save({ id, bucketId: this.bucketId, event })
  }

  private save(open: OpenHeartbeat): Promise<void> {
    return this.session.set({ [OPEN_HEARTBEAT_STORAGE_NAME]: open })
  }
}
