// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Which token must reach which WCAG 2 contrast on which background, ported
 * from the design draft's check-contrast script.
 *
 * - `text` (4.5:1): anything set as words.
 * - `non-text` (3:1): focus ring, boundaries that must be seen, status icons,
 *   single-series marks (WCAG 1.4.11).
 * - `ordinal` (2:1): focus-level steps, which always ship with a legend and a
 *   table view as relief.
 * - `decorative`: reported only.
 */
export type ContrastKind = 'text' | 'non-text' | 'ordinal' | 'decorative'

export interface ContrastRule {
  readonly fg: string
  readonly on: readonly string[]
  readonly kind: ContrastKind
  readonly purpose: string
}

export const MIN_CONTRAST: Readonly<Record<ContrastKind, number | null>> = {
  'text': 4.5,
  'non-text': 3,
  'ordinal': 2,
  'decorative': null,
}

const SURFACES = ['surface-0', 'surface-1', 'surface-2'] as const
const PAGE_SURFACES = ['surface-0', 'surface-1'] as const

export const CONTRAST_RULES: readonly ContrastRule[] = [
  { fg: 'ink-1', on: SURFACES, kind: 'text', purpose: 'primary text' },
  { fg: 'ink-2', on: SURFACES, kind: 'text', purpose: 'secondary text' },
  { fg: 'ink-3', on: SURFACES, kind: 'text', purpose: 'muted text' },
  { fg: 'surface-0', on: ['ink-1'], kind: 'text', purpose: 'ink button label' },
  {
    fg: 'accent',
    on: [...SURFACES, 'accent-soft'],
    kind: 'text',
    purpose: 'link, selected segment',
  },
  { fg: 'accent-hover', on: PAGE_SURFACES, kind: 'text', purpose: 'link hover' },
  { fg: 'accent-ink', on: ['accent', 'accent-hover'], kind: 'text', purpose: 'Close label' },
  { fg: 'status-critical', on: SURFACES, kind: 'text', purpose: 'field error' },
  { fg: 'focus', on: SURFACES, kind: 'non-text', purpose: 'focus ring' },
  { fg: 'line-strong', on: SURFACES, kind: 'non-text', purpose: 'UI boundary' },
  { fg: 'status-good', on: SURFACES, kind: 'non-text', purpose: 'status icon' },
  { fg: 'status-warning', on: SURFACES, kind: 'non-text', purpose: 'status icon' },
  { fg: 'mark-neutral', on: PAGE_SURFACES, kind: 'non-text', purpose: 'single-series mark' },
  ...[0, 1, 2, 3, 4].map((i): ContrastRule => ({
    fg: `level-${i}`,
    on: PAGE_SURFACES,
    kind: 'ordinal',
    purpose: 'ordinal mark (legend + table relief)',
  })),
  { fg: 'baseline', on: PAGE_SURFACES, kind: 'decorative', purpose: 'axis rule' },
  { fg: 'mark-muted', on: PAGE_SURFACES, kind: 'decorative', purpose: 'labelled mark' },
  { fg: 'line', on: PAGE_SURFACES, kind: 'decorative', purpose: 'hairline' },
  { fg: 'gridline', on: ['surface-0'], kind: 'decorative', purpose: 'gridline' },
]
