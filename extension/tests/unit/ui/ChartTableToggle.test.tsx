// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartTableToggle } from '../../../src/ui/ChartTableToggle'
import { renderWithI18n } from '../../support/renderWithI18n'

describe('ChartTableToggle', () => {
  it('toggle_is_a_two_option_radio_group_named_after_its_chart', () => {
    renderWithI18n(<ChartTableToggle title="Today by level" value="chart" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Show Today by level as' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Chart' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Table' })).not.toBeChecked()
  })

  it('choosing_table_reports_the_table_view', async () => {
    const onChange = vi.fn()
    renderWithI18n(<ChartTableToggle title="Today by level" value="chart" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Table' }))
    expect(onChange).toHaveBeenCalledWith('table')
  })

  it('toggle_labels_are_translated', () => {
    renderWithI18n(
      <ChartTableToggle title="Hoy por nivel" value="table" onChange={vi.fn()} />,
      'es'
    )
    expect(screen.getByRole('radio', { name: 'Tabla' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Gráfico' })).toBeInTheDocument()
  })
})
