// SPDX-License-Identifier: AGPL-3.0-or-later
import { setTimeout as sleep } from 'node:timers/promises'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import { formatRfc3339Utc } from '@monki-focus/protocol'
import type Device from '#models/device'
import UnlockRequest from '#models/unlock_request'
import {
  cancelRequest,
  effectiveStatus,
  type UnlockRequestStatus,
} from '#domain/unlock/unlock_request_state'
import { isStillUsable } from '#domain/unlock/unlock_token_ledger'
import { UNLOCK_TOKENS_TABLE } from '#services/unlock_token_ledger_store'
import { UNLOCK_TOKEN_SEAL_PURPOSE } from '#services/unlock/unlock_decisions'

/** The longest long-poll (`?wait=`), seconds. */
export const MAX_POLL_WAIT_SECONDS = 25
/** How often a long-poll re-reads the request. */
export const POLL_INTERVAL_MS = 500

export interface PollAnswer {
  readonly uuid: string
  readonly status: UnlockRequestStatus
  readonly grantedMinutes?: number
  readonly token?: string
}

/**
 * The device side of its own unlock requests: every lookup is scoped to
 * the calling device, so another device's or another user's uuid is the
 * same 404 as a missing one.
 */
export default class DeviceUnlockRequests {
  async findOrFail(device: Device, uuid: string): Promise<UnlockRequest> {
    return UnlockRequest.query().where('uuid', uuid).where('device_id', device.id).firstOrFail()
  }

  /**
   * The state, waiting up to `waitSeconds` (cap 25) while it is pending.
   * An approved request carries its unlock token again for as long as the
   * ledger says it is usable and not revoked (the client's online
   * revalidation).
   */
  async poll(
    device: Device,
    uuid: string,
    waitSeconds: number,
    now: () => DateTime,
    signal?: AbortSignal
  ): Promise<PollAnswer> {
    let request = await this.findOrFail(device, uuid)
    const deadline = Date.now() + Math.min(Math.max(waitSeconds, 0), MAX_POLL_WAIT_SECONDS) * 1000
    while (
      effectiveStatus(request.timeline(), now().toJSDate()) === 'pending' &&
      Date.now() + POLL_INTERVAL_MS <= deadline &&
      !signal?.aborted
    ) {
      await sleep(POLL_INTERVAL_MS)
      request = await this.findOrFail(device, uuid)
    }
    return this.answer(request, now())
  }

  /** Withdraws a pending request (and its action capabilities); a closed one is left as is. */
  async cancel(device: Device, uuid: string, now: DateTime): Promise<void> {
    await db.transaction(async (trx) => {
      const request = await UnlockRequest.query({ client: trx })
        .where('uuid', uuid)
        .where('device_id', device.id)
        .forUpdate()
        .firstOrFail()
      if (!cancelRequest(request.timeline(), now.toJSDate()).ok) return
      request.status = 'cancelled'
      request.approveActionHash = null
      request.denyActionHash = null
      request.actionExpiresAt = null
      request.updatedAt = now
      await request.useTransaction(trx).save()
    })
  }

  /** Records the device's "used" telemetry for one of its tokens; false when it is not its own. */
  async markConsumed(device: Device, jti: string, now: DateTime): Promise<boolean> {
    const owned = await db
      .from(UNLOCK_TOKENS_TABLE)
      .where({ jti, device_uuid: device.uuid })
      .first()
    if (!owned) return false
    await db
      .from(UNLOCK_TOKENS_TABLE)
      .where({ jti })
      .whereNull('consumed_at')
      .update({ consumed_at: now.toJSDate() })
    return true
  }

  protected async answer(request: UnlockRequest, now: DateTime): Promise<PollAnswer> {
    const status = effectiveStatus(request.timeline(), now.toJSDate())
    const base = { uuid: request.uuid, status }
    if (status !== 'approved' || request.grantedMinutes === null) return base
    const token = await this.usableToken(request, Math.floor(now.toSeconds()))
    return {
      ...base,
      grantedMinutes: request.grantedMinutes,
      ...(token ? { token } : {}),
    }
  }

  protected async usableToken(request: UnlockRequest, now: number): Promise<string | null> {
    if (!request.tokenSealed) return null
    const entry = await db
      .from(UNLOCK_TOKENS_TABLE)
      .where('request_uuid', request.uuid)
      .orderBy('id', 'desc')
      .first()
    if (!entry || entry.revoked_at !== null) return null
    const expiresAt = Math.floor((entry.expires_at as Date).getTime() / 1000)
    if (!isStillUsable({ expiresAt }, now)) return null
    return encryption.decrypt<string>(request.tokenSealed, UNLOCK_TOKEN_SEAL_PURPOSE)
  }
}

export function serverTime(now: DateTime): string {
  return formatRfc3339Utc(Math.floor(now.toSeconds()))
}
