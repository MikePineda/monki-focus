// SPDX-License-Identifier: AGPL-3.0-or-later
import { stdSerializers } from '@adonisjs/core/logger'

/**
 * Fields that never reach a log line (pino `redact`). The repo rule is:
 * never log tokens, pairing or enrolment codes, capabilities, credentials or
 * personal data. Matched at the top level and up to two levels deep, which
 * covers `logger.info({ token })`, `{ device: { token } }` and
 * `{ err: { config: { headers } } }`-style objects; request and response
 * headers are covered by their full paths.
 */
const SENSITIVE_FIELDS = [
  // Credentials and sessions
  'password',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  // Tokens: device access tokens, unlock and policy tokens, ntfy tokens
  'token',
  'accessToken',
  'refreshToken',
  'deviceToken',
  'unlockToken',
  'publishToken',
  // One-time codes and capabilities
  'code',
  'pairingCode',
  'enrollmentCode',
  'capability',
  'capabilityUrl',
  'actionUrl',
  // Signing keys
  'privateKey',
  'signingKey',
  // Personal data
  'email',
  'fullName',
]

const HEADER_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-xsrf-token"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
]

export const LOG_REDACT_PATHS: string[] = [
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
  ...SENSITIVE_FIELDS.map((field) => `*.*.${field}`),
  ...HEADER_PATHS,
]

/** What a redacted value prints as. */
export const LOG_REDACT_CENSOR = '[redacted]'

export const logRedaction = { paths: LOG_REDACT_PATHS, censor: LOG_REDACT_CENSOR }

/**
 * Errors are serialised as usual, except that their `code` (a failure name
 * such as `E_ROUTE_NOT_FOUND`, `ECONNREFUSED` or a Postgres SQLSTATE, which
 * operators need) is written as `errorCode`: a field called `code` is always
 * redacted, because pairing and enrolment codes travel under that name.
 */
export function serializeError(error: unknown): unknown {
  const serialized = stdSerializers.err(error as Error) as unknown
  if (typeof serialized !== 'object' || serialized === null || !('code' in serialized)) {
    return serialized
  }
  const { code, ...rest } = serialized as Record<string, unknown>
  return { ...rest, errorCode: code }
}

export const logSerializers = { err: serializeError }
