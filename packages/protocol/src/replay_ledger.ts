// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The local replay store for unlock tokens, keyed by `jti`, as a pure value:
 * every operation returns a new ledger (platforms persist it in Room, GRDB or
 * `storage.local`).
 *
 *   received --activate--> active --deactivate/expire--> ended
 *       \______________________________________________/
 *                         revoke (heartbeat)             --> revoked
 *
 * - Receiving or activating the same `jti` again inside its window is
 *   idempotent (a retried long-poll or a second tab is not an error).
 * - An `ended` jti never becomes active again (`replayed`); a `revoked` one
 *   never does either (`revoked`), even if it is received again later.
 * - Revocations may name a jti the device has not seen yet; they are stored
 *   so a late delivery is still refused.
 * - Entries are purged one day after `exp`.
 */
import { CLOCK_SKEW_SECONDS } from './token_purpose.ts'
import { fail, ok, type Result } from './token_error.ts'

export type ReplayStatus = 'received' | 'active' | 'ended' | 'revoked'

export interface ReplayEntry {
  readonly status: ReplayStatus
  /** The token's `exp`, in epoch seconds. */
  readonly exp: number
}

export type ReplayLedger = ReadonlyMap<string, ReplayEntry>

export const PURGE_AFTER_EXP_SECONDS = 24 * 60 * 60

export const emptyReplayLedger: ReplayLedger = new Map()

function withEntry(ledger: ReplayLedger, jti: string, entry: ReplayEntry): ReplayLedger {
  const next = new Map(ledger)
  next.set(jti, entry)
  return next
}

function refuse(entry: ReplayEntry): Result<ReplayLedger> {
  return fail(entry.status === 'revoked' ? 'revoked' : 'replayed')
}

export function recordReceipt(
  ledger: ReplayLedger,
  jti: string,
  exp: number
): Result<ReplayLedger> {
  const entry = ledger.get(jti)
  if (entry === undefined) {
    return ok(withEntry(ledger, jti, { status: 'received', exp }))
  }
  return entry.status === 'received' || entry.status === 'active' ? ok(ledger) : refuse(entry)
}

export function activate(
  ledger: ReplayLedger,
  jti: string,
  trustedNow: number
): Result<ReplayLedger> {
  const entry = ledger.get(jti)
  if (entry === undefined) {
    return fail('invalid_input')
  }
  if (entry.status === 'ended' || entry.status === 'revoked') {
    return refuse(entry)
  }
  if (trustedNow > entry.exp + CLOCK_SKEW_SECONDS) {
    return fail('expired')
  }
  return ok(
    entry.status === 'active' ? ledger : withEntry(ledger, jti, { ...entry, status: 'active' })
  )
}

export function deactivate(ledger: ReplayLedger, jti: string): ReplayLedger {
  const entry = ledger.get(jti)
  if (entry === undefined || entry.status === 'ended' || entry.status === 'revoked') {
    return ledger
  }
  return withEntry(ledger, jti, { ...entry, status: 'ended' })
}

export function applyRevocations(
  ledger: ReplayLedger,
  revoked: readonly { readonly jti: string; readonly exp: number }[]
): ReplayLedger {
  const next = new Map(ledger)
  for (const { jti, exp } of revoked) {
    next.set(jti, { status: 'revoked', exp: Math.max(exp, ledger.get(jti)?.exp ?? exp) })
  }
  return next
}

export function purge(ledger: ReplayLedger, trustedNow: number): ReplayLedger {
  const next = new Map<string, ReplayEntry>()
  for (const [jti, entry] of ledger) {
    if (trustedNow <= entry.exp + PURGE_AFTER_EXP_SECONDS) {
      next.set(jti, entry)
    }
  }
  return next
}
