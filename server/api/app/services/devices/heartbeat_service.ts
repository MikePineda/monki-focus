// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import { formatRfc3339Utc } from '@monki-focus/protocol'
import type Device from '#models/device'
import { DeviceApiError } from '#exceptions/device_api_error'
import { clockOffsetMs } from '#domain/devices/clock_offset'
import { gapSeconds, wasAnnounced } from '#domain/devices/deadman_rule'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import type { BypassDetails } from '#domain/devices/bypass_event_details'
import {
  checkKeyPins,
  pinnedSetFingerprint,
  type KidsByPurpose,
} from '#domain/devices/key_pin_check'
import type { RiskState } from '#domain/devices/risk_state'
import BypassEventRecorder, {
  BYPASS_EVENTS_TABLE,
  type NewBypassEvent,
} from '#services/devices/bypass_event_recorder'
import DeviceTokens from '#services/devices/device_tokens'
import { consumeHeartbeat } from '#services/devices/device_throttles'
import { publishedKeys } from '#services/devices/published_keys'

export const DEVICE_HEARTBEATS_TABLE = 'device_heartbeats'

interface LockedState {
  last_seen_at: Date
  announced_offline_at: Date | null
  protection_active: boolean
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

/** openapi.yaml `HeartbeatRequest`, validated. */
export interface Heartbeat {
  readonly clientTime: DateTime
  readonly protectionActive: boolean
  readonly rulesHash: string
  readonly policyHash: string
  readonly clientVersion: string
  readonly nonce: string
  readonly boot: string
  readonly pinnedKids: KidsByPurpose
  readonly a11yEnabled?: boolean
  readonly riskState?: readonly RiskState[]
  readonly goingOffline?: boolean
}

/** openapi.yaml `HeartbeatResponse`. */
export interface HeartbeatAnswer {
  readonly serverTime: string
  readonly timeToken: string
  readonly keysEtag: string
  readonly rulesVersion: number
  readonly tokenRotationDue: boolean
}

/**
 * `POST /device/heartbeat`. In this order:
 *
 * 1. the per-device throttle;
 * 2. the signed time token (TokenIssuance), bound to this device, the
 *    request's nonce and boot id, with the device's pending revocations;
 *    nothing is written if it cannot be signed;
 * 3. one transaction, holding the device row (`FOR UPDATE`, the lock the
 *    dead-man switch inserts under): an open dead-man gap is resolved (and a
 *    `heartbeat_resumed` stored with its length), the heartbeat row and the
 *    device's state are written, pinned kids the instance does not publish
 *    raise one `key_pin_mismatch` per distinct pinned set, and turning
 *    protection off raises `protection_disabled` (the dead-man switch stops
 *    watching a device without protection, so the switch itself is told).
 *
 * `serverTime` is informative; only the time token anchors trusted time.
 */
@inject()
export default class HeartbeatService {
  constructor(
    protected events: BypassEventRecorder,
    protected tokens: DeviceTokens
  ) {}

  async record(
    device: Device,
    token: AccessToken,
    heartbeat: Heartbeat,
    now: DateTime
  ): Promise<HeartbeatAnswer> {
    await consumeHeartbeat(device.id)

    const issuance = await app.container.make('tokenIssuance')
    const time = await issuance.issueTime({
      deviceUuid: device.uuid,
      nonce: heartbeat.nonce,
      boot: heartbeat.boot,
    })
    if (!time.ok) {
      if (time.reason === 'invalid_binding' || time.reason === 'invalid_claims') {
        throw new DeviceApiError('validation_failed', 422, { nonce: 'invalid', boot: 'invalid' })
      }
      throw new Error(`time token refused: ${time.reason}`)
    }

    const keys = await publishedKeys()
    const pins = checkKeyPins(heartbeat.pinnedKids, keys.kids)
    const nowDate = now.toJSDate()
    await db.transaction(async (trx) => {
      // The device row first: the dead-man switch inserts under the same
      // lock, so it either sees this heartbeat or its alert is resolved below.
      const locked = (await trx
        .from('devices')
        .where('id', device.id)
        .forUpdate()
        .select('last_seen_at', 'announced_offline_at', 'protection_active')
        .first()) as LockedState
      const previousSeenAt = toSeconds(locked.last_seen_at)
      const wasProtected = locked.protection_active
      const resolved = await trx
        .from(BYPASS_EVENTS_TABLE)
        .where('device_id', device.id)
        .where('kind', 'heartbeat_missing')
        .whereNull('resolved_at')
        .update({ resolved_at: nowDate })
        .returning(['id'])
      const raised: NewBypassEvent[] = (resolved as Array<{ id: number }>).map((gap) => ({
        wardUserId: device.userId,
        deviceId: device.id,
        kind: 'heartbeat_resumed',
        source: 'server',
        dedupeKey: serverDedupeKey('heartbeat_resumed', device.uuid, gap.id),
        occurredAt: nowDate,
        details: {
          gapSeconds: gapSeconds(previousSeenAt, Math.floor(now.toSeconds())),
          announced: wasAnnounced({
            protectionActive: wasProtected,
            revoked: false,
            lastSeenAt: previousSeenAt,
            deadmanHours: device.deadmanHours,
            announcedOfflineAt: locked.announced_offline_at
              ? toSeconds(locked.announced_offline_at)
              : null,
          }),
        },
      }))
      if (wasProtected && !heartbeat.protectionActive) {
        raised.push({
          wardUserId: device.userId,
          deviceId: device.id,
          kind: 'protection_disabled',
          source: 'server',
          dedupeKey: serverDedupeKey(
            'protection_disabled',
            device.uuid,
            Math.floor(now.toSeconds())
          ),
          occurredAt: nowDate,
          details: {},
        })
      }
      if (pins.mismatch) {
        raised.push({
          wardUserId: device.userId,
          deviceId: device.id,
          kind: 'key_pin_mismatch',
          source: 'server',
          dedupeKey: serverDedupeKey(
            'key_pin_mismatch',
            device.uuid,
            pinnedSetFingerprint(heartbeat.pinnedKids)
          ),
          occurredAt: nowDate,
          details: unknownKidDetails(pins.unknown),
        })
      }

      const riskState = [...(heartbeat.riskState ?? [])]
      await trx.table(DEVICE_HEARTBEATS_TABLE).insert({
        device_id: device.id,
        received_at: nowDate,
        client_time: heartbeat.clientTime.toJSDate(),
        protection_active: heartbeat.protectionActive,
        rules_hash: heartbeat.rulesHash,
        policy_hash: heartbeat.policyHash,
        client_version: heartbeat.clientVersion,
        boot: heartbeat.boot,
        a11y_enabled: heartbeat.a11yEnabled ?? null,
        risk_state: JSON.stringify(riskState),
        going_offline: heartbeat.goingOffline === true,
        key_pin_mismatch: pins.mismatch,
      })

      device.useTransaction(trx).merge({
        lastSeenAt: now,
        protectionActive: heartbeat.protectionActive,
        clientVersion: heartbeat.clientVersion,
        rulesHash: heartbeat.rulesHash,
        policyHash: heartbeat.policyHash,
        a11yEnabled: heartbeat.a11yEnabled ?? null,
        riskState,
        pinnedKids: heartbeat.pinnedKids,
        keyPinMismatch: pins.mismatch,
        lastBoot: heartbeat.boot,
        announcedOfflineAt: heartbeat.goingOffline === true ? now : null,
        clockOffsetMs: clockOffsetMs(now.toMillis(), heartbeat.clientTime.toMillis()),
      })
      await device.save()
      await this.events.record(raised, nowDate, trx)
    })

    return {
      serverTime: formatRfc3339Utc(Math.floor(now.toSeconds())),
      timeToken: time.value.token,
      keysEtag: keys.etag,
      // Rule sets arrive with phase 5; until then there is no server-side version.
      rulesVersion: 0,
      tokenRotationDue: this.tokens.rotationDue(token, now),
    }
  }
}

/** `unknownUnlockKids` / `unknownPolicyKids`: kids joined by `:` (a detail value is a code). */
function unknownKidDetails(unknown: KidsByPurpose): BypassDetails {
  const details: Record<string, string> = {}
  if (unknown.unlock.length > 0) details.unknownUnlockKids = unknown.unlock.slice(0, 2).join(':')
  if (unknown.policy.length > 0) details.unknownPolicyKids = unknown.policy.slice(0, 2).join(':')
  return details
}
