// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Trusted now: the wall clock, but never earlier than the last server time
 * the device saw plus the monotonic time elapsed since then.
 *
 *   trusted_now = max(wall_now, anchor.server_time + (mono_now - anchor.mono_at) / 1000)
 *
 * The anchor comes from the last authenticated server response (heartbeat
 * `serverTime`, or a token's `iat` on receipt). Monotonic time is the
 * platform's boot-relative clock (`SystemClock.elapsedRealtime`,
 * `mach_continuous_time`, `performance.now()` in a long-lived context) and
 * only means something within one boot, so an anchor from another boot is
 * ignored. Rewinding the wall clock therefore cannot make a token look
 * younger; moving it forward only makes tokens expire sooner (fails closed).
 */
export interface TimeAnchor {
  /** Server time in epoch seconds. */
  readonly serverTime: number
  /** Monotonic clock reading when `serverTime` was received, in milliseconds. */
  readonly monoAtMs: number
  /** Boot counter (Android `Settings.Global.BOOT_COUNT`, macOS boot session uuid hashed to a number). */
  readonly bootCount: number
}

export interface DeviceClock {
  /** Wall clock in epoch seconds (untrusted: the user can set it). */
  readonly wallNow: number
  /** Monotonic clock in milliseconds since boot. */
  readonly monoNowMs: number
  readonly bootCount: number
}

/** Trusted now in whole epoch seconds. */
export function trustedNow(clock: DeviceClock, anchor: TimeAnchor | null): number {
  const wall = Math.floor(clock.wallNow)
  if (anchor?.bootCount !== clock.bootCount || clock.monoNowMs < anchor.monoAtMs) {
    return wall
  }
  const anchored = anchor.serverTime + Math.floor((clock.monoNowMs - anchor.monoAtMs) / 1000)
  return Math.max(wall, anchored)
}
