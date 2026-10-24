// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Instants (SEMANTICS.md §1). Inputs are RFC 3339 with an explicit offset and
 * whole seconds; every computed instant is written in UTC with `Z` and no
 * fractional seconds, so fixtures compare as strings. The engine works in
 * whole epoch seconds internally.
 */
import type { Instant, UtcInstant } from '@monki-focus/rules'

/** Whole seconds since the Unix epoch of an RFC 3339 instant with an explicit offset. */
export function epochSecondsOf(instant: Instant): number {
  const millis = Date.parse(instant)
  if (Number.isNaN(millis)) throw new RangeError(`Not an RFC 3339 instant: ${instant}`)
  return Math.floor(millis / 1000)
}

/** The canonical UTC form (`2026-10-25T23:00:00Z`) of whole epoch seconds. */
export function utcInstantOf(epochSeconds: number): UtcInstant {
  return `${new Date(epochSeconds * 1000).toISOString().slice(0, 19)}Z`
}
