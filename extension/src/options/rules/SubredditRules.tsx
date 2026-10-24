// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'
import { allowedSubreddits, allowSubreddit, parseSubredditName, removeRule } from './RulesetEdits'

export interface SubredditRulesProps {
  ruleset: Ruleset
  pendingIds: ReadonlySet<string>
  onPropose: (next: Ruleset) => Promise<boolean>
}

/** Reddit communities let through the friction: `allow` rules on `reddit.com/r/<name>/**`. */
export function SubredditRules({ ruleset, pendingIds, onPropose }: SubredditRulesProps) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)
  const communities = allowedSubreddits(ruleset)

  const add = async () => {
    const name = parseSubredditName(input)
    setInvalid(name === null)
    if (name === null) return
    if (await onPropose(allowSubreddit(ruleset, name))) setInput('')
  }

  return (
    <section class="options__block" aria-labelledby="options-subreddits">
      <h3 id="options-subreddits" class="options__subheading">
        {t('rules.subreddits.title')}
      </h3>
      <p class="options__muted">{t('rules.subreddits.body')}</p>
      {communities.length === 0 ? (
        <p class="options__muted">{t('rules.subreddits.empty')}</p>
      ) : (
        <ul class="options__list">
          {communities.map(({ rule, name }) => (
            <li key={rule.id} class="options__list-item">
              <span>
                {t('rules.subreddits.name', { name })}
                {pendingIds.has(rule.id) ? ` · ${t('rules.sites.waiting')}` : ''}
              </span>
              <Button variant="quiet" onClick={() => void onPropose(removeRule(ruleset, rule.id))}>
                {t('rules.subreddits.remove', { name })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        class="options__inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <TextField
          label={t('rules.subreddits.add')}
          value={input}
          onInput={setInput}
          placeholder={t('rules.subreddits.placeholder')}
          hint={t('rules.subreddits.hint')}
          invalid={invalid}
        />
        <div class="options__actions">
          <Button variant="ink" type="submit">
            {t('rules.subreddits.allow')}
          </Button>
        </div>
      </form>
    </section>
  )
}
