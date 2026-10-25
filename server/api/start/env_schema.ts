// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| Environment schema
|--------------------------------------------------------------------------
|
| Every variable the server reads, validated at boot by start/env.ts, so a
| missing or malformed value stops the container before it listens (and
| Swarm rolls back) instead of failing at request time. Rules:
|
| - Secrets use `Env.schema.secret()`: they never print in logs or errors.
| - Booleans are booleans, numbers are numbers, nothing is a list.
| - No value defaults to a real domain, person or credential. Optional
|   values are optional here; the code that reads them owns the default.
| - The documented list is `server/api/.env.example`; keep both in sync
|   (tests/unit/env_example.spec.ts fails when they drift).
|
*/

import { Env } from '@adonisjs/core/env'
import { parseAddressRanges } from '#http/address_ranges'
import { isLoopbackHost, isLoopbackUrl } from '#http/loopback_address'
import { parseEnvSigningKey } from '#domain/keys/env_signing_key'

/** `1.2.3` or `1.2.3-beta.1`: what clients send after `<platform>/`. */
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

/** An HTTP header name (RFC 9110 token), compared lowercase. */
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

/** An optional semantic version (a client minimum, `MIN_CLIENT_VERSION_*`). */
function optionalSemver(name: string, value?: string) {
  if (!value) return undefined
  if (!SEMVER.test(value)) {
    throw new Error(`${name} must be a semantic version such as 1.4.0 (got "${value}")`)
  }
  return value
}

/** An optional header name, lowercased; empty means "no proxy header". */
function optionalHeaderName(name: string, value?: string) {
  if (!value) return undefined
  if (!HEADER_NAME.test(value)) throw new Error(`${name} must be an HTTP header name`)
  return value.toLowerCase()
}

/** Optional comma-separated CIDRs or addresses, kept as the raw string (parsed by its reader). */
function optionalAddressRanges(name: string, value?: string) {
  if (!value?.trim()) return undefined
  try {
    parseAddressRanges(value)
  } catch (error) {
    throw new Error(`${name}: ${(error as Error).message}`)
  }
  return value.trim()
}

/** An optional integer within [min, max]. */
function optionalIntegerIn(min: number, max: number) {
  return (name: string, value?: string) => {
    if (!value) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${name} must be an integer from ${min} to ${max} (got "${value}")`)
    }
    return parsed
  }
}

/** An optional ntfy topic prefix: letters, digits, `_` and `-` only. */
function optionalTopicPrefix(name: string, value?: string) {
  if (!value) return undefined
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(value)) {
    throw new Error(`${name} must be 1-16 letters, digits, "_" or "-"`)
  }
  return value
}

export const envSchema = {
  /*
   * App
   */
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  TZ: Env.schema.string.optional(),
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  LOG_LEVEL: Env.schema.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  APP_NAME: Env.schema.string.optional(),
  APP_VERSION: Env.schema.string.optional(),
  GIT_SHA: Env.schema.string.optional(),
  APP_DEFAULT_LOCALE: Env.schema.enum.optional(['en', 'es'] as const),
  SOURCE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  REGISTRATION_OPEN: Env.schema.boolean.optional(),
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),
  CLIENT_IP_HEADER: optionalHeaderName,
  CLIENT_IP_HEADER_FROM: optionalAddressRanges,
  E2E_MODE: Env.schema.boolean.optional(),

  /*
   * Database
   */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.secret.optional(),
  DB_DATABASE: Env.schema.string(),
  DB_POOL_MAX: optionalIntegerIn(1, 100),

  /*
   * Boot and seed (read by docker/entrypoint.mjs and the seeders). Real
   * names and emails live only in the deploy panel.
   */
  MIGRATE_ON_START: Env.schema.boolean.optional(),
  SCHEDULER: Env.schema.enum.optional(['on', 'off'] as const),
  SEED_USERS: Env.schema.boolean.optional(),
  SEED_ADMIN_EMAIL: Env.schema.string.optional({ format: 'email' }),
  SEED_ADMIN_NAME: Env.schema.string.optional(),
  SEED_ADMIN_PASSWORD: Env.schema.secret.optional(),
  SEED_ADMIN_LOCALE: Env.schema.enum.optional(['en', 'es'] as const),
  SEED_ADMIN_TIME_ZONE: Env.schema.string.optional(),
  SMOKE_EMAIL: Env.schema.string.optional({ format: 'email' }),
  SMOKE_PASSWORD: Env.schema.secret.optional(),
  SMOKE_DEVICE_TOKEN: Env.schema.secret.optional(),

  /*
   * Unlocks and protection. Token lifetime is capped at 4 hours by the
   * token spec (exp - iat <= 4 h).
   */
  UNLOCK_SIGNING_KEY: Env.schema.secret.optional(),
  UNLOCK_SIGNING_KEY_ID: Env.schema.string.optional(),
  UNLOCK_TOKEN_MAX_MINUTES: optionalIntegerIn(1, 240),
  UNLOCK_REQUEST_TTL_MINUTES: optionalIntegerIn(1, 60),
  PAIRING_CODE_TTL_MINUTES: optionalIntegerIn(1, 60),
  DEADMAN_DEFAULT_HOURS: optionalIntegerIn(1, 48),
  WARD_REVOCATION_COOLDOWN_HOURS: optionalIntegerIn(0, 168),
  MIN_CLIENT_VERSION_EXTENSION: optionalSemver,
  MIN_CLIENT_VERSION_ANDROID: optionalSemver,
  MIN_CLIENT_VERSION_MACOS: optionalSemver,

  /*
   * Retention
   */
  HEARTBEAT_RETENTION_DAYS: optionalIntegerIn(1, 3650),
  ACTIVITY_RETENTION_DAYS: optionalIntegerIn(1, 3650),

  /*
   * ntfy (guardian notifications)
   */
  NTFY_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  NTFY_PUBLIC_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  NTFY_PUBLISH_TOKEN: Env.schema.secret.optional(),
  NTFY_TOPIC_PREFIX: optionalTopicPrefix,

  /*
   * LLM (empty LLM_API_KEY = no LLM, the server keeps working)
   */
  LLM_PROVIDER: Env.schema.enum.optional(['anthropic-compatible', 'anthropic', 'fake'] as const),
  LLM_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  LLM_API_KEY: Env.schema.secret.optional(),
  LLM_MODEL: Env.schema.string.optional(),
  LLM_MONTHLY_CAP: optionalIntegerIn(0, 100_000),
  WEEKLY_REPORT_ENABLED: Env.schema.boolean.optional(),

  /*
   * Digest
   */
  DIGEST_ENABLED: Env.schema.boolean.optional(),
  REDDIT_CLIENT_ID: Env.schema.string.optional(),
  REDDIT_CLIENT_SECRET: Env.schema.secret.optional(),
  REDDIT_USER_AGENT: Env.schema.string.optional(),

  /*
   * Observability
   */
  SENTRY_DSN: Env.schema.secret.optional(),
  SENTRY_DSN_WEB: Env.schema.string.optional({ format: 'url', tld: false }),
}

/** Names of every validated variable (the `.env.example` parity test reads it). */
export const ENV_NAMES = Object.keys(envSchema) as Array<keyof typeof envSchema>

/**
 * Rules across variables, checked after the schema. Returns the problems
 * found (empty when the combination is valid); start/env.ts throws on any.
 */
export function crossFieldProblems(values: {
  NODE_ENV: string
  E2E_MODE?: boolean
  HOST: string
  APP_URL: string
  /** Released secret: only checked here, never printed. */
  UNLOCK_SIGNING_KEY?: string
  UNLOCK_SIGNING_KEY_ID?: string
}): string[] {
  const problems: string[] = []
  // Test-support routes (fake clock, scheduler tick) and test-grade settings
  // must never be reachable from another machine, whatever NODE_ENV says.
  const testGrade = values.NODE_ENV === 'test' || values.E2E_MODE === true
  if (testGrade && !(isLoopbackHost(values.HOST) && isLoopbackUrl(values.APP_URL))) {
    problems.push(
      'NODE_ENV=test and E2E_MODE need a loopback HOST and APP_URL (127.0.0.0/8, ::1 or localhost)'
    )
  }
  // The operator's unlock key: both variables or neither, a valid Ed25519
  // PKCS#8 key and its own kid. The problem names the reason, never the key.
  const signingKey = parseEnvSigningKey({
    key: values.UNLOCK_SIGNING_KEY,
    kid: values.UNLOCK_SIGNING_KEY_ID,
  })
  if (!signingKey.ok) {
    problems.push(
      `UNLOCK_SIGNING_KEY and UNLOCK_SIGNING_KEY_ID must be set together: an Ed25519 private key as unpadded base64url PKCS#8 DER and its kid (${signingKey.reason})`
    )
  }
  return problems
}
