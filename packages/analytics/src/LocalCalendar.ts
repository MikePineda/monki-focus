// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Local dates in the pinned IANA time zone (SEMANTICS.md §6.3), never the
 * device zone. Built on `Intl.DateTimeFormat`, available in a service worker
 * and in Node alike. Days last 23, 24 or 25 hours around DST changes.
 */

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterOf(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** `YYYY-MM-DD` of an instant (epoch seconds) in `timeZone`. */
export function localDateOf(epochSeconds: number, timeZone: string): string {
  let year = ''
  let month = ''
  let day = ''
  for (const part of formatterOf(timeZone).formatToParts(epochSeconds * 1000)) {
    if (part.type === 'year') year = part.value
    else if (part.type === 'month') month = part.value
    else if (part.type === 'day') day = part.value
  }
  return `${year.padStart(4, '0')}-${month}-${day}`
}

/** No local day lasts longer than this (DST moves by at most 2 hours). */
const LONGEST_DAY_SECONDS = 26 * 3600

/** The first instant (epoch seconds) after `epochSeconds` that falls on a later local date. */
export function nextLocalMidnight(epochSeconds: number, timeZone: string): number {
  const today = localDateOf(epochSeconds, timeZone)
  // Invariant: `low` is on `today`, `high` is on a later date.
  let low = epochSeconds
  let high = epochSeconds + LONGEST_DAY_SECONDS
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (localDateOf(middle, timeZone) > today) high = middle
    else low = middle
  }
  return high
}
