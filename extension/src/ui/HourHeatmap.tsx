// SPDX-License-Identifier: AGPL-3.0-or-later
import { Fragment } from 'preact'
import { useId } from 'preact/hooks'
import { formatNumber } from '../i18n/formatNumber'
import { useI18n } from '../i18n/I18nContext'
import { ChartTableToggle, type ChartView } from './ChartTableToggle'
import './DataTable.css'
import './HourHeatmap.css'
import { LevelDot } from './LevelDot'
import { LEVEL_INDICES, levelNameKey, type LevelIndex } from './LevelIndex'
import './PulseColumns.css'
import './VisuallyHidden.css'

export interface HeatmapCell {
  hour: number
  pulse: number | null
  /** The level band the pulse falls in; null paints the empty `surface-2` cell. */
  band: LevelIndex | null
}

export interface HeatmapRow {
  key: string
  /** Already translated weekday ("Mon"). */
  label: string
  cells: readonly HeatmapCell[]
}

export interface HourHeatmapProps {
  title: string
  rows: readonly HeatmapRow[]
  /** Already formatted hour labels, index = hour (shown every 3 h). */
  hourLabels: readonly string[]
  view: ChartView
  onViewChange: (view: ChartView) => void
}

const EM_DASH = '—'

/**
 * Hour × weekday grid of 16px cells, each hour's pulse binned into the five
 * level bands, with a text legend; the table view lists every weekday-hour
 * pulse. Colour never carries a value alone (DESIGN.md "Charts").
 */
export function HourHeatmap({ title, rows, hourLabels, view, onViewChange }: HourHeatmapProps) {
  const { t, locale } = useI18n()
  const titleId = useId()
  const pulseText = (pulse: number | null) =>
    pulse === null ? EM_DASH : formatNumber(pulse, locale)

  return (
    <section class="mf-heatmap" aria-labelledby={titleId}>
      <header class="mf-chart__header">
        <h3 id={titleId} class="mf-chart__title">
          {title}
        </h3>
        <ChartTableToggle title={title} value={view} onChange={onViewChange} />
      </header>
      {view === 'chart' ? (
        <>
          <div class="mf-chart__scroll">
            <div class="mf-heatmap__grid" role="img" aria-label={t('heatmap.summary', { title })}>
              <span aria-hidden="true" />
              {hourLabels.map((label, hour) => (
                <span key={hour} class="mf-heatmap__hour" aria-hidden="true">
                  {hour % 3 === 0 ? label : ''}
                </span>
              ))}
              {rows.map((row) => (
                <Fragment key={row.key}>
                  <span class="mf-heatmap__day" aria-hidden="true">
                    {row.label}
                  </span>
                  {row.cells.map((cell) => (
                    <span
                      key={`${row.key}-${cell.hour}`}
                      class="mf-heatmap__cell"
                      data-band={cell.band ?? 'empty'}
                      aria-hidden="true"
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <ul class="mf-heatmap__legend">
            {LEVEL_INDICES.map((level) => (
              <li key={level} class="mf-heatmap__legend-item">
                <LevelDot level={level} />
                {t('heatmap.band', {
                  level: t(levelNameKey(level)),
                  from: formatNumber(level * 20, locale),
                  to: formatNumber(level === 4 ? 100 : level * 20 + 19, locale),
                })}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div class="mf-chart__scroll">
          <table class="mf-data-table mf-data-table--compact mf-heatmap__table">
            <caption class="mf-visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col" class="mf-data-table__cell mf-data-table__cell--start">
                  {t('heatmap.weekday')}
                </th>
                {hourLabels.map((label, hour) => (
                  <th key={hour} scope="col" class="mf-data-table__cell mf-data-table__cell--end">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" class="mf-data-table__cell mf-data-table__cell--start">
                    {row.label}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.hour} class="mf-data-table__cell mf-data-table__cell--end">
                      {pulseText(cell.pulse)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
