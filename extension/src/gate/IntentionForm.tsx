// SPDX-License-Identifier: AGPL-3.0-or-later
import { intentionRequirements, intentionWordCount } from '@monki-focus/engine'
import type { Gate } from '@monki-focus/rules/pure'
import { useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { SimpleKey } from '../i18n/t'
import {
  INTENTION_MINUTES,
  MAX_INTENTION_LENGTH,
  type CommitRejection,
  type IntentionMinutes,
} from '../shared/GateContract'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { TextField } from '../ui/TextField'

export interface IntentionFormProps {
  gate: Gate
  site: string
  exampleIndex: number
  /** Answers the reason a commit was refused, or null when it was accepted. */
  onCommit: (minutes: IntentionMinutes, intention: string) => Promise<CommitRejection | null>
}

const EXAMPLES: readonly SimpleKey[] = [
  'gate.intentionExample.0',
  'gate.intentionExample.1',
  'gate.intentionExample.2',
  'gate.intentionExample.3',
]

/**
 * After the pause: "What are you here for?" (optional at L0/L1, at least 3
 * words and different from last time from L2), a 5/10/15 minute choice
 * with no default (choosing is the commitment) and the secondary "Continue
 * to <site>", disabled until the choice is valid. `Enter` submits only from
 * the text field.
 */
export function IntentionForm({ gate, site, exampleIndex, onCommit }: IntentionFormProps) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState<IntentionMinutes | null>(null)
  const [rejection, setRejection] = useState<CommitRejection | null>(null)
  const [busy, setBusy] = useState(false)
  const required = gate.requiresTypedIntention
  // The engine's rule (§7.5); the service worker checks it again with the previous text.
  const wordsMissing = intentionWordCount(text) < intentionRequirements(gate).minWords
  const valid = minutes !== null && !wordsMissing
  const example = EXAMPLES[exampleIndex % EXAMPLES.length] ?? 'gate.intentionExample.0'

  const submit = () => {
    if (!valid || busy || minutes === null) return
    setBusy(true)
    void onCommit(minutes, text.slice(0, MAX_INTENTION_LENGTH))
      .then((refused) => setRejection(refused))
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }

  const hint = rejection
    ? t(
        rejection === 'intention.tooFewWords'
          ? 'gate.rejection.tooFewWords'
          : 'gate.rejection.sameAsLast'
      )
    : t(required ? 'gate.intentionHintRequired' : 'gate.intentionHintOptional')

  return (
    <section class="mf-gate__form">
      <TextField
        label={t('gate.intentionLabel')}
        value={text}
        onInput={(value) => {
          setText(value)
          setRejection(null)
        }}
        placeholder={t(example)}
        hint={hint}
        invalid={rejection !== null || (required && text.length > 0 && wordsMissing)}
        countWords={required}
        onSubmit={submit}
      />
      <Segmented
        label={t('gate.durationLabel')}
        labelVisible
        options={INTENTION_MINUTES.map((value) => ({
          value: String(value) as `${IntentionMinutes}`,
          label: t('gate.durationMinutes', { minutes: value }),
        }))}
        value={minutes === null ? null : (String(minutes) as `${IntentionMinutes}`)}
        onChange={(value) => setMinutes(Number(value) as IntentionMinutes)}
      />
      <Button
        variant="secondary"
        disabled={!valid || busy}
        {...(minutes === null
          ? { disabledReason: t('gate.chooseDuration') }
          : wordsMissing
            ? { disabledReason: t('gate.writeIntention') }
            : {})}
        onClick={submit}
      >
        {t('gate.continue', { site })}
      </Button>
    </section>
  )
}
