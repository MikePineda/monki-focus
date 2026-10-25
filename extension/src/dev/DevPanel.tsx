// SPDX-License-Identifier: AGPL-3.0-or-later
import { intentionWordCount, MIN_INTENTION_WORDS } from '@monki-focus/engine'
import { Globe, Settings, X } from 'lucide-preact'
import { useId, useState } from 'preact/hooks'
import { formatNumber } from '../i18n/formatNumber'
import { I18nProvider, useI18n } from '../i18n/I18nContext'
import type { Locale } from '../i18n/locale'
import type { Clock } from '../shared/clock'
import { Banner } from '../ui/Banner'
import { Button } from '../ui/Button'
import { Countdown } from '../ui/Countdown'
import { DataTable } from '../ui/DataTable'
import { LevelBar } from '../ui/LevelBar'
import { LevelDot } from '../ui/LevelDot'
import { levelNameKey } from '../ui/LevelIndex'
import { ListRow } from '../ui/ListRow'
import { OverlayCard } from '../ui/OverlayCard'
import { ProgressLine } from '../ui/ProgressLine'
import { Segmented } from '../ui/Segmented'
import { StatNumber } from '../ui/StatNumber'
import { TextField } from '../ui/TextField'
import { Toast } from '../ui/Toast'
import { DevSection } from './DevSection'
import {
  SAMPLE_CLOSES_TODAY,
  SAMPLE_COUNTDOWN_SECONDS,
  SAMPLE_DURATIONS,
  SAMPLE_INTENTION_MINUTES,
  SAMPLE_MINUTES_BY_LEVEL,
  SAMPLE_PAUSE_ELAPSED_SECONDS,
  SAMPLE_PAUSE_SECONDS,
  SAMPLE_PULSE,
  SAMPLE_SITE,
  SAMPLE_TOP_SITES,
  SAMPLE_TRACKED,
  SAMPLE_UNCATEGORISED_MINUTES,
  type SampleSite,
} from './sampleData'

export type DevTheme = 'light' | 'dark'

export interface DevPanelProps {
  theme: DevTheme
  locale: Locale
  clock: Clock
}

type Duration = (typeof SAMPLE_DURATIONS)[number]

/** Gallery actions do nothing; the components only need a handler. */
const ignore = (): void => undefined

/** Every component once, pinned to one theme and one language. */
export function DevPanel({ theme, locale, clock }: DevPanelProps) {
  return (
    <I18nProvider locale={locale}>
      <PanelBody theme={theme} clock={clock} />
    </I18nProvider>
  )
}

function PanelBody({ theme, clock }: { theme: DevTheme; clock: Clock }) {
  const { t, locale } = useI18n()
  const titleId = useId()
  const [duration, setDuration] = useState<Duration | null>(null)
  const [intention, setIntention] = useState('')
  const [endsAt, setEndsAt] = useState(() => clock.now() + SAMPLE_COUNTDOWN_SECONDS * 1000)

  const minutes = (value: number) => t('dev.sample.durationMinutes', { minutes: value })

  return (
    <section class="dev-panel" data-theme={theme} lang={locale} aria-labelledby={titleId}>
      <h2 id={titleId} class="dev-panel__title">
        {t('dev.panelTitle', { theme: t(`dev.theme.${theme}`), language: t('dev.language') })}
      </h2>

      <DevSection title={t('dev.section.button')}>
        <Button variant="leave" icon={X}>
          {t('dev.sample.closeTab')}
        </Button>
        <div class="dev-row">
          <Button variant="ink">{t('dev.sample.startFocus')}</Button>
          <Button variant="quiet">{t('dev.sample.endNow')}</Button>
        </div>
        <div>
          <Button
            variant="secondary"
            disabled={duration === null}
            disabledReason={t('dev.sample.chooseFirst')}
          >
            {t('dev.sample.continueTo', { site: SAMPLE_SITE })}
          </Button>
        </div>
      </DevSection>

      <DevSection title={t('dev.section.segmented')}>
        <Segmented<Duration>
          label={t('dev.sample.duration')}
          labelVisible
          value={duration}
          onChange={setDuration}
          options={SAMPLE_DURATIONS.map((value) => ({ value, label: minutes(Number(value)) }))}
        />
      </DevSection>

      <DevSection title={t('dev.section.textField')}>
        <TextField
          label={t('dev.sample.intentionLabel')}
          value={intention}
          onInput={setIntention}
          placeholder={t('dev.sample.intentionPlaceholder')}
          hint={t('dev.sample.intentionHint')}
          invalid={intention.trim() !== '' && intentionWordCount(intention) < MIN_INTENTION_WORDS}
          countWords
        />
        <TextField
          label={t('dev.sample.intentionLabel')}
          value={t('dev.sample.intention')}
          onInput={ignore}
          error={t('dev.sample.saveFailed')}
        />
      </DevSection>

      <DevSection title={t('dev.section.countdown')}>
        <Countdown
          key={endsAt}
          endsAt={endsAt}
          clock={clock}
          onDone={() => setEndsAt(clock.now() + SAMPLE_COUNTDOWN_SECONDS * 1000)}
        />
        <ProgressLine
          label={t('dev.sample.pauseProgress')}
          value={SAMPLE_PAUSE_ELAPSED_SECONDS}
          max={SAMPLE_PAUSE_SECONDS}
        />
        <p class="dev-why">{t('dev.sample.pauseWhy')}</p>
      </DevSection>

      <DevSection title={t('dev.section.statNumber')}>
        <div class="dev-row">
          <StatNumber
            label={t('dev.sample.pulse')}
            value={SAMPLE_PULSE}
            context={t('dev.sample.pulseContext', {
              tracked: t('dev.sample.trackedDuration', SAMPLE_TRACKED),
            })}
          />
          <StatNumber
            label={t('dev.sample.pulse')}
            value={null}
            context={t('dev.sample.pulseMissingContext')}
          />
        </div>
        <StatNumber label={t('dev.sample.pulse')} value={SAMPLE_PULSE} size="display" />
      </DevSection>

      <DevSection title={t('dev.section.levelBar')}>
        <LevelBar
          title={t('dev.sample.todayByLevel')}
          minutes={SAMPLE_MINUTES_BY_LEVEL}
          uncategorisedMinutes={SAMPLE_UNCATEGORISED_MINUTES}
        />
        <LevelBar
          title={t('dev.sample.todayByLevel')}
          minutes={SAMPLE_MINUTES_BY_LEVEL}
          size="compact"
        />
      </DevSection>

      <DevSection title={t('dev.section.dataTable')}>
        <DataTable<SampleSite>
          caption={t('dev.sample.topSites')}
          captionVisible
          rows={SAMPLE_TOP_SITES}
          rowKey={(site) => site.host}
          columns={[
            { id: 'site', header: t('dev.sample.siteHeader'), cell: (site) => site.host },
            {
              id: 'level',
              header: t('levelBar.levelHeader'),
              cell: (site) => (
                <span class="dev-level">
                  <LevelDot level={site.level} />
                  {t(levelNameKey(site.level))}
                </span>
              ),
            },
            {
              id: 'minutes',
              header: t('levelBar.minutesHeader'),
              align: 'end',
              cell: (site) => formatNumber(site.minutes, locale),
            },
          ]}
        />
      </DevSection>

      <DevSection title={t('dev.section.banner')}>
        <Banner message={t('dev.sample.guardianNotice')} />
        <Banner
          tone="warning"
          message={t('dev.sample.privateWarning')}
          action={{ label: t('dev.sample.allow'), onClick: ignore }}
        />
      </DevSection>

      <DevSection title={t('dev.section.toast')}>
        <Toast
          message={t('dev.sample.closedToast', { count: SAMPLE_CLOSES_TODAY })}
          onDismiss={ignore}
          durationMs={null}
          floating={false}
        />
      </DevSection>

      <DevSection title={t('dev.section.overlayCard')}>
        <OverlayCard
          preview
          context={t('dev.sample.timeoutContext', {
            site: SAMPLE_SITE,
            minutes: SAMPLE_INTENTION_MINUTES,
          })}
          title={t('dev.sample.timeoutTitle', {
            minutes: SAMPLE_INTENTION_MINUTES,
            intention: t('dev.sample.intention'),
          })}
          note={t('dev.sample.timeoutNote')}
        >
          <Button variant="leave" icon={X}>
            {t('dev.sample.leave', { site: SAMPLE_SITE })}
          </Button>
          <Button variant="secondary">{t('dev.sample.moreMinutes')}</Button>
        </OverlayCard>
      </DevSection>

      <DevSection title={t('dev.section.listRow')}>
        <ul class="dev-list">
          {SAMPLE_TOP_SITES.map((site) => (
            <ListRow
              key={site.host}
              primary={site.host}
              secondary={t('dev.sample.visits', { count: site.visits })}
              trailing={minutes(site.minutes)}
              leading={{ level: site.level }}
            />
          ))}
          <ListRow primary={t('dev.sample.statistics')} leading={{ icon: Globe }} href="#" />
          <ListRow
            primary={t('dev.sample.settings')}
            leading={{ icon: Settings }}
            onClick={ignore}
          />
        </ul>
      </DevSection>
    </section>
  )
}
