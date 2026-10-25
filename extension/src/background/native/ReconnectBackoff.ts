// SPDX-License-Identifier: AGPL-3.0-or-later

export const MIN_RECONNECT_MS = 1_000
export const MAX_RECONNECT_MS = 60_000

/**
 * Delays between reconnect attempts to the native host: exponential from
 * 1 s, capped at 60 s, with "equal jitter" (half fixed, half random) so many
 * profiles restarting together do not retry in lockstep, and never below
 * 1 s. A connection that got its `hello.ack` resets it.
 */
export class ReconnectBackoff {
  private attempt = 0

  /** `random` returns [0, 1) (`Math.random` in production). */
  constructor(private readonly random: () => number = Math.random) {}

  /** The delay before the next attempt; each call backs off further. */
  next(): number {
    const ceiling = Math.min(MAX_RECONNECT_MS, MIN_RECONNECT_MS * 2 ** this.attempt)
    this.attempt = Math.min(this.attempt + 1, 16)
    const half = ceiling / 2
    return Math.round(Math.max(MIN_RECONNECT_MS, half + this.random() * half))
  }

  reset(): void {
    this.attempt = 0
  }
}
