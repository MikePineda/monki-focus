// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen, within } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LevelBar } from '../../../src/ui/LevelBar'
import type { MinutesByLevel } from '../../../src/ui/LevelIndex'
import { renderWithI18n } from '../../support/renderWithI18n'

const MINUTES: MinutesByLevel = [42, 18, 0, 25, 61]
const LEVEL_NAMES = ['Distracting', 'Personal', 'Neutral', 'Other work', 'Focus']

describe('LevelBar', () => {
  it('level_bar_has_a_text_legend_with_every_level_and_its_minutes', () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} />)
    const legend = screen.getByRole('list')
    const items = within(legend).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Distracting42 min',
      'Personal18 min',
      'Neutral0 min',
      'Other work25 min',
      'Focus61 min',
    ])
  })

  it('level_bar_image_label_lists_every_level_and_its_minutes', () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Distracting: 42 min, Personal: 18 min, Neutral: 0 min, Other work: 25 min, Focus: 61 min'
    )
  })

  it('level_bar_segments_follow_the_fixed_scale_order_and_skip_empty_levels', () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} />)
    const segments = [...screen.getByRole('img').querySelectorAll('.mf-level-bar__segment')]
    expect(segments.map((segment) => segment.getAttribute('data-level'))).toEqual([
      '0',
      '1',
      '3',
      '4',
    ])
    expect(segments[0]).toHaveStyle({ flexGrow: '42' })
  })

  it('uncategorised_time_is_a_final_muted_segment_with_its_own_legend_entry', () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} uncategorisedMinutes={9} />)
    const segments = [...screen.getByRole('img').querySelectorAll('.mf-level-bar__segment')]
    expect(segments.at(-1)).toHaveAttribute('data-level', 'uncategorised')
    expect(within(screen.getByRole('list')).getAllByRole('listitem').at(-1)).toHaveTextContent(
      'Uncategorised9 min'
    )
  })

  it('level_bar_offers_a_table_alternative_with_the_same_data_and_order', async () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Table' }))

    const table = screen.getByRole('table', { name: 'Today by level' })
    const [, ...rows] = within(table).getAllByRole('row')
    expect(rows.map((row) => row.textContent)).toEqual(
      LEVEL_NAMES.map((name, level) => `${name}${MINUTES[level]}`)
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('level_bar_is_a_titled_region_with_its_toggle', () => {
    renderWithI18n(<LevelBar title="Today by level" minutes={MINUTES} />)
    expect(screen.getByRole('heading', { name: 'Today by level' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Chart' })).toBeChecked()
  })

  it('level_bar_speaks_spanish', () => {
    renderWithI18n(<LevelBar title="Hoy por nivel" minutes={MINUTES} />, 'es')
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Distracción: 42 min, Personal: 18 min, Neutral: 0 min, Otro trabajo: 25 min, Enfoque: 61 min'
    )
  })
})
