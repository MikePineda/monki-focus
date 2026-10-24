// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Rule, RuleMode, RuleSchedule, Schedule } from '@monki-focus/rules/pure'
import { useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { InputField } from '../../ui/InputField'
import { SelectField } from '../../ui/SelectField'
import { WeekdayPicker } from '../../ui/WeekdayPicker'
import { RULE_MODES } from './RulesetEdits'
import { modeNameKey, targetLabel } from './RuleText'

type ScheduleKind = 'always' | 'workHours' | 'custom'

const DEFAULT_WINDOW: Schedule = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  start: '09:00',
  end: '17:00',
}

function scheduleKindOf(schedules: readonly RuleSchedule[]): ScheduleKind {
  if (schedules.length === 0) return 'always'
  return schedules.every((schedule) => 'ref' in schedule) ? 'workHours' : 'custom'
}

function firstWindow(schedules: readonly RuleSchedule[]): Schedule {
  return schedules.find((schedule): schedule is Schedule => !('ref' in schedule)) ?? DEFAULT_WINDOW
}

export interface RuleEditorProps {
  rule: Rule
  onSave: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  onCancel: () => void
}

/** Edits one rule: mode, daily budget, when it applies, on or off. */
export function RuleEditor({ rule, onSave, onDelete, onCancel }: RuleEditorProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<RuleMode>(rule.mode)
  const [budget, setBudget] = useState(rule.dailyBudgetMinutes?.toString() ?? '')
  const [kind, setKind] = useState<ScheduleKind>(scheduleKindOf(rule.schedules))
  const [customWindow, setCustomWindow] = useState<Schedule>(firstWindow(rule.schedules))
  const [enabled, setEnabled] = useState(rule.enabled)

  const save = () => {
    const next: Rule = { ...rule, mode, enabled }
    const minutes = Number.parseInt(budget, 10)
    if (budget.trim() === '') delete next.dailyBudgetMinutes
    else next.dailyBudgetMinutes = Number.isNaN(minutes) ? Number(budget) : minutes
    next.schedules =
      kind === 'always' ? [] : kind === 'workHours' ? [{ ref: 'workHours' }] : [customWindow]
    onSave(next)
  }

  return (
    <form
      class="options__editor"
      aria-label={t('rules.editor.label', { target: targetLabel(rule.target, t) })}
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h4 class="options__subheading">{targetLabel(rule.target, t)}</h4>
      <div class="options__grid">
        <SelectField<RuleMode>
          label={t('rules.editor.mode')}
          value={mode}
          onChange={setMode}
          options={RULE_MODES.map((value) => ({ value, label: t(modeNameKey(value)) }))}
          hint={t(`rules.modeHint.${mode}`)}
        />
        <InputField
          type="number"
          label={t('rules.editor.budget')}
          value={budget}
          onInput={setBudget}
          min={1}
          max={1440}
          hint={t('rules.editor.budgetHint')}
        />
        <SelectField<ScheduleKind>
          label={t('rules.editor.schedule')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'always', label: t('schedule.always') },
            { value: 'workHours', label: t('schedule.workHours') },
            { value: 'custom', label: t('schedule.custom') },
          ]}
        />
      </div>
      {kind === 'custom' ? (
        <div class="options__grid">
          <WeekdayPicker
            label={t('schedule.days')}
            value={customWindow.days}
            onChange={(days) => setCustomWindow({ ...customWindow, days })}
          />
          <InputField
            type="time"
            label={t('schedule.start')}
            value={customWindow.start}
            onInput={(start) => setCustomWindow({ ...customWindow, start })}
          />
          <InputField
            type="time"
            label={t('schedule.end')}
            value={customWindow.end}
            onInput={(end) => setCustomWindow({ ...customWindow, end })}
          />
        </div>
      ) : null}
      <Checkbox label={t('rules.editor.enabled')} checked={enabled} onChange={setEnabled} />
      <div class="options__actions">
        <Button variant="ink" type="submit">
          {t('rules.editor.save')}
        </Button>
        <Button variant="secondary" onClick={() => onDelete(rule)}>
          {t('rules.editor.delete')}
        </Button>
        <Button variant="quiet" tone="muted" onClick={onCancel}>
          {t('rules.editor.cancel')}
        </Button>
      </div>
    </form>
  )
}
