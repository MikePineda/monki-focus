// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  activate,
  applyRevocations,
  deactivate,
  emptyReplayLedger,
  purge,
  receive,
  revalidate,
  type ReplayLedger,
  type TimeContext,
} from '../src/replay_ledger.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import {
  applyTimeAnchor,
  initialTrustedTime,
  raiseFloor,
  ratchetFloor,
  trustedNow,
  type DeviceClock,
  type TrustedTimeState,
} from '../src/trusted_time.ts'

const at = (text: string) => parseRfc3339Utc(text) ?? Number.NaN
const JTI = '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b'
const WINDOW = {
  jti: JTI,
  iat: at('2026-01-05T09:00:00Z'),
  nbf: at('2026-01-05T09:00:00Z'),
  exp: at('2026-01-05T09:30:00Z'),
  durS: 900,
}
const MINUTE = 60_000

function clock(wall: string, mono: number, boot = '41'): DeviceClock {
  return { wallNow: at(wall), monoNowMs: mono, boot }
}

function anchored(serverTime: string, sentAt: DeviceClock): TrustedTimeState {
  const result = applyTimeAnchor(initialTrustedTime, at(serverTime), sentAt.monoNowMs, sentAt)
  if (!result.ok) throw new Error(result.error.code)
  return result.value
}

function ctx(time: TrustedTimeState, deviceClock: DeviceClock): TimeContext {
  return { time, clock: deviceClock }
}

function must(step: { readonly ledger: ReplayLedger; readonly result: { readonly ok: boolean } }) {
  if (!step.result.ok) throw new Error('unexpected failure')
  return step.ledger
}

describe('trusted time', () => {
  it('test_wall_clock_rewind_does_not_extend_unlock', () => {
    const start = clock('2026-01-05T09:00:00Z', 0)
    const time = anchored('2026-01-05T09:00:00Z', start)
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    ledger = must(activate(ledger, JTI, ctx(time, start)))
    // 20 real minutes later, wall clock set back to 08:30.
    const later = clock('2026-01-05T08:30:00Z', 20 * MINUTE)
    expect(trustedNow(time, later)).toBe(at('2026-01-05T09:20:00Z'))
    expect(activate(ledger, JTI, ctx(time, later)).result).toEqual({
      ok: false,
      error: { code: 'expired' },
    })
  })

  it('test_floor_survives_a_restart_and_is_never_raised_by_the_wall_clock', () => {
    let time = anchored('2026-01-05T09:00:00Z', clock('2026-01-05T09:00:00Z', 0, 'a'))
    time = ratchetFloor(time, clock('2026-01-05T09:00:00Z', 10 * MINUTE, 'a'))
    expect(time.floor).toBe(at('2026-01-05T09:10:00Z'))
    const restarted = clock('2026-01-05T07:00:00Z', 5, 'b')
    expect(trustedNow(time, restarted)).toBe(at('2026-01-05T09:10:00Z'))
    expect(ratchetFloor(time, clock('2026-01-06T07:00:00Z', 6, 'b'))).toBe(time)
  })

  it('test_token_iat_only_raises_the_floor_and_never_anchors', () => {
    const time = raiseFloor(initialTrustedTime, at('2026-01-05T09:00:00Z'))
    expect(time.anchor).toBeNull()
    expect(trustedNow(time, clock('2026-01-05T08:00:00Z', 0))).toBe(at('2026-01-05T09:00:00Z'))
  })

  it('test_late_time_answer_does_not_anchor', () => {
    const sentAt = 0
    const result = applyTimeAnchor(
      initialTrustedTime,
      at('2026-01-05T09:00:00Z'),
      sentAt,
      clock('2026-01-05T09:00:00Z', 60_001)
    )
    expect(result).toEqual({ ok: false, error: { code: 'stale_time' } })
  })
})

describe('replay ledger', () => {
  const start = clock('2026-01-05T09:00:00Z', 0)
  const time = anchored('2026-01-05T09:00:00Z', start)

  it('test_no_first_receipt_without_a_current_boot_anchor', () => {
    expect(receive(emptyReplayLedger, WINDOW, ctx(initialTrustedTime, start)).result).toEqual({
      ok: false,
      error: { code: 'time_anchor_required' },
    })
  })

  it('test_reactivation_returns_the_original_end', () => {
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    const first = activate(ledger, JTI, ctx(time, start))
    ledger = first.ledger
    expect(first.result).toEqual({ ok: true, value: at('2026-01-05T09:15:00Z') })
    const again = activate(ledger, JTI, ctx(time, clock('2026-01-05T09:00:00Z', 5 * MINUTE)))
    expect(again.result).toEqual({ ok: true, value: at('2026-01-05T09:15:00Z') })
  })

  it('test_token_invalid_after_reboot_until_online_revalidation', () => {
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    ledger = must(activate(ledger, JTI, ctx(time, start)))
    const rebooted = clock('2026-01-05T09:02:00Z', 1000, '42')
    expect(activate(ledger, JTI, ctx(time, rebooted)).result).toEqual({
      ok: false,
      error: { code: 'time_anchor_required' },
    })
    const fresh = anchored('2026-01-05T09:02:00Z', rebooted)
    expect(activate(ledger, JTI, ctx(fresh, rebooted)).result).toEqual({
      ok: false,
      error: { code: 'revalidation_required' },
    })
    ledger = must(revalidate(ledger, JTI, ctx(fresh, rebooted)))
    expect(activate(ledger, JTI, ctx(fresh, rebooted)).result).toEqual({
      ok: true,
      value: at('2026-01-05T09:15:00Z'),
    })
  })

  it('test_replayed_jti_after_deactivation_is_rejected', () => {
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    ledger = deactivate(must(activate(ledger, JTI, ctx(time, start))), JTI)
    expect(activate(ledger, JTI, ctx(time, start)).result).toEqual({
      ok: false,
      error: { code: 'replayed' },
    })
    expect(receive(ledger, WINDOW, ctx(time, start)).result).toEqual({
      ok: false,
      error: { code: 'replayed' },
    })
  })

  it('test_revoked_jti_from_heartbeat_is_rejected', () => {
    const ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    const revoked = applyRevocations(ledger, [{ jti: JTI, exp: WINDOW.exp }], true)
    expect(activate(revoked, JTI, ctx(time, start)).result).toEqual({
      ok: false,
      error: { code: 'revoked' },
    })
  })

  it('test_service_worker_restart_and_clock_rewind_do_not_extend_an_active_unlock', () => {
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    ledger = must(activate(ledger, JTI, ctx(time, start)))
    const restarted = clock('2026-01-05T08:10:00Z', 500, 'sw-b')
    expect(activate(ledger, JTI, ctx(time, restarted)).result.ok).toBe(false)
    const fresh = anchored('2026-01-05T10:00:00Z', restarted)
    expect(activate(ledger, JTI, ctx(fresh, restarted)).result.ok).toBe(false)
    const step = revalidate(ledger, JTI, ctx(fresh, restarted))
    expect(step.result).toEqual({ ok: false, error: { code: 'expired' } })
    expect(step.ledger.get(JTI)?.status).toBe('ended')
  })

  it('test_reboot_clock_jump_purge_and_rewind_cannot_replay', () => {
    let ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    ledger = deactivate(must(activate(ledger, JTI, ctx(time, start))), JTI)
    const jumped = clock('2026-01-08T09:00:00Z', 10, '42')
    ledger = purge(ledger, ctx(time, jumped))
    expect(ledger.has(JTI)).toBe(true)
    const rewound = clock('2026-01-05T09:02:00Z', 20, '42')
    const fresh = anchored('2026-01-05T09:02:00Z', rewound)
    expect(receive(ledger, WINDOW, ctx(fresh, rewound)).result).toEqual({
      ok: false,
      error: { code: 'replayed' },
    })
  })

  it('test_purge_and_expiry_never_run_on_wall_only_time', () => {
    const ledger = must(receive(emptyReplayLedger, WINDOW, ctx(time, start)))
    const wallOnly = clock('2027-01-01T00:00:00Z', 5, '42')
    expect(purge(ledger, ctx(time, wallOnly))).toBe(ledger)
    const step = activate(ledger, JTI, ctx(time, wallOnly))
    expect(step.result).toEqual({ ok: false, error: { code: 'time_anchor_required' } })
    expect(step.ledger.get(JTI)?.status).toBe('received')
  })
})
