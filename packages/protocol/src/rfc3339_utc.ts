// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `iat`, `nbf` and `exp` are PASETO registered claims, which the spec defines
 * as ISO 8601 date-times. monki-focus restricts them to one strict RFC 3339
 * shape, `YYYY-MM-DDTHH:MM:SSZ` (UTC, whole seconds, no offset, no
 * fraction), so every platform parses them the same way with a regex and
 * integer arithmetic instead of a lenient date parser. The pattern bounds
 * every field (year >= 1970, no leap second); the only rule left for code is
 * that the day exists in its month (no 2026-02-30).
 */
export const RFC3339_UTC_PATTERN =
  /^(?:19[7-9][0-9]|[2-9][0-9]{3})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/

/** Seconds since the Unix epoch, or `null` if `text` is not a real UTC instant in that shape. */
export function parseRfc3339Utc(text: string): number | null {
  if (!RFC3339_UTC_PATTERN.test(text)) {
    return null
  }
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(5, 7))
  const day = Number(text.slice(8, 10))
  const hour = Number(text.slice(11, 13))
  const minute = Number(text.slice(14, 16))
  const second = Number(text.slice(17, 19))
  const millis = Date.UTC(year, month - 1, day, hour, minute, second)
  // Rejects 2026-02-30 and friends, which Date.UTC silently rolls over.
  if (formatRfc3339Utc(millis / 1000) !== text) {
    return null
  }
  return millis / 1000
}

export function formatRfc3339Utc(epochSeconds: number): string {
  return `${new Date(epochSeconds * 1000).toISOString().slice(0, 19)}Z`
}
