// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { StatNumber } from '../../../src/ui/StatNumber'
import { renderWithI18n } from '../../support/renderWithI18n'

describe('StatNumber', () => {
  it('stat_shows_its_label_value_and_context', () => {
    renderWithI18n(<StatNumber label="Pulse today" value={56} context="of 100 · 4 h 12 min" />)
    expect(screen.getByText('Pulse today')).toBeInTheDocument()
    expect(screen.getByText('56')).toHaveClass('mf-stat__value')
    expect(screen.getByText('of 100 · 4 h 12 min')).toBeInTheDocument()
  })

  it('missing_value_is_an_em_dash_never_zero', () => {
    renderWithI18n(<StatNumber label="Pulse today" value={null} />)
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('No data yet')).toHaveClass('mf-visually-hidden')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('stat_formats_the_number_for_the_locale', () => {
    renderWithI18n(<StatNumber label="Minutos" value={12_345} />, 'es')
    expect(screen.getByText('12.345')).toBeInTheDocument()
  })

  it('stat_value_is_read_together_with_its_label', () => {
    const { container } = renderWithI18n(<StatNumber label="Pulse today" value={56} />)
    const group = container.querySelector('[role="group"]')
    expect(group).toHaveAccessibleName('Pulse today')
  })

  it.each(['stat', 'display'] as const)('%s_size_is_a_style_hook', (size) => {
    const { container } = renderWithI18n(<StatNumber label="Pulse" value={1} size={size} />)
    expect(container.querySelector('.mf-stat')).toHaveClass(`mf-stat--${size}`)
  })
})
