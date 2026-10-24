// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SyncBlock } from '@monki-focus/analytics'

/** Column names are data identifiers (like JSON keys), not UI copy. */
export const BLOCKS_CSV_COLUMNS = [
  'block_start',
  'activity_key',
  'category',
  'level',
  'source',
  'seconds',
] as const

/**
 * RFC 4180 field: quoted when it holds a comma, a quote or a line break.
 * A field a spreadsheet would read as a formula gets a leading `'`.
 */
function field(value: string | number | null): string {
  let text = value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The 5-minute blocks as CSV (CRLF line ends), oldest first. */
export function blocksCsv(blocks: readonly SyncBlock[]): string {
  const rows = [...blocks]
    .sort((a, b) => (a.blockStart < b.blockStart ? -1 : a.blockStart > b.blockStart ? 1 : 0))
    .map((block) =>
      [
        block.blockStart,
        block.activityKey,
        block.categoryPath,
        block.level,
        block.source,
        block.seconds,
      ]
        .map(field)
        .join(',')
    )
  return [BLOCKS_CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}
