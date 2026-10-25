// SPDX-License-Identifier: AGPL-3.0-or-later
import { refuse, succeed, type Outcome } from '#domain/outcome'

/**
 * The `details` of a bypass event: small codes and numbers the guardian
 * may see, never personal data. The shape itself keeps URLs, titles and
 * screen text out:
 *
 * - at most 16 members;
 * - keys are identifiers (`targetGroup`, `wait_seconds`);
 * - strings are at most 64 characters of `A-Z a-z 0-9 . _ : -`, so no
 *   space, slash, `@`, `?` or `%` fits: no sentence, path, URL or email;
 * - numbers are finite; booleans as they are; nothing nested.
 */

export const MAX_DETAILS = 16
export const DETAIL_KEY_PATTERN = /^[a-z][A-Za-z0-9_]{0,47}$/
export const DETAIL_STRING_PATTERN = /^[A-Za-z0-9._:-]{0,64}$/

export type DetailValue = string | number | boolean
export type BypassDetails = Readonly<Record<string, DetailValue>>

export type DetailsProblem = 'not_an_object' | 'too_many' | 'bad_key' | 'bad_value'

export function checkBypassDetails(value: unknown): Outcome<BypassDetails, DetailsProblem> {
  if (value === undefined || value === null) return succeed({})
  if (typeof value !== 'object' || Array.isArray(value)) return refuse('not_an_object')
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_DETAILS) return refuse('too_many')

  const details: Record<string, DetailValue> = {}
  for (const [key, child] of entries) {
    if (!DETAIL_KEY_PATTERN.test(key)) return refuse('bad_key')
    if (!isDetailValue(child)) return refuse('bad_value')
    details[key] = child
  }
  return succeed(details)
}

function isDetailValue(value: unknown): value is DetailValue {
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && DETAIL_STRING_PATTERN.test(value)
}
