// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Clock } from '../../../src/shared/clock'
import { Countdown } from '../../../src/ui/Countdown'
import { renderWithI18n } from '../../support/renderWithI18n'

const START = Date.parse('2026-01-05T09:00:00Z')
// Reads the faked wall clock, so `vi.setSystemTime` moves it.
const clock: Clock = { now: () => Date.now(), monotonic: () => 0 }

const liveRegion = () => document.querySelector('[aria-live]')
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('countdown_shows_bare_seconds_with_a_muted_unit_under_a_minute', () => {
    renderWithI18n(<Countdown endsAt={START + 12_000} clock={clock} />)
    expect(screen.getByText('12')).toHaveClass('mf-countdown__value')
    expect(screen.getByText('s')).toHaveClass('mf-countdown__unit')
  })

  it('countdown_shows_minutes_and_seconds_from_a_minute', () => {
    renderWithI18n(<Countdown endsAt={START + 107_000} clock={clock} />)
    expect(screen.getByText('1:47')).toBeInTheDocument()
    expect(screen.queryByText('s')).not.toBeInTheDocument()
  })

  it('countdown_is_driven_by_the_end_time_not_by_ticks', async () => {
    renderWithI18n(<Countdown endsAt={START + 60_000} clock={clock} />)

    // The page was suspended for 40 s: no ticks ran, the end time still rules.
    vi.setSystemTime(START + 40_000)
    await advance(250)

    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('countdown_live_region_is_polite_and_atomic', () => {
    renderWithI18n(<Countdown endsAt={START + 12_000} clock={clock} />)
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion()).toHaveAttribute('aria-atomic', 'true')
  })

  it('countdown_digits_are_hidden_from_assistive_technology', () => {
    renderWithI18n(<Countdown endsAt={START + 12_000} clock={clock} />)
    expect(screen.getByText('12').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('countdown_announces_only_every_5_seconds', async () => {
    renderWithI18n(<Countdown endsAt={START + 12_000} clock={clock} />)
    expect(liveRegion()).toHaveTextContent('12 seconds left')

    await advance(1_000) // 11
    expect(liveRegion()).toHaveTextContent('12 seconds left')
    await advance(1_000) // 10
    expect(liveRegion()).toHaveTextContent('10 seconds left')
    for (let second = 9; second >= 6; second -= 1) {
      await advance(1_000)
      expect(liveRegion()).toHaveTextContent('10 seconds left')
    }
    await advance(1_000) // 5
    expect(liveRegion()).toHaveTextContent('5 seconds left')
    await advance(5_000) // 0
    expect(liveRegion()).toHaveTextContent('0 seconds left')
  })

  it('countdown_announces_minutes_in_words', () => {
    renderWithI18n(<Countdown endsAt={START + 105_000} clock={clock} />, 'es')
    expect(liveRegion()).toHaveTextContent('Quedan 1 min 45 s')
  })

  it('countdown_reports_done_once_and_never_goes_negative', async () => {
    const onDone = vi.fn()
    renderWithI18n(<Countdown endsAt={START + 2_000} clock={clock} onDone={onDone} />)

    await advance(5_000)

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
