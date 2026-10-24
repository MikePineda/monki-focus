// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TargetedEvent } from 'preact'
import { useId } from 'preact/hooks'
import './FormControl.css'

export interface InputFieldProps {
  /** Already translated label, shown above the field. */
  label: string
  /** `time` (HH:MM, the browser's time picker) or `number` (whole numbers). */
  type: 'time' | 'number'
  value: string
  onInput: (value: string) => void
  min?: number
  max?: number
  hint?: string
}

/** A native time or number input in the shared field style. */
export function InputField({ label, type, value, onInput, min, max, hint }: InputFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div class="mf-field">
      <label class="mf-field__label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="mf-field__control"
        type={type}
        value={value}
        min={min}
        max={max}
        step={type === 'number' ? 1 : 60}
        inputMode={type === 'number' ? 'numeric' : undefined}
        aria-describedby={hint ? hintId : undefined}
        onInput={(event: TargetedEvent<HTMLInputElement>) => onInput(event.currentTarget.value)}
      />
      {hint ? (
        <p id={hintId} class="mf-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
