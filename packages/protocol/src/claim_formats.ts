// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Value formats shared by the unlock and policy claims. The JSON Schemas in
 * `schema/` carry the same patterns verbatim (a test keeps them in sync), so
 * a Kotlin or Swift verifier can copy either source.
 *
 * Every pattern is anchored, ASCII-only and free of look-around, so it means
 * the same thing in JavaScript, `java.util.regex` and Swift `Regex`.
 */

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
/**
 * The last label is a letters-only TLD or an IDNA A-label (`xn--…`), never
 * all-numeric, so no IP literal (`127.0.0.1`, `0.1`) is ever a valid host.
 */
const TOP_LABEL = '(?:[a-z]{2,63}|xn--[a-z0-9-]{0,58}[a-z0-9])'
const HOST = `${LABEL}(?:\\.${LABEL})*\\.${TOP_LABEL}`

/** A TCP port from 1 to 65535, without leading zeros, excluding 80 (the http default). */
const LOOPBACK_PORT =
  '(?:[1-9]|[1-79][0-9]|8[1-9]|[1-9][0-9]{2,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])'

/**
 * Release profile of the instance origin: lowercase `https://host`, no port
 * (instances serve on 443, usually behind a reverse proxy), no path, no
 * trailing slash.
 */
export const RELEASE_ISSUER_PATTERN = new RegExp(`^https://${HOST}$`)

/**
 * Any issuer a claim may carry: the release form, or, for local development
 * only, `http://localhost` / `http://127.0.0.1` with an optional non-default
 * port. Verifiers accept the development form only when explicitly told to.
 */
export const ISSUER_PATTERN = new RegExp(
  `^(?:https://${HOST}|http://(?:localhost|127\\.0\\.0\\.1)(?::${LOOPBACK_PORT})?)$`
)
export const ISSUER_MAX_LENGTH = 270

/** Lowercase canonical UUID (device ids, request ids, token ids). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const DEVICE_ID_PATTERN = UUID_PATTERN

/** Opaque user id on the instance. */
export const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/** Rule id from the user's rule set. */
export const RULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

/** Exact hostname with at least two labels; never a wildcard. */
export const SCOPE_DOMAIN_PATTERN = new RegExp(`^${HOST}$`)
export const SCOPE_DOMAIN_MAX_LENGTH = 253

const SEGMENT_CHAR = "[A-Za-z0-9._~!$&'()+,;=:@-]"
const SEGMENT_START = "[A-Za-z0-9_~!$&'()+,;=:@-]"
/** A non-empty path segment that is not `.` or `..` (and has no `%`, `/` or `\\`). */
const SEGMENT = `(?:${SEGMENT_START}${SEGMENT_CHAR}*|\\.${SEGMENT_START}${SEGMENT_CHAR}*|\\.\\.${SEGMENT_CHAR}+)`

/**
 * Exact host plus one or more literal path segments: no query, fragment,
 * wildcard, percent-encoding, backslash, empty segment, `.` or `..`.
 */
export const SCOPE_PATH_PATTERN = new RegExp(`^${HOST}(?:/${SEGMENT})+$`)
export const SCOPE_PATH_MAX_LENGTH = 512

/** Android package name or Apple bundle id. */
export const SCOPE_APP_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/
export const SCOPE_APP_MAX_LENGTH = 255

/** Unpadded base64url SHA-256 digest (32 bytes, 43 characters). */
export const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** IANA time-zone name such as `Etc/UTC` or `America/New_York`. */
export const TIME_ZONE_PATTERN = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/
export const TIME_ZONE_MAX_LENGTH = 64

/** Client nonce of a time request: 16 random bytes, unpadded base64url. */
export const NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/

/**
 * Boot id: Android `BOOT_COUNT` in decimal, the macOS boot session uuid, or
 * the extension service worker's per-instance `crypto.randomUUID()`.
 */
export const BOOT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/

/** Key id: the first 16 characters of base64url(SHA-256(raw public key)). */
export const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/
