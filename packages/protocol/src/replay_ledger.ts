// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The local replay store for unlock tokens, keyed by `jti`, as a pure value:
 * every operation returns a new ledger (platforms persist it in Room, GRDB or
 * `storage.local`, next to the trusted-time floor). Spec §7 and §8.
 *
 *   received --activate--> active --end reached / deactivate--> ended
 *        \____________________|____________ revoke ____________> revoked
 *
 * - A first receipt or activation needs a time anchor from the current boot
 *   (`time_anchor_required`).
 * - A receipt is bound to its boot and to a monotonic budget of
 *   `(exp - iat) + 60 s`; an activation stores its instant (trusted and
 *   monotonic) and boot, and ends at `min(activated_at + dur_s, exp + 60 s)`
 *   or when `dur_s` of monotonic time has passed in that boot, whichever is
 *   first. Activating again returns the original end.
 * - After a reboot (or a service-worker restart), after an incomplete
 *   revocation list, or when received while the persisted
 *   `revocationsIncomplete` flag is set, an entry needs online revalidation
 *   (`revalidation_required`) before it can be used again.
 * - `ended` never becomes active again (`replayed`); `revoked` never does
 *   either (`revoked`), even when revoked before it was received.
 * - Entries are ended on time and purged (one day after `exp`) only with a
 *   current-boot anchor; on wall-only time nothing is ended or removed.
 */
import {
  hasCurrentAnchor,
  trustedNow,
  type DeviceClock,
  type TrustedTimeState,
} from './trusted_time.ts'
import { CLOCK_SKEW_SECONDS } from './token_purpose.ts'
import { fail, ok, type Result, type TokenErrorCode } from './token_error.ts'

export type ReplayStatus = 'received' | 'active' | 'ended' | 'revoked'

/** The verified token data the ledger needs, times in epoch seconds. */
export interface UnlockWindow {
  readonly jti: string
  readonly iat: number
  readonly nbf: number
  readonly exp: number
  readonly durS: number
}

/** A monotonic binding: usable only in `boot`, for `budgetMs` after `monoAtMs`. */
export interface MonoBinding {
  readonly boot: string
  readonly monoAtMs: number
  readonly budgetMs: number
}

export interface Activation {
  /** Trusted instant of the first activation, epoch seconds. */
  readonly at: number
  /** Trusted instant the unlock ends, epoch seconds. */
  readonly end: number
  readonly mono: MonoBinding
}

export interface ReplayEntry {
  readonly status: ReplayStatus
  /** The token's `exp`, epoch seconds (purge happens a day after it). */
  readonly exp: number
  /** Absent only for a revocation of a jti this device never received. */
  readonly window?: UnlockWindow
  readonly receipt?: MonoBinding
  readonly activation?: Activation
  /** Set by an incomplete revocation list; cleared by revalidation. */
  readonly stale?: boolean
}

export type ReplayLedger = ReadonlyMap<string, ReplayEntry>

/** Every operation returns the (possibly updated) ledger together with its result. */
export interface LedgerStep<T> {
  readonly ledger: ReplayLedger
  readonly result: Result<T>
}

export interface TimeContext {
  readonly time: TrustedTimeState
  readonly clock: DeviceClock
}

export const PURGE_AFTER_EXP_SECONDS = 24 * 60 * 60

export const emptyReplayLedger: ReplayLedger = new Map()

function withEntry(ledger: ReplayLedger, jti: string, entry: ReplayEntry): ReplayLedger {
  const next = new Map(ledger)
  next.set(jti, entry)
  return next
}

function step<T>(ledger: ReplayLedger, result: Result<T>): LedgerStep<T> {
  return { ledger, result }
}

function refused<T>(ledger: ReplayLedger, code: TokenErrorCode): LedgerStep<T> {
  return step(ledger, fail(code))
}

function isUsableBinding(binding: MonoBinding, clock: DeviceClock): boolean {
  const elapsed = clock.monoNowMs - binding.monoAtMs
  return binding.boot === clock.boot && elapsed >= 0 && elapsed <= binding.budgetMs
}

function endEntry(ledger: ReplayLedger, jti: string, entry: ReplayEntry): LedgerStep<never> {
  return refused(withEntry(ledger, jti, { ...entry, status: 'ended' }), 'expired')
}

export function receive(
  ledger: ReplayLedger,
  window: UnlockWindow,
  context: TimeContext
): LedgerStep<null> {
  const entry = ledger.get(window.jti)
  if (entry?.status === 'revoked') return refused(ledger, 'revoked')
  if (entry?.status === 'ended') return refused(ledger, 'replayed')
  if (entry !== undefined) return step(ledger, ok(null))
  if (!hasCurrentAnchor(context.time, context.clock)) {
    return refused(ledger, 'time_anchor_required')
  }
  const now = trustedNow(context.time, context.clock)
  if (now < window.nbf - CLOCK_SKEW_SECONDS) return refused(ledger, 'not_yet_valid')
  if (now > window.exp + CLOCK_SKEW_SECONDS) return refused(ledger, 'expired')
  const receipt = {
    boot: context.clock.boot,
    monoAtMs: context.clock.monoNowMs,
    budgetMs: (window.exp - window.iat + CLOCK_SKEW_SECONDS) * 1000,
  }
  // While the last time token said the revocation list was incomplete, a new
  // receipt is recorded but needs online revalidation before activation.
  const stale = context.time.revocationsIncomplete
  return step(
    withEntry(ledger, window.jti, { status: 'received', exp: window.exp, window, receipt, stale }),
    ok(null)
  )
}

/** Activates (or re-checks) an unlock; the result is its end, epoch seconds. */
export function activate(
  ledger: ReplayLedger,
  jti: string,
  context: TimeContext
): LedgerStep<number> {
  const entry = ledger.get(jti)
  if (entry === undefined) return refused(ledger, 'invalid_input')
  if (entry.status === 'revoked') return refused(ledger, 'revoked')
  if (entry.status === 'ended') return refused(ledger, 'replayed')
  if (!hasCurrentAnchor(context.time, context.clock)) {
    return refused(ledger, 'time_anchor_required')
  }
  if (entry.stale === true) return refused(ledger, 'revalidation_required')
  const now = trustedNow(context.time, context.clock)
  const { clock } = context

  if (entry.status === 'active' && entry.activation !== undefined) {
    const { activation } = entry
    if (activation.mono.boot !== clock.boot) return refused(ledger, 'revalidation_required')
    if (!isUsableBinding(activation.mono, clock) || now >= activation.end) {
      return endEntry(ledger, jti, entry)
    }
    return step(ledger, ok(activation.end))
  }

  const { window, receipt } = entry
  if (window === undefined || receipt === undefined) return refused(ledger, 'invalid_input')
  if (receipt.boot !== clock.boot) return refused(ledger, 'revalidation_required')
  if (!isUsableBinding(receipt, clock) || now > window.exp + CLOCK_SKEW_SECONDS) {
    return endEntry(ledger, jti, entry)
  }
  if (now < window.nbf - CLOCK_SKEW_SECONDS) return refused(ledger, 'not_yet_valid')
  const end = Math.min(now + window.durS, window.exp + CLOCK_SKEW_SECONDS)
  const activation = {
    at: now,
    end,
    mono: { boot: clock.boot, monoAtMs: clock.monoNowMs, budgetMs: window.durS * 1000 },
  }
  return step(withEntry(ledger, jti, { ...entry, status: 'active', activation }), ok(end))
}

export function deactivate(ledger: ReplayLedger, jti: string): ReplayLedger {
  const entry = ledger.get(jti)
  if (entry === undefined || entry.status === 'ended' || entry.status === 'revoked') {
    return ledger
  }
  return withEntry(ledger, jti, { ...entry, status: 'ended' })
}

/**
 * Re-binds an entry to the current boot after the server confirmed online
 * that the token is still valid and not revoked (the unlock request poll
 * returned it again). The original end of an activation never moves; the new
 * monotonic budget is what is left of it.
 */
export function revalidate(
  ledger: ReplayLedger,
  jti: string,
  context: TimeContext
): LedgerStep<null> {
  const entry = ledger.get(jti)
  if (entry === undefined) return refused(ledger, 'invalid_input')
  if (entry.status === 'revoked') return refused(ledger, 'revoked')
  if (entry.status === 'ended') return refused(ledger, 'replayed')
  if (!hasCurrentAnchor(context.time, context.clock)) {
    return refused(ledger, 'time_anchor_required')
  }
  const now = trustedNow(context.time, context.clock)
  const { boot, monoNowMs } = context.clock
  if (entry.status === 'active' && entry.activation !== undefined) {
    const remaining = entry.activation.end - now
    if (remaining <= 0) return endEntry(ledger, jti, entry)
    const mono = { boot, monoAtMs: monoNowMs, budgetMs: remaining * 1000 }
    const activation = { ...entry.activation, mono }
    return step(withEntry(ledger, jti, { ...entry, activation, stale: false }), ok(null))
  }
  const remaining = entry.exp + CLOCK_SKEW_SECONDS - now
  if (remaining < 0) return endEntry(ledger, jti, entry)
  const receipt = { boot, monoAtMs: monoNowMs, budgetMs: remaining * 1000 }
  return step(withEntry(ledger, jti, { ...entry, receipt, stale: false }), ok(null))
}

/**
 * Applies the revocation list of a verified time token. Listed jtis become
 * `revoked`, even unseen ones. When the list is incomplete, every received
 * or active entry also needs revalidation before further use.
 */
export function applyRevocations(
  ledger: ReplayLedger,
  revoked: readonly { readonly jti: string; readonly exp: number }[],
  complete: boolean
): ReplayLedger {
  const next = new Map(ledger)
  for (const { jti, exp } of revoked) {
    const entry = ledger.get(jti)
    next.set(jti, { ...entry, status: 'revoked', exp: Math.max(exp, entry?.exp ?? exp) })
  }
  if (!complete) {
    for (const [jti, entry] of next) {
      if (entry.status === 'received' || entry.status === 'active') {
        next.set(jti, { ...entry, stale: true })
      }
    }
  }
  return next
}

/** Drops entries one day after `exp`; a no-op without a current-boot anchor. */
export function purge(ledger: ReplayLedger, context: TimeContext): ReplayLedger {
  if (!hasCurrentAnchor(context.time, context.clock)) {
    return ledger
  }
  const now = trustedNow(context.time, context.clock)
  const next = new Map<string, ReplayEntry>()
  for (const [jti, entry] of ledger) {
    if (now <= entry.exp + PURGE_AFTER_EXP_SECONDS) {
      next.set(jti, entry)
    }
  }
  return next
}
