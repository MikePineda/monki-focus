// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import type { FieldContext } from '@vinejs/vine/types'
import {
  BOOT_ID_PATTERN,
  KEY_ID_PATTERN,
  NONCE_PATTERN,
  SHA256_BASE64URL_PATTERN,
} from '@monki-focus/protocol'
import { ENROLLMENT_CODE_PATTERN } from '#domain/devices/enrollment_code'
import { DEVICE_PLATFORMS } from '#domain/devices/device_platform'
import { RISK_STATES, MAX_RISK_STATES } from '#domain/devices/risk_state'
import { CLIENT_BYPASS_KINDS } from '#domain/devices/bypass_event_kinds'
import { CLIENT_DEDUPE_KEY_PATTERN } from '#domain/devices/bypass_dedupe_key'
import { MAX_BYPASS_BATCH } from '#services/devices/bypass_event_reports'
import { deviceName } from '#validators/devices'

/**
 * Bodies of the device API (packages/protocol/openapi.yaml). Failures
 * answer 422 `{ code: 'validation_failed', fields: { <path>: <rule> } }`
 * (app/http/device_api_error_response.ts). Unknown members are dropped, so
 * a newer client's extra fields never break an older server.
 */

/** RFC 3339 in UTC (`Z`), optional fraction: the contract's `Timestamp`. */
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/

const realInstant = vine.createRule((value: unknown, _: undefined, field: FieldContext) => {
  if (typeof value !== 'string' || !DateTime.fromISO(value, { zone: 'utc' }).isValid) {
    field.report('The {{ field }} field must be an RFC 3339 UTC time', 'timestamp', field)
  }
})

function utcTimestamp() {
  return vine
    .string()
    .regex(UTC_TIMESTAMP)
    .use(realInstant())
    .transform((value) => DateTime.fromISO(value, { zone: 'utc' }))
}

/** `<semver>` or a short build string, as in `X-Client-Version` after the platform. */
function clientVersion() {
  return vine.string().regex(/^[0-9A-Za-z.+_-]{1,32}$/)
}

function kids() {
  return vine.array(vine.string().regex(KEY_ID_PATTERN)).minLength(1).maxLength(2)
}

/** POST /device/enroll (`EnrollRequest`). The code is never logged. */
export const enrollValidator = vine.create({
  code: vine.string().regex(ENROLLMENT_CODE_PATTERN),
  name: deviceName(),
  platform: vine.enum(DEVICE_PLATFORMS),
  clientVersion: clientVersion(),
})

/** POST /device/heartbeat (`HeartbeatRequest`). */
export const heartbeatValidator = vine.create({
  clientTime: utcTimestamp(),
  protectionActive: vine.boolean({ strict: true }),
  rulesHash: vine.string().regex(SHA256_BASE64URL_PATTERN),
  policyHash: vine.string().regex(SHA256_BASE64URL_PATTERN),
  clientVersion: clientVersion(),
  nonce: vine.string().regex(NONCE_PATTERN),
  boot: vine.string().regex(BOOT_ID_PATTERN),
  pinnedKids: vine.object({ unlock: kids(), policy: kids() }),
  a11yEnabled: vine.boolean({ strict: true }).optional(),
  riskState: vine.array(vine.enum(RISK_STATES)).maxLength(MAX_RISK_STATES).distinct().optional(),
  goingOffline: vine.boolean({ strict: true }).optional(),
})

/** POST /device/bypass-events (`BypassEventBatch`). */
export const bypassEventsValidator = vine.create({
  events: vine
    .array(
      vine.object({
        dedupeKey: vine.string().regex(CLIENT_DEDUPE_KEY_PATTERN),
        kind: vine.enum(CLIENT_BYPASS_KINDS),
        occurredAt: utcTimestamp(),
        // Checked against the kind's allowlist by the controller (checkBypassDetails).
        details: vine.any().optional(),
      })
    )
    .minLength(1)
    .maxLength(MAX_BYPASS_BATCH),
})
