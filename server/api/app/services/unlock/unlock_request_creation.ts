// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import { randomBytes, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { UnlockScope } from '@monki-focus/protocol'
import type Device from '#models/device'
import GuardianLink from '#models/guardian_link'
import UnlockRequest from '#models/unlock_request'
import { DeviceApiError } from '#exceptions/device_api_error'
import {
  actionTokenExpiresAt,
  actionTokenFromBytes,
  actionTokenHash,
  ACTION_TOKEN_BYTES,
} from '#domain/unlock/action_token'
import { grantedMinutes, minutesCeiling } from '#domain/unlock/unlock_minutes'
import { unlockLifetimeCapSeconds } from '#domain/unlock/unlock_lifetime'
import { consumeUnlockRequest } from '#services/unlock/unlock_throttles'
import UnlockNotifications from '#services/unlock/unlock_notifications'
import OutboxDispatcher from '#services/notify/outbox_dispatcher'

/** `UNLOCK_REQUEST_TTL_MINUTES` when it is empty: as long as the action buttons live. */
export const DEFAULT_UNLOCK_REQUEST_TTL_MINUTES = 15

export interface UnlockRequestInput {
  readonly ruleId: string
  readonly scope: UnlockScope
  readonly minutes: number
  readonly reason?: string
}

/** The longest unlock this instance can sign, in minutes. */
export function instanceMinutesCeiling(): number {
  return minutesCeiling(unlockLifetimeCapSeconds(env.get('UNLOCK_TOKEN_MAX_MINUTES')))
}

/**
 * `POST /device/unlock-requests`: 6 per hour per device; 409
 * `no_active_guardian` without a link that grants guardianship (active or
 * revoking, guardian with two-step verification on), 409 `policy_unknown`
 * before the device's first heartbeat (the token's `pol` needs it).
 *
 * The request goes to one guardian: the ward's oldest link nobody asked
 * to leave, else the oldest revoking one. Two action tokens are drawn,
 * only their SHA-256 stored; the notification is queued in the same
 * transaction and published right after commit (on failure the outbox job
 * retries it).
 */
@inject()
export default class UnlockRequestCreation {
  constructor(
    protected notifications: UnlockNotifications,
    protected dispatcher: OutboxDispatcher
  ) {}

  async create(device: Device, input: UnlockRequestInput, now: DateTime): Promise<UnlockRequest> {
    await consumeUnlockRequest(device.id)
    const link = await this.guardingLink(device.userId, now)
    if (!link) throw new DeviceApiError('no_active_guardian', 409)
    if (device.policyHash === null) throw new DeviceApiError('policy_unknown', 409)

    const minutes = grantedMinutes({
      requested: input.minutes,
      linkMax: link.maxUnlockMinutes,
      ceiling: instanceMinutesCeiling(),
    })
    const approve = actionTokenFromBytes(randomBytes(ACTION_TOKEN_BYTES))
    const deny = actionTokenFromBytes(randomBytes(ACTION_TOKEN_BYTES))
    const ttl = env.get('UNLOCK_REQUEST_TTL_MINUTES') ?? DEFAULT_UNLOCK_REQUEST_TTL_MINUTES

    const { request, outboxId } = await db.transaction(async (trx) => {
      const created = await UnlockRequest.create(
        {
          uuid: randomUUID(),
          wardUserId: device.userId,
          deviceId: device.id,
          guardianLinkId: link.id,
          ruleId: input.ruleId,
          scope: input.scope,
          requestedMinutes: input.minutes,
          grantedMinutes: null,
          reason: input.reason ?? null,
          policyHash: device.policyHash!,
          status: 'pending',
          approveActionHash: actionTokenHash(approve),
          denyActionHash: actionTokenHash(deny),
          actionExpiresAt: DateTime.fromJSDate(actionTokenExpiresAt(now.toJSDate()), {
            zone: 'utc',
          }),
          tokenSealed: null,
          decidedByUserId: null,
          decidedVia: null,
          decidedAt: null,
          expiresAt: now.plus({ minutes: ttl }),
          createdAt: now,
          updatedAt: now,
        },
        { client: trx }
      )
      const id = await this.notifications.queueRequest(
        trx,
        link,
        { uuid: created.uuid, minutes },
        { approve, deny },
        now
      )
      return { request: created, outboxId: id }
    })

    if (outboxId !== null) await this.dispatcher.dispatchRow(outboxId, now)
    return request
  }

  /** The link a new request goes to, or null. */
  protected guardingLink(wardUserId: number, now: DateTime) {
    return GuardianLink.query()
      .where('ward_user_id', wardUserId)
      .where('status', 'active')
      .where((deadline) =>
        deadline
          .whereNull('revocation_effective_at')
          .orWhere('revocation_effective_at', '>', now.toJSDate())
      )
      .whereIn('guardian_user_id', (guardians) =>
        guardians.from('users').select('id').whereNotNull('totp_enabled_at')
      )
      .orderByRaw('revocation_requested_at IS NOT NULL')
      .orderBy('id')
      .first()
  }
}
