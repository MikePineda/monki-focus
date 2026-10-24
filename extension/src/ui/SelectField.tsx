// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TargetedEvent } from 'preact'
import { useId } from 'preact/hooks'
import './FormControl.css'

export interface SelectOption<T extends string> {
  value: T
  /** Already translated option label. */
  label: string
}

export interface SelectFieldProps<T extends string> {
  /** Already translated label, shown above the select. */
  label: string
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  hint?: string
}

/** A native `<select>` (keyboard and screen-reader behaviour from the browser). */
export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div class="mf-field">
      <label class="mf-field__label" for={id}>
        {label}
      </label>
      <select
        id={id}
        class="mf-field__control"
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event: TargetedEvent<HTMLSelectElement>) =>
          onChange(event.currentTarget.value as T)
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} class="mf-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
