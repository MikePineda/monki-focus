// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Rule, RuleMode, Ruleset } from '@monki-focus/rules/pure'
import { useState } from 'preact/hooks'
import { formatNumber } from '../../i18n/formatNumber'
import { useI18n } from '../../i18n/I18nContext'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { SelectField } from '../../ui/SelectField'
import { TextField } from '../../ui/TextField'
import { RuleEditor } from './RuleEditor'
import {
  addSiteRule,
  allowedSubredditOf,
  parseDomainInput,
  removeRule,
  replaceRule,
  RULE_MODES,
} from './RulesetEdits'
import { modeNameKey, scheduleSummary, targetLabel } from './RuleText'

export interface SiteRulesProps {
  ruleset: Ruleset
  pendingIds: ReadonlySet<string>
  onPropose: (next: Ruleset) => Promise<boolean>
}

/** The rule list (target, mode, schedule, budget, waiting or not), an editor and "Add a site". */
export function SiteRules({ ruleset, pendingIds, onPropose }: SiteRulesProps) {
  const { t, locale } = useI18n()
  const [editing, setEditing] = useState<string | null>(null)
  const [domain, setDomain] = useState('')
  const [mode, setMode] = useState<RuleMode>('friction')
  const [domainInvalid, setDomainInvalid] = useState(false)
  // Community allow rules have their own editor below.
  const rules = ruleset.rules.filter((rule) => allowedSubredditOf(rule) === null)
  const editedRule = rules.find((rule) => rule.id === editing)

  const add = async () => {
    const parsed = parseDomainInput(domain)
    setDomainInvalid(parsed === null)
    if (parsed === null) return
    if (await onPropose(addSiteRule(ruleset, parsed, mode))) setDomain('')
  }

  return (
    <section class="options__block" aria-labelledby="options-site-rules">
      <h3 id="options-site-rules" class="options__subheading">
        {t('rules.sites.title')}
      </h3>
      <DataTable<Rule>
        caption={t('rules.sites.title')}
        rows={rules}
        rowKey={(rule) => rule.id}
        columns={[
          {
            id: 'target',
            header: t('rules.sites.target'),
            cell: (rule) => targetLabel(rule.target, t),
          },
          {
            id: 'mode',
            header: t('rules.sites.mode'),
            cell: (rule) =>
              rule.enabled
                ? t(modeNameKey(rule.mode))
                : t('rules.sites.off', { mode: t(modeNameKey(rule.mode)) }),
          },
          {
            id: 'schedule',
            header: t('rules.sites.schedule'),
            cell: (rule) => scheduleSummary(rule.schedules, t, locale),
          },
          {
            id: 'budget',
            header: t('rules.sites.budget'),
            align: 'end',
            cell: (rule) =>
              rule.dailyBudgetMinutes === undefined
                ? t('rules.sites.noBudget')
                : formatNumber(rule.dailyBudgetMinutes, locale),
          },
          {
            id: 'status',
            header: t('rules.sites.status'),
            cell: (rule) =>
              pendingIds.has(rule.id) ? t('rules.sites.waiting') : t('rules.sites.inForce'),
          },
          {
            id: 'edit',
            header: t('rules.sites.actions'),
            cell: (rule) => (
              <Button variant="quiet" onClick={() => setEditing(rule.id)}>
                {t('rules.sites.edit', { target: targetLabel(rule.target, t) })}
              </Button>
            ),
          },
        ]}
      />
      {editedRule ? (
        <RuleEditor
          key={editedRule.id}
          rule={editedRule}
          onCancel={() => setEditing(null)}
          onSave={(rule) =>
            void onPropose(replaceRule(ruleset, rule)).then((saved) => {
              if (saved) setEditing(null)
            })
          }
          onDelete={(rule) =>
            void onPropose(removeRule(ruleset, rule.id)).then((saved) => {
              if (saved) setEditing(null)
            })
          }
        />
      ) : null}
      <form
        class="options__inline-form"
        aria-labelledby="options-add-site"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <h4 id="options-add-site" class="options__subheading">
          {t('rules.sites.addTitle')}
        </h4>
        <div class="options__grid">
          <TextField
            label={t('rules.sites.domain')}
            value={domain}
            onInput={setDomain}
            placeholder={t('rules.sites.domainPlaceholder')}
            hint={t('rules.sites.domainHint')}
            invalid={domainInvalid}
          />
          <SelectField<RuleMode>
            label={t('rules.editor.mode')}
            value={mode}
            onChange={setMode}
            options={RULE_MODES.map((value) => ({ value, label: t(modeNameKey(value)) }))}
          />
        </div>
        <div class="options__actions">
          <Button variant="ink" type="submit">
            {t('rules.sites.add')}
          </Button>
        </div>
      </form>
    </section>
  )
}
