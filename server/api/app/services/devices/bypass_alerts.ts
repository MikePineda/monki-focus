// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BypassKind, BypassSource } from '#domain/devices/bypass_event_kinds'

/** A bypass event that was just stored for the first time (never a duplicate). */
export interface RaisedBypassEvent {
  readonly id: number
  readonly wardUserId: number
  readonly deviceId: number | null
  readonly kind: BypassKind
  readonly source: BypassSource
  readonly occurredAt: Date
}

/**
 * Where newly stored bypass events go to reach the guardian: the port the
 * notification package (S6) implements with the ntfy outbox. Called once
 * per new event, after it is committed, never for a duplicate. Delivery
 * state lives in `bypass_events.notified_at`, so an implementation may
 * also let the outbox pick up rows with `notified_at IS NULL`.
 *
 * An abstract class so it can be the container token itself
 * (providers/devices_provider.ts binds it; tests `swap` it).
 */
export abstract class BypassAlerts {
  abstract raised(events: readonly RaisedBypassEvent[]): Promise<void>
}

/** Until notifications land (S6): events are stored, nobody is told yet. */
export class StoredOnlyBypassAlerts extends BypassAlerts {
  async raised(_events: readonly RaisedBypassEvent[]): Promise<void> {}
}
