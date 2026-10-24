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
const HOST = `${LABEL}(?:\\.${LABEL})+`

/**
 * Canonical instance origin: lowercase `https://host[:port]`, no path, no
 * trailing slash. Plain `http` is accepted only for loopback development.
 */
export const ISSUER_PATTERN = new RegExp(
  `^(?:https://${HOST}(?::[0-9]{1,5})?|http://(?:localhost|127\\.0\\.0\\.1)(?::[0-9]{1,5})?)$`
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

/** Exact host plus one or more literal path segments, no query, fragment or wildcard. */
export const SCOPE_PATH_PATTERN = new RegExp(`^${HOST}(?:/[A-Za-z0-9._~%!$&'()+,;=:@-]+)+$`)
export const SCOPE_PATH_MAX_LENGTH = 512

/** Android package name or Apple bundle id. */
export const SCOPE_APP_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/
export const SCOPE_APP_MAX_LENGTH = 255

/** Unpadded base64url SHA-256 digest (32 bytes, 43 characters). */
export const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** IANA time-zone name such as `Etc/UTC` or `America/New_York`. */
export const TIME_ZONE_PATTERN = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/
export const TIME_ZONE_MAX_LENGTH = 64

/** Key id: the first 16 characters of base64url(SHA-256(raw public key)). */
export const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/
