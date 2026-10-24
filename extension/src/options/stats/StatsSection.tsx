// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleCheck, CircleX, Timer, X } from 'lucide-preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { formatDuration } from '../../i18n/formatDuration'
import { formatNumber } from '../../i18n/formatNumber'
import { formatClockTime, formatLocalDate } from '../../i18n/formatTime'
import { useI18n } from '../../i18n/I18nContext'
import type { DownloadFile } from '../../pages/FileDownload'
import { useChartView } from '../../pages/useChartView'
import type { CommandClient } from '../../shared/CommandClient'
import type {
  IntentionLogAnswer,
  IntentionLogEntry,
  IntentionOutcome,
} from '../../shared/IntentionContract'
import type { WeekStats } from '../../shared/StatsContract'
import { Banner } from '../../ui/Banner'
import { DataTable } from '../../ui/DataTable'
import { HourHeatmap } from '../../ui/HourHeatmap'
import { Icon, type LucideIcon } from '../../ui/Icon'
import { PulseColumns } from '../../ui/PulseColumns'
import { WEEKDAYS } from '../../ui/WeekdayPicker'
import { DataControls } from './DataControls'
import { weekViewModel } from './WeekViewModel'

export interface StatsSectionProps {
  client: CommandClient
  download: DownloadFile
}

const OUTCOME_ICONS: Record<IntentionOutcome, LucideIcon> = {
  on_time: CircleCheck,
  extended: Timer,
  broken: CircleX,
  closed: X,
}

function hourLabel(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    hour: locale === 'es' ? '2-digit' : 'numeric',
    ...(locale === 'es' ? { hourCycle: 'h23' as const } : {}),
  }).format(Date.UTC(2026, 0, 5, hour))
}

/** Stats (plan §8.3): the 7-day pulse, the hour × weekday heatmap, intentions, export and delete. */
export function StatsSection({ client, download }: StatsSectionProps) {
  const { t, locale } = useI18n()
  const [week, setWeek] = useState<WeekStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [log, setLog] = useState<IntentionLogAnswer | null>(null)
  const [pulseView, setPulseView] = useChartView(client, 'weekPulse')
  const [heatmapView, setHeatmapView] = useChartView(client, 'weekHeatmap')

  const load = useCallback(() => {
    client
      .send('stats.week', {})
      .then((answer) => {
        setWeek(answer)
        setFailed(false)
      })
      .catch(() => setFailed(true))
    client
      .send('intention.log', {})
      .then(setLog)
      .catch(() => setLog(null))
  }, [client])

  useEffect(load, [load])

  if (failed) return <Banner tone="error" message={t('stats.failed')} />
  if (week === null) return <p class="options__muted">{t('options.loading')}</p>

  const model = weekViewModel(week)
  const hours = Array.from({ length: 24 }, (_value, hour) => hourLabel(hour, locale))

  return (
    <div class="options__section-body">
      {model.empty ? <p class="options__muted">{t('stats.empty')}</p> : null}
      <div class="options__block">
        <PulseColumns
          title={t('stats.pulse.title')}
          view={pulseView}
          onViewChange={setPulseView}
          columns={model.days.map((day) => ({
            key: day.date,
            label: formatLocalDate(day.date, locale),
            pulse: day.pulse,
            tracked: formatDuration(day.trackedSeconds, t, locale),
            highlight: day.isToday,
          }))}
        />
      </div>
      <div class="options__block">
        <HourHeatmap
          title={t('stats.heatmap.title')}
          view={heatmapView}
          onViewChange={setHeatmapView}
          hourLabels={hours}
          rows={model.heatmap.map((row) => ({
            key: String(row.weekday),
            label: t(`weekday.${WEEKDAYS[row.weekday] ?? 'mon'}.short`),
            cells: row.cells,
          }))}
        />
        <p class="options__caption">
          {t('stats.heatmap.caption', { weeks: formatNumber(week.weeks, locale) })}
        </p>
      </div>
      {log?.available ? (
        <section class="options__block" aria-labelledby="options-intentions">
          <h3 id="options-intentions" class="options__subheading">
            {t('stats.intentions.title')}
          </h3>
          {log.entries.length === 0 ? (
            <p class="options__muted">{t('stats.intentions.empty')}</p>
          ) : (
            <DataTable<IntentionLogEntry>
              caption={t('stats.intentions.title')}
              rows={log.entries}
              rowKey={(entry) => `${entry.at}-${entry.outcome}`}
              columns={[
                {
                  id: 'time',
                  header: t('stats.intentions.time'),
                  cell: (entry) => formatClockTime(entry.at, locale),
                },
                {
                  id: 'site',
                  header: t('stats.intentions.site'),
                  cell: (entry) => entry.site ?? '',
                },
                {
                  id: 'text',
                  header: t('stats.intentions.text'),
                  cell: (entry) => entry.text ?? '',
                },
                {
                  id: 'minutes',
                  header: t('stats.intentions.minutes'),
                  align: 'end',
                  cell: (entry) =>
                    entry.minutes === null ? '' : formatNumber(entry.minutes, locale),
                },
                {
                  id: 'outcome',
                  header: t('stats.intentions.outcome'),
                  cell: (entry) => (
                    <span class="options__outcome">
                      <Icon icon={OUTCOME_ICONS[entry.outcome]} />
                      {t(`stats.intentions.outcome.${entry.outcome}`)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </section>
      ) : null}
      <DataControls client={client} download={download} onDeleted={load} />
    </div>
  )
}
