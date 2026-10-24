// SPDX-License-Identifier: AGPL-3.0-or-later

/** The IANA zone that pins a fresh rule set when nothing better resolves. */
export const FALLBACK_TIME_ZONE = 'UTC'

/** True when `Intl` resolves `zone` (the engine evaluates schedules with it). */
export function isResolvableTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * The device's IANA time zone, read once at install to pin the starter rule
 * set (SEMANTICS.md §6.3). The engine never reads the device zone itself.
 */
export function deviceTimeZone(
  resolve: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  let zone: string | undefined
  try {
    zone = resolve()
  } catch {
    zone = undefined
  }
  return isResolvableTimeZone(zone) ? zone : FALLBACK_TIME_ZONE
}
