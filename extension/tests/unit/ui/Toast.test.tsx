// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../../../src/ui/Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toast_is_a_status_region_with_its_message', () => {
    render(<Toast message="Closed. That's 4 closes today." onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent("Closed. That's 4 closes today.")
  })

  it('toast_region_stays_mounted_while_empty_so_the_next_message_is_announced', () => {
    const { rerender } = render(<Toast message={null} onDismiss={vi.fn()} />)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()

    rerender(<Toast message="Closed." onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Closed.')
  })

  it('toast_dismisses_itself_after_5_seconds', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Closed." onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(4_999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('parent_rerenders_do_not_restart_the_dismiss_timer', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<Toast message="Closed." onDismiss={() => onDismiss()} />)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    rerender(<Toast message="Closed." onDismiss={() => onDismiss()} />)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('persistent_toast_never_dismisses_itself', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Closed." onDismiss={onDismiss} durationMs={null} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('toast_icon_is_decorative', () => {
    render(<Toast message="Closed." onDismiss={vi.fn()} />)
    expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
