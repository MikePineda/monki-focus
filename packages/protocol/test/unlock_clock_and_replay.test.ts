// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  activate,
  applyRevocations,
  deactivate,
  emptyReplayLedger,
  purge,
  recordReceipt,
  type ReplayLedger,
} from '../src/replay_ledger.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import type { Result } from '../src/token_error.ts'
import { trustedNow } from '../src/trusted_time.ts'
import { checkReceipt, receiveUnlock } from '../src/unlock_receipt.ts'

const at = (text: string) => parseRfc3339Utc(text) ?? Number.NaN
// A 30-minute token: iat = nbf = 09:00, exp = 09:30.
const times = {
  iat: at('2026-01-05T09:00:00Z'),
  nbf: at('2026-01-05T09:00:00Z'),
  exp: at('2026-01-05T09:30:00Z'),
}
const JTI = '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b'
const BOOT = 41
const MINUTE_MS = 60_000

function unwrap(result: Result<ReplayLedger>): ReplayLedger {
  if (!result.ok) throw new Error(`unexpected ${result.error.code}`)
  return result.value
}

describe('trustedNow', () => {
  const anchor = { serverTime: times.iat, monoAtMs: 1_000_000, bootCount: BOOT }

  it('test_wall_clock_rewind_does_not_extend_unlock', () => {
    // 45 real minutes later the user has set the wall clock back to 09:10.
    const clock = {
      wallNow: at('2026-01-05T09:10:00Z'),
      monoNowMs: 1_000_000 + 45 * MINUTE_MS,
      bootCount: BOOT,
    }
    const now = trustedNow(clock, anchor)
    expect(now).toBe(at('2026-01-05T09:45:00Z'))
    const receipt = receiveUnlock(JTI, times, { monoNowMs: 1_000_000, bootCount: BOOT })
    expect(checkReceipt(receipt, clock, now)).toEqual({ ok: false, error: { code: 'expired' } })
  })

  it('test_wall_clock_ahead_of_anchor_wins', () => {
    const clock = {
      wallNow: at('2026-01-05T12:00:00Z'),
      monoNowMs: 1_000_000 + MINUTE_MS,
      bootCount: BOOT,
    }
    expect(trustedNow(clock, anchor)).toBe(at('2026-01-05T12:00:00Z'))
  })

  it('test_anchor_from_another_boot_is_ignored', () => {
    const clock = { wallNow: at('2026-01-05T09:10:00Z'), monoNowMs: 5_000, bootCount: BOOT + 1 }
    expect(trustedNow(clock, anchor)).toBe(at('2026-01-05T09:10:00Z'))
  })

  it('test_without_anchor_trusted_now_is_the_wall_clock', () => {
    const clock = { wallNow: at('2026-01-05T09:10:00Z') + 0.9, monoNowMs: 0, bootCount: BOOT }
    expect(trustedNow(clock, null)).toBe(at('2026-01-05T09:10:00Z'))
  })
})

describe('checkReceipt', () => {
  const receivedAtMs = 2_000_000
  const receipt = receiveUnlock(JTI, times, { monoNowMs: receivedAtMs, bootCount: BOOT })

  it('test_receipt_is_valid_inside_the_window', () => {
    const clock = { monoNowMs: receivedAtMs + 10 * MINUTE_MS, bootCount: BOOT }
    expect(checkReceipt(receipt, clock, at('2026-01-05T09:10:00Z')).ok).toBe(true)
  })

  it('test_token_invalid_after_reboot_until_online_revalidation', () => {
    const clock = { monoNowMs: 10_000, bootCount: BOOT + 1 }
    expect(checkReceipt(receipt, clock, at('2026-01-05T09:10:00Z'))).toEqual({
      ok: false,
      error: { code: 'reboot_revalidation_required' },
    })
  })

  it('test_monotonic_budget_is_lifetime_plus_skew', () => {
    const budgetMs = (30 * 60 + 60) * 1000
    const inside = { monoNowMs: receivedAtMs + budgetMs, bootCount: BOOT }
    const outside = { monoNowMs: receivedAtMs + budgetMs + 1, bootCount: BOOT }
    // Wall clock frozen at 09:10 (user tampering): only the monotonic budget catches it.
    expect(checkReceipt(receipt, inside, at('2026-01-05T09:10:00Z')).ok).toBe(true)
    expect(checkReceipt(receipt, outside, at('2026-01-05T09:10:00Z'))).toEqual({
      ok: false,
      error: { code: 'expired' },
    })
  })

  it('test_monotonic_clock_going_backwards_fails_closed', () => {
    const clock = { monoNowMs: receivedAtMs - 1, bootCount: BOOT }
    expect(checkReceipt(receipt, clock, at('2026-01-05T09:10:00Z')).ok).toBe(false)
  })
})

describe('replay ledger', () => {
  const now = at('2026-01-05T09:05:00Z')
  const received = unwrap(recordReceipt(emptyReplayLedger, JTI, times.exp))

  it('test_receipt_and_activation_are_idempotent_within_the_window', () => {
    expect(unwrap(recordReceipt(received, JTI, times.exp))).toBe(received)
    const active = unwrap(activate(received, JTI, now))
    expect(active.get(JTI)?.status).toBe('active')
    expect(unwrap(activate(active, JTI, now))).toBe(active)
  })

  it('test_replayed_jti_after_deactivation_is_rejected', () => {
    const ended = deactivate(unwrap(activate(received, JTI, now)), JTI)
    expect(activate(ended, JTI, now)).toEqual({ ok: false, error: { code: 'replayed' } })
    expect(recordReceipt(ended, JTI, times.exp)).toEqual({ ok: false, error: { code: 'replayed' } })
  })

  it('test_revoked_jti_from_heartbeat_is_rejected', () => {
    const revoked = applyRevocations(received, [{ jti: JTI, exp: times.exp }])
    expect(activate(revoked, JTI, now)).toEqual({ ok: false, error: { code: 'revoked' } })
  })

  it('test_revocation_before_delivery_still_refuses_the_token', () => {
    const revoked = applyRevocations(emptyReplayLedger, [{ jti: JTI, exp: times.exp }])
    expect(recordReceipt(revoked, JTI, times.exp)).toEqual({
      ok: false,
      error: { code: 'revoked' },
    })
  })

  it('test_expired_jti_never_activates', () => {
    expect(activate(received, JTI, times.exp + 61)).toEqual({
      ok: false,
      error: { code: 'expired' },
    })
  })

  it('test_activation_of_an_unseen_jti_is_refused', () => {
    expect(activate(emptyReplayLedger, JTI, now)).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it('test_entries_are_purged_one_day_after_exp', () => {
    const day = 24 * 60 * 60
    expect(purge(received, times.exp + day).has(JTI)).toBe(true)
    expect(purge(received, times.exp + day + 1).has(JTI)).toBe(false)
  })
})
