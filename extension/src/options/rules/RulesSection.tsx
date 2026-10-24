// SPDX-License-Identifier: AGPL-3.0-or-later
import { formatInstantIn } from '../../i18n/formatTime'
import { useI18n } from '../../i18n/I18nContext'
import type { Translate } from '../../i18n/t'
import type { DownloadFile } from '../../pages/FileDownload'
import type { CommandClient } from '../../shared/CommandClient'
import { configuredRuleset } from '../../shared/RuleChangeContract'
import type { PermissionsApi } from '../../shared/SiteOrigins'
import { Banner } from '../../ui/Banner'
import type { Locale } from '../../i18n/locale'
import { CategoryRules } from './CategoryRules'
import { PendingChangePanel } from './PendingChangePanel'
import { pendingChanges, pendingRuleIds } from './PendingChanges'
import { RulesetTransfer } from './RulesetTransfer'
import { ScheduleSettings } from './ScheduleSettings'
import { SiteRules } from './SiteRules'
import { SubredditRules } from './SubredditRules'
import { useRuleChanges, type SaveFeedback } from './useRuleChanges'
import { useState } from 'preact/hooks'
import type { RejectionCode } from '@monki-focus/rules/pure'

export interface RulesSectionProps {
  client: CommandClient
  permissions: PermissionsApi
  download: DownloadFile
}

function feedbackText(feedback: SaveFeedback, t: Translate, locale: Locale, timeZone: string) {
  switch (feedback.kind) {
    case 'applied':
      return t('rules.feedback.applied')
    case 'cancelled':
      return t('rules.feedback.cancelled')
    case 'pending':
      return t('rules.feedback.pending', {
        time: formatInstantIn(feedback.effectiveFrom, timeZone, locale),
      })
    case 'rejected':
      return t(`rules.rejected.${feedback.code}`)
  }
}

/**
 * The rule editor. Every save sends the whole edited set to the service
 * worker, which applies the engine's rule-change policy: what tightens
 * applies now, what loosens waits and shows here until it takes effect.
 */
export function RulesSection({ client, permissions, download }: RulesSectionProps) {
  const { t, locale } = useI18n()
  const changes = useRuleChanges(client, permissions)
  const [importProblem, setImportProblem] = useState<RejectionCode | null>(null)
  const { state } = changes

  if (changes.loadFailed) return <Banner tone="error" message={t('rules.loadFailed')} />
  if (state === null) return <p class="options__muted">{t('options.loading')}</p>

  const configured = configuredRuleset(state)
  const waiting = state.pending ? pendingChanges(state.effective, configured) : []
  const pendingIds = pendingRuleIds(waiting)
  const propose = (next: typeof configured) => {
    setImportProblem(null)
    return changes.propose(next)
  }
  // Remount the editors when the configured set changes so their drafts start over.
  const key = `${configured.revision}:${state.pending?.effectiveFrom ?? ''}`
  const feedback = importProblem
    ? t(`rules.rejected.${importProblem}`)
    : changes.feedback
      ? feedbackText(changes.feedback, t, locale, configured.timeZone)
      : null

  return (
    <div class="options__section-body">
      <p class="options__muted">{t('rules.intro')}</p>
      <div role="status" class="options__feedback">
        {feedback ? (
          <Banner
            tone={importProblem || changes.feedback?.kind === 'rejected' ? 'error' : 'notice'}
            message={feedback}
          />
        ) : null}
      </div>
      {state.pending ? (
        <PendingChangePanel
          pending={state.pending}
          changes={waiting}
          timeZone={configured.timeZone}
          onCancel={() => void changes.cancelPending()}
        />
      ) : null}
      <SiteRules
        key={`sites-${key}`}
        ruleset={configured}
        pendingIds={pendingIds}
        onPropose={propose}
      />
      <SubredditRules
        key={`subs-${key}`}
        ruleset={configured}
        pendingIds={pendingIds}
        onPropose={propose}
      />
      <ScheduleSettings key={`schedules-${key}`} ruleset={configured} onPropose={propose} />
      <CategoryRules key={`categories-${key}`} ruleset={configured} onPropose={propose} />
      <RulesetTransfer
        ruleset={configured}
        onPropose={propose}
        onInvalidImport={setImportProblem}
        download={download}
      />
    </div>
  )
}
