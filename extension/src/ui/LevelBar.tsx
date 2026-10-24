// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId, useState } from 'preact/hooks'
import { formatNumber } from '../i18n/formatNumber'
import { useI18n } from '../i18n/I18nContext'
import { ChartTableToggle, type ChartView } from './ChartTableToggle'
import { DataTable } from './DataTable'
import { LevelDot } from './LevelDot'
import './LevelBar.css'
import { LEVEL_INDICES, levelNameKey, type LevelIndex, type MinutesByLevel } from './LevelIndex'

export interface LevelBarProps {
  /** Already translated chart title ("Today by level"). */
  title: string
  minutes: MinutesByLevel
  /** Time without a category: a final `mark-muted` segment when above 0. */
  uncategorisedMinutes?: number
  /** `compact` (12px bar) in the popup, `page` (24px) on the stats page. */
  size?: 'compact' | 'page'
  /** Controlled view; without it the bar keeps its own (chart first). */
  view?: ChartView
  onViewChange?: (view: ChartView) => void
}

interface LevelEntry {
  level: LevelIndex | 'uncategorised'
  name: string
  minutes: number
}

/**
 * Tracked time as one 100% stacked bar in fixed scale order, always with a
 * text legend (dot + name + minutes) and a table view behind the toggle, so
 * no value is carried by colour alone.
 */
export function LevelBar({
  title,
  minutes,
  uncategorisedMinutes = 0,
  size = 'page',
  view,
  onViewChange,
}: LevelBarProps) {
  const { t, locale } = useI18n()
  const titleId = useId()
  const [ownView, setOwnView] = useState<ChartView>('chart')
  const currentView = view ?? ownView
  const changeView = (next: ChartView) => {
    setOwnView(next)
    onViewChange?.(next)
  }

  const entries: LevelEntry[] = LEVEL_INDICES.map((level) => ({
    level,
    name: t(levelNameKey(level)),
    minutes: minutes[level],
  }))
  if (uncategorisedMinutes > 0) {
    entries.push({
      level: 'uncategorised',
      name: t('level.uncategorised'),
      minutes: uncategorisedMinutes,
    })
  }
  const minutesText = (value: number) =>
    t('levelBar.minutes', { minutes: formatNumber(value, locale) })
  const summary = entries
    .map((entry) =>
      t('levelBar.summaryItem', {
        level: entry.name,
        minutes: formatNumber(entry.minutes, locale),
      })
    )
    .join(', ')

  return (
    <section class={`mf-level-bar mf-level-bar--${size}`} aria-labelledby={titleId}>
      <header class="mf-level-bar__header">
        <h3 id={titleId} class="mf-level-bar__title">
          {title}
        </h3>
        <ChartTableToggle
          title={title}
          value={currentView}
          onChange={changeView}
          compact={size === 'compact'}
        />
      </header>
      {currentView === 'chart' ? (
        <>
          <div class="mf-level-bar__track" role="img" aria-label={summary}>
            {entries
              .filter((entry) => entry.minutes > 0)
              .map((entry) => (
                <span
                  key={entry.level}
                  class="mf-level-bar__segment"
                  data-level={entry.level}
                  style={{ flexGrow: entry.minutes }}
                />
              ))}
          </div>
          <ul class="mf-level-bar__legend">
            {entries.map((entry) => (
              <li key={entry.level} class="mf-level-bar__legend-item">
                <LevelDot level={entry.level} />
                <span class="mf-level-bar__legend-name">{entry.name}</span>
                <span class="mf-level-bar__legend-minutes">{minutesText(entry.minutes)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <DataTable
          caption={title}
          density={size === 'compact' ? 'compact' : 'page'}
          rows={entries}
          rowKey={(entry) => String(entry.level)}
          columns={[
            {
              id: 'level',
              header: t('levelBar.levelHeader'),
              cell: (entry) => (
                <span class="mf-level-bar__table-level">
                  <LevelDot level={entry.level} />
                  {entry.name}
                </span>
              ),
            },
            {
              id: 'minutes',
              header: t('levelBar.minutesHeader'),
              align: 'end',
              cell: (entry) => formatNumber(entry.minutes, locale),
            },
          ]}
        />
      )}
    </section>
  )
}
