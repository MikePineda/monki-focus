// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { markdownTable } from '../src/docs/MarkdownTable.ts'

describe('markdownTable', () => {
  it('escapes_backslashes_before_pipes_so_cells_cannot_break_the_table', () => {
    const table = markdownTable(['a'], [['x\\|y']])
    expect(table.split('\n')[2]).toBe('| x\\\\\\|y |')
  })

  it('escapes_pipes_inside_cells', () => {
    expect(markdownTable(['a'], [['x|y']]).split('\n')[2]).toBe('| x\\|y |')
  })
})
