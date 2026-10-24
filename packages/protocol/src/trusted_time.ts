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
 * - The **floor** is persisted. It ratchets up to the anchored time at least
 *   every 60 s of monotonic progress and, capped at anchored now + 4 h, to the
 *   `iat` of verified tokens; it is never raised from the wall clock, and it
 *   survives reboots and service-worker restarts, so a wall clock set back
 *   can never take trusted time below it. A verified time token is
 *   authoritative and resets the floor to its server time, even downwards,
 *   so no bad future value can trap the user.
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
  /**
   * Persisted lower bound, epoch seconds. Only rises, except that a verified
   * time token resets it to the server's time.
   */
  readonly floor: number
  readonly anchor: TimeAnchor | null
  /**
   * Persisted: set by a time token with `complete: false`, cleared only by one
   * with `complete: true`. While set, every new receipt needs online
   * revalidation.
   */
  readonly revocationsIncomplete: boolean
}

/** Longest accepted gap between sending a time request and verifying its answer. */
export const MAX_TIME_ROUND_TRIP_MS = 60_000

/** Platforms ratchet the floor at least this often while the anchor is current. */
export const FLOOR_RATCHET_INTERVAL_MS = 60_000

export const initialTrustedTime: TrustedTimeState = {
  floor: 0,
  anchor: null,
  revocationsIncomplete: false,
}

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

/** Size of a floor drop (seconds) above which `applyTimeAnchor` reports `time_floor_lowered`. */
export const FLOOR_LOWERED_NOTICE_SECONDS = 60

/** How far past anchored time a token's `iat` may push the floor. */
export const MAX_IAT_FLOOR_LEAD_SECONDS = 4 * 60 * 60

export interface AnchorApplied {
  readonly state: TrustedTimeState
  /** True when the floor dropped by more than 60 s (`time_floor_lowered`). */
  readonly floorLowered: boolean
}

/**
 * Accepts a verified, nonce-fresh time token. Its server time is
 * **authoritative**: the floor is set to it even when that is lower than the
 * current floor (a bad future value must never trap the user), and a drop of
 * more than 60 s is reported so the platform can record `time_floor_lowered`.
 * `revocationsComplete` is the token's `complete` flag: `false` sets the
 * persistent `revocationsIncomplete` state, `true` clears it. The token's
 * nonce and boot were checked by `verifyTimeToken`; this checks that the
 * answer arrived within the round-trip limit of its request in this boot.
 */
export function applyTimeAnchor(
  state: TrustedTimeState,
  serverTime: number,
  sentMonoMs: number,
  clock: DeviceClock,
  revocationsComplete = true
): Result<AnchorApplied> {
  const roundTrip = clock.monoNowMs - sentMonoMs
  if (!Number.isSafeInteger(serverTime) || roundTrip < 0 || roundTrip > MAX_TIME_ROUND_TRIP_MS) {
    return fail('stale_time')
  }
  const anchor = { serverTime, monoAtMs: sentMonoMs, boot: clock.boot }
  const floorLowered = state.floor - serverTime > FLOOR_LOWERED_NOTICE_SECONDS
  const next = ratchetFloor(
    { floor: serverTime, anchor, revocationsIncomplete: !revocationsComplete },
    clock
  )
  return ok({ state: next, floorLowered })
}

/** Raises the floor to the anchored time; call on every anchor and at least every 60 s. */
export function ratchetFloor(state: TrustedTimeState, clock: DeviceClock): TrustedTimeState {
  const anchored = anchoredNow(state, clock)
  return anchored === null || anchored <= state.floor ? state : { ...state, floor: anchored }
}

/**
 * Raises the floor towards a verified token's `iat` (signed server time).
 * Never anchors, never lowers, does nothing without a current-boot anchor,
 * and never goes past anchored now + 4 h, so a token with a bad future `iat`
 * cannot lock the device out.
 */
export function raiseFloorFromIat(
  state: TrustedTimeState,
  iat: number,
  clock: DeviceClock
): TrustedTimeState {
  const anchored = anchoredNow(state, clock)
  if (anchored === null) {
    return state
  }
  const target = Math.min(iat, anchored + MAX_IAT_FLOOR_LEAD_SECONDS)
  return target > state.floor ? { ...state, floor: target } : state
}
