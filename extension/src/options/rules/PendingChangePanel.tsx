// SPDX-License-Identifier: AGPL-3.0-or-later
import { Clock } from 'lucide-preact'
import { formatInstantIn } from '../../i18n/formatTime'
import { useI18n } from '../../i18n/I18nContext'
import type { PendingRuleChange } from '../../shared/RuleChangeContract'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import type { PendingChange } from './PendingChanges'
import { targetLabel } from './RuleText'

export interface PendingChangePanelProps {
  pending: PendingRuleChange
  changes: readonly PendingChange[]
  timeZone: string
  onCancel: () => void
}

/**
 * The waiting (loosening) change: when it takes effect, what it changes, and
 * the one way out, cancelling it, which keeps what applies now.
 */
export function PendingChangePanel({
  pending,
  changes,
  timeZone,
  onCancel,
}: PendingChangePanelProps) {
  const { t, locale } = useI18n()
  const when = formatInstantIn(pending.effectiveFrom, timeZone, locale)
  return (
    <section class="options__pending" aria-labelledby="options-pending-title">
      <h3 id="options-pending-title" class="options__subheading">
        <Icon icon={Clock} />
        {t('rules.pending.title', { time: when })}
      </h3>
      <p class="options__muted">{t('rules.pending.body')}</p>
      <ul class="options__pending-list">
        {changes.map((change) => (
          <li key={'ruleId' in change ? `${change.kind}:${change.ruleId}` : change.kind}>
            {'ruleId' in change
              ? t(`rules.pending.${change.kind}`, { target: targetLabel(change.target, t) })
              : t(`rules.pending.${change.kind}`)}
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={onCancel}>
          {t('rules.pending.cancel')}
        </Button>
      </div>
    </section>
  )
}
