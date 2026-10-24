// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Injected time source. Domain code never calls `Date.now()` itself: it takes
 * a Clock so tests can freeze time (`fixedClock`) and so the wall clock can be
 * cross-checked against monotonic time (a rewound wall clock must never
 * extend an unlock).
 */
export interface Clock {
  /** Wall-clock time in epoch milliseconds. */
  now(): number
  /** Monotonic milliseconds since an arbitrary origin; never goes backwards. */
  monotonic(): number
}

export const systemClock: Clock = {
  now: () => Date.now(),
  monotonic: () => performance.now(),
}

/** A clock frozen at `iso` (wall) and at 0 (monotonic). */
export function fixedClock(iso: string): Clock {
  const instant = Date.parse(iso)
  if (Number.isNaN(instant)) {
    throw new RangeError(`fixedClock needs an ISO 8601 instant, got "${iso}"`)
  }
  return { now: () => instant, monotonic: () => 0 }
}
