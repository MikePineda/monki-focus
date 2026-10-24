// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChartColumn, Settings } from 'lucide-preact'
import { formatDuration } from '../i18n/formatDuration'
import { formatNumber } from '../i18n/formatNumber'
import { useI18n } from '../i18n/I18nContext'
import type { Clock } from '../shared/clock'
import { Banner } from '../ui/Banner'
import { Button } from '../ui/Button'
import type { ChartView } from '../ui/ChartTableToggle'
import { DataTable } from '../ui/DataTable'
import { LevelBar } from '../ui/LevelBar'
import { LevelDot } from '../ui/LevelDot'
import { levelNameKey } from '../ui/LevelIndex'
import { StatNumber } from '../ui/StatNumber'
import { ActiveIntentionPanel } from './ActiveIntentionPanel'
import type { PopupViewModel, TopSiteRow } from './PopupViewModel'

export interface PopupViewProps {
  model: PopupViewModel
  clock: Clock
  levelsView: ChartView
  onLevelsViewChange: (view: ChartView) => void
  onEndIntention: () => void
  onAllowSites: () => void
  onOpenExtensionSettings: () => void
  onOpenSettings: () => void
  onOpenStats: () => void
}

/** The popup body (plan §8.2). There is deliberately no on/off switch. */
export function PopupView({
  model,
  clock,
  levelsView,
  onLevelsViewChange,
  onEndIntention,
  onAllowSites,
  onOpenExtensionSettings,
  onOpenSettings,
  onOpenStats,
}: PopupViewProps) {
  const { t, locale } = useI18n()
  const { intentions } = model
  const pulseContext = model.emptyDay
    ? t('popup.pulse.empty')
    : t('popup.pulse.context', { tracked: formatDuration(model.trackedSeconds, t, locale) })

  return (
    <div class="popup">
      {model.activeIntention ? (
        <ActiveIntentionPanel
          intention={model.activeIntention}
          clock={clock}
          onEnd={onEndIntention}
        />
      ) : null}

      <section class="popup__section">
        <StatNumber label={t('popup.pulse.label')} value={model.pulse} context={pulseContext} />
      </section>

      <section class="popup__section">
        <LevelBar
          title={t('popup.levels.title')}
          size="compact"
          minutes={model.minutesByLevel}
          uncategorisedMinutes={model.uncategorisedMinutes}
          view={levelsView}
          onViewChange={onLevelsViewChange}
        />
      </section>

      <section class="popup__section" aria-labelledby="popup-top-sites">
        <h2 id="popup-top-sites" class="popup__heading">
          {t('popup.topSites.title')}
        </h2>
        {model.topSites.length === 0 ? (
          <p class="popup__muted">{t('popup.topSites.empty')}</p>
        ) : (
          <DataTable<TopSiteRow>
            caption={t('popup.topSites.title')}
            density="compact"
            rows={model.topSites}
            rowKey={(row) => row.domain}
            columns={[
              { id: 'site', header: t('popup.topSites.site'), cell: (row) => row.domain },
              {
                id: 'minutes',
                header: t('popup.topSites.minutes'),
                align: 'end',
                cell: (row) => formatNumber(row.minutes, locale),
              },
              {
                id: 'level',
                header: t('popup.topSites.level'),
                cell: (row) => (
                  <span class="popup__level">
                    <LevelDot level={row.level} />
                    {t(levelNameKey(row.level))}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>

      <section class="popup__section">
        <p class="popup__summary">
          {intentions.total === 0 && intentions.closes === 0
            ? t('popup.intentions.none')
            : [
                t('popup.intentions.total', { count: intentions.total }),
                t('popup.intentions.kept', { count: intentions.kept }),
                t('popup.intentions.broken', { count: intentions.broken }),
                t('popup.intentions.closes', { count: intentions.closes }),
              ].join(' · ')}
        </p>
      </section>

      {model.warnings.length > 0 ? (
        <section class="popup__section popup__warnings">
          {model.warnings.includes('incognito') ? (
            <Banner
              tone="warning"
              message={t('popup.warning.incognito')}
              action={{
                label: t('popup.warning.incognitoAction'),
                onClick: onOpenExtensionSettings,
              }}
            />
          ) : null}
          {model.warnings.includes('permissions') ? (
            <Banner
              tone="warning"
              message={t('popup.warning.permissions')}
              action={{ label: t('popup.warning.permissionsAction'), onClick: onAllowSites }}
            />
          ) : null}
        </section>
      ) : null}

      <footer class="popup__footer">
        <Button variant="quiet" tone="muted" icon={Settings} onClick={onOpenSettings}>
          {t('popup.footer.settings')}
        </Button>
        <Button variant="quiet" tone="muted" icon={ChartColumn} onClick={onOpenStats}>
          {t('popup.footer.stats')}
        </Button>
      </footer>
    </div>
  )
}
