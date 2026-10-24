// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'preact/hooks'
import { formatNumber } from '../i18n/formatNumber'
import { useI18n } from '../i18n/I18nContext'
import { ChartTableToggle, type ChartView } from './ChartTableToggle'
import { DataTable } from './DataTable'
import './PulseColumns.css'

export interface PulseColumn {
  key: string
  /** Already formatted day label ("Mon 5"). */
  label: string
  pulse: number | null
  /** Already formatted tracked time ("4 h 12 min"). */
  tracked: string
  highlight?: boolean
}

export interface PulseColumnsProps {
  /** Already translated chart title ("Pulse · 7 days"). */
  title: string
  columns: readonly PulseColumn[]
  view: ChartView
  onViewChange: (view: ChartView) => void
}

const EM_DASH = '—'
const PLOT_HEIGHT = 120
const BAR_WIDTH = 24
const SLOT = 48
const RADIUS = 4

/** A bar with a 4px rounded data end and a square foot on the baseline. */
function barPath(x: number, top: number, baseline: number): string {
  const r = Math.min(RADIUS, (baseline - top) / 2)
  const right = x + BAR_WIDTH
  return `M${x},${baseline}V${top + r}Q${x},${top} ${x + r},${top}H${right - r}Q${right},${top} ${right},${top + r}V${baseline}Z`
}

/**
 * Seven vertical bars of the daily pulse in `mark-neutral` on a 0–100 axis
 * (ticks 0, 50, 100), today's bar labelled with its value, "—" under days
 * without data; the table view shows the same rows (DESIGN.md "Charts").
 */
export function PulseColumns({ title, columns, view, onViewChange }: PulseColumnsProps) {
  const { t, locale } = useI18n()
  const titleId = useId()
  const width = columns.length * SLOT + 32
  const summary = columns
    .map((column) =>
      t('pulseColumns.summaryItem', {
        day: column.label,
        pulse: column.pulse === null ? t('stat.missing') : formatNumber(column.pulse, locale),
      })
    )
    .join(', ')
  const y = (pulse: number) => PLOT_HEIGHT - (pulse / 100) * PLOT_HEIGHT

  return (
    <section class="mf-pulse-columns" aria-labelledby={titleId}>
      <header class="mf-chart__header">
        <h3 id={titleId} class="mf-chart__title">
          {title}
        </h3>
        <ChartTableToggle title={title} value={view} onChange={onViewChange} />
      </header>
      {view === 'chart' ? (
        <svg
          class="mf-pulse-columns__plot"
          role="img"
          aria-label={summary}
          viewBox={`0 0 ${width} ${PLOT_HEIGHT + 40}`}
          width={width}
          height={PLOT_HEIGHT + 40}
        >
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                class={tick === 0 ? 'mf-chart__baseline' : 'mf-chart__gridline'}
                x1={28}
                x2={width}
                y1={y(tick) + 8}
                y2={y(tick) + 8}
              />
              <text class="mf-chart__tick" x={22} y={y(tick) + 12} text-anchor="end">
                {formatNumber(tick, locale)}
              </text>
            </g>
          ))}
          {columns.map((column, index) => {
            const x = 32 + index * SLOT + (SLOT - BAR_WIDTH) / 2
            const top = column.pulse === null ? null : y(Math.max(column.pulse, 1)) + 8
            return (
              <g key={column.key}>
                {top !== null ? (
                  <path class="mf-pulse-columns__bar" d={barPath(x, top, PLOT_HEIGHT + 8)} />
                ) : null}
                {column.highlight && column.pulse !== null && top !== null ? (
                  <text
                    class="mf-chart__value"
                    x={x + BAR_WIDTH / 2}
                    y={top - 4}
                    text-anchor="middle"
                  >
                    {formatNumber(column.pulse, locale)}
                  </text>
                ) : null}
                <text
                  class="mf-chart__tick"
                  x={x + BAR_WIDTH / 2}
                  y={PLOT_HEIGHT + 24}
                  text-anchor="middle"
                >
                  {column.label}
                </text>
                {column.pulse === null ? (
                  <text
                    class="mf-chart__tick"
                    x={x + BAR_WIDTH / 2}
                    y={PLOT_HEIGHT + 38}
                    text-anchor="middle"
                  >
                    {EM_DASH}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      ) : (
        <DataTable<PulseColumn>
          caption={title}
          rows={columns}
          rowKey={(column) => column.key}
          columns={[
            { id: 'day', header: t('pulseColumns.day'), cell: (column) => column.label },
            {
              id: 'pulse',
              header: t('pulseColumns.pulse'),
              align: 'end',
              cell: (column) =>
                column.pulse === null ? EM_DASH : formatNumber(column.pulse, locale),
            },
            {
              id: 'tracked',
              header: t('pulseColumns.tracked'),
              align: 'end',
              cell: (column) => column.tracked,
            },
          ]}
        />
      )}
    </section>
  )
}
