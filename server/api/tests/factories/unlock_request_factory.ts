// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type Device from '#models/device'
import UnlockRequest from '#models/unlock_request'
import { HASH } from '#tests/support/device_api'

/**
 * A stored unlock request of `device` (pending, synthetic domain scope,
 * no guardian link unless given): for specs that need a ledger row's
 * request to exist without going through the flow.
 */
export async function anUnlockRequest(
  device: Device,
  overrides: Partial<Pick<UnlockRequest, 'uuid' | 'guardianLinkId' | 'status' | 'expiresAt'>> = {}
) {
  const now = DateTime.utc()
  return UnlockRequest.create({
    uuid: randomUUID(),
    wardUserId: device.userId,
    deviceId: device.id,
    guardianLinkId: null,
    ruleId: 'social.video-feed',
    scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
    requestedMinutes: 15,
    grantedMinutes: null,
    reason: null,
    policyHash: HASH,
    status: 'pending',
    approveActionHash: null,
    denyActionHash: null,
    actionExpiresAt: null,
    tokenSealed: null,
    decidedByUserId: null,
    decidedVia: null,
    decidedAt: null,
    expiresAt: now.plus({ minutes: 15 }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}
