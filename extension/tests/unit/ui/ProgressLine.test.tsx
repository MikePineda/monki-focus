// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { ProgressLine } from '../../../src/ui/ProgressLine'

describe('ProgressLine', () => {
  it('progress_line_is_a_named_progressbar_with_its_values', () => {
    render(<ProgressLine label="Pause progress" value={4} max={10} />)
    const bar = screen.getByRole('progressbar', { name: 'Pause progress' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '10')
    expect(bar).toHaveAttribute('aria-valuenow', '4')
  })

  it('progress_line_fill_grows_with_the_value', () => {
    render(<ProgressLine label="Pause progress" value={4} max={10} />)
    const fill = screen.getByRole('progressbar').querySelector('.mf-progress-line__fill')
    expect(fill).toHaveStyle({ transform: 'scaleX(0.4)' })
  })

  it('progress_line_clamps_values_outside_the_range', () => {
    const { rerender } = render(<ProgressLine label="Pause progress" value={14} max={10} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10')
    rerender(<ProgressLine label="Pause progress" value={-3} max={10} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('progress_line_with_an_empty_range_shows_no_progress', () => {
    render(<ProgressLine label="Pause progress" value={0} max={0} />)
    const fill = screen.getByRole('progressbar').querySelector('.mf-progress-line__fill')
    expect(fill).toHaveStyle({ transform: 'scaleX(0)' })
  })
})
