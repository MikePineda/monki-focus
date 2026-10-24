// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren } from 'preact'
import './DataTable.css'
import './VisuallyHidden.css'

export interface DataTableColumn<Row> {
  id: string
  /** Already translated header; units go here ("Min"), not in every cell. */
  header: string
  /** `end` for numbers so digits line up. */
  align?: 'start' | 'end'
  cell: (row: Row) => ComponentChildren
}

export interface DataTableProps<Row> {
  /** Already translated table name. */
  caption: string
  /** Hide the caption visually when a heading above already names the table. */
  captionVisible?: boolean
  columns: readonly DataTableColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** `compact`: 32px rows in the popup and menu bar, where rows are not tappable. */
  density?: 'page' | 'compact'
}

/** The table view of every chart, and plain tabular data. */
export function DataTable<Row>({
  caption,
  captionVisible = false,
  columns,
  rows,
  rowKey,
  density = 'page',
}: DataTableProps<Row>) {
  const cellClass = (column: DataTableColumn<Row>) =>
    `mf-data-table__cell mf-data-table__cell--${column.align ?? 'start'}`
  return (
    <table class={`mf-data-table mf-data-table--${density}`}>
      <caption class={captionVisible ? 'mf-data-table__caption' : 'mf-visually-hidden'}>
        {caption}
      </caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} scope="col" class={cellClass(column)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.id} class={cellClass(column)}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
