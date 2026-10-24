// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableColumn } from '../../../src/ui/DataTable'

interface SiteRow {
  site: string
  minutes: number
}

const ROWS: SiteRow[] = [
  { site: 'news.example', minutes: 42 },
  { site: 'video.example', minutes: 7 },
]
const COLUMNS: DataTableColumn<SiteRow>[] = [
  { id: 'site', header: 'Site', cell: (row) => row.site },
  { id: 'minutes', header: 'Min', align: 'end', cell: (row) => row.minutes },
]

describe('DataTable', () => {
  it('data_table_is_named_by_its_caption', () => {
    render(<DataTable caption="Top sites" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.site} />)
    expect(screen.getByRole('table', { name: 'Top sites' })).toBeInTheDocument()
  })

  it('data_table_has_column_headers_with_units_in_the_header', () => {
    render(<DataTable caption="Top sites" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.site} />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['Site', 'Min'])
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col')
  })

  it('rows_keep_the_given_order', () => {
    render(<DataTable caption="Top sites" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.site} />)
    const [, ...bodyRows] = screen.getAllByRole('row')
    expect(bodyRows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'news.example',
      'video.example',
    ])
  })

  it('numeric_columns_align_to_the_end_with_tabular_figures', () => {
    render(<DataTable caption="Top sites" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.site} />)
    expect(screen.getByText('42')).toHaveClass('mf-data-table__cell--end')
    expect(screen.getByRole('columnheader', { name: 'Min' })).toHaveClass(
      'mf-data-table__cell--end'
    )
  })

  it('compact_density_is_a_style_hook', () => {
    render(
      <DataTable
        caption="Top sites"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.site}
        density="compact"
      />
    )
    expect(screen.getByRole('table')).toHaveClass('mf-data-table--compact')
  })
})
