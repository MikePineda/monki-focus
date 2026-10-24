// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CategoryAssignment, CategoryLevel, Ruleset } from '@monki-focus/rules/pure'
import { useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { LevelDot } from '../../ui/LevelDot'
import { levelNameKey, type LevelIndex } from '../../ui/LevelIndex'
import { SelectField } from '../../ui/SelectField'
import { TextField } from '../../ui/TextField'
import {
  CATEGORY_LEVELS,
  parseDomainInput,
  removeCategory,
  setDomainCategory,
} from './RulesetEdits'
import { targetLabel } from './RuleText'

export interface CategoryRulesProps {
  ruleset: Ruleset
  onPropose: (next: Ruleset) => Promise<boolean>
}

const levelIndexOf = (level: CategoryLevel) => (level / 25) as LevelIndex

/** The user's own levels for sites (over the bundled defaults), on the five-step scale. */
export function CategoryRules({ ruleset, onPropose }: CategoryRulesProps) {
  const { t } = useI18n()
  const [domain, setDomain] = useState('')
  const [level, setLevel] = useState<CategoryLevel>(0)
  const [invalid, setInvalid] = useState(false)
  const rows = ruleset.categories.map((assignment, index) => ({ assignment, index }))
  const levelOptions = CATEGORY_LEVELS.map((value) => ({
    value: String(value),
    label: t(levelNameKey(levelIndexOf(value))),
  }))

  const add = async () => {
    const parsed = parseDomainInput(domain)
    setInvalid(parsed === null)
    if (parsed === null) return
    if (await onPropose(setDomainCategory(ruleset, parsed, level))) setDomain('')
  }

  return (
    <section class="options__block" aria-labelledby="options-categories">
      <h3 id="options-categories" class="options__subheading">
        {t('rules.categories.title')}
      </h3>
      <p class="options__muted">{t('rules.categories.body')}</p>
      {rows.length === 0 ? (
        <p class="options__muted">{t('rules.categories.empty')}</p>
      ) : (
        <DataTable<{ assignment: CategoryAssignment; index: number }>
          caption={t('rules.categories.title')}
          rows={rows}
          rowKey={({ index }) => String(index)}
          columns={[
            {
              id: 'target',
              header: t('rules.sites.target'),
              cell: ({ assignment }) => targetLabel(assignment.target, t),
            },
            {
              id: 'level',
              header: t('levelBar.levelHeader'),
              cell: ({ assignment }) => (
                <span class="options__level">
                  <LevelDot level={levelIndexOf(assignment.level)} />
                  {t(levelNameKey(levelIndexOf(assignment.level)))}
                </span>
              ),
            },
            {
              id: 'remove',
              header: t('rules.sites.actions'),
              cell: ({ assignment, index }) => (
                <Button
                  variant="quiet"
                  onClick={() => void onPropose(removeCategory(ruleset, index))}
                >
                  {t('rules.categories.remove', { target: targetLabel(assignment.target, t) })}
                </Button>
              ),
            },
          ]}
        />
      )}
      <form
        class="options__inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <div class="options__grid">
          <TextField
            label={t('rules.sites.domain')}
            value={domain}
            onInput={setDomain}
            placeholder={t('rules.sites.domainPlaceholder')}
            hint={t('rules.sites.domainHint')}
            invalid={invalid}
          />
          <SelectField<string>
            label={t('levelBar.levelHeader')}
            value={String(level)}
            onChange={(value) => setLevel(Number(value) as CategoryLevel)}
            options={levelOptions}
          />
        </div>
        <div class="options__actions">
          <Button variant="ink" type="submit">
            {t('rules.categories.set')}
          </Button>
        </div>
      </form>
    </section>
  )
}
