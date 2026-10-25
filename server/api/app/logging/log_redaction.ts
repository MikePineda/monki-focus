// SPDX-License-Identifier: AGPL-3.0-or-later
import { stdSerializers } from '@adonisjs/core/logger'

/**
 * What never reaches a log line. The repo rule: never log tokens, pairing
 * or enrolment codes, capabilities, credentials, signing keys or personal
 * data (account seeds, recovery codes and invitation links included).
 * Three layers, all wired by `LOG_PRIVACY` into config/logger.ts:
 *
 * 1. `scrubLogObject` (pino `formatters.log`): walks every logged plain
 *    object and array at any depth and censors keys whose name, compared
 *    case-insensitively and without `_`/`-`, is sensitive. That covers
 *    camelCase, snake_case and header spellings (`Authorization`,
 *    `X-Api-Key`, `set-cookie`) inside any `headers` object.
 * 2. `serializeError` (pino `serializers.err`): drops the fields where
 *    drivers and HTTP clients copy values (`detail`, `bindings`, `sql`,
 *    `config`, `request`, `response`), renames `code` to `errorCode` and
 *    scrubs the rest, causes included.
 * 3. pino `redact` paths: the same names at fixed depths, a second net
 *    applied after serializers.
 */

/** Sensitive key names, normalised: lowercase, without `_` and `-`. */
const SENSITIVE_KEYS = new Set([
  // Credentials and sessions
  'password',
  'passwordconfirmation',
  'currentpassword',
  'newpassword',
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'secret',
  'clientsecret',
  'apikey',
  'xapikey',
  'xxsrftoken',
  'xcsrftoken',
  // Tokens: device access tokens, unlock and policy tokens, ntfy tokens
  'token',
  'accesstoken',
  'refreshtoken',
  'devicetoken',
  'unlocktoken',
  'publishtoken',
  // One-time codes and capabilities
  'code',
  'pairingcode',
  'enrollmentcode',
  'capability',
  'capabilityurl',
  'actionurl',
  // Signing keys
  'privatekey',
  'signingkey',
  // Accounts: second factors, invitation links, password hashes
  'recoverycode',
  'recoverycodes',
  'otpauthurl',
  'otpauthuri',
  'totpsecret',
  'totpseed',
  'totpsecretencrypted',
  'invitation',
  'invitationurl',
  'invitationlink',
  'tokenhash',
  'codehash',
  'passwordhash',
  // Personal data
  'email',
  'fullname',
])

/** Error fields where drivers and HTTP clients copy values, headers or bodies. */
const LEAKY_ERROR_FIELDS = ['detail', 'bindings', 'sql', 'config', 'request', 'response']

/** What a redacted value prints as. */
export const LOG_REDACT_CENSOR = '[redacted]'

/** How deep the scrub walks; deeper values are replaced, not printed. */
const MAX_DEPTH = 10

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * A copy of a logged value with every sensitive key censored, at any depth.
 * Plain objects and arrays are walked; other instances (Error, Date, Buffer)
 * are left to their serializers. Never mutates the caller's objects.
 */
export function scrubLogObject<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (!Array.isArray(value) && !isPlainObject(value)) return value
  if (seen.has(value)) return '[circular]' as T
  if (depth >= MAX_DEPTH) return '[too deep]' as T
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => scrubLogObject(item, depth + 1, seen)) as T
  }
  const copy: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    copy[key] = isSensitiveKey(key) ? LOG_REDACT_CENSOR : scrubLogObject(child, depth + 1, seen)
  }
  return copy as T
}

/** Cleans one serialised error (and its causes) in place of the std output. */
function cleanSerializedError(serialized: unknown): unknown {
  if (serialized instanceof Error) return serializeError(serialized)
  // pino's std serializer answers an object with its own prototype, not a plain one.
  if (typeof serialized !== 'object' || serialized === null) return serialized
  const { code, cause, aggregateErrors, ...rest } = { ...serialized } as Record<string, unknown>
  for (const field of LEAKY_ERROR_FIELDS) delete rest[field]
  const clean: Record<string, unknown> = scrubLogObject(rest)
  if (code !== undefined) clean.errorCode = code
  if (cause !== undefined) clean.cause = cleanSerializedError(cause)
  if (Array.isArray(aggregateErrors)) {
    clean.aggregateErrors = aggregateErrors.map(cleanSerializedError)
  }
  return clean
}

/**
 * Errors are serialised as usual, minus the leaky fields; their `code` (a
 * failure name such as `E_ROUTE_NOT_FOUND`, `ECONNREFUSED` or a Postgres
 * SQLSTATE, which operators need) is written as `errorCode`, because a field
 * called `code` is always redacted (pairing and enrolment codes use it).
 */
export function serializeError(error: unknown): unknown {
  return cleanSerializedError(stdSerializers.err(error as Error))
}

const CAMEL_AND_SNAKE_FIELDS = [
  'password',
  'passwordConfirmation',
  'password_confirmation',
  'currentPassword',
  'current_password',
  'newPassword',
  'new_password',
  'authorization',
  'cookie',
  'secret',
  'clientSecret',
  'client_secret',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'deviceToken',
  'device_token',
  'unlockToken',
  'unlock_token',
  'publishToken',
  'publish_token',
  'code',
  'pairingCode',
  'pairing_code',
  'enrollmentCode',
  'enrollment_code',
  'capability',
  'capabilityUrl',
  'capability_url',
  'actionUrl',
  'action_url',
  'privateKey',
  'private_key',
  'signingKey',
  'signing_key',
  'recoveryCode',
  'recovery_code',
  'recoveryCodes',
  'recovery_codes',
  'otpauthUrl',
  'otpauth_url',
  'totpSecret',
  'totp_secret',
  'totpSecretEncrypted',
  'totp_secret_encrypted',
  'invitation',
  'invitationUrl',
  'invitation_url',
  'tokenHash',
  'token_hash',
  'codeHash',
  'code_hash',
  'email',
  'fullName',
  'full_name',
]

const HEADER_NAMES = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-xsrf-token',
  'x-csrf-token',
]

export const LOG_REDACT_PATHS: string[] = [
  ...CAMEL_AND_SNAKE_FIELDS,
  ...CAMEL_AND_SNAKE_FIELDS.map((field) => `*.${field}`),
  ...CAMEL_AND_SNAKE_FIELDS.map((field) => `*.*.${field}`),
  ...HEADER_NAMES.flatMap((name) => [
    `headers["${name}"]`,
    `*.headers["${name}"]`,
    `*.*.headers["${name}"]`,
  ]),
]

export const logRedaction = { paths: LOG_REDACT_PATHS, censor: LOG_REDACT_CENSOR }

export const logSerializers = { err: serializeError }

/** pino `formatters.log`: the recursive scrub of every logged object. */
export const logFormatters = {
  log: (object: Record<string, unknown>) => scrubLogObject(object),
}

/** Everything config/logger.ts (and the redaction tests) give pino. */
export const LOG_PRIVACY = {
  redact: logRedaction,
  serializers: logSerializers,
  formatters: logFormatters,
}
