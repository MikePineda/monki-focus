// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type Device from '#models/device'
import type { ClientBypassKind } from '#domain/devices/bypass_event_kinds'
import type { BypassDetails } from '#domain/devices/bypass_event_details'
import { clientDedupeKey } from '#domain/devices/bypass_dedupe_key'
import BypassEventRecorder, { type NewBypassEvent } from '#services/devices/bypass_event_recorder'
import { consumeBypassBatch } from '#services/devices/device_throttles'

/** openapi.yaml `BypassEvent`, validated (details already checked to be codes only). */
export interface ReportedBypassEvent {
  readonly dedupeKey: string
  readonly kind: ClientBypassKind
  readonly occurredAt: DateTime
  readonly details: BypassDetails
}

/** At most 100 events per batch (openapi.yaml `BypassEventBatch`). */
export const MAX_BYPASS_BATCH = 100

/**
 * `POST /device/bypass-events`: a device's batch, stored once per
 * `dedupeKey` (namespaced by the device, so re-sending after a timeout is
 * safe and never collides with another device or a server event).
 * `accepted` counts the events stored now, `duplicates` the ones already
 * there (or repeated in the batch).
 */
@inject()
export default class BypassEventReports {
  constructor(protected recorder: BypassEventRecorder) {}

  async report(device: Device, events: readonly ReportedBypassEvent[], now: DateTime) {
    await consumeBypassBatch(device.id)

    const unique = new Map<string, NewBypassEvent>()
    for (const event of events) {
      const dedupeKey = clientDedupeKey(device.uuid, event.dedupeKey)
      if (unique.has(dedupeKey)) continue
      unique.set(dedupeKey, {
        wardUserId: device.userId,
        deviceId: device.id,
        kind: event.kind,
        source: 'client',
        dedupeKey,
        occurredAt: event.occurredAt.toJSDate(),
        details: event.details,
      })
    }

    const stored = await this.recorder.record([...unique.values()], now.toJSDate())
    return { accepted: stored.length, duplicates: events.length - stored.length }
  }
}
