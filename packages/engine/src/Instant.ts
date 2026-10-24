// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Instants (SEMANTICS.md §1). Inputs MUST be RFC 3339 with an explicit offset
 * or `Z` and whole seconds (the schema pattern); a floating local time or any
 * other text is invalid input and throws, which `decide` turns into a
 * fail-closed decision (§14). Parsing is strict on purpose: `Date.parse`
 * accepts offset-less text as device-local time. Every computed instant is
 * written in UTC with `Z` and no fractional seconds, so fixtures compare as
 * strings. The engine works in whole epoch seconds internally.
 */
import type { Instant, UtcInstant } from '@monki-focus/rules'

const RFC_3339_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):(\d{2}))$/

function invalid(): never {
  throw new RangeError('Not an RFC 3339 instant with an explicit offset')
}

/** Whole seconds since the Unix epoch of an RFC 3339 instant with an explicit offset. */
export function epochSecondsOf(instant: Instant): number {
  const match = typeof instant === 'string' ? RFC_3339_INSTANT.exec(instant) : null
  if (match === null) return invalid()
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const offsetSign = match[7] === '-' ? -1 : 1
  const offsetHours = Number(match[8] ?? '0')
  const offsetMinutes = Number(match[9] ?? '0')
  if (hour > 23 || minute > 59 || second > 59 || offsetHours > 23 || offsetMinutes > 59) {
    return invalid()
  }
  const millis = Date.UTC(year, month - 1, day, hour, minute, second)
  const date = new Date(millis)
  // Rejects month 13, 31 April and the like, which Date.UTC would roll over.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return invalid()
  return millis / 1000 - offsetSign * (offsetHours * 3600 + offsetMinutes * 60)
}

/** The canonical UTC form (`2026-10-25T23:00:00Z`) of whole epoch seconds. */
export function utcInstantOf(epochSeconds: number): UtcInstant {
  return `${new Date(epochSeconds * 1000).toISOString().slice(0, 19)}Z`
}
