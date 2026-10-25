// SPDX-License-Identifier: AGPL-3.0-or-later

/** An IANA name shape: `UTC`, `Etc/GMT+5`, `America/Argentina/Buenos_Aires`. Never an offset. */
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/

/** Longest IANA name stored (`users.time_zone` is varchar(64)). */
export const TIME_ZONE_MAX_LENGTH = 64

/**
 * Whether `name` is an IANA time zone the runtime knows. Raw offsets
 * (`+05:00`) and abbreviations the runtime rejects are refused: days and
 * weeks must follow the zone's daylight-saving rules, which an offset lacks.
 */
export function isIanaTimeZone(name: string): boolean {
  if (name.length === 0 || name.length > TIME_ZONE_MAX_LENGTH || !IANA_NAME.test(name)) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}
