// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Decision } from '@monki-focus/rules/pure'
import { screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GateSessionGuard } from '../../../src/content/GateSessionGuard'
import type { SessionOverlayView } from '../../../src/content/SessionOverlayMount'
import { TimeoutOverlay } from '../../../src/content/TimeoutOverlay'
import type { ActiveSession } from '../../../src/shared/GateContract'
import type { FeedDecision } from '../../../src/shared/messages'
import { ManualClock } from '../../support/ManualClock'
import { renderWithI18n } from '../../support/renderWithI18n'

const URL_ = 'https://www.reddit.com/r/examplesub/'

function decision(overrides: Partial<Decision>): Decision {
  return {
    access: 'allow',
    content: 'show',
    ruleId: null,
    reason: 'no_rule',
    explanationKey: 'decision.no_rule',
    validUntil: '2026-01-06T09:00:00Z',
    ...overrides,
  }
}

function answer(overrides: Partial<Decision>, session?: ActiveSession): FeedDecision {
  return {
    surface: null,
    decision: decision(overrides),
    hide: [],
    restrict: [],
    ...(session ? { session } : {}),
  }
}

function session(overrides: Partial<ActiveSession>): ActiveSession {
  return {
    phase: 'active',
    endsAtMs: Date.parse('2026-01-05T09:05:00Z'),
    minutes: 5,
    intention: 'reply to one message',
    nextPauseSeconds: 10,
    site: 'reddit.com',
    ...overrides,
  }
}

function makeGuard(sendAnswer: unknown = { ok: true, data: { opened: true } }) {
  const clock = new ManualClock('2026-01-05T09:00:00Z')
  const shown: (SessionOverlayView | null)[] = []
  const send = vi.fn(() => Promise.resolve(sendAnswer))
  const reevaluate = vi.fn()
  const guard = new GateSessionGuard({
    clock,
    send,
    overlay: { show: (view) => shown.push(view), clear: () => shown.push(null) },
    reevaluate,
    pillEnabled: () => Promise.resolve(true),
    currentUrl: () => URL_,
  })
  return { guard, clock, shown, send, reevaluate }
}

describe('GateSessionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a_gated_page_asks_once_to_go_to_the_gate', () => {
    const { guard, send } = makeGuard()
    const gated = answer({ access: 'gate', reason: 'intention_required', ruleId: 'rule-a' })

    guard.apply(gated, URL_)
    guard.apply(gated, URL_)

    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith({ v: 1, type: 'gate.open', payload: { url: URL_ } })
  })

  it('an_engine_error_never_sends_the_page_to_the_gate', () => {
    const { guard, send } = makeGuard()

    guard.apply(answer({ access: 'block', reason: 'engine_error' }), URL_)

    expect(send).not.toHaveBeenCalled()
  })

  it('a_running_intention_shows_the_pill_then_the_timeout_overlay_at_its_end', async () => {
    const timedOut = session({ phase: 'timed_out', endsAtMs: null })
    const { guard, clock, shown, send } = makeGuard({ ok: true, data: { session: timedOut } })

    guard.apply(answer({ reason: 'intention_active', ruleId: 'rule-a' }, session({})), URL_)
    await vi.advanceTimersByTimeAsync(0)
    expect(shown.at(-1)).toEqual({ kind: 'pill', endsAt: Date.parse('2026-01-05T09:05:00Z') })

    clock.advanceSeconds(300)
    await vi.advanceTimersByTimeAsync(1000)

    expect(send).toHaveBeenCalledWith({ v: 1, type: 'intention.expired', payload: { url: URL_ } })
    expect(shown.at(-1)).toEqual({ kind: 'timeout', session: timedOut })
  })

  it('a_timed_out_page_shows_the_overlay_instead_of_the_gate', () => {
    const { guard, shown, send } = makeGuard()
    const timedOut = session({ phase: 'timed_out', endsAtMs: null })

    guard.apply(
      answer({ access: 'gate', reason: 'intention_required', ruleId: 'rule-a' }, timedOut),
      URL_
    )

    expect(shown.at(-1)).toEqual({ kind: 'timeout', session: timedOut })
    expect(send).not.toHaveBeenCalled()
  })

  it('an_ending_override_decides_the_page_again', async () => {
    const { guard, clock, reevaluate } = makeGuard()

    guard.apply(
      answer(
        { reason: 'emergency_active', ruleId: 'rule-a' },
        session({ phase: 'override_active' })
      ),
      URL_
    )
    clock.advanceSeconds(300)
    await vi.advanceTimersByTimeAsync(1000)

    expect(reevaluate).toHaveBeenCalledOnce()
  })

  it('leave_and_more_minutes_go_to_the_service_worker_with_the_page_url', async () => {
    const { guard, send } = makeGuard()

    await guard.leave()
    await guard.extend()

    expect(send).toHaveBeenNthCalledWith(1, {
      v: 1,
      type: 'intention.leave',
      payload: { url: URL_ },
    })
    expect(send).toHaveBeenNthCalledWith(2, {
      v: 1,
      type: 'intention.extend',
      payload: { url: URL_ },
    })
  })
})

describe('TimeoutOverlay', () => {
  it('names_the_intention_offers_leave_first_and_states_the_cost_of_more', async () => {
    const onLeave = vi.fn()
    const onExtend = vi.fn()
    renderWithI18n(
      <TimeoutOverlay
        site="reddit.com"
        minutes={10}
        intention="check the opening hours"
        nextPauseSeconds={30}
        onLeave={onLeave}
        onExtend={onExtend}
      />
    )

    expect(
      screen.getByRole('dialog', { name: 'Your 10 min for “check the opening hours” are up.' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Leave reddit.com' })).toHaveFocus()
    expect(screen.getByText('Counts as a broken intention · next pause will be 30 s')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: '5 more min' }))
    expect(onExtend).toHaveBeenCalledOnce()
  })
})

describe('timeout overlay styles', () => {
  it('the_intention_text_is_never_selectable', () => {
    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/content/SessionOverlay.css'),
      'utf8'
    )
    expect(css).toMatch(/\.mf-overlay__card\s*\{\s*user-select:\s*none;/)
  })
})
