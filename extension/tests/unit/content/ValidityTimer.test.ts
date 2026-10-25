// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_REVALIDATION_DELAY_MS,
  MIN_REVALIDATION_DELAY_MS,
  ValidityTimer,
} from '../../../src/content/ValidityTimer'
import { ManualClock } from '../../support/ManualClock'

function makeTimer(clock = new ManualClock('2026-01-05T09:00:00Z')) {
  const reevaluate = vi.fn()
  return { timer: new ValidityTimer({ clock, reevaluate }), reevaluate, clock }
}

describe('ValidityTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('the_page_asks_again_exactly_when_its_decision_runs_out', () => {
    const { timer, reevaluate } = makeTimer()

    timer.schedule('2026-01-05T09:05:00Z')

    vi.advanceTimersByTime(5 * 60_000 - 1)
    expect(reevaluate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reevaluate).toHaveBeenCalledOnce()
  })

  it('a_distant_validity_is_capped_so_a_changed_clock_is_noticed', () => {
    const { timer, reevaluate } = makeTimer()

    timer.schedule('2026-01-06T09:00:00Z')

    vi.advanceTimersByTime(MAX_REVALIDATION_DELAY_MS)
    expect(reevaluate).toHaveBeenCalledOnce()
  })

  it('a_validity_already_past_waits_the_minimum_instead_of_looping', () => {
    const { timer, reevaluate } = makeTimer()

    timer.schedule('2026-01-05T08:59:00Z')

    vi.advanceTimersByTime(MIN_REVALIDATION_DELAY_MS - 1)
    expect(reevaluate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reevaluate).toHaveBeenCalledOnce()
  })

  it('without_a_validity_the_page_retries_after_the_cap', () => {
    const { timer, reevaluate } = makeTimer()

    timer.schedule(null)
    timer.schedule('not an instant')

    vi.advanceTimersByTime(MAX_REVALIDATION_DELAY_MS)
    expect(reevaluate).toHaveBeenCalledOnce()
  })

  it('a_new_answer_replaces_the_pending_timer_and_stop_cancels_it', () => {
    const { timer, reevaluate } = makeTimer()

    timer.schedule('2026-01-05T09:01:00Z')
    timer.schedule('2026-01-05T09:10:00Z')
    vi.advanceTimersByTime(60_000)
    expect(reevaluate).not.toHaveBeenCalled()

    timer.stop()
    vi.advanceTimersByTime(MAX_REVALIDATION_DELAY_MS)
    expect(reevaluate).not.toHaveBeenCalled()
  })
})
