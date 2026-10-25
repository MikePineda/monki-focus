// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Device from '#models/device'
import { ownedBy } from '#services/tenancy/owned_by'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import BypassEventRecorder from '#services/devices/bypass_event_recorder'
import DeviceTokens from '#services/devices/device_tokens'

export interface DeviceChanges {
  readonly name?: string
  readonly deadmanHours?: number
}

/**
 * The dashboard's view of a user's devices, always through the owner
 * (app/services/tenancy/owned_by.ts): another user's uuid, like a revoked
 * device's, is a 404. Revoking is final: the tokens are deleted in the same
 * transaction that stamps `revoked_at` and stores a `device_revoked` event
 * for the guardian.
 */
@inject()
export default class DeviceRegistry {
  constructor(
    protected tokens: DeviceTokens,
    protected events: BypassEventRecorder
  ) {}

  /** Active devices first (newest first), then revoked ones. */
  list(user: User) {
    return ownedBy(Device, user)
      .orderByRaw('revoked_at IS NOT NULL')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
  }

  async update(user: User, uuid: string, changes: DeviceChanges): Promise<Device> {
    const device = await this.findActive(user, uuid)
    if (changes.name !== undefined) device.name = changes.name
    if (changes.deadmanHours !== undefined) device.deadmanHours = changes.deadmanHours
    await device.save()
    return device
  }

  async revoke(user: User, uuid: string, now: DateTime): Promise<void> {
    await db.transaction(async (trx) => {
      const device = await ownedBy(Device, user)
        .useTransaction(trx)
        .where('uuid', uuid)
        .whereNull('revoked_at')
        .forUpdate()
        .firstOrFail()
      device.revokedAt = now
      await device.useTransaction(trx).save()
      await this.tokens.revokeAll(device, trx)
      await this.events.record(
        [
          {
            wardUserId: device.userId,
            deviceId: device.id,
            kind: 'device_revoked',
            source: 'server',
            dedupeKey: serverDedupeKey('device_revoked', device.uuid),
            occurredAt: now.toJSDate(),
            details: { platform: device.platform },
          },
        ],
        now.toJSDate(),
        trx
      )
    })
  }

  protected findActive(user: User, uuid: string) {
    return ownedBy(Device, user).where('uuid', uuid).whereNull('revoked_at').firstOrFail()
  }
}
