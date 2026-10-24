// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Structural checks used by the claims validators. They mirror JSON Schema
 * keywords one to one (`required` + `additionalProperties: false`,
 * `pattern` + `maxLength`, `const`, integer `minimum`/`maximum`) so the
 * hand-written validators stay equivalent to `schema/*.schema.json`.
 */
import { RFC3339_UTC_PATTERN, parseRfc3339Utc } from './rfc3339_utc.ts'

export type JsonObject = Readonly<Record<string, unknown>>

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `required` (all of `keys`) plus `additionalProperties: false`. */
export function hasExactlyKeys(value: JsonObject, keys: readonly string[]): boolean {
  const own = Object.keys(value)
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

export function isPatternString(value: unknown, pattern: RegExp, maxLength: number): boolean {
  return typeof value === 'string' && value.length <= maxLength && pattern.test(value)
}

export function isIntegerInRange(value: unknown, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

/** A strict RFC 3339 UTC date-time that is also a real calendar instant. */
export function isRfc3339Utc(value: unknown): boolean {
  return (
    typeof value === 'string' && RFC3339_UTC_PATTERN.test(value) && parseRfc3339Utc(value) !== null
  )
}
