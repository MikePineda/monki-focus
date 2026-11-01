// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import { BOOT_ID_PATTERN, NONCE_PATTERN, RULE_ID_PATTERN } from '@monki-focus/protocol'

/**
 * Bodies and queries of the unlock routes. The scope's value formats are
 * checked by app/domain/unlock/unlock_scope.ts after this shape check.
 */

/** POST /device/unlock-requests (`UnlockRequestCreate`). */
export const createUnlockRequestValidator = vine.create({
  ruleId: vine.string().regex(RULE_ID_PATTERN),
  scope: vine.object({
    kind: vine.string().maxLength(16),
    value: vine.string().maxLength(512),
    includeSubdomains: vine.boolean({ strict: true }).optional(),
  }),
  minutes: vine.number({ strict: true }).withoutDecimals().range([1, 120]),
  reason: vine.string().trim().maxLength(280).optional(),
})

/** GET /device/unlock-requests/:uuid query. */
export const pollUnlockRequestValidator = vine.create({
  wait: vine.number().withoutDecimals().range([0, 25]).optional(),
  nonce: vine.string().regex(NONCE_PATTERN).optional(),
  boot: vine.string().regex(BOOT_ID_PATTERN).optional(),
})

/** POST /guardian/unlock-requests/:uuid/approve. */
export const approveUnlockRequestValidator = vine.create({
  minutes: vine.number({ strict: true }).withoutDecimals().range([1, 240]).optional(),
})

/** GET /guardian/unlock-requests and GET /unlock-requests. */
export const listUnlockRequestsValidator = vine.create({
  status: vine.enum(['pending']).optional(),
  page: vine.number().withoutDecimals().range([1, 10_000]).optional(),
})
