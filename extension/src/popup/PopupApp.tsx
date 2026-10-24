// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { OptionsSection } from '../options/OptionsApp'
import { useChartView } from '../pages/useChartView'
import type { Clock } from '../shared/clock'
import type { CommandClient } from '../shared/CommandClient'
import { configuredRuleset } from '../shared/RuleChangeContract'
import { missingOrigins, requiredOrigins, type PermissionsApi } from '../shared/SiteOrigins'
import { Banner } from '../ui/Banner'
import { popupViewModel, type PopupViewModel } from './PopupViewModel'
import { PopupView } from './PopupView'
import './Popup.css'

export interface PopupAppProps {
  client: CommandClient
  permissions: PermissionsApi
  clock: Clock
  /** Opens the options page at a section (`rules`, `stats`, ...). */
  openOptions: (section: OptionsSection) => void
  /** Opens the browser's page for this extension (incognito access lives there). */
  openExtensionSettings: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; model: PopupViewModel; missing: string[] }

/** Loads today's numbers, the intention (when E6 provides it) and the warnings. */
export function PopupApp({
  client,
  permissions,
  clock,
  openOptions,
  openExtensionSettings,
}: PopupAppProps) {
  const { t } = useI18n()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [levelsView, setLevelsView] = useChartView(client, 'todayLevels')

  const load = useCallback(async () => {
    try {
      const [today, incognito, intention, rules] = await Promise.all([
        client.send('stats.today', {}),
        client.send('privacy.incognitoAccess', {}).catch(() => null),
        client.send('intention.active', {}).catch(() => null),
        client.send('rules.state', {}).catch(() => null),
      ])
      const missing = await missingOrigins(
        permissions,
        requiredOrigins(rules ? configuredRuleset(rules) : null)
      )
      setState({
        status: 'ready',
        missing,
        model: popupViewModel({
          today,
          incognitoAllowed: incognito?.allowed ?? null,
          missingOrigins: missing,
          activeIntention: intention?.available ? intention.active : null,
        }),
      })
    } catch {
      setState({ status: 'failed' })
    }
  }, [client, permissions])

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'loading') return <p class="popup__muted">{t('popup.loading')}</p>
  if (state.status === 'failed') return <Banner tone="error" message={t('popup.loadFailed')} />

  const endIntention = () => {
    const active = state.model.activeIntention
    if (!active) return
    void client
      .send('intention.end', { targetGroup: active.targetGroup })
      .catch(() => undefined)
      .then(load)
  }
  const allowSites = () => {
    // Called straight from the click so the browser sees the user's gesture.
    void permissions
      .request({ origins: state.missing })
      .catch(() => false)
      .then(load)
  }

  return (
    <PopupView
      model={state.model}
      clock={clock}
      levelsView={levelsView}
      onLevelsViewChange={setLevelsView}
      onEndIntention={endIntention}
      onAllowSites={allowSites}
      onOpenExtensionSettings={openExtensionSettings}
      onOpenSettings={() => openOptions('rules')}
      onOpenStats={() => openOptions('stats')}
    />
  )
}
