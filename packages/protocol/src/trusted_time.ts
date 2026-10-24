// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Trusted now (spec §6):
 *
 *   trusted_now = max(wall_now, floor, anchor.server_time + (mono_now - anchor.mono_at))
 *
 * - The **anchor** comes only from a verified, nonce-bound time token
 *   (`typ: "time"`) and is valid only within the boot it was taken in. Its
 *   monotonic reference is the reading taken when the request was *sent*, so
 *   network delay can only make trusted time run ahead (fail closed).
 * - The **floor** is persisted and only ever ratchets up: to the anchored time
 *   on every anchor and at least every 60 s of monotonic progress, and to the
 *   `iat` of every verified token. It is never raised from the wall clock, so
 *   a clock set far ahead cannot lock the device out permanently, and it
 *   survives reboots and service-worker restarts, so a wall clock set back
 *   can never take trusted time below it.
 * - Without an anchor from the current boot, trusted time is "wall-only"
 *   (`max(wall, floor)`): good enough to refuse tokens, never good enough to
 *   accept a new receipt or activation, to purge the replay store or to end
 *   entries on time (see `replay_ledger.ts`).
 */
import { fail, ok, type Result } from './token_error.ts'

/**
 * The device clock at one instant. `boot` identifies the monotonic clock's
 * epoch: Android `Settings.Global.BOOT_COUNT` (decimal), the macOS boot
 * session uuid, or, in the extension, a `crypto.randomUUID()` generated once
 * per service-worker instance and kept only in memory.
 */
export interface DeviceClock {
  /** Wall clock in epoch seconds (untrusted: the user can set it). */
  readonly wallNow: number
  /** Monotonic clock in milliseconds since `boot` began. */
  readonly monoNowMs: number
  readonly boot: string
}

export interface TimeAnchor {
  /** Server time from a verified time token, epoch seconds. */
  readonly serverTime: number
  /** Monotonic reading when the request carrying the nonce was sent. */
  readonly monoAtMs: number
  readonly boot: string
}

export interface TrustedTimeState {
  /** Persisted, monotonically non-decreasing lower bound, epoch seconds. */
  readonly floor: number
  readonly anchor: TimeAnchor | null
}

/** Longest accepted gap between sending a time request and verifying its answer. */
export const MAX_TIME_ROUND_TRIP_MS = 60_000

/** Platforms ratchet the floor at least this often while the anchor is current. */
export const FLOOR_RATCHET_INTERVAL_MS = 60_000

export const initialTrustedTime: TrustedTimeState = { floor: 0, anchor: null }

/** True when the anchor was taken in the current boot and the monotonic clock has not gone back. */
export function hasCurrentAnchor(state: TrustedTimeState, clock: DeviceClock): boolean {
  return (
    state.anchor !== null &&
    state.anchor.boot === clock.boot &&
    clock.monoNowMs >= state.anchor.monoAtMs
  )
}

function anchoredNow(state: TrustedTimeState, clock: DeviceClock): number | null {
  if (state.anchor === null || !hasCurrentAnchor(state, clock)) {
    return null
  }
  return state.anchor.serverTime + Math.floor((clock.monoNowMs - state.anchor.monoAtMs) / 1000)
}

/** Trusted now in whole epoch seconds. */
export function trustedNow(state: TrustedTimeState, clock: DeviceClock): number {
  return Math.max(Math.floor(clock.wallNow), state.floor, anchoredNow(state, clock) ?? -Infinity)
}

/**
 * Accepts the server time of a verified time token as the new anchor. The
 * token's nonce and boot were checked by `verifyTimeToken`; this checks that
 * the answer is from this boot and arrived within the round-trip limit.
 */
export function applyTimeAnchor(
  state: TrustedTimeState,
  serverTime: number,
  sentMonoMs: number,
  clock: DeviceClock
): Result<TrustedTimeState> {
  const roundTrip = clock.monoNowMs - sentMonoMs
  if (!Number.isSafeInteger(serverTime) || roundTrip < 0 || roundTrip > MAX_TIME_ROUND_TRIP_MS) {
    return fail('stale_time')
  }
  const anchor = { serverTime, monoAtMs: sentMonoMs, boot: clock.boot }
  return ok(ratchetFloor({ floor: Math.max(state.floor, serverTime), anchor }, clock))
}

/** Raises the floor to the anchored time; call on every anchor and at least every 60 s. */
export function ratchetFloor(state: TrustedTimeState, clock: DeviceClock): TrustedTimeState {
  const anchored = anchoredNow(state, clock)
  return anchored === null || anchored <= state.floor ? state : { ...state, floor: anchored }
}

/** Raises the floor to a signed server instant (a verified token's `iat`). Never anchors. */
export function raiseFloor(state: TrustedTimeState, serverInstant: number): TrustedTimeState {
  return serverInstant > state.floor ? { ...state, floor: serverInstant } : state
}
