// SPDX-License-Identifier: AGPL-3.0-or-later
import type BypassEvent from '#models/bypass_event'

/** A bypass event in the user's export: codes only, never the dedupe key. */
export function bypassEventResource(event: BypassEvent, deviceUuid: string | null) {
  return {
    id: event.id,
    kind: event.kind,
    source: event.source,
    deviceUuid,
    details: event.details,
    occurredAt: event.occurredAt.toUTC().toISO(),
    resolvedAt: event.resolvedAt?.toUTC().toISO() ?? null,
    createdAt: event.createdAt.toUTC().toISO(),
  }
}
