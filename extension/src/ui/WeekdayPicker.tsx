// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Weekday } from '@monki-focus/rules/pure'
import { useI18n } from '../i18n/I18nContext'
import { Checkbox } from './Checkbox'
import './FormControl.css'

/** Monday first, the order of every week in the product. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface WeekdayPickerProps {
  /** Already translated group label ("Days"). */
  label: string
  value: readonly Weekday[]
  onChange: (days: Weekday[]) => void
}

/** Seven checkboxes in a fieldset; the result keeps Monday-first order. */
export function WeekdayPicker({ label, value, onChange }: WeekdayPickerProps) {
  const { t } = useI18n()
  const toggle = (day: Weekday, checked: boolean) => {
    const next = new Set(value)
    if (checked) next.add(day)
    else next.delete(day)
    onChange(WEEKDAYS.filter((candidate) => next.has(candidate)))
  }
  return (
    <fieldset class="mf-fieldset">
      <legend class="mf-fieldset__legend">{label}</legend>
      <div class="mf-fieldset__options">
        {WEEKDAYS.map((day) => (
          <Checkbox
            key={day}
            label={t(`weekday.${day}`)}
            checked={value.includes(day)}
            onChange={(checked) => toggle(day, checked)}
          />
        ))}
      </div>
    </fieldset>
  )
}
