// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Instants are RFC 3339 strings at the edges and whole epoch seconds inside.
 * Every computed instant is written in UTC with `Z` and no fractional
 * seconds (SEMANTICS.md §1).
 */

/** Whole epoch seconds of an RFC 3339 instant with an explicit offset. */
export function epochSecondsOf(instant: string): number {
  const milliseconds = Date.parse(instant)
  if (Number.isNaN(milliseconds)) throw new RangeError(`Not an RFC 3339 instant: ${instant}`)
  return Math.floor(milliseconds / 1000)
}

/** `YYYY-MM-DDTHH:MM:SSZ` for whole epoch seconds. */
export function utcInstantOf(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}
